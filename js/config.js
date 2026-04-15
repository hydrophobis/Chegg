export const CONFIG = {
    SERVER_URL: 'https://sonic-declare-implemented-meat.trycloudflare.com',
    
    get API_URL() {
        return `${this.SERVER_URL}/api`;
    },
    
    get WS_URL() {
        // Determine WebSocket protocol based on HTTP protocol
        const protocol = this.SERVER_URL.startsWith('https') ? 'wss:' : 'ws:';
        const urlWithoutProtocol = this.SERVER_URL.replace(/^https?:\/\//, '');
        return `${protocol}//${urlWithoutProtocol}`;
    },
    
    // SERVER_URL: 'http://localhost:1109',
};

// Export individual values for convenience
export const SERVER_URL = CONFIG.SERVER_URL;
export const API_URL = CONFIG.API_URL;
export const WS_URL = CONFIG.WS_URL;
