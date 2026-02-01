export class BoardUI {
    constructor(gameState, containerSelector) {
        this.gameState = gameState;
        this.container = document.querySelector(containerSelector);
        this.boardElement = null;
        this.tiles = [];
        this.onTileClick = null;
        this.onMinionClick = null;

        this.init();
    }

    init() {
        // Wrapper for labels + board
        const wrapper = document.createElement('div');
        wrapper.className = 'board-grid-wrapper';

        // Top labels (1-8)
        const topLabels = document.createElement('div');
        topLabels.className = 'board-labels-top';
        // empty corner
        topLabels.appendChild(document.createElement('div'));
        for (let i = 1; i <= 8; i++) {
            const lbl = document.createElement('div');
            lbl.className = 'label-cell';
            lbl.textContent = i;
            topLabels.appendChild(lbl);
        }
        wrapper.appendChild(topLabels);

        // Center section: Left labels + Board
        const centerSection = document.createElement('div');
        centerSection.className = 'board-center-section';

        // Left labels (A-J)
        const leftLabels = document.createElement('div');
        leftLabels.className = 'board-labels-left';
        const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        for (const r of rows) {
            const lbl = document.createElement('div');
            lbl.className = 'label-cell';
            lbl.textContent = r;
            leftLabels.appendChild(lbl);
        }
        centerSection.appendChild(leftLabels);

        // Actual board
        this.boardElement = document.createElement('div');
        this.boardElement.className = 'board';

        // 10x8 grid
        for (let row = 0; row < 10; row++) {
            this.tiles[row] = [];
            for (let col = 0; col < 8; col++) {
                const tile = this.createTile(row, col);
                this.tiles[row][col] = tile;
                this.boardElement.appendChild(tile);
            }
        }
        centerSection.appendChild(this.boardElement);

        wrapper.appendChild(centerSection);
        this.container.appendChild(wrapper);
    }

    createTile(row, col) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.row = row;
        tile.dataset.col = col;

        // checkerboard
        if ((row + col) % 2 === 0) {
            tile.classList.add('light');
        } else {
            tile.classList.add('dark');
        }

        // spawn zone shades
        if (row <= 1) {
            tile.classList.add('blue-spawn');
        } else if (row >= 8) {
            tile.classList.add('red-spawn');
        }

        tile.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleTileClick(row, col);
        });

        return tile;
    }

    handleTileClick(row, col) {
        const minion = this.gameState.getMinionAt(row, col);

        // unit or empty?
        if (minion && this.onMinionClick) {
            this.onMinionClick(minion, row, col);
        } else if (this.onTileClick) {
            this.onTileClick(row, col);
        }
    }

    render() {
        // wipe & redraw
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 8; col++) {
                const tile = this.tiles[row][col];
                const minionEl = tile.querySelector('.minion');
                if (minionEl) {
                    minionEl.remove();
                }
            }
        }

        this.gameState.minionRegistry.forEach(minion => {
            if (minion.position) {
                this.renderMinion(minion);
            }
        });
    }

    renderMinion(minion) {
        const { row, col } = minion.position;
        const tile = this.tiles[row][col];

        const minionEl = document.createElement('div');
        minionEl.className = `minion ${minion.owner}`;
        minionEl.dataset.instanceId = minion.instanceId;

        if (minion.id === 'villager') {
            minionEl.classList.add('villager');
        }

        // glow if active
        if (!minion.justSpawned && !minion.hasActedThisTurn &&
            minion.owner === this.gameState.currentPlayer) {
            minionEl.classList.add('can-act');
        }

        if (minion.justSpawned) {
            minionEl.classList.add('just-spawned');
        }

        if (minion.hasMoved && minion.id !== 'villager') {
            minionEl.classList.add('dash-mode');
        }

        // load sprite, fallback to initials
        const imgPath = `assets/minions/${minion.image || minion.id + '.png'}`;
        const img = new Image();
        img.src = imgPath;
        img.onload = () => {
            minionEl.innerHTML = '';
            minionEl.appendChild(img);
        };
        img.onerror = () => {
            minionEl.innerHTML = `<div class="minion-placeholder">${minion.name.substring(0, 3)}</div>`;
        };

        minionEl.innerHTML = `<div class="minion-placeholder">${minion.name.substring(0, 3)}</div>`;

        tile.appendChild(minionEl);
    }

    clearHighlights() {
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 8; col++) {
                const tile = this.tiles[row][col];
                tile.classList.remove(
                    'highlight-move',
                    'highlight-attack',
                    'highlight-ability',
                    'highlight-selected',
                    'highlight-attack-preview'
                );
            }
        }
    }

    highlightMoves(positions) {
        for (const pos of positions) {
            const tile = this.tiles[pos.row][pos.col];
            tile.classList.add('highlight-move');
        }
    }

    highlightAttacks(positions) {
        for (const pos of positions) {
            const row = pos.row !== undefined ? pos.row : pos.targets?.[0]?.row;
            const col = pos.col !== undefined ? pos.col : pos.targets?.[0]?.col;
            if (row !== undefined && col !== undefined) {
                const tile = this.tiles[row][col];
                tile.classList.add('highlight-attack');
            }
        }
    }

    highlightAbilityTargets(positions) {
        for (const pos of positions) {
            const row = pos.row !== undefined ? pos.row : pos.minion?.position?.row;
            const col = pos.col !== undefined ? pos.col : pos.minion?.position?.col;
            if (row !== undefined && col !== undefined) {
                const tile = this.tiles[row][col];
                tile.classList.add('highlight-ability');
            }
        }
    }

    highlightAttackPreview(positions) {
        for (const pos of positions) {
            if (this.gameState.isValidPosition(pos.row, pos.col)) {
                const tile = this.tiles[pos.row][pos.col];
                tile.classList.add('highlight-attack-preview');
            }
        }
    }

    selectTile(row, col) {
        this.tiles[row][col].classList.add('highlight-selected');
    }

    highlightSpawnZone(player) {
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 8; col++) {
                const inZone = (player === 'blue' && row <= 1) ||
                    (player === 'red' && row >= 8);
                if (inZone && !this.gameState.getMinionAt(row, col)) {
                    this.tiles[row][col].classList.add('highlight-move');
                }
            }
        }
    }

    animateSpawn(row, col) {
        const tile = this.tiles[row][col];
        const minionEl = tile.querySelector('.minion');
        if (minionEl) {
            minionEl.classList.add('minion-spawn');
            setTimeout(() => minionEl.classList.remove('minion-spawn'), 300);
        }
    }

    animateAttack(row, col) {
        const tile = this.tiles[row][col];
        const minionEl = tile.querySelector('.minion');
        if (minionEl) {
            minionEl.classList.add('minion-attack');
            setTimeout(() => minionEl.classList.remove('minion-attack'), 200);
        }
    }

    animateDeath(row, col) {
        const tile = this.tiles[row][col];
        const minionEl = tile.querySelector('.minion');
        if (minionEl) {
            minionEl.classList.add('minion-death');
        }
    }

    setFlip(flipped) {
        const wrapper = this.container.querySelector('.board-grid-wrapper');
        if (flipped) {
            wrapper.classList.add('flipped');
        } else {
            wrapper.classList.remove('flipped');
        }
    }



    showTooltip(minion, x, y) {
        this.hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.id = 'minion-tooltip';

        const config = minion.config || minion;

        tooltip.innerHTML = `
            <div class="tooltip-title">${minion.name}</div>
            <div class="tooltip-cost">Cost: ${minion.cost} mana</div>
            <div class="tooltip-description">${config.description || ''}</div>
        `;

        tooltip.style.left = `${x + 10}px`;
        tooltip.style.top = `${y + 10}px`;

        document.body.appendChild(tooltip);
    }

    hideTooltip() {
        const existing = document.getElementById('minion-tooltip');
        if (existing) {
            existing.remove();
        }
    }
}

export default BoardUI;
