import { GameState } from './engine/GameState.js';
import { TurnManager } from './engine/TurnManager.js';
import { DeckManager } from './engine/DeckManager.js';
import { ManaSystem } from './engine/ManaSystem.js';
import { MinionLoader } from './minions/MinionLoader.js';
import { AbilitySystem } from './minions/AbilitySystem.js';
import { BoardUI } from './ui/BoardUI.js';
import { HandUI } from './ui/HandUI.js';
import { InfoPanel } from './ui/InfoPanel.js';
import { DeckBuilder } from './ui/DeckBuilder.js';
import { ModManager } from './mods/ModManager.js';
import { ModManagerUI } from './ui/ModManagerUI.js';

class CheggGame {
    constructor() {
        this.gameState = null;
        this.turnManager = null;
        this.minionLoader = null;
        this.abilitySystem = null;
        this.modManager = null;

        // ui stuff
        this.boardUI = null;
        this.bluePanel = null;
        this.redPanel = null;
        this.blueHand = null;
        this.redHand = null;
        this.deckBuilder = null;
        this.modManagerUI = null;

        // current state
        this.mode = 'idle'; // idle, selectingSpawn, selectingMove, selectingAttack, selectingAbility
        this.selectedMinion = null;
        this.selectedCard = null;
        this.currentAbility = null;

        this.init();
    }

    async init() {
        this.minionLoader = new MinionLoader();
        this.modManager = new ModManager();
        this.modManagerUI = new ModManagerUI(this.modManager);

        // load externals via mod manager
        await this.modManager.loadAll();
        this.minionLoader.loadFromModManager(this.modManager);

        // expose export function
        window.exportBoard = () => this.gameState.exportBoardState();

        this.showStartScreen();
    }

    showStartScreen() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.id = 'start-screen';

        overlay.innerHTML = `
            <div class="modal" style="text-align: center; max-width: 450px;">
                <div class="modal-title" style="font-size: 2.5rem; margin-bottom: 8px;">
                    CHEGG
                </div>
                <div style="color: var(--text-secondary); margin-bottom: 24px;">
                    A turn based & deck building strategy game
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="action-btn primary" id="btn-quick-start" style="width: 100%; padding: 12px;">
                        Quick Start (Default Decks)
                    </button>
                    <button class="action-btn secondary" id="btn-custom-decks" style="width: 100%; padding: 12px;">
                        Build Custom Decks
                    </button>
                    <button class="action-btn secondary" id="btn-mods" style="width: 100%; padding: 12px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.5);">
                        Mod Manager (${this.modManager.getLoadedMods().minions.length + this.modManager.getLoadedMods().abilities.length})
                    </button>
                </div>
                
                <div style="margin-top: 24px; font-size: 0.75rem; color: var(--text-muted);">
                    <p>Designed by Gerg • JS version • <a href="https://docs.google.com/document/d/1TM736HhNsh2nz8l3L-a6PuWAVxbnBSF__NB7qX7Wdlw/edit?tab=t.0" target="_blank">wtf are the rules?</a></p>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#btn-quick-start').addEventListener('click', () => {
            overlay.remove();
            this.startGameWithDefaultDecks();
        });

        overlay.querySelector('#btn-custom-decks').addEventListener('click', () => {
            overlay.remove();
            this.startDeckBuilding();
        });

        overlay.querySelector('#btn-mods').addEventListener('click', () => {
            this.modManagerUI.show();
        });
    }

    startDeckBuilding() {
        this.deckBuilder = new DeckBuilder(this.minionLoader);

        // blue goes first
        this.deckBuilder.show('blue', (blueDeck) => {
            const blueConfig = blueDeck;

            // then red
            this.deckBuilder.show('red', (redDeck) => {
                this.startGame(blueConfig, redDeck);
            });
        });
    }

    startGameWithDefaultDecks() {
        const defaultDeck = DeckManager.createDefaultDeck(this.minionLoader);
        // generic starting decks
        const blueDeck = defaultDeck.map(m => ({ ...m }));
        const redDeck = defaultDeck.map(m => ({ ...m }));

        this.startGame(blueDeck, redDeck);
    }

    startGame(blueDeck, redDeck) {
        this.gameState = new GameState();
        this.turnManager = new TurnManager(this.gameState);
        this.abilitySystem = new AbilitySystem(this.gameState);
        this.abilitySystem.loadFromModManager(this.modManager);

        // prep decks, shuffle happens inside
        DeckManager.initializePlayerDeck(this.gameState.players.blue, blueDeck);
        DeckManager.initializePlayerDeck(this.gameState.players.red, redDeck);

        // start with villager in hand
        const villagerCard = this.minionLoader.getConfig('villager');
        if (villagerCard) {
            this.gameState.players.blue.hand.unshift({ ...villagerCard, deckCard: true });
            this.gameState.players.red.hand.unshift({ ...villagerCard, deckCard: true });
        }

        this.setupUI();
        this.turnManager.startGame();
        this.render();
    }

    setupUI() {
        const container = document.getElementById('game-container');
        container.innerHTML = `
            <header class="game-header">
                <div class="game-title">CHEGG</div>
                <div class="turn-indicator blue" id="turn-indicator">
                    <div class="player-dot"></div>
                    <span id="turn-text">Blue's Turn</span>
                </div>
                <div class="turn-number" id="turn-number">Turn 1</div>
            </header>
            
            <main class="game-main">
                <div id="blue-panel-container"></div>
                
                <div class="board-wrapper">
                    <div class="board-container" id="board-container"></div>
                    
                    <div id="current-hand-container"></div>
                    
                    <div class="action-bar">
                        <button class="action-btn secondary" id="btn-cancel">Cancel</button>
                        <button class="action-btn primary" id="btn-end-turn">End Turn</button>
                    </div>
                    
                    <div id="action-hint" style="text-align: center; margin-top: 8px; color: var(--text-secondary); font-size: 0.85rem;"></div>
                </div>
                
                <div id="red-panel-container"></div>
            </main>
        `;

        this.boardUI = new BoardUI(this.gameState, '#board-container');
        this.boardUI.onTileClick = (row, col) => this.handleTileClick(row, col);
        this.boardUI.onMinionClick = (minion, row, col) => this.handleMinionClick(minion, row, col);

        this.bluePanel = new InfoPanel(this.gameState, '#blue-panel-container', 'blue');
        this.redPanel = new InfoPanel(this.gameState, '#red-panel-container', 'red');

        this.currentHand = new HandUI(this.gameState, '#current-hand-container', 'blue');
        this.currentHand.onCardClick = (card, index) => this.handleCardClick(card, index);

        document.getElementById('btn-cancel').addEventListener('click', () => this.cancelAction());
        document.getElementById('btn-end-turn').addEventListener('click', () => this.endTurn());

        // clicking away cancels stuff
        document.getElementById('board-container').addEventListener('click', (e) => {
            if (e.target.id === 'board-container' || e.target.classList.contains('board')) {
                this.cancelAction();
            }
        });

        document.addEventListener('chegg:turnStart', (e) => this.onTurnStart(e.detail));
        document.addEventListener('chegg:turnEnd', (e) => this.onTurnEnd(e.detail));
    }

    placeVillagers() {
        // Obsolete
    }

    render() {
        this.boardUI.render();
        this.bluePanel.render();
        this.redPanel.render();
        this.currentHand.setPlayer(this.gameState.currentPlayer);

        const indicator = document.getElementById('turn-indicator');
        const turnText = document.getElementById('turn-text');
        const turnNumber = document.getElementById('turn-number');

        indicator.className = `turn-indicator ${this.gameState.currentPlayer}`;
        turnText.textContent = `${this.gameState.currentPlayer === 'blue' ? 'Blue' : 'Red'}'s Turn`;
        turnNumber.textContent = `Turn ${this.gameState.turnNumber}`;

        this.updateActionHint();
    }

    updateActionHint() {
        const hint = document.getElementById('action-hint');

        switch (this.mode) {
            case 'idle':
                if (this.gameState.phase === 'setup') {
                    hint.textContent = 'Placement Phase: Place your Villager/King on the board';
                } else {
                    hint.textContent = 'Select a card to spawn or a minion to command';
                }
                break;
            case 'selectingSpawn':
                hint.textContent = 'Click a tile in your spawn zone to place the minion';
                break;
            case 'selectingMove':
                hint.textContent = 'Green = move, Red = attack. Click elsewhere to cancel.';
                break;
            case 'selectingAbility':
                hint.textContent = `Select a target for ${this.currentAbility} ability`;
                break;
            default:
                hint.textContent = '';
        }
    }

    onTurnStart(detail) {
        this.mode = 'idle';
        this.selectedMinion = null;
        this.selectedCard = null;
        this.currentAbility = null;
        this.boardUI.clearHighlights();

        // Flip board if blue (since blue is row 0-1, normally top)
        // We want current player at bottom
        this.boardUI.setFlip(this.gameState.currentPlayer === 'blue');

        this.render();
    }

    onTurnEnd(detail) {
        if (this.gameState.phase === 'gameOver') {
            this.showGameOver();
        }
    }

    handleCardClick(card, index) {
        // too broke
        if (!ManaSystem.canAfford(this.gameState.players[this.gameState.currentPlayer], card.cost)) {
            return;
        }

        this.cancelAction();

        this.selectedCard = { card, index };
        this.currentHand.selectCard(index);
        this.mode = 'selectingSpawn';

        this.boardUI.highlightSpawnZone(this.gameState.currentPlayer);
        this.updateActionHint();
    }

    handleMinionClick(minion, row, col) {
        if (this.mode === 'selectingAbility') {
            this.executeAbility(minion, row, col);
            return;
        }

        // clicking enemy = attack, clicking empty = move
        if (this.mode === 'selectingMove' && minion.owner !== this.gameState.currentPlayer) {
            this.handleTileClick(row, col);
            return;
        }

        if (minion.owner === this.gameState.currentPlayer) {
            this.selectMinion(minion);
        }
    }

    selectMinion(minion) {
        this.cancelAction();

        // can't act same turn they spawn
        if (minion.justSpawned) {
            this.setHint('too dizzy to move this turn');
            return;
        }

        this.selectedMinion = minion;
        this.mode = 'selectingMove';

        this.boardUI.selectTile(minion.position.row, minion.position.col);

        const config = this.minionLoader.getConfig(minion.id);

        // dummy instance for logic
        const minionInstance = this.minionLoader.createSpecializedMinion(minion.id, minion.owner);
        Object.assign(minionInstance, minion);
        // Restore fresh movement config (in case existing minion has stale data)
        if (config.movement) {
            minionInstance.movement = config.movement;
        }

        if (this.turnManager.canMinionMove(minion)) {
            const moves = minionInstance.getValidMoves(this.gameState);
            this.boardUI.highlightMoves(moves);
        }

        // Show attack range preview if minion has an attack
        if (config.attack && !config.cannotAttack) {
            const positions = this.minionLoader.getAttackPreview(minion, this.gameState);
            if (positions) {
                this.boardUI.highlightAttackPreview(positions);
            }
        }

        if (this.turnManager.canMinionAttack(minion)) {
            const attacks = minionInstance.getValidAttacks(this.gameState);
            this.boardUI.highlightAttacks(attacks);
        }

        // handle abilities
        if (config.abilities && config.abilities.length > 0 && !minion.hasUsedAbility) {
            this.checkAndShowAbilityTargets(minion, config);
        }

        this.updateActionHint();
    }

    checkAndShowAbilityTargets(minion, config) {
        if (config.abilities.includes('teleport')) {
            const targets = this.abilitySystem.getValidTargets(minion, 'teleport');
            if (targets.length > 0) {
                this.boardUI.highlightAbilityTargets(targets);
                this.currentAbility = 'teleport';
                this.mode = 'selectingAbility';
            }
        }

        if (config.abilities.includes('pull')) {
            const targets = this.abilitySystem.getValidTargets(minion, 'pull');
            if (targets.length > 0) {
                this.boardUI.highlightAbilityTargets(targets);
                this.currentAbility = 'pull';
                this.mode = 'selectingAbility';
            }
        }
    }

    handleTileClick(row, col) {
        if (this.mode === 'selectingSpawn') {
            this.spawnMinion(row, col);
        } else if (this.mode === 'selectingMove' && this.selectedMinion) {
            const targetMinion = this.gameState.getMinionAt(row, col);

            // enemy = attack, empty = move
            if (targetMinion && targetMinion.owner !== this.gameState.currentPlayer) {
                this.attackMinion(row, col);
            } else if (!targetMinion) {
                this.moveMinion(row, col);
            }
        } else if (this.mode === 'selectingAbility' && this.selectedMinion) {
            const targetMinion = this.gameState.getMinionAt(row, col);

            if (targetMinion) {
                this.cancelAction();
                return;
            }

            const targets = this.abilitySystem.getValidTargets(this.selectedMinion, this.currentAbility);
            const isAbilityTarget = targets.some(t => t.row === row && t.col === col && !t.minion);

            if (isAbilityTarget) {
                this.executeAbility(null, row, col);
                return;
            }

            this.moveMinion(row, col);
        } else {
            this.cancelAction();
        }
    }

    executeAbility(targetMinion, row, col) {
        if (!this.selectedMinion || !this.currentAbility) return;

        const minion = this.selectedMinion;
        const config = this.minionLoader.getConfig(minion.id);
        const abilityCost = config.abilityCost || 1;

        if (!ManaSystem.canAfford(this.gameState.players[this.gameState.currentPlayer], abilityCost)) {
            this.setHint('Not enough mana');
            return;
        }

        const targets = this.abilitySystem.getValidTargets(minion, this.currentAbility);
        const validTarget = targets.find(t =>
            (t.row === row && t.col === col) ||
            (t.minion && t.minion.position.row === row && t.minion.position.col === col)
        );

        if (!validTarget) {
            this.setHint('Invalid target');
            return;
        }

        const success = this.abilitySystem.execute(minion, this.currentAbility, validTarget);

        if (success) {
            ManaSystem.spendMana(this.gameState.players[this.gameState.currentPlayer], abilityCost);
            minion.hasUsedAbility = true;
            minion.hasActedThisTurn = true;
        }

        this.cancelAction();
        this.render();
    }

    spawnMinion(row, col) {
        if (!this.selectedCard) return;

        const { card, index } = this.selectedCard;
        const player = this.gameState.currentPlayer;

        if (!this.gameState.isSpawnZone(row, player)) {
            this.setHint('Must spawn in your spawn zone');
            return;
        }

        if (this.gameState.getMinionAt(row, col)) {
            this.setHint('That tile is occupied');
            return;
        }

        if (!ManaSystem.spendMana(this.gameState.players[player], card.cost)) {
            this.setHint('Not enough mana');
            return;
        }

        const minion = this.minionLoader.createSpecializedMinion(card.id, player);
        this.gameState.placeMinion(minion, row, col);

        // pop card and trigger spawn hooks
        this.gameState.players[player].hand.splice(index, 1);
        if (minion.onSpawn) {
            minion.onSpawn(this.gameState);
        }

        this.cancelAction();
        this.render();
        this.boardUI.animateSpawn(row, col);
    }

    moveMinion(row, col) {
        if (!this.selectedMinion) return;

        const minion = this.selectedMinion;
        const needsDash = minion.hasMoved;
        const isVillager = minion.id === 'villager';

        const minionInstance = this.minionLoader.createSpecializedMinion(minion.id, minion.owner);
        Object.assign(minionInstance, minion);
        // Restore fresh movement config
        const config = this.minionLoader.getConfig(minion.id);
        if (config.movement) {
            minionInstance.movement = config.movement;
        }

        const validMoves = minionInstance.getValidMoves(this.gameState);
        const isValidMove = validMoves.some(m => m.row === row && m.col === col);

        if (!isValidMove) {
            this.selectedMinion = null;
            this.boardUI.clearHighlights();
            this.boardUI.render();
            return;
        }

        // Villagers always cost mana to move, others only if theyre dashing
        let cost = 0;
        if (isVillager) {
            if (needsDash) {
                cost = 2;
            } else {
                cost = 1;
            }
        } else {
            if (needsDash) {
                cost = 1;
            }
        }

        if (cost > 0 && !ManaSystem.spendMana(this.gameState.players[this.gameState.currentPlayer], cost)) {
            this.setHint('Not enough mana');
            return;
        }

        const oldPos = { ...minion.position };
        this.gameState.moveMinion(minion, row, col);

        if (needsDash) {
            this.turnManager.recordAction(minion, 'dash');
        } else {
            minion.hasMoved = true;
        }

        // rabbit jump logic
        if (minion.id === 'rabbit') {
            const rabbitAbility = this.abilitySystem.get('drawOnJumpOver');
            if (rabbitAbility && rabbitAbility.checkTrigger(minion, oldPos, { row, col }, this.gameState)) {
                rabbitAbility.onTrigger(minion, this.gameState);
            }
        }

        this.cancelAction();
        this.render();
    }

    attackMinion(row, col) {
        if (!this.selectedMinion) return;

        const minion = this.selectedMinion;
        const target = this.gameState.getMinionAt(row, col);

        if (!target || target.owner === minion.owner) {
            this.setHint('Invalid target');
            return;
        }

        const config = this.minionLoader.getConfig(minion.id);
        const minionInstance = this.minionLoader.createSpecializedMinion(minion.id, minion.owner);
        Object.assign(minionInstance, minion);

        const validAttacks = minionInstance.getValidAttacks(this.gameState);
        const isValidAttack = validAttacks.some(a => a.row === row && a.col === col);

        if (!isValidAttack) {
            this.setHint('Invalid attack');
            return;
        }

        const cost = config.attackCost || ManaSystem.ATTACK_COST;
        if (!ManaSystem.spendMana(this.gameState.players[this.gameState.currentPlayer], cost)) {
            this.setHint('Not enough mana');
            return;
        }

        if (minion.id === 'creeper' && config.attack && config.attack.selfDestruct) {
            this.executeCreeper(minion);
            return;
        }

        this.boardUI.animateAttack(minion.position.row, minion.position.col);
        this.boardUI.animateDeath(row, col);

        // wait for animation
        setTimeout(() => {
            this.gameState.removeMinion(target);
            this.turnManager.recordAction(minion, 'attack');

            if (minionInstance.movesToAttack) {
                this.gameState.moveMinion(minion, row, col);
            }

            if (this.gameState.phase === 'gameOver') {
                this.showGameOver();
            }

            this.cancelAction();
            this.render();
        }, 150);
    }

    executeCreeper(minion) {
        const { row, col } = minion.position;
        const targets = [];
        const positions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        // boom, rip everyone nearby
        for (const [dr, dc] of positions) {
            const target = this.gameState.getMinionAt(row + dr, col + dc);
            if (target) targets.push(target);
        }

        this.boardUI.animateAttack(row, col);

        setTimeout(() => {
            for (const target of targets) {
                this.gameState.removeMinion(target);
            }
            this.gameState.removeMinion(minion);
            this.turnManager.recordAction(minion, 'attack');

            if (this.gameState.phase === 'gameOver') {
                this.showGameOver();
            }

            this.cancelAction();
            this.render();
        }, 150);
    }

    cancelAction() {
        this.mode = 'idle';
        this.selectedMinion = null;
        this.selectedCard = null;
        this.currentAbility = null;
        this.boardUI.clearHighlights();
        this.currentHand.clearSelection();
        this.updateActionHint();
    }

    endTurn() {
        if (this.gameState.phase === 'setup') {
            const player = this.gameState.currentPlayer;
            const minions = Array.from(this.gameState.minionRegistry.values());
            const hasVillager = minions.find(m => m.id === 'villager' && m.owner === player);
            if (!hasVillager) {
                this.setHint('You must place your Villager first');
                return;
            }
        }
        this.cancelAction();
        this.turnManager.endTurn();
        this.render();
    }

    setHint(message) {
        const hint = document.getElementById('action-hint');
        hint.textContent = message;
        hint.style.color = 'var(--player-red)';

        // clear after 2s
        setTimeout(() => {
            hint.style.color = 'var(--text-secondary)';
            this.updateActionHint();
        }, 2000);
    }

    showGameOver() {
        const winner = this.gameState.winner;
        const winnerName = winner === 'blue' ? 'Blue Player' : 'Red Player';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.id = 'game-over-screen';

        overlay.innerHTML = `
            <div class="modal game-over">
                <div class="game-over-title ${winner}">
                    ${winnerName} Wins!
                </div>
                <div class="game-over-subtitle">
                    The enemy Villager has been defeated after ${this.gameState.turnNumber} turns
                </div>
                <button class="action-btn primary" id="btn-play-again" style="padding: 12px 32px;">
                    Play Again
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#btn-play-again').addEventListener('click', () => {
            overlay.remove();
            document.getElementById('game-container').innerHTML = '';
            this.showStartScreen();
        });
    }
}

// entry point
document.addEventListener('DOMContentLoaded', () => {
    window.game = new CheggGame();
});

export default CheggGame;
