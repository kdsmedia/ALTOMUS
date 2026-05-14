const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Server: SocketIOServer } = require('socket.io');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));

const publicDir = path.join(__dirname, 'public');

// Serve at both root (direct port access) and /tapmus/ (via proxy)
app.use(express.static(publicDir));
app.use('/tapmus', express.static(publicDir));

app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/tapmus', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/tapmus/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

// ────────────────────────────────────────────────
// HTTP SERVER (shared by WS + Socket.IO)
// ────────────────────────────────────────────────
const server = http.createServer(app);

// ════════════════════════════════════════════════
//  GAME 1 — BulTok  (plain WebSocket  /ws)
// ════════════════════════════════════════════════
let userLikes  = {};
let userGifts  = {};
let userShares = {};

const profilePictures = [
    'bg/bg1.jpeg', 'bg/bg2.png', 'bg/bg3.jpg', 'bg/bg4.jpeg', 'bg/bg5.jpg',
];

let bultokConnection  = null;
let currentWebSocket  = null;

function getProfilePicUrl(user) {
    if (!user) return '';
    const pic = user.profilePicture || user.profilePictureMedium || user.profilePictureLarge;
    if (pic && pic.url && pic.url.length > 0) return pic.url[0];
    if (pic && pic.mUri) return pic.mUri;
    return '';
}

const soundMapping = {
    '2':  'sounds/2.mp3',
    '3':  'sounds/3.mp3',
    '5':  'sounds/5.mp3',
    '11': 'sounds/11.mp3',
    'a':  'sounds/a.mp3',
    'm':  'sounds/2.mp3',
    'assalamualaikum':   'sounds/salam.mp3',
    "assalamu'alaikum": 'sounds/salam.mp3',
    'assalamu alaikum': 'sounds/salam.mp3',
    'taptap yuk':       'sounds/kentut.mp3',
    'halo':             'sounds/hallo.mp3',
    'anjay':            'sounds/anjay.mp3',
};

function sendToClient(data) {
    if (currentWebSocket && currentWebSocket.readyState === WebSocket.OPEN) {
        currentWebSocket.send(JSON.stringify(data));
    }
}

function bultokMemberJoin(data) {
    const username = data.user?.uniqueId || 'unknown';
    const picUrl   = getProfilePicUrl(data.user) || '';
    sendToClient({ type: 'floating-photo', profilePictureUrl: picUrl, userName: username });
    sendToClient({ type: 'play-sound', sound: 'sounds/hallo.mp3' });
}

function bultokGift(data) {
    const username    = data.user?.uniqueId || 'unknown';
    const picUrl      = getProfilePicUrl(data.user) || '';
    const giftType    = data.giftDetails?.giftType ?? 0;
    const repeatEnd   = data.repeatEnd;
    const repeatCount = data.repeatCount || 1;
    const diamonds    = data.giftDetails?.diamondCount ?? 0;
    if (giftType === 1 && !repeatEnd) return;
    userGifts[username] = (userGifts[username] || 0) + repeatCount * diamonds;
    sendToClient({ type: 'big-photo', profilePictureUrl: picUrl, userName: username });
    sendToClient({ type: 'play-sound', sound: 'sounds/winner.mp3' });
}

function bultokLike(data) {
    const username  = data.user?.uniqueId || 'unknown';
    const picUrl    = getProfilePicUrl(data.user) || '';
    const likeCount = data.likeCount || 1;
    userLikes[username] = (userLikes[username] || 0) + likeCount;
    const max = Math.min(likeCount, 5);
    for (let i = 0; i < max; i++) {
        setTimeout(() => sendToClient({ type: 'floating-photo', profilePictureUrl: picUrl, userName: username }), i * 400);
    }
    if (likeCount > 10) sendToClient({ type: 'play-sound', sound: 'sounds/winner.mp3' });
}

function bultokShare(data) {
    const username = data.user?.uniqueId || 'unknown';
    const picUrl   = getProfilePicUrl(data.user) || '';
    userShares[username] = (userShares[username] || 0) + 1;
    sendToClient({ type: 'floating-photo', profilePictureUrl: picUrl, userName: username });
    sendToClient({ type: 'play-sound', sound: 'sounds/kentut.mp3' });
}

function bultokChat(data) {
    const username    = data.user?.uniqueId || 'unknown';
    const comment     = data.comment || '';
    const commentLow  = comment.trim().toLowerCase();
    sendToClient({ type: 'chat', userName: username, comment });
    if (soundMapping[commentLow]) sendToClient({ type: 'play-sound', sound: soundMapping[commentLow] });
    if (commentLow === 'ganti')   sendToClient({ type: 'stop-sound' });
}

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
    currentWebSocket = ws;
    console.log('[bultok] WebSocket client connected');

    ws.on('message', async (raw) => {
        let data;
        try { data = JSON.parse(raw); } catch { return; }

        if (data.type === 'connect') {
            const username = data.username;
            console.log(`[bultok] Connecting to @${username}`);
            if (bultokConnection) {
                try { bultokConnection.disconnect(); } catch (_) {}
                bultokConnection = null;
            }
            try {
                bultokConnection = new TikTokLiveConnection(username);
                const state = await bultokConnection.connect();
                sendToClient({ type: 'status', message: `Terhubung ke @${username} (roomId: ${state.roomId})` });
                bultokConnection.on('disconnected',  () => sendToClient({ type: 'status', message: 'Terputus dari Live.' }));
                bultokConnection.on('streamEnd',     () => sendToClient({ type: 'status', message: 'Live telah berakhir.' }));
                bultokConnection.on('error',         (e) => console.error('[bultok] error:', e?.message));
                bultokConnection.on('member',        bultokMemberJoin);
                bultokConnection.on('gift',          bultokGift);
                bultokConnection.on('like',          bultokLike);
                bultokConnection.on('share',         bultokShare);
                bultokConnection.on('chat',          bultokChat);
                bultokConnection.on('envelope',      (d) => sendToClient({ type: 'envelope-event', data: d }));
                bultokConnection.on('roomUser',      (d) => sendToClient({ type: 'roomUser', viewerCount: d.viewerCount }));
            } catch (e) {
                sendToClient({ type: 'status', message: `Gagal koneksi ke @${username}: ${e?.message || e}` });
            }
        }
    });

    ws.on('close', () => {
        console.log('[bultok] WebSocket client disconnected');
        if (currentWebSocket === ws) currentWebSocket = null;
    });
    ws.on('error', (e) => console.error('[bultok] ws error:', e.message));
});

// ════════════════════════════════════════════════
//  GAME 2 — PrintOK  (Socket.IO  /printok)
// ════════════════════════════════════════════════
const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    path: '/printok/socket.io',
});

io.on('connection', (socket) => {
    console.log('[printok] Socket.IO client connected:', socket.id);
    let printokConn = null;

    socket.on('setUniqueId', async (uniqueId, options) => {
        if (typeof options === 'object' && options) {
            delete options.requestOptions;
            delete options.websocketOptions;
        }

        if (printokConn) {
            try { printokConn.disconnect(); } catch (_) {}
            printokConn = null;
        }

        console.log(`[printok] Connecting @${uniqueId}`);
        try {
            printokConn = new TikTokLiveConnection(uniqueId, options || {});
            const state = await printokConn.connect();
            console.log(`[printok] Connected roomId: ${state.roomId}`);
            socket.emit('tiktokConnected', state);

            // Normalise v2 data for printok frontend (expects flat-ish shape)
            const normalise = (data) => ({
                ...data,
                uniqueId:          data.user?.uniqueId || '',
                nickname:          data.user?.nickname || '',
                profilePictureUrl: getProfilePicUrl(data.user),
            });

            printokConn.on(WebcastEvent.STREAM_END, () => {
                socket.emit('streamEnd');
                printokConn = null;
            });
            printokConn.on(WebcastEvent.DISCONNECTED, () => {
                socket.emit('tiktokDisconnected', 'Disconnected');
            });
            printokConn.on(WebcastEvent.ERROR, (e) => console.error('[printok] error:', e?.message));

            printokConn.on('roomUser',  (d) => socket.emit('roomUser', normalise(d)));
            printokConn.on('member',    (d) => socket.emit('member',   normalise(d)));
            printokConn.on('chat',      (d) => socket.emit('chat',     normalise(d)));
            printokConn.on('gift',      (d) => {
                const nd = normalise(d);
                // Expose gift info in shape printok app.js expects
                nd.giftType   = d.giftDetails?.giftType   ?? d.giftType   ?? 0;
                nd.repeatEnd  = d.repeatEnd;
                nd.gift       = { name: d.giftDetails?.giftName || 'Gift', diamondCount: d.giftDetails?.diamondCount || 0 };
                socket.emit('gift', nd);
            });
            printokConn.on('share',     (d) => socket.emit('social',   normalise(d)));
            printokConn.on('like',      (d) => socket.emit('like',     normalise(d)));

        } catch (e) {
            console.error('[printok] Connection failed:', e?.message);
            socket.emit('tiktokDisconnected', e?.message || String(e));
        }
    });

    socket.on('disconnect', () => {
        console.log('[printok] Socket.IO client disconnected:', socket.id);
        if (printokConn) {
            try { printokConn.disconnect(); } catch (_) {}
            printokConn = null;
        }
    });
});

// ════════════════════════════════════════════════
//  GAME 3 — MusicLive  (plain WebSocket  /musiklive-ws)
// ════════════════════════════════════════════════
const musikWss = new WebSocket.Server({ server, path: '/musiklive-ws' });

// Sound mapping: comment → file served from /musiklive/sounds/
const musikSoundMap = {};
for (let i = 0; i <= 39; i++) musikSoundMap[String(i)] = `musiklive/sounds/${i}.mp3`;
musikSoundMap['king'] = 'musiklive/sounds/stop.mp3';
musikSoundMap['fyp']  = 'musiklive/sounds/telolet.mp3';

musikWss.on('connection', (ws) => {
    console.log('[musiklive] WebSocket client connected');
    let musikConn = null;

    function sendM(data) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    }

    ws.on('message', async (raw) => {
        let data;
        try { data = JSON.parse(raw); } catch { return; }

        if (data.type === 'connect') {
            const username = data.username;
            console.log(`[musiklive] Connecting to @${username}`);
            if (musikConn) { try { musikConn.disconnect(); } catch (_) {} musikConn = null; }

            try {
                musikConn = new TikTokLiveConnection(username);
                const state = await musikConn.connect();
                sendM({ type: 'status', message: `🎵 Terhubung ke @${username} (roomId: ${state.roomId})` });

                musikConn.on('disconnected', () => sendM({ type: 'status', message: '🔴 Terputus dari Live.' }));
                musikConn.on('streamEnd',    () => sendM({ type: 'status', message: '🔴 Live telah berakhir.' }));
                musikConn.on('error',        (e) => console.error('[musiklive] error:', e?.message));

                musikConn.on('member', (d) => {
                    const u = d.user?.uniqueId || 'unknown';
                    const p = getProfilePicUrl(d.user) || '';
                    sendM({ type: 'floating-photo', profilePictureUrl: p, userName: u });
                });

                musikConn.on('gift', (d) => {
                    const u  = d.user?.uniqueId || 'unknown';
                    const p  = getProfilePicUrl(d.user) || '';
                    const gt = d.giftDetails?.giftType ?? 0;
                    if (gt === 1 && !d.repeatEnd) return;
                    sendM({ type: 'big-photo', profilePictureUrl: p, userName: u });
                });

                musikConn.on('like', (d) => {
                    const u = d.user?.uniqueId || 'unknown';
                    const p = getProfilePicUrl(d.user) || '';
                    const n = Math.min(d.likeCount || 1, 5);
                    for (let i = 0; i < n; i++) {
                        setTimeout(() => sendM({ type: 'floating-photo', profilePictureUrl: p, userName: u }), i * 500);
                    }
                });

                musikConn.on('share', (d) => {
                    const u = d.user?.uniqueId || 'unknown';
                    const p = getProfilePicUrl(d.user) || '';
                    sendM({ type: 'floating-photo', profilePictureUrl: p, userName: u });
                });

                musikConn.on('chat', (d) => {
                    const comment  = (d.comment || '').trim();
                    const key      = comment.toLowerCase();
                    const soundFile = musikSoundMap[key];
                    if (soundFile) {
                        sendM({ type: 'play-sound', sound: soundFile });
                    }
                    if (key === 'ganti' || key === 'stop') {
                        sendM({ type: 'stop-sound' });
                    }
                });

            } catch (e) {
                sendM({ type: 'status', message: `❌ Gagal koneksi ke @${username}: ${e?.message || e}` });
            }
        }
    });

    ws.on('close', () => {
        console.log('[musiklive] WebSocket client disconnected');
        if (musikConn) { try { musikConn.disconnect(); } catch (_) {} musikConn = null; }
    });
    ws.on('error', (e) => console.error('[musiklive] ws error:', e.message));
});

// Broadcast global stats every 5 s
setInterval(() => {
    const count = wss.clients.size + io.engine.clientsCount + musikWss.clients.size;
    io.emit('statistic', { globalConnectionCount: count });
}, 5000);

// ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`ALTOMUS server running on port ${PORT}`);
    console.log(`tiktok-live-connector: ${require('./node_modules/tiktok-live-connector/package.json').version}`);
    console.log(`socket.io:            ${require('./node_modules/socket.io/package.json').version}`);
});
