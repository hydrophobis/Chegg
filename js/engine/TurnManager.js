import { ManaSystem } from './ManaSystem.js';

export class TurnManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.turnPhase = 'draw'; // draw, action, end
    }

    startGame() {
        this.gameState.phase = 'setup';
        this.gameState.turnNumber = -1; // startTurn will increment to 0
        this.gameState.currentPlayer = 'blue';

        ManaSystem.initializePlayer(this.gameState.players.red);
        ManaSystem.initializePlayer(this.gameState.players.blue);

        this.startTurn();
    }

    startTurn() {
        this.gameState.startTurn(); // Let GameState handle turn logic
        const player = this.gameState.players[this.gameState.currentPlayer];

        // draw card except during setup
        if (this.gameState.phase === 'playing') {
            this.gameState.drawCards(this.gameState.currentPlayer, 1);
        }

        this.resetMinionStates();
        this.turnPhase = 'action';

        this.emitEvent('turnStart', {
            player: this.gameState.currentPlayer,
            turnNumber: this.gameState.turnNumber
        });
    }

    endTurn() {
        // clean up selections before switching
        this.gameState.selectedMinion = null;
        this.gameState.selectedHandCard = null;
        this.gameState.actionMode = null;

        this.emitEvent('turnEnd', {
            player: this.gameState.currentPlayer,
            turnNumber: this.gameState.turnNumber
        });

        this.gameState.currentPlayer = this.gameState.getOpponent();

        if (this.gameState.phase !== 'gameOver') {
            this.startTurn();
        }
    }

    resetMinionStates() {
        this.gameState.minionRegistry.forEach(minion => {
            if (minion.owner === this.gameState.currentPlayer) {
                minion.hasActedThisTurn = false;
                minion.hasMoved = false;
                minion.hasDashed = false;
                minion.hasAttacked = false;
                minion.hasUsedAbility = false;
                minion.justSpawned = false;
            }
        });
    }

    canMinionAct(minion) {
        if (minion.justSpawned) return false;
        if (minion.owner !== this.gameState.currentPlayer) return false;
        return true;
    }

    canMinionMove(minion) {
        if (!this.canMinionAct(minion)) return false;
        if (minion.hasAttacked) return false;

        // static units
        const staticMinions = ['cat', 'enderman', 'shulker_box'];
        if (staticMinions.includes(minion.id)) return false;

        return true;
    }

    canMinionDash(minion) {
        if (!this.canMinionMove(minion)) return false;
        if (!minion.hasMoved) return false;
        if (minion.hasDashed) return false;

        const dashCost = ManaSystem.getDashCost(minion);
        if (!ManaSystem.canAfford(this.gameState.players[this.gameState.currentPlayer], dashCost)) {
            return false;
        }

        return true;
    }

    canMinionAttack(minion) {
        if (!this.canMinionAct(minion)) return false;
        if (minion.hasAttacked) return false;
        if (minion.hasDashed) return false;

        // peaceful ones
        const nonAttackers = ['pig', 'rabbit', 'frog', 'cat', 'sniffer'];
        if (nonAttackers.includes(minion.id)) return false;

        const attackCost = ManaSystem.getAttackCost(minion);
        if (!ManaSystem.canAfford(this.gameState.players[this.gameState.currentPlayer], attackCost)) {
            return false;
        }

        return true;
    }

    canMinionUseAbility(minion) {
        if (!this.canMinionAct(minion)) return false;
        if (minion.hasUsedAbility) return false;

        const abilityCost = minion.abilityCost || 1;
        if (!ManaSystem.canAfford(this.gameState.players[this.gameState.currentPlayer], abilityCost)) {
            return false;
        }

        return true;
    }

    recordAction(minion, actionType) {
        switch (actionType) {
            case 'move':
                minion.hasMoved = true;
                break;
            case 'dash':
                minion.hasDashed = true;
                minion.hasActedThisTurn = true;
                break;
            case 'attack':
                minion.hasAttacked = true;
                minion.hasActedThisTurn = true;
                break;
            case 'ability':
                minion.hasUsedAbility = true;
                minion.hasActedThisTurn = true;
                break;
        }
    }

    // tell ui what happened
    emitEvent(eventName, data) {
        const event = new CustomEvent(`chegg:${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }
}

export default TurnManager;
