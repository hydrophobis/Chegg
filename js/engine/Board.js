export class Board {
    static ROWS = 10;
    static COLS = 8;
    static SPAWN_ROWS = {
        blue: [0, 1],
        red: [8, 9]
    };

    static DIRECTIONS = {
        lateral: [
            { row: -1, col: 0 },
            { row: 1, col: 0 },
            { row: 0, col: -1 },
            { row: 0, col: 1 }
        ],
        diagonal: [
            { row: -1, col: -1 },
            { row: -1, col: 1 },
            { row: 1, col: -1 },
            { row: 1, col: 1 }
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
        'knight-path': [
            { row: -2, col: -1, path: [{row: -1, col: 0}, {row: -2, col: 0}, {row: -2, col: -1}] },
            { row: -2, col: 1, path: [{row: -1, col: 0}, {row: -2, col: 0}, {row: -2, col: 1}] },
            { row: 2, col: -1, path: [{row: 1, col: 0}, {row: 2, col: 0}, {row: 2, col: -1}] },
            { row: 2, col: 1, path: [{row: 1, col: 0}, {row: 2, col: 0}, {row: 2, col: 1}] },
            { row: -1, col: -2, path: [{row: 0, col: -1}, {row: 0, col: -2}, {row: -1, col: -2}] },
            { row: -1, col: 2, path: [{row: 0, col: 1}, {row: 0, col: 2}, {row: -1, col: 2}] },
            { row: 1, col: -2, path: [{row: 0, col: -1}, {row: 0, col: -2}, {row: 1, col: -2}] },
            { row: 1, col: 2, path: [{row: 0, col: 1}, {row: 0, col: 2}, {row: 1, col: 2}] }
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

    static getSpawnRows(player) {
        return this.SPAWN_ROWS[player] || [];
    }

    static isSpawnZone(row, player) {
        return this.getSpawnRows(player).includes(row);
    }

    static getTileType(row, col) {
        if (this.isSpawnZone(row, 'blue')) return 'spawn-blue';
        if (this.isSpawnZone(row, 'red')) return 'spawn-red';
        return 'normal';
    }

    static getValidMoves(gameState, startRow, startCol, pattern, range, options = {}) {
        const positions = [];
        const directions = this.DIRECTIONS[pattern] || [];

        const {
            canJump = false,
            mustBeEmpty = true,
            onlyDarkTiles = false,
            blockByObstacle = true,
            exactRange = false
        } = options;

        if (pattern === 'knight-path') {
            for (const dir of directions) {
                let blocked = false;
                
                if (dir.path) {
                    // Check each step in the path (including final destination)
                    for (let i = 0; i < dir.path.length; i++) {
                        const step = dir.path[i];
                        const checkRow = startRow + step.row;
                        const checkCol = startCol + step.col;
                        
                        if (!this.isValidPosition(checkRow, checkCol)) {
                            blocked = true;
                            break;
                        }
                        
                        const minion = gameState.getMinionAt(checkRow, checkCol);
                        
                        // If this is the last step (final destination)
                        const isFinalStep = (i === dir.path.length - 1);
                        
                        if (minion) {
                            if (isFinalStep && mustBeEmpty) {
                                // Final destination must be empty for movement
                                blocked = true;
                            } else if (!isFinalStep) {
                                // Intermediate steps must always be empty
                                blocked = true;
                            }
                            break;
                        }
                    }
                }
                
                if (!blocked) {
                    const finalRow = startRow + dir.row;
                    const finalCol = startCol + dir.col;
                    
                    if (this.isValidPosition(finalRow, finalCol)) {
                        if (onlyDarkTiles && !gameState.board[finalRow][finalCol].isDark) continue;
                        positions.push({ row: finalRow, col: finalCol });
                    }
                }
            }
            return positions;
        }

        for (const dir of directions) {
            const startDist = exactRange ? range : 1;
            const endDist = range;
            
            for (let dist = startDist; dist <= endDist; dist++) {
                const row = startRow + dir.row * dist;
                const col = startCol + dir.col * dist;

                if (!this.isValidPosition(row, col)) break;
                if (onlyDarkTiles && !gameState.board[row][col].isDark) continue;

                const minion = gameState.getMinionAt(row, col);

                if (!canJump && blockByObstacle && minion && dist < range) {
                    break;
                }

                if (mustBeEmpty && minion) {
                    if (!canJump) break;
                    continue;
                }

                positions.push({ row, col });

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
            onlyDarkTiles = false,
            exactRange = false
        } = options;

        if (pattern === 'knight-path') {
            for (const dir of directions) {
                if (dir.path) {
                    // Check each step along the path
                    for (const step of dir.path) {
                        const checkRow = startRow + step.row;
                        const checkCol = startCol + step.col;
                        
                        if (!this.isValidPosition(checkRow, checkCol)) {
                            break; // Path goes off board, stop checking this direction
                        }
                        
                        const minion = gameState.getMinionAt(checkRow, checkCol);
                        if (minion) {
                            // Found a minion along the path
                            if (minion.owner !== owner) {
                                // It's an enemy, can attack it
                                targets.push({ row: checkRow, col: checkCol, minion });
                            }
                            // Path is blocked (by friend or foe), stop checking this direction
                            break;
                        }
                    }
                }
                
                // Also check the final destination (if path wasn't blocked)
                const finalRow = startRow + dir.row;
                const finalCol = startCol + dir.col;
                
                if (this.isValidPosition(finalRow, finalCol)) {
                    if (onlyDarkTiles && !gameState.board[finalRow][finalCol].isDark) continue;
                    
                    // Check if we already added this position (from path checking)
                    const alreadyAdded = targets.some(t => t.row === finalRow && t.col === finalCol);
                    if (!alreadyAdded) {
                        const finalMinion = gameState.getMinionAt(finalRow, finalCol);
                        if (finalMinion && finalMinion.owner !== owner) {
                            targets.push({ row: finalRow, col: finalCol, minion: finalMinion });
                        }
                    }
                }
            }
            return targets;
        }

        for (const dir of directions) {
            const dirTargets = [];
            const startDist = exactRange ? range : 1;
            const endDist = range;

            for (let dist = startDist; dist <= endDist; dist++) {
                const row = startRow + dir.row * dist;
                const col = startCol + dir.col * dist;

                if (!this.isValidPosition(row, col)) break;
                if (onlyDarkTiles && !gameState.board[row][col].isDark) continue;

                const minion = gameState.getMinionAt(row, col);

                // For exactRange attacks, skip line of sight checks
                if (!exactRange && requiresLoS && minion && dist < range) {
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

    static getAOEPositions(centerRow, centerCol, pattern = 'surrounding', range = 1, options = {}) {
        const positions = [];
        const directions = this.DIRECTIONS[pattern] || this.DIRECTIONS.surrounding;
        const { exactRange = false } = options;

        // Special handling for knight-path pattern - show all squares along the path
        if (pattern === 'knight-path') {
            for (const dir of directions) {
                if (dir.path) {
                    // Add all squares along the path
                    for (const step of dir.path) {
                        const row = centerRow + step.row;
                        const col = centerCol + step.col;
                        
                        if (this.isValidPosition(row, col)) {
                            positions.push({ row, col });
                        }
                    }
                }
                
                // Also add the final destination
                const finalRow = centerRow + dir.row;
                const finalCol = centerCol + dir.col;
                
                if (this.isValidPosition(finalRow, finalCol)) {
                    positions.push({ row: finalRow, col: finalCol });
                }
            }
            return positions;
        }

        for (const dir of directions) {
            const startDist = exactRange ? range : 1;
            const endDist = range;
            
            for (let dist = startDist; dist <= endDist; dist++) {
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
