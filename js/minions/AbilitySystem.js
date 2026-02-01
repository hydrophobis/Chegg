import { Board } from '../engine/Board.js';
import { ManaSystem } from '../engine/ManaSystem.js';

export class AbilitySystem {
    constructor(gameState) {
        this.gameState = gameState;
        this.abilities = new Map();

        this.registerBuiltInAbilities();
    }

    registerBuiltInAbilities() {
        // enderman swap
        this.register('teleport', {
            name: 'Teleport',
            cost: 1,
            description: 'Swap places with any minion in a lateral line',
            cannotTargetVillager: true,

            getValidTargets: (minion, gameState) => {
                return Board.getLinePositions(
                    gameState,
                    minion.position.row,
                    minion.position.col,
                    'lateral'
                ).filter(t => t.minion.id !== 'villager');
            },

            execute: (minion, target, gameState) => {
                const { row: r1, col: c1 } = minion.position;
                const { row: r2, col: c2, minion: targetMinion } = target;

                // swap 'em
                gameState.board[r1][c1].minion = targetMinion;
                gameState.board[r2][c2].minion = minion;

                targetMinion.position = { row: r1, col: c1 };
                minion.position = { row: r2, col: c2 };

                return true;
            }
        });

        // frog pull
        this.register('pull', {
            name: 'Pull',
            cost: 1,
            description: 'Pull any minion in a lateral line 2 tiles closer',

            getValidTargets: (minion, gameState) => {
                return Board.getLinePositions(
                    gameState,
                    minion.position.row,
                    minion.position.col,
                    'lateral'
                );
            },

            execute: (minion, target, gameState) => {
                const destination = Board.findPullDestination(
                    gameState,
                    target.row,
                    target.col,
                    target.direction,
                    2
                );

                // only do something if they actually move
                if (destination.row !== target.row || destination.col !== target.col) {
                    gameState.moveMinion(target.minion, destination.row, destination.col);
                    return true;
                }
                return false;
            }
        });

        // Parrot: Copy an adjacent unit's attack style
        this.register('copyAttack', {
            name: 'Copy Attack',
            cost: 0,
            description: 'Copy the attack pattern of an adjacent minion',

            getValidSources: (minion, gameState) => {
                const sources = [];
                const { row, col } = minion.position;

                for (const dir of Board.DIRECTIONS.lateral) {
                    const r = row + dir.row;
                    const c = col + dir.col;
                    const adjacent = gameState.getMinionAt(r, c);

                    if (adjacent && adjacent.attack) {
                        sources.push({
                            minion: adjacent,
                            attackPattern: adjacent.attack
                        });
                    }
                }

                return sources;
            },

            getAttacksWithPattern: (minion, attackPattern, gameState) => {
                return Board.getValidAttacks(
                    gameState,
                    minion.position.row,
                    minion.position.col,
                    attackPattern.pattern,
                    attackPattern.range,
                    minion.owner
                );
            }
        });

        // Creeper: Blow up everything around it
        this.register('selfDestruct', {
            name: 'Self Destruct',
            cost: 1,
            description: 'Destroy all minions in surrounding 8 tiles, including self',

            getValidTargets: (minion, gameState) => {
                return [{ confirm: true }];
            },

            execute: (minion, target, gameState) => {
                const { row, col } = minion.position;
                const targets = [];

                for (const dir of Board.DIRECTIONS.surrounding) {
                    const r = row + dir.row;
                    const c = col + dir.col;
                    const m = gameState.getMinionAt(r, c);
                    if (m) {
                        targets.push(m);
                    }
                }

                // everything dies in the blast
                for (const t of targets) {
                    gameState.removeMinion(t);
                }

                // including the creeper itself
                gameState.removeMinion(minion);

                return true;
            }
        });

        // Iron Golem: Swing across 3 tiles in a direction
        this.register('sweep', {
            name: 'Sweep Attack',
            cost: 1,
            description: 'Attack 3 tiles in a lateral direction',

            getValidDirections: (minion, gameState) => {
                const directions = [];
                const { row, col } = minion.position;

                for (const dir of Board.DIRECTIONS.lateral) {
                    const targets = [];
                    const centerR = row + dir.row;
                    const centerC = col + dir.col;

                    if (!Board.isValidPosition(centerR, centerC)) continue;

                    // calculate the perpendicular tiles for the sweep
                    const perpendicular = dir.row === 0
                        ? [{ row: -1, col: 0 }, { row: 1, col: 0 }]
                        : [{ row: 0, col: -1 }, { row: 0, col: 1 }];

                    targets.push({ row: centerR, col: centerC });

                    for (const p of perpendicular) {
                        const r = centerR + p.row;
                        const c = centerC + p.col;
                        if (Board.isValidPosition(r, c)) {
                            targets.push({ row: r, col: c });
                        }
                    }

                    // only show this direction if there's someone to hit
                    const hasEnemy = targets.some(t => {
                        const m = gameState.getMinionAt(t.row, t.col);
                        return m && m.owner !== minion.owner;
                    });

                    if (hasEnemy) {
                        directions.push({ direction: dir, targets });
                    }
                }

                return directions;
            },

            execute: (minion, directionData, gameState) => {
                for (const tile of directionData.targets) {
                    const target = gameState.getMinionAt(tile.row, tile.col);
                    if (target && target.owner !== minion.owner) {
                        gameState.removeMinion(target);
                    }
                }
                return true;
            }
        });

        // Rabbit: Draw a card if you jump over something
        this.register('drawOnJumpOver', {
            name: 'Draw on Jump',
            cost: 0,
            description: 'Draw a card when jumping over any minion',
            passive: true,

            checkTrigger: (minion, fromPos, toPos, gameState) => {
                // look for any minions in the path of the jump
                const dir = {
                    row: Math.sign(toPos.row - fromPos.row),
                    col: Math.sign(toPos.col - fromPos.col)
                };

                let r = fromPos.row + dir.row;
                let c = fromPos.col + dir.col;

                while (r !== toPos.row || c !== toPos.col) {
                    if (gameState.getMinionAt(r, c)) {
                        return true;
                    }
                    r += dir.row;
                    c += dir.col;
                }

                return false;
            },

            onTrigger: (minion, gameState) => {
                gameState.drawCards(minion.owner, 1);
            }
        });
    }

    register(id, ability) {
        this.abilities.set(id, ability);
    }

    // load custom abilities from ModManager
    loadFromModManager(modManager) {
        const abilities = modManager.getAbilities();
        for (const ability of abilities) {
            this.register(ability.id, ability);
        }
        console.log(`[AbilitySystem] Loaded ${abilities.length} custom ability(s) from ModManager`);
    }

    get(id) {
        return this.abilities.get(id);
    }

    canUse(minion, abilityId) {
        const ability = this.get(abilityId);
        if (!ability) return false;

        // check if they can afford it
        if (ability.cost > 0) {
            if (!ManaSystem.canAfford(
                this.gameState.players[minion.owner],
                ability.cost
            )) {
                return false;
            }
        }

        // check if there's any valid target to use it on
        if (ability.getValidTargets) {
            const targets = ability.getValidTargets(minion, this.gameState);
            if (targets.length === 0) return false;
        }

        return true;
    }

    execute(minion, abilityId, target) {
        const ability = this.get(abilityId);
        if (!ability) return false;

        // spend action points/mana and run the code
        const result = ability.execute(minion, target, this.gameState);

        if (result) {
            minion.hasUsedAbility = true;
            minion.hasActedThisTurn = true;
        }

        return result;
    }

    getValidTargets(minion, abilityId) {
        const ability = this.get(abilityId);
        if (!ability || !ability.getValidTargets) return [];

        return ability.getValidTargets(minion, this.gameState);
    }
}

export default AbilitySystem;
