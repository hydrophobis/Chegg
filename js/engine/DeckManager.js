export class DeckManager {
    static DECK_SIZE = 15;
    static INITIAL_DRAW = 3;

    static createDeck(minionConfigs) {
        // configs -> deck objects
        return minionConfigs.map(config => ({
            ...config,
            deckCard: true
        }));
    }

    // fisher-yates type shi
    static shuffle(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    static draw(deck, hand, count) {
        const drawn = [];
        for (let i = 0; i < count && deck.length > 0; i++) {
            const card = deck.pop();
            hand.push(card);
            drawn.push(card);
        }
        return drawn;
    }

    static initializePlayerDeck(player, deckConfig) {
        // shuffle & draw 3
        player.deck = this.shuffle(this.createDeck(deckConfig));
        player.hand = [];

        this.draw(player.deck, player.hand, this.INITIAL_DRAW);
    }

    static validateDeck(deckConfig) {
        const result = {
            valid: true,
            errors: []
        };

        // deck must be 15
        if (deckConfig.length !== this.DECK_SIZE) {
            result.valid = false;
            result.errors.push(`Deck must contain exactly ${this.DECK_SIZE} minions (has ${deckConfig.length})`);
        }

        return result;
    }

    static getDeckStats(deckConfig) {
        const stats = {
            totalCost: 0,
            averageCost: 0,
            costCurve: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
            minionCounts: {}
        };

        // stats for builder ui
        for (const minion of deckConfig) {
            stats.totalCost += minion.cost || 0;

            const costBucket = Math.min(minion.cost || 1, 6);
            stats.costCurve[costBucket]++;

            stats.minionCounts[minion.id] = (stats.minionCounts[minion.id] || 0) + 1;
        }

        stats.averageCost = deckConfig.length > 0
            ? (stats.totalCost / deckConfig.length).toFixed(1)
            : 0;

        return stats;
    }

    static createDefaultDeck(minionLoader) {
        // default deck
        const defaultMinions = [
            'zombie', 'zombie', 'zombie',    // 3x cost 1
            'creeper', 'pig',                // 2x cost 1
            'rabbit', 'pufferfish',          // 2x cost 2
            'iron_golem', 'frog',            // 2x cost 2
            'skeleton', 'blaze',             // 2x cost 3
            'phantom',                        // 1x cost 3
            'slime', 'enderman',             // 2x cost 4
            'parrot'                          // 1x cost 5
        ];

        return defaultMinions.map(id => minionLoader.getConfig(id)).filter(Boolean);
    }

    static saveDeck(name, deckConfig) {
        const savedDecks = JSON.parse(localStorage.getItem('chegg_decks') || '{}');
        savedDecks[name] = deckConfig.map(m => m.id);
        localStorage.setItem('chegg_decks', JSON.stringify(savedDecks));
    }

    static loadDeck(name, minionLoader) {
        const savedDecks = JSON.parse(localStorage.getItem('chegg_decks') || '{}');
        const deckIds = savedDecks[name];

        if (!deckIds) return null;

        return deckIds.map(id => minionLoader.getConfig(id)).filter(Boolean);
    }

    static getSavedDeckNames() {
        const savedDecks = JSON.parse(localStorage.getItem('chegg_decks') || '{}');
        return Object.keys(savedDecks);
    }

    static deleteDeck(name) {
        const savedDecks = JSON.parse(localStorage.getItem('chegg_decks') || '{}');
        delete savedDecks[name];
        localStorage.setItem('chegg_decks', JSON.stringify(savedDecks));
    }
}

export default DeckManager;
