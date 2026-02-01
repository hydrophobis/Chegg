export class Board {
    static ROWS = 10;
    static COLS = 8;

    static DIRECTIONS = {
        lateral: [
            { row: -1, col: 0 },  // up
            { row: 1, col: 0 },   // down
            { row: 0, col: -1 },  // left
            { row: 0, col: 1 }    // right
        ],
        diagonal: [
            { row: -1, col: -1 }, // up-left
            { row: -1, col: 1 },  // up-right
            { row: 1, col: -1 },  // down-left
            { row: 1, col: 1 }    // down-right
        ],
        surrounding: [
            { row: -1, col: 0 }, { row: 1, col: 0 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
            { row: -1, col: -1 }, { row: -1, col: 1 },
            { row: 1, col: -1 }, { row: 1, col: 1 }
        ],
        knight: [
            { row: -2, col: -1 }, { row: -2, col: 1 },
            { row: 2, col: -1 }, { row: 2, col: 1 },
            { row: -1, col: -2 }, { row: -1, col: 2 },
            { row: 1, col: -2 }, { row: 1, col: 2 }
        ],
        'forward-blue': [
            { row: 1, col: -1 },
            { row: 1, col: 0 },
            { row: 1, col: 1 }
        ],
        'forward-red': [
            { row: -1, col: -1 },
            { row: -1, col: 0 },
            { row: -1, col: 1 }
        ]
    };

    static getValidMoves(gameState, startRow, startCol, pattern, range, options = {}) {
        const positions = [];
        const directions = this.DIRECTIONS[pattern] || [];

        const {
            canJump = false,
            mustBeEmpty = true,
            onlyDarkTiles = false,
            blockByObstacle = true
        } = options;

        for (const dir of directions) {
            for (let dist = 1; dist <= range; dist++) {
                const row = startRow + dir.row * dist;
                const col = startCol + dir.col * dist;

                if (!this.isValidPosition(row, col)) break;
                if (onlyDarkTiles && !gameState.board[row][col].isDark) continue;

                const minion = gameState.getMinionAt(row, col);

                // path blocked (unless jumping)
                if (!canJump && blockByObstacle && minion && dist < range) {
                    break;
                }

                if (mustBeEmpty && minion) {
                    if (!canJump) break;
                    continue;
                }

                positions.push({ row, col });

                // blocked
                if (!canJump && minion) break;
            }
        }

        return positions;
    }

    static getValidAttacks(gameState, startRow, startCol, pattern, range, owner, options = {}) {
        const targets = [];
        const directions = this.DIRECTIONS[pattern] || [];

        const {
            aoe = false,
            directional = false,
            requiresLoS = true,
            onlyDarkTiles = false
        } = options;

        for (const dir of directions) {
            const dirTargets = [];

            for (let dist = 1; dist <= range; dist++) {
                const row = startRow + dir.row * dist;
                const col = startCol + dir.col * dist;

                if (!this.isValidPosition(row, col)) break;
                if (onlyDarkTiles && !gameState.board[row][col].isDark) continue;

                const minion = gameState.getMinionAt(row, col);

                // sight blocked
                if (requiresLoS && minion && dist < range) {
                    if (minion.owner !== owner) {
                        dirTargets.push({ row, col, minion });
                    }
                    break;
                }

                if (minion && minion.owner !== owner) {
                    dirTargets.push({ row, col, minion });
                }
            }

            if (directional && dirTargets.length > 0) {
                targets.push({ direction: dir, targets: dirTargets });
            } else {
                targets.push(...dirTargets);
            }
        }

        return targets;
    }

    static getAOEPositions(centerRow, centerCol, pattern = 'surrounding', range = 1) {
        const positions = [];
        const directions = this.DIRECTIONS[pattern] || this.DIRECTIONS.surrounding;

        for (const dir of directions) {
            for (let dist = 1; dist <= range; dist++) {
                const row = centerRow + dir.row * dist;
                const col = centerCol + dir.col * dist;

                if (this.isValidPosition(row, col)) {
                    positions.push({ row, col });
                }
            }
        }

        return positions;
    }

    static getLinePositions(gameState, startRow, startCol, pattern = 'lateral', maxRange = 10) {
        const positions = [];
        const directions = this.DIRECTIONS[pattern] || this.DIRECTIONS.lateral;

        for (const dir of directions) {
            for (let dist = 1; dist <= maxRange; dist++) {
                const row = startRow + dir.row * dist;
                const col = startCol + dir.col * dist;

                if (!this.isValidPosition(row, col)) break;

                const minion = gameState.getMinionAt(row, col);
                if (minion) {
                    positions.push({ row, col, minion, direction: dir, distance: dist });
                }
            }
        }

        return positions;
    }

    static findPullDestination(gameState, minionRow, minionCol, direction, pullDistance) {
        let destRow = minionRow;
        let destCol = minionCol;

        // slide back from target to source
        for (let i = 0; i < pullDistance; i++) {
            const newRow = destRow - direction.row;
            const newCol = destCol - direction.col;

            if (!this.isValidPosition(newRow, newCol)) break;
            if (gameState.getMinionAt(newRow, newCol)) break;

            destRow = newRow;
            destCol = newCol;
        }

        return { row: destRow, col: destCol };
    }

    static isValidPosition(row, col) {
        return row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS;
    }

    static isPassable(gameState, row, col, minion) {
        return this.isValidPosition(row, col);
    }

    static getDistance(row1, col1, row2, col2) {
        return Math.abs(row1 - row2) + Math.abs(col1 - col2);
    }

    static isAdjacent(row1, col1, row2, col2) {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);
        return rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0);
    }
}

export default Board;
