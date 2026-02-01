import { Board } from '../engine/Board.js';
import { ManaSystem } from '../engine/ManaSystem.js';

export class MinionBase {
    constructor(config, owner) {
        // who am i
        this.id = config.id;
        this.name = config.name;
        this.cost = config.cost || 0;
        this.owner = owner;

        // Position will be set later
        this.position = null;
        this.instanceId = null;

        // State flags
        this.justSpawned = true;
        this.hasMoved = false;
        this.hasDashed = false;
        this.hasAttacked = false;
        this.hasUsedAbility = false;
        this.hasActedThisTurn = false;

        // Configuration
        this.movement = config.movement || { pattern: 'surrounding', range: 1 };
        this.attack = config.attack || null;
        this.abilities = config.abilities || [];
        this.image = config.image || `${config.id}.png`;

        // Special flags from config
        this.cannotMove = config.cannotMove || false;
        this.cannotAttack = config.cannotAttack || false;
        this.canJump = config.canJump || false;
        this.onlyDarkTiles = config.onlyDarkTiles || false;
    }

    getValidMoves(gameState) {
        if (this.cannotMove) return [];
        if (!this.position) return [];

        const { row, col } = this.position;
        const movements = Array.isArray(this.movement) ? this.movement : [this.movement];
        const allMoves = [];

        // console.log(`[MinionBase] Getting moves for ${this.id} at ${row},${col}`, movements);

        for (const moveConfig of movements) {
            let { pattern, range } = moveConfig;

            // Handle owner-specific patterns (like forward for Zombie)
            if (pattern === 'forward') {
                pattern = `forward-${this.owner}`;
            }

            const moves = Board.getValidMoves(
                gameState,
                row,
                col,
                pattern,
                range,
                {
                    canJump: this.canJump,
                    mustBeEmpty: true,
                    onlyDarkTiles: this.onlyDarkTiles
                }
            );
            allMoves.push(...moves);
        }

        // console.log(`[MinionBase] Total moves:`, allMoves);

        return allMoves;
    }

    getValidAttacks(gameState) {
        if (this.cannotAttack || !this.attack) return [];
        if (!this.position) return [];

        const { row, col } = this.position;
        const { pattern, range } = this.attack;

        return Board.getValidAttacks(
            gameState,
            row,
            col,
            pattern,
            range,
            this.owner,
            {
                onlyDarkTiles: this.onlyDarkTiles,
                aoe: this.attack.aoe || false
            }
        );
    }

    move(gameState, toRow, toCol) {
        const validMoves = this.getValidMoves(gameState);
        const isValid = validMoves.some(m => m.row === toRow && m.col === toCol);

        if (!isValid) return false;

        // costs mana?
        const moveCost = this.getMoveCost();
        if (!ManaSystem.canAfford(gameState.players[this.owner], moveCost)) {
            return false;
        }

        ManaSystem.spendMana(gameState.players[this.owner], moveCost);
        gameState.moveMinion(this, toRow, toCol);

        return true;
    }

    attack(gameState, targetRow, targetCol) {
        const validAttacks = this.getValidAttacks(gameState);
        const target = validAttacks.find(t => t.row === targetRow && t.col === targetCol);

        if (!target) return false;

        const attackCost = ManaSystem.getAttackCost(this);
        if (!ManaSystem.spendMana(gameState.players[this.owner], attackCost)) {
            return false;
        }

        // rip target
        gameState.removeMinion(target.minion);
        this.hasAttacked = true;
        this.hasActedThisTurn = true;

        // Some minions move to attack position
        if (this.movesToAttack) {
            gameState.moveMinion(this, targetRow, targetCol);
        }

        return true;
    }

    getMoveCost() {
        if (this.id === 'villager') return ManaSystem.VILLAGER_MOVE_COST;
        if (this.hasMoved) return ManaSystem.DASH_COST; // Dashing
        return 0; // Free first move
    }

    onSpawn(gameState) {

    }

    onDeath(gameState) {

    }

    useAbility(gameState, abilityId, target) {
        return false;
    }

    canAct() {
        return !this.justSpawned && !this.hasActedThisTurn;
    }

    getDisplayInfo() {
        return {
            id: this.id,
            name: this.name,
            cost: this.cost,
            owner: this.owner,
            image: this.image,
            position: this.position
        };
    }

    serialize() {
        return {
            id: this.id,
            instanceId: this.instanceId,
            owner: this.owner,
            position: this.position,
            hasMoved: this.hasMoved,
            hasAttacked: this.hasAttacked,
            justSpawned: this.justSpawned
        };
    }
}

export default MinionBase;
