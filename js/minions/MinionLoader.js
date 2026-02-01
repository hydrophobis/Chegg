import { MinionBase } from './MinionBase.js';
import { Board } from '../engine/Board.js';

// built-in roster
const BUILT_IN_MINIONS = {
    villager: {
        id: 'villager',
        name: 'Villager',
        cost: 0,
        movement: { pattern: 'surrounding', range: 1 },
        attack: { pattern: 'surrounding', range: 1 },
        movesToAttack: true,
        description: 'Your king. If it dies, you lose. Costs 1 mana to move.'
    },
    zombie: {
        id: 'zombie',
        name: 'Zombie',
        cost: 1,
        movement: { pattern: 'forward', range: 1 },
        attack: { pattern: 'lateral', range: 1 },
        description: 'Basic unit. Moves forward, attacks laterally.'
    },
    creeper: {
        id: 'creeper',
        name: 'Creeper',
        cost: 1,
        movement: { pattern: 'surrounding', range: 1 },
        attack: { pattern: 'surrounding', range: 1, aoe: true, selfDestruct: true },
        description: 'Explodes! Destroys all 8 surrounding tiles but dies in the process.'
    },
    pig: {
        id: 'pig',
        name: 'Pig',
        cost: 1,
        movement: { pattern: 'surrounding', range: 1 },
        cannotAttack: true,
        abilities: ['drawOnSpawn', 'drawOnDeath'],
        description: 'Draw a card when spawned and when it dies.'
    },
    rabbit: {
        id: 'rabbit',
        name: 'Rabbit',
        cost: 2,
        movement: { pattern: 'lateral', range: 2 },
        canJump: true,
        cannotAttack: true,
        abilities: ['drawOnJumpOver'],
        description: 'Jumps 2 tiles. Draw a card if jumping over any minion.'
    },
    pufferfish: {
        id: 'pufferfish',
        name: 'Puffer-Fish',
        cost: 2,
        movement: { pattern: 'lateral', range: 1 },
        attack: { pattern: 'diagonal', range: 1, aoe: true },
        description: 'Attacks all 4 diagonal tiles simultaneously.'
    },
    iron_golem: {
        id: 'iron_golem',
        name: 'Iron Golem',
        cost: 2,
        movement: { pattern: 'surrounding', range: 1 },
        attack: { pattern: 'surrounding', range: 1, sweep: true },
        description: 'Sweeping attack hits 3 tiles in a lateral direction.'
    },
    frog: {
        id: 'frog',
        name: 'Frog',
        cost: 2,
        movement: [
            { pattern: 'lateral', range: 2 },
            { pattern: 'diagonal', range: 1 }
        ],
        cannotAttack: true,
        abilities: ['pull'],
        abilityCost: 1,
        description: 'Pull any minion in a lateral line 2 tiles closer (1 mana).'
    },
    skeleton: {
        id: 'skeleton',
        name: 'Skeleton',
        cost: 3,
        movement: { pattern: 'lateral', range: 1 },
        attack: { pattern: 'diagonal', range: 3 },
        description: 'Ranged attacker. Shoots diagonally up to 3 tiles.'
    },
    blaze: {
        id: 'blaze',
        name: 'Blaze',
        cost: 3,
        movement: { pattern: 'diagonal', range: 1 },
        attack: { pattern: 'lateral', range: 2 },
        description: 'Moves diagonally, attacks laterally up to 2 tiles.'
    },
    phantom: {
        id: 'phantom',
        name: 'Phantom',
        cost: 3,
        movement: { pattern: 'surrounding', range: 2 },
        attack: { pattern: 'surrounding', range: 2 },
        onlyDarkTiles: true,
        movesToAttack: false,
        description: 'Highly mobile but can only be on dark tiles.'
    },
    enderman: {
        id: 'enderman',
        name: 'Enderman',
        cost: 4,
        movement: { pattern: 'none', range: 0 },
        cannotMove: true,
        attack: { pattern: 'surrounding', range: 1 },
        abilities: ['teleport'],
        abilityCost: 1,
        description: 'Cannot move. Teleport: swap with any minion in a lateral line (1 mana).'
    },
    slime: {
        id: 'slime',
        name: 'Slime',
        cost: 4,
        movement: { pattern: 'surrounding', range: 2 },
        attack: { pattern: 'surrounding', range: 2 },
        canJump: true,
        movesToAttack: true,
        description: 'Jumps up to 2 tiles. Attack by moving onto enemies.'
    },
    shulker_box: {
        id: 'shulker_box',
        name: 'Shulker Box',
        cost: 4,
        movement: { pattern: 'none', range: 0 },
        cannotMove: true,
        attack: { pattern: 'surrounding', range: 4 },
        movesToAttack: true,
        description: 'Cannot move freely. Ranged attack, moves to target position.'
    },
    parrot: {
        id: 'parrot',
        name: 'Parrot',
        cost: 5,
        movement: { pattern: 'surrounding', range: 2 },
        abilities: ['copyAttack'],
        description: 'Copies the attack pattern of an adjacent minion.'
    },
    cat: {
        id: 'cat',
        name: 'Cat',
        cost: 5,
        movement: { pattern: 'none', range: 0 },
        cannotMove: true,
        cannotAttack: true,
        abilities: ['manaBonus'],
        description: 'Cannot move or attack. Grants +1 mana per turn (stacks).'
    },
    sniffer: {
        id: 'sniffer',
        name: 'Sniffer',
        cost: 5,
        movement: { pattern: 'surrounding', range: 1 },
        cannotAttack: true,
        abilities: ['drawFromEnemy', 'discardOnDeath'],
        description: 'Draw 2 from enemy deck on spawn. Discard 2 on death.'
    },
    wither: {
        id: 'wither',
        name: 'Wither',
        cost: 6,
        movement: { pattern: 'surrounding', range: 1 },
        attack: { pattern: 'lateral', range: 3, splash: true },
        attackCost: 2,
        abilities: ['spawnExplosion'],
        description: 'Explodes on spawn (all 8 tiles). Attack costs 2 mana and splashes.'
    }
};

export class MinionLoader {
    constructor() {
        this.configs = new Map();
        this.customConfigs = new Map();

        // start by loading our factory defaults
        this.loadBuiltInMinions();
    }

    loadBuiltInMinions() {
        for (const [id, config] of Object.entries(BUILT_IN_MINIONS)) {
            this.configs.set(id, config);
        }
    }

    // look for more minion types in the config folder
    async loadFromDirectory(path) {
        try {
            const response = await fetch(`${path}/manifest.json`);
            const manifest = await response.json();

            for (const minionId of manifest.minions) {
                const configResponse = await fetch(`${path}/${minionId}.json`);
                const config = await configResponse.json();
                this.addConfig(config);
            }
        } catch (error) {
            console.warn('Could not load extra minion configs, sticking with defaults', error);
        }
    }

    // add configs from ModManager
    loadFromModManager(modManager) {
        const configs = modManager.getMinionConfigs();
        for (const config of configs) {
            this.addConfig(config);
        }
        console.log(`[MinionLoader] Loaded ${configs.length} custom minion(s) from ModManager`);
    }

    addConfig(config) {
        if (!config.id) {
            console.error('This config is missing an ID, skipping it', config);
            return;
        }
        this.customConfigs.set(config.id, config);
    }

    getConfig(id) {
        return this.customConfigs.get(id) || this.configs.get(id) || null;
    }

    getAllConfigs() {
        // combine built-in and custom ones
        const all = new Map(this.configs);
        for (const [id, config] of this.customConfigs) {
            all.set(id, config);
        }
        return Array.from(all.values());
    }

    getDeckBuildingConfigs() {
        // no vilager
        return this.getAllConfigs().filter(c => c.id !== 'villager');
    }

    createMinion(id, owner) {
        const config = this.getConfig(id);
        if (!config) {
            console.error(`I don't know what a "${id}" is`);
            return null;
        }
        return new MinionBase(config, owner);
    }

    createSpecializedMinion(id, owner) {
        const config = this.getConfig(id);
        if (!config) return null;

        const minion = new MinionBase(config, owner);

        minion.movesToAttack = config.movesToAttack || false;
        minion.attackCost = config.attackCost || 1;

        // hook up any special triggers or abilities
        if (config.abilities) {
            this.attachAbilities(minion, config.abilities);
        }

        return minion;
    }

    // this is where we map ability strings to actual code logic
    attachAbilities(minion, abilities) {
        for (const ability of abilities) {
            switch (ability) {
                case 'drawOnSpawn':
                    minion.onSpawn = (gameState) => {
                        gameState.drawCards(minion.owner, 1);
                    };
                    break;

                case 'drawOnDeath':
                    minion.onDeath = (gameState) => {
                        gameState.drawCards(minion.owner, 1);
                    };
                    break;

                case 'manaBonus':
                    minion.onSpawn = (gameState) => {
                        gameState.players[minion.owner].catBonusMana++;
                    };
                    minion.onDeath = (gameState) => {
                        gameState.players[minion.owner].catBonusMana--;
                    };
                    break;

                case 'drawFromEnemy':
                    minion.onSpawn = (gameState) => {
                        gameState.drawFromOpponent(minion.owner, 2);
                    };
                    break;

                case 'discardOnDeath':
                    const originalOnDeath = minion.onDeath;
                    minion.onDeath = (gameState) => {
                        if (originalOnDeath) originalOnDeath(gameState);
                        gameState.discardCards(minion.owner, 2);
                    };
                    break;

                case 'spawnExplosion':
                    const origSpawn = minion.onSpawn;
                    minion.onSpawn = (gameState) => {
                        if (origSpawn) origSpawn(gameState);
                        // blast everything in the surrounding 8 tiles
                        const { row, col } = minion.position;
                        const positions = [
                            [-1, -1], [-1, 0], [-1, 1],
                            [0, -1], [0, 1],
                            [1, -1], [1, 0], [1, 1]
                        ];
                        for (const [dr, dc] of positions) {
                            const target = gameState.getMinionAt(row + dr, col + dc);
                            // dont blow up the kings!
                            // if (target && target.id !== 'villager') {
                            //     gameState.removeMinion(target);
                            // }
                        }
                    };
                    break;
            }
        }
    }

    validateConfig(config) {
        const required = ['id', 'name', 'cost'];
        const errors = [];

        for (const field of required) {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    getAttackPreview(minion, gameState) {
        if (!minion || !minion.position) return [];
        const config = this.getConfig(minion.id);
        if (!config || !config.attack) return [];

        const { pattern, range } = config.attack;

        // Simple redir to Board.getAOEPositions which handles geometry
        return Board.getAOEPositions(minion.position.row, minion.position.col, pattern, range);
    }
}

export default MinionLoader;
