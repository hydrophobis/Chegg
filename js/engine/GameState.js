export class GameState {
    constructor() {
        this.board = this.createEmptyBoard();
        this.players = {
            red: this.createPlayerState('red'),
            blue: this.createPlayerState('blue')
        };
        this.currentPlayer = 'blue'; // blue always starts
        this.turnNumber = 0;
        this.phase = 'setup'; // setup, playing, gameOver
        this.winner = null;
        this.selectedMinion = null;
        this.selectedHandCard = null;
        this.actionMode = null; // null, 'move', 'attack', 'ability', 'spawn'
        this.minionRegistry = new Map(); // tracks all active instances
        this.nextMinionId = 1;
    }

    createEmptyBoard() {
        // board is 8x10
        // blue @ 0-1, red @ 8-9
        const board = [];
        for (let row = 0; row < 10; row++) {
            const rowData = [];
            for (let col = 0; col < 8; col++) {
                rowData.push({
                    minion: null,
                    tileType: this.getTileType(row, col),
                    isDark: (row + col) % 2 === 1 // phantoms love these
                });
            }
            board.push(rowData);
        }
        return board;
    }

    getTileType(row, col) {
        if (row <= 1) return 'spawn-blue';
        if (row >= 8) return 'spawn-red';
        return 'normal';
    }

    createPlayerState(color) {
        return {
            color,
            mana: 0,
            maxMana: 0,
            hand: [],
            deck: [],
            villager: null,
            catBonusMana: 0
        };
    }

    getOpponent() {
        return this.currentPlayer === 'red' ? 'blue' : 'red';
    }

    placeMinion(minion, row, col) {
        if (!this.isValidPosition(row, col)) return false;
        if (this.board[row][col].minion) return false;

        minion.instanceId = this.nextMinionId++;
        minion.position = { row, col };
        minion.justSpawned = true;

        this.board[row][col].minion = minion;
        this.minionRegistry.set(minion.instanceId, minion);

        if (minion.id === 'villager') {
            this.players[minion.owner].villager = minion;
        }

        return true;
    }

    moveMinion(minion, toRow, toCol) {
        const { row: fromRow, col: fromCol } = minion.position;

        this.board[fromRow][fromCol].minion = null;
        this.board[toRow][toCol].minion = minion;
        minion.position = { row: toRow, col: toCol };
        minion.hasMoved = true;

        return true;
    }

    removeMinion(minion) {
        const { row, col } = minion.position;
        this.board[row][col].minion = null;
        this.minionRegistry.delete(minion.instanceId);

        // rip king -> game over
        if (minion.id === 'villager') {
            this.phase = 'gameOver';
            this.winner = this.getOpponent();
        }

        if (minion.onDeath) {
            minion.onDeath(this);
        }
    }

    isValidPosition(row, col) {
        return row >= 0 && row < 10 && col >= 0 && col < 8;
    }

    isSpawnZone(row, player) {
        if (player === 'blue') return row <= 1;
        if (player === 'red') return row >= 8;
        return false;
    }

    getMinionAt(row, col) {
        if (!this.isValidPosition(row, col)) return null;
        return this.board[row][col].minion;
    }

    startTurn() {
        this.turnNumber++;
        const player = this.players[this.currentPlayer];

        // Normal play starts after turn 1
        if (this.turnNumber > 1) {
            this.phase = 'playing';
            // cap @ 6
            if (player.maxMana < 6) {
                player.maxMana++;
            }
            player.mana = player.maxMana + player.catBonusMana;
        } else {
            this.phase = 'setup';
            player.mana = 0;
            player.maxMana = 0;
        }

        // reset everyone
        this.minionRegistry.forEach(minion => {
            if (minion.owner === this.currentPlayer) {
                minion.hasActedThisTurn = false;
                minion.hasMoved = false;
                minion.hasDashed = false;
                minion.hasAttacked = false;
                minion.justSpawned = false;
            }
        });
    }

    endTurn() {
        this.currentPlayer = this.getOpponent();
        this.selectedMinion = null;
        this.selectedHandCard = null;
        this.actionMode = null;
        this.startTurn();
    }

    spendMana(amount) {
        const player = this.players[this.currentPlayer];
        if (player.mana >= amount) {
            player.mana -= amount;
            return true;
        }
        return false;
    }

    canAfford(cost) {
        return this.players[this.currentPlayer].mana >= cost;
    }

    drawCards(player, count) {
        const p = this.players[player];
        for (let i = 0; i < count; i++) {
            if (p.deck.length > 0) {
                p.hand.push(p.deck.pop());
            }
        }
    }

    drawFromOpponent(player, count) {
        const opponent = player === 'red' ? 'blue' : 'red';
        const p = this.players[player];
        const opp = this.players[opponent];

        for (let i = 0; i < count; i++) {
            if (opp.deck.length > 0) {
                p.hand.push(opp.deck.pop());
            }
        }
    }

    discardCards(player, count) {
        const p = this.players[player];
        for (let i = 0; i < count && p.hand.length > 0; i++) {
            p.hand.pop();
        }
    }

    getPlayerMinions(player) {
        const minions = [];
        this.minionRegistry.forEach(minion => {
            if (minion.owner === player) {
                minions.push(minion);
            }
        });
        return minions;
    }

    exportBoardState() {
        const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        console.log('=== BOARD EXPORT ===');

        // Print header
        console.log('   1 2 3 4 5 6 7 8');

        // Print grid
        for (let r = 0; r < 10; r++) {
            let line = `${rows[r]}  `;
            for (let c = 0; c < 8; c++) {
                const minion = this.getMinionAt(r, c);
                if (!minion) {
                    line += '. ';
                } else {
                    // Start of name + owner indicator
                    const code = minion.name[0];
                    line += minion.owner === 'blue' ? code.toUpperCase() + ' ' : code.toLowerCase() + ' ';
                }
            }
            console.log(line);
        }

        // List details
        console.log('\nMinion Details:');
        this.minionRegistry.forEach(m => {
            if (m.position) {
                const r = rows[m.position.row];
                const c = m.position.col + 1;
                console.log(`[${r}${c}] ${m.name} (${m.owner}) - Cost: ${m.cost}`);
            }
        });

        // List Hands
        console.log('\nHands:');
        for (const color of ['blue', 'red']) {
            const hand = this.players[color].hand;
            // hand contains card objects (configs)
            const handStr = hand.map(c => c.name).join(', ') || '(empty)';
            console.log(`${color.toUpperCase()}: ${handStr}`);
        }
        console.log('====================');
    }

    serialize() {
        return JSON.stringify({
            board: this.board,
            players: this.players,
            currentPlayer: this.currentPlayer,
            turnNumber: this.turnNumber,
            phase: this.phase,
            winner: this.winner
        });
    }
}

export default GameState;
