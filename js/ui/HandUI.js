export class HandUI {
    constructor(gameState, containerSelector, player) {
        this.gameState = gameState;
        this.container = document.querySelector(containerSelector);
        this.player = player;
        this.handElement = null;
        this.onCardClick = null;
        this.selectedIndex = -1;

        this.init();
    }

    init() {
        const section = document.createElement('div');
        section.className = 'hand-section';

        const label = document.createElement('div');
        label.className = 'hand-label';
        label.textContent = 'Your Hand';

        this.handElement = document.createElement('div');
        this.handElement.className = 'hand';
        this.handElement.id = `hand-${this.player}`;

        section.appendChild(label);
        section.appendChild(this.handElement);
        this.container.appendChild(section);
    }

    render() {
        this.handElement.innerHTML = '';

        const playerData = this.gameState.players[this.player];
        const isSetup = this.gameState.phase === 'setup';
        const canAfford = (cost) => (isSetup && cost === 0) || (!isSetup && playerData.mana >= cost);
        const isCurrentPlayer = this.gameState.currentPlayer === this.player;

        playerData.hand.forEach((card, index) => {
            const cardEl = this.createCard(card, index, canAfford(card.cost), isCurrentPlayer);
            this.handElement.appendChild(cardEl);
        });

        // empty hand warning
        if (playerData.hand.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'hand-empty';
            empty.textContent = 'No cards in hand';
            empty.style.cssText = 'color: var(--text-muted); font-style: italic; padding: 20px;';
            this.handElement.appendChild(empty);
        }
    }

    createCard(card, index, affordable, isCurrentPlayer) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.index = index;

        // can't afford or wrong turn
        if (!affordable || !isCurrentPlayer) {
            cardEl.classList.add('cannot-afford');
        }

        if (index === this.selectedIndex) {
            cardEl.classList.add('selected');
        }

        const imgContainer = document.createElement('div');
        imgContainer.className = 'card-image';

        const img = new Image();
        img.src = `assets/minions/${card.image || card.id + '.png'}`;
        img.onload = () => {
            imgContainer.innerHTML = '';
            imgContainer.appendChild(img);
        };
        img.onerror = () => {
            imgContainer.textContent = card.name.substring(0, 3);
        };
        imgContainer.textContent = card.name.substring(0, 3);

        const name = document.createElement('div');
        name.className = 'card-name';
        name.textContent = card.name;

        const cost = document.createElement('div');
        cost.className = 'card-cost';
        cost.textContent = card.cost;

        cardEl.appendChild(imgContainer);
        cardEl.appendChild(name);
        cardEl.appendChild(cost);

        cardEl.addEventListener('click', () => {
            if (isCurrentPlayer && affordable && this.onCardClick) {
                this.onCardClick(card, index);
            }
        });

        // show stats on hover
        cardEl.addEventListener('mouseenter', (e) => {
            this.showTooltip(card, e.clientX, e.clientY);
        });

        cardEl.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });

        return cardEl;
    }

    selectCard(index) {
        this.selectedIndex = index;
        this.render();
    }

    clearSelection() {
        this.selectedIndex = -1;
        this.render();
    }

    getSelectedCard() {
        if (this.selectedIndex < 0) return null;
        return this.gameState.players[this.player].hand[this.selectedIndex];
    }

    removeSelectedCard() {
        if (this.selectedIndex >= 0) {
            this.gameState.players[this.player].hand.splice(this.selectedIndex, 1);
            this.selectedIndex = -1;
        }
    }

    showTooltip(card, x, y) {
        this.hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.id = 'card-tooltip';

        tooltip.innerHTML = `
            <div class="tooltip-title">${card.name}</div>
            <div class="tooltip-cost">Cost: ${card.cost} mana</div>
            <div class="tooltip-description">${card.description || ''}</div>
        `;

        // float the tooltip above the cursor
        tooltip.style.left = `${x + 10}px`;
        tooltip.style.top = `${Math.max(10, y - 100)}px`;

        document.body.appendChild(tooltip);
    }

    hideTooltip() {
        const existing = document.getElementById('card-tooltip');
        if (existing) {
            existing.remove();
        }
    }

    setPlayer(player) {
        this.player = player;
        this.selectedIndex = -1;
        this.render();
    }
}

export default HandUI;
