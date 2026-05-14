/**
 * Wrapper for client-side TikTok connection over Socket.IO.
 * Patched to use custom socket.io path: /printok/socket.io
 */
class TikTokIOConnection {
    constructor(backendUrl) {
        this.socket = io({
            path: '/printok/socket.io',
        });
        this.uniqueId = null;
        this.options  = null;

        this.socket.on('connect', () => {
            console.info('[printok] socket connected');
            if (this.uniqueId) {
                this.setUniqueId();
            }
        });

        this.socket.on('disconnect', () => {
            console.warn('[printok] socket disconnected');
        });

        this.socket.on('streamEnd', () => {
            console.warn('[printok] stream ended');
            this.uniqueId = null;
        });

        this.socket.on('tiktokDisconnected', (errMsg) => {
            console.warn('[printok] tiktokDisconnected:', errMsg);
            if (errMsg && errMsg.includes('ended')) {
                this.uniqueId = null;
            }
        });
    }

    connect(uniqueId, options) {
        this.uniqueId = uniqueId;
        this.options  = options || {};
        this.setUniqueId();

        return new Promise((resolve, reject) => {
            this.socket.once('tiktokConnected',    resolve);
            this.socket.once('tiktokDisconnected', reject);
            setTimeout(() => reject('Connection Timeout'), 15000);
        });
    }

    setUniqueId() {
        this.socket.emit('setUniqueId', this.uniqueId, this.options);
    }

    on(eventName, handler) {
        this.socket.on(eventName, handler);
    }
}
