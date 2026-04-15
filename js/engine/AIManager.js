import { Board } from './Board.js';
import { TurnManager } from './TurnManager.js';
import { ManaSystem } from './ManaSystem.js';

// lets see them beat this i dnt care making it close to 1000 lines
export class AIManager {
    static DIFFICULTY_PRESETS = {
        cautious: {
            searchDepth: 2,
            moveLimit: 5,
            spawnTileLimit: 4,
            minimumGain: -0.05,
            playstyleBonus: 'defensive',
            tieBreakWindow: 0.25
        },
        balanced: {
            searchDepth: 3,
            moveLimit: 6,
            spawnTileLimit: 5,
            minimumGain: -0.12,
            playstyleBonus: 'balanced',
            tieBreakWindow: 0.18
        },
        aggressive: {
            searchDepth: 3,
            moveLimit: 8,
            spawnTileLimit: 7,
            minimumGain: -0.2,
            playstyleBonus: 'aggressive',
            tieBreakWindow: 0.12
        }
    };

    constructor(game, options = {}) {
        this.game = game;
        this.color = 'red';
        this.opponentColor = 'blue';
        this.minionLoader = game.minionLoader;
        this.abilitySystem = game.abilitySystem;
        this.setDifficulty(options.difficulty || 'balanced');
    }

    setDifficulty(level) {
        const key = this.constructor.DIFFICULTY_PRESETS[level] ? level : 'balanced';
        this.difficulty = key;
        this.settings = this.constructor.DIFFICULTY_PRESETS[key];
    }

    async performTurn() {
        if (this.game.gameState.currentPlayer !== this.color) return;

        await this.delay(800);

        if (this.game.gameState.phase === 'setup') {
            await this.performSetup();
            this.game.endTurn();
            return;
        }

        let actionsTaken = 0;
        const MAX_ACTIONS_PER_TURN = 10;

        while (actionsTaken < MAX_ACTIONS_PER_TURN) {
            const bestMove = this.getBestNextAction();
            if (!bestMove) break;

            const success = await this.executeAction(bestMove);
            if (!success) break;

            actionsTaken++;
            await this.delay(600);
        }

        await this.delay(500);
        this.game.endTurn();
    }

    async performSetup() {
        const spawnZone = this.getSpawnTiles(this.color);
        const pos = this.getBestSetupPosition(spawnZone);
        const hand = this.game.gameState.players[this.color].hand;
        const villagerIndex = hand.findIndex(c => c.id === 'villager');

        if (villagerIndex !== -1) {
            this.game.performSpawn(villagerIndex, pos.r, pos.c);
            await this.delay(500);
        }
    }

    getBestNextAction() {
        const state = this.game.gameState;
        const moves = this.generateAllMoves(state, this.color);
        if (moves.length === 0) return null;

        const currentScore = this.evaluateState(state, this.color);
        // quick first pass so we only spend deeper search on the juicy options
        const previewedMoves = this.rankMovesByPreview(state, this.color, moves)
            .slice(0, this.settings.moveLimit);

        let bestScore = currentScore + this.settings.minimumGain;
        const bestCandidates = [];

        for (const candidate of previewedMoves) {
            const planScore = this.searchActionPlan(candidate.state, this.color, this.settings.searchDepth - 1);

            if (planScore > bestScore + 1e-6) {
                bestScore = planScore;
                bestCandidates.length = 0;
                bestCandidates.push({ move: candidate.move, score: planScore });
                continue;
            }

            if (Math.abs(planScore - bestScore) <= this.settings.tieBreakWindow) {
                bestCandidates.push({ move: candidate.move, score: planScore });
            }
        }

        if (bestCandidates.length === 0) return null;

        bestCandidates.sort((a, b) => {
            const scoreDelta = b.score - a.score;
            if (Math.abs(scoreDelta) > 1e-6) return scoreDelta;
            return this.compareMovePriority(a.move, b.move);
        });

        return bestCandidates[0].move;
    }

    searchActionPlan(state, forColor, depthRemaining) {
        const standPatScore = this.evaluateState(state, forColor);
        if (depthRemaining <= 0 || state.phase === 'gameOver') {
            return standPatScore;
        }

        const moves = this.generateAllMoves(state, forColor);
        if (moves.length === 0) {
            return standPatScore;
        }

        const previewedMoves = this.rankMovesByPreview(state, forColor, moves)
            .slice(0, this.settings.moveLimit);

        let bestScore = standPatScore;

        for (const candidate of previewedMoves) {
            const score = this.searchActionPlan(candidate.state, forColor, depthRemaining - 1);
            if (score > bestScore) {
                bestScore = score;
            }
        }

        return bestScore;
    }

    rankMovesByPreview(state, forColor, moves) {
        const ranked = [];

        for (const move of moves) {
            const clone = state.clone(this.minionLoader);
            if (!this.applySimulatedMove(clone, move, forColor)) continue;

            ranked.push({
                move,
                state: clone,
                score: this.scoreMovePreview(state, clone, move, forColor)
            });
        }

        ranked.sort((a, b) => {
            const scoreDelta = b.score - a.score;
            if (Math.abs(scoreDelta) > 1e-6) return scoreDelta;
            return this.compareMovePriority(a.move, b.move);
        });

        return ranked;
    }

    scoreMovePreview(originalState, nextState, move, forColor) {
        let score = this.evaluateState(nextState, forColor);
        const opponentColor = forColor === 'red' ? 'blue' : 'red';
        const enemyVillager = nextState.players[opponentColor].villager;
        const ownVillager = nextState.players[forColor].villager;
        const endpoint = this.getMoveEndpoint(originalState, nextState, move, forColor);

        if (move.type === 'attack') {
            const target = originalState.getMinionAt(move.row, move.col);
            if (target) {
                score += this.getMinionValue(target) * 0.35;
                if (target.id === 'villager') score += 1000;
            }
        }

        if (endpoint && enemyVillager?.position) {
            const distToEnemyVillager = Board.getDistance(
                endpoint.row,
                endpoint.col,
                enemyVillager.position.row,
                enemyVillager.position.col
            );
            score += Math.max(0, 8 - distToEnemyVillager) * this.getPressureMultiplier(this.settings.playstyleBonus);
        }

        if (endpoint && ownVillager?.position && this.settings.playstyleBonus === 'defensive') {
            const distToOwnVillager = Board.getDistance(
                endpoint.row,
                endpoint.col,
                ownVillager.position.row,
                ownVillager.position.col
            );
            score += Math.max(0, 4 - distToOwnVillager) * 6;
        }

        return score;
    }

    getMoveEndpoint(originalState, nextState, move, forColor) {
        if (move.type === 'spawn' || move.type === 'move') {
            return { row: move.row, col: move.col };
        }

        if (move.type !== 'attack') return null;

        const attackerBefore = originalState.minionRegistry.get(move.minionId);
        if (!attackerBefore) return null;

        const attackerAfter = nextState.minionRegistry.get(move.minionId);
        if (attackerAfter?.position) return attackerAfter.position;

        return attackerBefore.position || null;
    }

    generateAllMoves(state, forColor) {
        const moves = [];
        const player = state.players[forColor];
        const myMinions = state.getPlayerMinions(forColor);
        const tm = new TurnManager(state);

        const affordableHandCards = player
            .hand
            .map((card, idx) => ({ card, idx }))
            .filter(item => ManaSystem.canAfford(player, item.card.cost));

        // spawning on every legal tile gets silly fast, so trim it to the tiles we actually care about
        const spawnTiles = this.getPreferredSpawnTiles(state, forColor);

        for (const item of affordableHandCards) {
            for (const tile of spawnTiles) {
                if (item.card.id === 'villager' && state.phase !== 'setup') continue;
                moves.push({ type: 'spawn', index: item.idx, row: tile.r, col: tile.c, cost: item.card.cost });
            }
        }

        for (const minion of myMinions) {
            if (tm.canMinionMove(minion)) {
                const instance = state.rehydrateMinion(minion, this.minionLoader);
                const validMoves = instance.getValidMoves(state);
                for (const move of validMoves) {
                    moves.push({ type: 'move', minionId: minion.instanceId, row: move.row, col: move.col });
                }
            }

            if (tm.canMinionAttack(minion)) {
                const instance = state.rehydrateMinion(minion, this.minionLoader);
                const validAttacks = instance.getValidAttacks(state);
                for (const attack of validAttacks) {
                    moves.push({ type: 'attack', minionId: minion.instanceId, row: attack.row, col: attack.col });
                }
            }
        }

        return moves;
    }

    getPreferredSpawnTiles(state, color) {
        const opponentColor = color === 'red' ? 'blue' : 'red';
        const enemyVillager = state.players[opponentColor].villager;
        const ownVillager = state.players[color].villager;

        return this.getSpawnTiles(color)
            .filter(tile => !state.getMinionAt(tile.r, tile.c))
            .map(tile => {
                let score = 0;
                const centerDistance = Math.abs(tile.c - ((Board.COLS - 1) / 2));
                score += Math.max(0, 4 - centerDistance) * 5;

                if (enemyVillager?.position) {
                    const distToEnemy = Board.getDistance(tile.r, tile.c, enemyVillager.position.row, enemyVillager.position.col);
                    score += Math.max(0, 12 - distToEnemy) * this.getPressureMultiplier(this.settings.playstyleBonus);
                }

                if (ownVillager?.position) {
                    const distToOwn = Board.getDistance(tile.r, tile.c, ownVillager.position.row, ownVillager.position.col);
                    score += this.settings.playstyleBonus === 'defensive'
                        ? Math.max(0, 5 - distToOwn) * 8
                        : Math.max(0, 3 - distToOwn) * 3;
                }

                return { tile, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, this.settings.spawnTileLimit)
            .map(item => item.tile);
    }

    applySimulatedMove(state, move, forColor) {
        const tm = new TurnManager(state);

        if (move.type === 'spawn') {
            const player = state.players[forColor];
            const card = player.hand[move.index];
            if (!card || !ManaSystem.canAfford(player, card.cost)) return false;
            if (state.getMinionAt(move.row, move.col)) return false;

            const config = this.minionLoader.getConfig(card.id);
            if (config?.onlyDarkTiles && !state.board[move.row][move.col].isDark) return false;

            const minion = this.minionLoader.createSpecializedMinion(card.id, forColor);
            if (!minion) return false;

            if (!state.placeMinion(minion, move.row, move.col)) return false;

            ManaSystem.spendMana(player, card.cost || 0);
            player.hand.splice(move.index, 1);

            if (minion.onSpawn) {
                minion.onSpawn(state);
            }

            return true;
        }

        if (move.type === 'move') {
            const minion = state.minionRegistry.get(move.minionId);
            if (!minion || !this.canMinionMove(state, minion)) return false;

            const moveCost = ManaSystem.getMoveCost(minion);
            if (!ManaSystem.spendMana(state.players[forColor], moveCost)) return false;

            const needsDash = minion.hasMoved;
            state.moveMinion(minion, move.row, move.col);

            if (needsDash) {
                tm.recordAction(minion, 'dash');
            } else {
                minion.hasMoved = true;
            }

            return true;
        }

        if (move.type === 'attack') {
            const minion = state.minionRegistry.get(move.minionId);
            if (!minion || !this.canMinionAttack(state, minion)) return false;

            const targetMinion = state.getMinionAt(move.row, move.col);
            if (!targetMinion || targetMinion.owner === forColor) return false;

            const attackCost = ManaSystem.getAttackCost(minion);
            if (!ManaSystem.spendMana(state.players[forColor], attackCost)) return false;

            return this.resolveSimulatedAttack(state, tm, minion, targetMinion, move);
        }

        return false;
    }

    resolveSimulatedAttack(state, tm, attacker, targetMinion, move) {
        // mirror the weird stuff from real combat or the search starts believing lies
        if (attacker.id === 'creeper' && attacker.attack?.selfDestruct) {
            const { row, col } = attacker.position;
            const blastTiles = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];

            for (const [dr, dc] of blastTiles) {
                const victim = state.getMinionAt(row + dr, col + dc);
                if (victim) {
                    state.removeMinion(victim);
                }
            }

            if (state.minionRegistry.has(attacker.instanceId)) {
                state.removeMinion(attacker);
            }

            return true;
        }

        state.removeMinion(targetMinion);
        tm.recordAction(attacker, 'attack');

        if (attacker.id === 'wither' && attacker.attack?.splash) {
            for (const dir of Board.DIRECTIONS.lateral) {
                const splashTarget = state.getMinionAt(move.row + dir.row, move.col + dir.col);
                if (splashTarget) {
                    state.removeMinion(splashTarget);
                }
            }
        }

        if (attacker.movesToAttack && state.minionRegistry.has(attacker.instanceId)) {
            state.moveMinion(attacker, move.row, move.col);
        }

        return true;
    }

    async executeAction(move) {
        if (move.type === 'spawn') {
            return this.game.performSpawn(move.index, move.row, move.col);
        }

        if (move.type === 'move') {
            const minion = this.game.gameState.minionRegistry.get(move.minionId);
            if (!minion) return false;
            return this.game.performMove(minion, move.row, move.col);
        }

        if (move.type === 'attack') {
            const minion = this.game.gameState.minionRegistry.get(move.minionId);
            if (!minion) return false;
            return this.game.performAttack(minion, move.row, move.col);
        }

        return false;
    }

    evaluateState(state, color) {
        const opponentColor = color === 'red' ? 'blue' : 'red';
        const myPlayer = state.players[color];
        const opponentPlayer = state.players[opponentColor];

        if (state.phase === 'gameOver') {
            if (state.winner === color) return Infinity;
            if (state.winner === opponentColor) return -Infinity;
        }

        const style = this.settings.playstyleBonus;
        const myMinions = state.getPlayerMinions(color);
        const opponentMinions = state.getPlayerMinions(opponentColor);

        let score = 0;

        for (const minion of myMinions) {
            score += this.getMinionValue(minion);
        }

        for (const minion of opponentMinions) {
            score -= this.getMinionValue(minion);
        }

        // material is nice, but chegg gets decided by king danger and who is about to get jumped
        score += (myPlayer.mana - opponentPlayer.mana) * (style === 'aggressive' ? 4 : 3);
        score += (myPlayer.hand.length - opponentPlayer.hand.length) * 7;
        score += this.evaluateFormation(state, color, opponentColor, style);
        score -= this.evaluateFormation(state, opponentColor, color, 'balanced') * 0.9;
        score += this.evaluateCapturePressure(state, color, opponentColor, false);
        score -= this.evaluateCapturePressure(state, opponentColor, color, true) * 1.15;

        return score;
    }

    evaluateFormation(state, friendlyColor, enemyColor, style) {
        let score = 0;
        const ownVillager = state.players[friendlyColor].villager;
        const enemyVillager = state.players[enemyColor].villager;

        for (const minion of state.getPlayerMinions(friendlyColor)) {
            if (!minion.position) continue;

            const centerDistance = Math.abs(minion.position.col - ((Board.COLS - 1) / 2));
            score += Math.max(0, 3.5 - centerDistance) * (minion.id === 'villager' ? 1.5 : 3);

            if (minion.id !== 'villager' && enemyVillager?.position) {
                const distToEnemyVillager = Board.getDistance(
                    minion.position.row,
                    minion.position.col,
                    enemyVillager.position.row,
                    enemyVillager.position.col
                );
                score += Math.max(0, 10 - distToEnemyVillager) * this.getPressureMultiplier(style);

                if (distToEnemyVillager <= 1) {
                    score += style === 'aggressive' ? 120 : 80;
                }
            }

            if (minion.id !== 'villager' && ownVillager?.position) {
                const distToOwnVillager = Board.getDistance(
                    minion.position.row,
                    minion.position.col,
                    ownVillager.position.row,
                    ownVillager.position.col
                );

                if (style === 'defensive') {
                    score += Math.max(0, 4 - distToOwnVillager) * 10;
                } else if (style === 'balanced') {
                    score += Math.max(0, 3 - distToOwnVillager) * 4;
                }
            }
        }

        if (ownVillager?.position) {
            const guardCount = this.countMinionsWithin(state, friendlyColor, ownVillager.position, 2, false);
            const nearbyEnemies = this.countMinionsWithin(state, enemyColor, ownVillager.position, 3, true);
            const attackersOnVillager = this.countAttackersOnTile(state, enemyColor, ownVillager.position, true);

            score += guardCount * (style === 'defensive' ? 24 : 14);
            score -= nearbyEnemies * (style === 'defensive' ? 42 : 30);
            score -= attackersOnVillager * 180;
        }

        if (enemyVillager?.position) {
            const attackersOnEnemyVillager = this.countAttackersOnTile(state, friendlyColor, enemyVillager.position, false);
            score += attackersOnEnemyVillager * 220;
        }

        return score;
    }

    evaluateCapturePressure(state, attackerColor, defenderColor, ignoreReadiness = false) {
        const bestThreats = new Map();

        for (const attacker of state.getPlayerMinions(attackerColor)) {
            if (!ignoreReadiness && !this.canMinionAttack(state, attacker)) continue;

            const attackTargets = this.getAttackTargets(state, attacker);
            for (const attack of attackTargets) {
                const target = attack.minion;
                if (!target || target.owner !== defenderColor) continue;

                let swing = this.getMinionValue(target);

                if (attacker.id === 'creeper' && attacker.attack?.selfDestruct) {
                    swing = this.getExplosionSwing(state, attacker, attackerColor, defenderColor);
                }

                if (attacker.id === 'wither' && attacker.attack?.splash) {
                    swing += this.getSplashSwing(state, attack.row, attack.col, attackerColor, defenderColor);
                }

                if (target.id === 'villager') {
                    swing += 2000;
                }

                const previousBest = bestThreats.get(target.instanceId) || -Infinity;
                if (swing > previousBest) {
                    bestThreats.set(target.instanceId, swing);
                }
            }
        }

        let total = 0;
        for (const swing of bestThreats.values()) {
            total += swing * 0.2;
        }

        return total;
    }

    getExplosionSwing(state, attacker, attackerColor, defenderColor) {
        let swing = -this.getMinionValue(attacker) * 0.8;

        for (const dr of [-1, 0, 1]) {
            for (const dc of [-1, 0, 1]) {
                if (dr === 0 && dc === 0) continue;
                const target = state.getMinionAt(attacker.position.row + dr, attacker.position.col + dc);
                if (!target) continue;

                const value = this.getMinionValue(target);
                if (target.owner === defenderColor) {
                    swing += value;
                    if (target.id === 'villager') swing += 2000;
                } else if (target.owner === attackerColor) {
                    swing -= value * 0.9;
                    if (target.id === 'villager') swing -= 2000;
                }
            }
        }

        return swing;
    }

    getSplashSwing(state, row, col, attackerColor, defenderColor) {
        let swing = 0;

        for (const dir of Board.DIRECTIONS.lateral) {
            const target = state.getMinionAt(row + dir.row, col + dir.col);
            if (!target) continue;

            const value = this.getMinionValue(target);
            if (target.owner === defenderColor) {
                swing += value;
                if (target.id === 'villager') swing += 2000;
            } else if (target.owner === attackerColor) {
                swing -= value * 0.9;
                if (target.id === 'villager') swing -= 2000;
            }
        }

        return swing;
    }

    countAttackersOnTile(state, attackerColor, position, ignoreReadiness) {
        let count = 0;

        for (const attacker of state.getPlayerMinions(attackerColor)) {
            if (!ignoreReadiness && !this.canMinionAttack(state, attacker)) continue;

            const threatensTile = this.getAttackTargets(state, attacker)
                .some(target => target.row === position.row && target.col === position.col);

            if (threatensTile) count++;
        }

        return count;
    }

    countMinionsWithin(state, color, position, range, includeVillager = true) {
        let count = 0;

        for (const minion of state.getPlayerMinions(color)) {
            if (!minion.position) continue;
            if (!includeVillager && minion.id === 'villager') continue;

            const dist = Board.getDistance(
                minion.position.row,
                minion.position.col,
                position.row,
                position.col
            );

            if (dist <= range) count++;
        }

        return count;
    }

    getAttackTargets(state, minion) {
        const instance = state.rehydrateMinion(minion, this.minionLoader);
        if (!instance || !instance.attack) return [];
        return instance.getValidAttacks(state);
    }

    canMinionMove(state, minion) {
        const config = this.minionLoader.getConfig(minion.id);
        if (!config || config.cannotMove || !minion.position) return false;
        if (minion.justSpawned || minion.hasAttacked || minion.hasDashed) return false;

        const moveCost = ManaSystem.getMoveCost(minion);
        return ManaSystem.canAfford(state.players[minion.owner], moveCost);
    }

    canMinionAttack(state, minion) {
        const config = this.minionLoader.getConfig(minion.id);
        if (!config || config.cannotAttack || !config.attack || !minion.position) return false;
        if (minion.justSpawned || minion.hasAttacked || minion.hasDashed) return false;
        if (minion.id === 'enderman' && minion.hasUsedAbility) return false;

        const attackCost = ManaSystem.getAttackCost(minion);
        return ManaSystem.canAfford(state.players[minion.owner], attackCost);
    }

    getMinionValue(minion) {
        if (!minion) return 0;
        if (minion.id === 'villager') return 1600;

        const config = this.minionLoader.getConfig(minion.id) || {};
        const attackRange = config.attack?.range || 0;
        const moveBonus = Array.isArray(config.movement) ? config.movement.length * 4 : (config.movement?.range || 0) * 2;
        let value = ((config.cost ?? minion.cost ?? 0) * 22) + 18;

        value += attackRange * 6;
        value += moveBonus;

        if (config.canJump) value += 8;
        if (config.movesToAttack) value += 10;
        if (config.attackCost > 1) value += 8;
        if (config.cannotMove) value += 10;
        if (config.cannotAttack) value -= 6;
        if (config.abilities?.length) value += config.abilities.length * 7;

        switch (minion.id) {
            case 'wither':
                value += 60;
                break;
            case 'cat':
                value += 45;
                break;
            case 'sniffer':
                value += 36;
                break;
            case 'enderman':
                value += 30;
                break;
            case 'shulker_box':
                value += 24;
                break;
            case 'slime':
            case 'phantom':
                value += 18;
                break;
            case 'creeper':
                value += 14;
                break;
        }

        return value;
    }

    compareMovePriority(leftMove, rightMove) {
        const weights = { attack: 0, spawn: 1, move: 2 };
        return (weights[leftMove.type] ?? 3) - (weights[rightMove.type] ?? 3);
    }

    getPressureMultiplier(style) {
        if (style === 'aggressive') return 8;
        if (style === 'defensive') return 4.5;
        return 6;
    }

    getSpawnTiles(color) {
        const tiles = [];
        for (const r of Board.getSpawnRows(color)) {
            for (let c = 0; c < Board.COLS; c++) {
                tiles.push({ r, c });
            }
        }
        return tiles;
    }

    getBestSetupPosition(spawnZone) {
        let best = null;
        let bestScore = Infinity;
        const enemyBaseRow = this.color === 'red' ? 0 : Board.ROWS - 1;

        for (const pos of spawnZone) {
            const distFromEnemyBase = Math.abs(pos.r - enemyBaseRow);
            const edgeBias = Math.abs(pos.c - Math.floor(Board.COLS / 2));
            const score = -distFromEnemyBase - edgeBias * 0.25;

            if (score < bestScore) {
                bestScore = score;
                best = pos;
            }
        }

        return best || spawnZone[Math.floor(Math.random() * spawnZone.length)];
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default AIManager;
