import { AuthManager } from './AuthManager.js';

export class NetworkClient {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.color = null; // our assigned color
        this.roomData = null;
        this.pendingCallbacks = new Map();
        this.authManager = new AuthManager();
        this.authenticated = false;
    }

    connect() {
        if (this.socket && this.socket.readyState <= 1) return;

        // Use the current host but change protocol to ws://
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//chegg.hydrophobicmc.us:25565`;

        console.log('Connecting to WebSocket:', wsUrl);
        this.socket = new WebSocket(wsUrl);

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (err) {
                console.error('WS Parse error:', err);
            }
        };

        this.socket.onopen = () => {
            console.log('WS Connected');
            this.authenticate();
        };

        this.socket.onerror = (err) => {
            console.error('WS Error:', err);
            this.game.showError('Connection error occurred.');
        };

        this.socket.onclose = () => {
            console.log('WS Closed');
            this.game.showError('Disconnected from server.');
        };
    }

    handleMessage(data) {
        const { event, payload } = data;

        switch (event) {
            case 'player_assigned':
                this.color = payload.color;
                console.log('assigned color:', this.color);
                break;
            case 'state_update':
                const newState = JSON.parse(payload.state);
                this.game.onServerStateUpdate(newState);
                break;
            case 'game_event':
                const { eventName, detail } = payload;
                const customEvent = new CustomEvent(`chegg:${eventName}`, { detail });
                document.dispatchEvent(customEvent);
                break;
            case 'timer_tick':
                this.game.updateTimer(payload);
                break;
            case 'error':
                this.game.showError(payload.message);
                break;
            case 'custom_rooms_list':
                if (this.pendingCallbacks.has('custom_rooms_list')) {
                    this.pendingCallbacks.get('custom_rooms_list')(payload);
                    this.pendingCallbacks.delete('custom_rooms_list');
                }
                break;
            case 'room_created':
                console.log('Room created:', payload.roomId);
                break;
            case 'auth_success':
                this.authenticated = true;
                const { username, elo } = payload;
                const creds = this.authManager.getCredentials();
                if (creds) {
                    this.authManager.setCredentials(username, creds.token, elo);
                }
                this.color = payload.color; // might provide info
                console.log('Auth success for:', username, 'Elo:', elo);

                // Dispatch event for UI updates
                document.dispatchEvent(new CustomEvent('chegg:auth_success', { detail: payload }));
                if (this.pendingCallbacks.has('auth')) {
                    this.pendingCallbacks.get('auth')(true);
                    this.pendingCallbacks.delete('auth');
                }
                break;
            case 'auth_failure':
                this.authenticated = false;
                console.error('Auth failed:', payload.message);
                alert('Authentication failed: ' + payload.message);
                if (this.pendingCallbacks.has('auth')) {
                    this.pendingCallbacks.get('auth')(false);
                    this.pendingCallbacks.delete('auth');
                }
                break;
            case 'rating_change':
                this.game.showRatingChange(payload);
                break;
        }
    }

    authenticate(callback) {
        const creds = this.authManager.getCredentials();
        if (!creds) {
            if (callback) callback(false);
            return;
        }

        if (callback) this.pendingCallbacks.set('auth', callback);

        this.socket.send(JSON.stringify({
            event: 'auth',
            payload: creds
        }));
    }

    send(event, payload) {
        if (!this.socket || this.socket.readyState !== 1) {
            this.connect();
            // wait for open
            const check = setInterval(() => {
                if (this.socket.readyState === 1) {
                    clearInterval(check);
                    this.socket.send(JSON.stringify({ event, payload }));
                }
            }, 100);
            return;
        }
        this.socket.send(JSON.stringify({ event, payload }));
    }

    findMatch(deck) {
        this.send('join_matchmaking', { deck });
    }

    createCustomRoom(name, timer, deck, saveGame = true) {
        this.send('create_custom_room', { name, timer, deck, saveGame });
    }

    joinCustomRoom(roomId, deck) {
        this.send('join_custom_room', { roomId, deck });
    }

    spectateRoom(roomId) {
        this.send('spectate_room', { roomId });
    }

    getCustomRooms(callback) {
        this.pendingCallbacks.set('custom_rooms_list', callback);
        this.send('get_custom_rooms');
    }

    sendAction(type, payload) {
        this.send('game_action', { type, payload });
    }

    forfeit() {
        this.send('forfeit');
    }
}
