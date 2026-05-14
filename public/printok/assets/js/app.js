// DATA
let connection = new TikTokIOConnection(undefined);
let gameWords = [];
let gameSelectedWord = null;
let gameTimer = null;
let gameStatus = false;

// Config
let confComment = false;
let confLike = false;
let confShare = false;
let confJoin = false;

// START
$(document).ready(() => {
    // Resize
    function resizeContainer() {
        let height = window.innerHeight;
        let width = Math.round((9 / 16) * height);
        $("#gameSize").html(width + 'x' + height);
        $(".container").outerWidth(width);
        $(".background").outerWidth(width);
        $(".printer").outerWidth(width);
        $(".animation").outerWidth(width);

        if (window.innerWidth >= 1366) {
            var paperHeight = $("#paperContainer").outerHeight() - 20;
        } else {
            var paperHeight = $("#paperContainer").outerHeight() + 7;
        }
        $("#paper").outerHeight(paperHeight);
    }
    resizeContainer();
    $(window).resize(function() { resizeContainer(); });

    // Connect button
    $("#targetConnect").click(function(e) {
        if (gameStatus) {
            let targetLive = $("#targetUsername").val().trim().replace(/^@/, '');
            if (targetLive) {
                connect(targetLive);
            } else {
                alert('Masukkan username TikTok!');
            }
        } else {
            alert("Mulai game terlebih dahulu!");
        }
    });

    // Start game
    $("#btnPrepare").click(function(e) {
        playSound(1);
        playSound(2);
        playSound(3);
        playSound(4);
        speakTTS(MSG_TEST);

        for (let i = 0; i < 30; i++) {
            addContent("<div style='text-align:center;'>Welcome 🥳🥳🥳</div>");
        }

        loadGame();
        loadSetting();
        gameStatus = true;
    });

    // Save config
    $("#btnSave").click(function(e) { loadSetting(); });

    // Audio unlock on first click (bypass autoplay policy)
    $(document).one('click', function() {
        ["sfx1","sfx2","sfx3","sfx4"].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.volume = 0; el.play().catch(()=>{}); el.pause(); el.volume = 1; }
        });
    });
});

/*
* GAME PLAY
*/

function speakTTS(msg) {
    speak(msg, { amplitude: 100, pitch: 100, speed: 150, wordgap: 5 });
}

function censor(word) {
    let censored = [];
    let length = word.length;
    let target = Math.ceil(length / 2);
    let range_start = 2;
    let range_end = target;
    for (let i = 0; i < length; i++) {
        let c = word.charAt(i);
        censored.push((i >= range_start && i <= range_end) ? "*" : c);
    }
    return censored.join("");
}

function copyArray(a) {
    let b = [];
    for (let i = 0; i < a.length; i++) { b[i] = a[i]; }
    return b;
}

function shuffle(a) {
    let j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return copyArray(a);
}

function countDown() {
    let timeleft = 60 * 5;
    if (gameTimer != null) clearInterval(gameTimer);
    gameTimer = setInterval(function() {
        if (timeleft <= 0) { clearInterval(gameTimer); loadGame(); }
        $("#gameTimeout").html(timeleft.toLocaleString() + "s");
        timeleft -= 1;
    }, 1000);
}

function loadGame() {
    if (gameWords.length < 1) { gameWords = shuffle(WORDS); }
    gameSelectedWord = gameWords.pop();
    $("#gameWords").html(gameWords.length);

    if (typeof gameSelectedWord === 'string') {
        let splittedWord = gameSelectedWord.split("|");
        gameSelectedWord = splittedWord[1];
        $("#textGuess").html(
            "<div style='font-size:70%;padding-bottom:5px;'>" + splittedWord[0] + "</div>" +
            censor(gameSelectedWord)
        );
        countDown();
    } else {
        loadGame();
    }
}

function checkWinner(data, msg) {
    if (typeof gameSelectedWord === 'string' && typeof msg === 'string') {
        if (gameSelectedWord.trim().toLowerCase() == msg.trim().toLowerCase()) {
            addPhoto(data, "winner");
            playSound(4);
            let userName = resolveUsername(data);
            let tssMsg = MSG_WINNER.replace("|username|", userName);
            speakTTS(tssMsg);
            loadGame();
        }
    }
}

function loadSetting() {
    confComment = $("#confComment").prop('checked');
    confLike    = $("#confLike").prop('checked');
    confShare   = $("#confShare").prop('checked');
    confJoin    = $("#confJoin").prop('checked');
}

/*
* LIVE TIKTOK
*/

// Resolve the display username from normalized server data
function resolveUsername(data) {
    return data.uniqueId || data.nickname ||
           (data.user && (data.user.uniqueId || data.user.nickname)) ||
           'Unknown';
}

// Resolve profile picture URL — server sets data.profilePictureUrl at top level
function resolveProfilePic(data) {
    return data.profilePictureUrl ||
           (data.user && data.user.profilePictureUrl) ||
           '/printok/assets/img/image.png';
}

function connect(targetLive) {
    if (targetLive !== '') {
        setStateText('Menghubungkan...', 'normal');
        $("#usernameTarget").html("@" + targetLive);
        connection.connect(targetLive, {
            enableExtendedGiftInfo: true
        }).then(state => {
            setStateText('Terhubung ✅', 'ok');
        }).catch(errorMessage => {
            setStateText('Gagal: ' + (errorMessage || 'Error'), 'err');
        });
    } else {
        alert('Masukkan username TikTok terlebih dahulu!');
    }
}

function setStateText(text, cls) {
    const el = document.getElementById('stateText');
    if (!el) return;
    el.textContent = text;
    el.className = cls || '';
}

function sanitize(text) {
    return String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

function playSound(mode) {
    const el = document.getElementById("sfx" + mode);
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
}

function addContent(payload) {
    let content = $('#paper');
    content.append("<div class='item'>" + payload + "</div>");
    content.animate({ scrollTop: content.get(0).scrollHeight }, 333);
}

function addMessage(data, msg) {
    let userName = resolveUsername(data);
    let message  = sanitize(msg);

    let command = message.split(" ")[0];
    if (command === "/say" || command === "/ngomong") {
        let cleanText = message.replace("/say", "").replace("/ngomong", "").trim();
        speakTTS(cleanText);
    } else {
        if (confComment) {
            addContent("<span style='font-weight:bold;'>" + userName + "</span>: " + message);
            playSound(1);
        }
    }
}

function addGift(data) {
    let userName    = resolveUsername(data);
    let giftName    = data.gift && data.gift.name ? data.gift.name : 'gift';
    let repeatCount = data.repeatCount || 1;
    let msg;
    if (typeof MSG_GIFT !== 'undefined') {
        msg = MSG_GIFT.replace('|username|', userName);
    } else {
        msg = userName + ' memberi gift!';
    }
    msg += ` <span class='gift-highlight'>🎁 ${repeatCount} × ${sanitize(giftName)}</span>`;
    addContent(`<span class='gift-message'>${msg}</span>`);
    playSound(2);
}

function addPhoto(data, reason) {
    let userName = resolveUsername(data);
    let photoUrl = resolveProfilePic(data);
    let label    = reason === 'winner' ? '🏆 Pemenang!' : '';
    addContent(
        `<span class='photo-message'>` +
        `<img src='${photoUrl}' alt='${sanitize(userName)}' class='profile-photo' ` +
        `onerror="this.src='/printok/assets/img/image.png'"/>` +
        ` <span class='photo-label'>${label}</span>` +
        ` <span class='photo-username'>${sanitize(userName)}</span></span>`
    );
}

// ── Socket.IO Event Listeners ──────────────────────────────────────────────

connection.on('chat', (data) => {
    addMessage(data, data.comment || '');
    checkWinner(data, data.comment || '');
});

connection.on('gift', (data) => {
    if (isPendingStreak(data)) return; // skip mid-streak
    addGift(data);
});

connection.on('like', (data) => {
    if (!confLike) return;
    let label = typeof data.label === 'string' ? data.label : '';
    let msg   = label.replace('{0:user}', '');
    if (data.likeCount) msg = msg.replace('likes', data.likeCount + ' likes');
    if (msg.trim()) addMessage(data, msg);
});

connection.on('social', (data) => {
    if (!confShare) return;
    let label = typeof data.label === 'string' ? data.label : '';
    addMessage(data, label.replace('{0:user}', ''));
});

let joinMsgDelay = 0;
connection.on('member', (data) => {
    let addDelay = 250;
    if (joinMsgDelay > 500)  addDelay = 100;
    if (joinMsgDelay > 1000) addDelay = 0;
    joinMsgDelay += addDelay;
    setTimeout(() => {
        joinMsgDelay -= addDelay;
        if (confJoin) addMessage(data, "bergabung ke Live");
    }, joinMsgDelay);
});

connection.on('tiktokConnected', () => {
    setStateText('Terhubung ✅', 'ok');
});

connection.on('tiktokDisconnected', (err) => {
    setStateText('Terputus ❌', 'err');
});

connection.on('streamEnd', () => {
    setStateText('Live telah berakhir.', 'err');
});
