import { ManaSystem } from '../engine/ManaSystem.js';

export class InfoPanel {
    constructor(gameState, containerSelector, player) {
        this.gameState = gameState;
        this.container = document.querySelector(containerSelector);
        this.player = player;
        this.panelElement = null;

        this.init();
    }

    init() {
        this.panelElement = document.createElement('div');
        this.panelElement.className = 'player-panel';
        this.panelElement.id = `panel-${this.player}`;

        this.render();
        this.container.appendChild(this.panelElement);
    }

    render() {
        const playerData = this.gameState.players[this.player];
        const isActive = this.gameState.currentPlayer === this.player;

        // highlight active panel
        this.panelElement.classList.remove('active');
        if (isActive) {
            this.panelElement.classList.add('active');
            if (this.player === 'red') {
                this.panelElement.classList.add('red');
            }
        }

        // build mana orbs
        const manaOrbs = [];
        for (let i = 0; i < 6; i++) {
            let orbClass = 'mana-orb';
            if (i < playerData.mana) {
                // cat bonus mana
                if (i >= playerData.maxMana) {
                    orbClass += ' filled bonus';
                } else {
                    orbClass += ' filled';
                }
            }
            manaOrbs.push(`<div class="${orbClass}"></div>`);
        }

        const playerName = this.player === 'blue' ? 'Blue Player' : 'Red Player';
        const deckCount = playerData.deck.length;
        const handCount = playerData.hand.length;

        this.panelElement.innerHTML = `
            <div class="player-name ${this.player}">${playerName}</div>
            
            <div class="mana-section">
                <div class="mana-label"><img src="assets/mana.png" alt="Mana" style="width: 10px; height: 10px;"> Mana</div>
                <div class="mana-display">
                    ${manaOrbs.join('')}
                </div>
                <div class="mana-text">${ManaSystem.formatMana(playerData)}</div>
            </div>
            
            <div class="deck-info">
                <div class="deck-icon"><img src="assets/box.png" alt="Box" style="width: 30px; height: 30px;"></div>
                <div>
                    <div class="deck-count">${deckCount}</div>
                    <div class="deck-label">Cards in Deck</div>
                </div>
            </div>
            
            <div class="deck-info">
                <div class="deck-icon"><img src="assets/shelf.png" alt="Hand" style="width: 30px; height: 30px;"></div>
                <div>
                    <div class="deck-count">${handCount}</div>
                    <div class="deck-label">Cards in Hand</div>
                </div>
            </div>
            
            ${playerData.catBonusMana > 0 ? `
            <div class="deck-info" style="background: rgba(168, 85, 247, 0.2);">
                <div class="deck-icon"><img src="assets/minions/cat.png" alt="Cat" style="width: 30px; height: 30px;"></div>
                <div>   
                    <div class="deck-count">+${playerData.catBonusMana}</div>
                    <div class="deck-label">Cat Bonus Mana</div>
                </div>
            </div>
            ` : ''}
        `;
    }

    update() {
        this.render();
    }
}

export default InfoPanel;
