import { DeckManager } from '../engine/DeckManager.js';

export class DeckBuilder {
    constructor(minionLoader) {
        this.minionLoader = minionLoader;
        this.currentDeck = [];
        this.onComplete = null;
        this.currentPlayer = 'blue';
        this.overlay = null;
    }

    show(player, callback) {
        this.currentPlayer = player;
        this.currentDeck = [];
        this.onComplete = callback;

        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay active';

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = this.getHTML();

        this.overlay.appendChild(modal);
        document.body.appendChild(this.overlay);

        this.bindEvents();
        this.render();
    }

    getHTML() {
        const playerName = this.currentPlayer === 'blue' ? 'Blue Player' : 'Red Player';

        return `
            <div class="modal-title">Build Deck, ${playerName}</div>
            
            <div class="deck-builder">
                <div class="minion-pool-section">
                    <div class="mana-label">Available Minions (click to add)</div>
                    <div class="minion-pool" id="minion-pool"></div>
                </div>
                
                <div class="deck-preview">
                    <div class="mana-label">Your Deck (<span id="deck-count">0</span>/15)</div>
                    <div class="deck-slots" id="deck-slots"></div>
                    
                    <div class="deck-stats" id="deck-stats" style="margin-top: 15px;"></div>
                    
                    <div style="margin-top: 15px;">
                        <button class="action-btn secondary" id="btn-clear">Clear Deck</button>
                        <button class="action-btn secondary" id="btn-default">Load Default</button>
                    </div>
                    
                    <div style="margin-top: 15px;">
                        <button class="action-btn primary" id="btn-confirm" disabled>Confirm Deck</button>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.overlay.querySelector('#btn-clear').addEventListener('click', () => {
            this.currentDeck = [];
            this.render();
        });

        this.overlay.querySelector('#btn-default').addEventListener('click', () => {
            this.currentDeck = DeckManager.createDefaultDeck(this.minionLoader);
            this.render();
        });

        this.overlay.querySelector('#btn-confirm').addEventListener('click', () => {
            // finish if full
            if (this.currentDeck.length === DeckManager.DECK_SIZE) {
                this.close();
                if (this.onComplete) {
                    this.onComplete(this.currentDeck);
                }
            }
        });
    }

    render() {
        this.renderMinionPool();
        this.renderDeckSlots();
        this.renderStats();
        this.updateConfirmButton();
    }

    renderMinionPool() {
        const pool = this.overlay.querySelector('#minion-pool');
        pool.innerHTML = '';

        const minions = this.minionLoader.getDeckBuildingConfigs();

        for (const minion of minions) {
            const card = document.createElement('div');
            card.className = 'card';

            const imgContainer = document.createElement('div');
            imgContainer.className = 'card-image';
            imgContainer.textContent = minion.name.substring(0, 3);

            const img = new Image();
            img.src = `assets/minions/${minion.image || minion.id + '.png'}`;
            img.onload = () => {
                imgContainer.innerHTML = '';
                imgContainer.appendChild(img);
            };

            const name = document.createElement('div');
            name.className = 'card-name';
            name.textContent = minion.name;

            const cost = document.createElement('div');
            cost.className = 'card-cost';
            cost.textContent = minion.cost;

            card.appendChild(imgContainer);
            card.appendChild(name);
            card.appendChild(cost);

            card.addEventListener('click', () => {
                if (this.currentDeck.length < DeckManager.DECK_SIZE) {
                    this.currentDeck.push({ ...minion });
                    this.render();
                }
            });

            pool.appendChild(card);
        }
    }

    renderDeckSlots() {
        const slotsContainer = this.overlay.querySelector('#deck-slots');
        const countDisplay = this.overlay.querySelector('#deck-count');

        slotsContainer.innerHTML = '';
        countDisplay.textContent = this.currentDeck.length;

        // show deck cards
        for (let i = 0; i < this.currentDeck.length; i++) {
            const minion = this.currentDeck[i];
            const slot = document.createElement('div');
            slot.className = 'deck-slot filled';
            slot.title = `${minion.name} (${minion.cost}), Click to remove`;
            slot.style.cursor = 'pointer';

            const img = new Image();
            img.src = `assets/minions/${minion.image || minion.id + '.png'}`;
            img.onload = () => {
                slot.innerHTML = '';
                slot.appendChild(img);
            };
            img.onerror = () => {
                slot.textContent = minion.name.substring(0, 3);
            };

            slot.textContent = minion.name.substring(0, 3);

            slot.addEventListener('click', () => {
                this.currentDeck.splice(i, 1);
                this.render();
            });

            slotsContainer.appendChild(slot);
        }

        // fill with ?
        for (let i = this.currentDeck.length; i < DeckManager.DECK_SIZE; i++) {
            const slot = document.createElement('div');
            slot.className = 'deck-slot';
            slot.textContent = '?';
            slotsContainer.appendChild(slot);
        }
    }

    renderStats() {
        const statsEl = this.overlay.querySelector('#deck-stats');

        if (this.currentDeck.length === 0) {
            statsEl.innerHTML = '<div style="color: var(--text-muted);">Add minions to see stats</div>';
            return;
        }

        const stats = DeckManager.getDeckStats(this.currentDeck);

        statsEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: var(--text-secondary);">Avg Cost:</span>
                <span style="color: var(--mana-color); font-weight: 600;">${stats.averageCost}</span>
            </div>
            <div style="display: flex; gap: 4px; align-items: flex-end;">
                ${Object.entries(stats.costCurve).map(([cost, count]) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div style="
                            width: 20px; 
                            height: ${count * 15}px; 
                            background: var(--mana-color);
                            border-radius: 3px;
                            min-height: 4px;
                        "></div>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">${cost}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    updateConfirmButton() {
        const btn = this.overlay.querySelector('#btn-confirm');
        btn.disabled = this.currentDeck.length !== DeckManager.DECK_SIZE;
    }

    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}

export default DeckBuilder;
