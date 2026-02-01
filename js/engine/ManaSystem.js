export class ManaSystem {
    static MAX_MANA = 6;
    static STARTING_MANA = 0;
    static ATTACK_COST = 1;
    static DASH_COST = 1;
    static VILLAGER_MOVE_COST = 1;

    static initializePlayer(player) {
        player.mana = this.STARTING_MANA;
        player.maxMana = this.STARTING_MANA;
        player.catBonusMana = 0;
    }

    static refreshMana(player) {
        // +1 max mana per turn, limit 6
        if (player.maxMana < this.MAX_MANA) {
            player.maxMana++;
        }

        // reset to max + cat bonuses
        player.mana = player.maxMana + player.catBonusMana;
    }

    // spend mana, false if too broke
    static spendMana(player, amount) {
        if (player.mana >= amount) {
            player.mana -= amount;
            return true;
        }
        return false;
    }

    static canAfford(player, cost) {
        return player.mana >= cost;
    }

    static getSpawnCost(minion) {
        return minion.cost || 0;
    }

    static getAttackCost(minion) {
        // wither costs 2
        if (minion.id === 'wither') return 2;
        return this.ATTACK_COST;
    }

    static getDashCost(minion) {
        return this.DASH_COST;
    }

    static getMoveCost(minion) {
        if (minion.id === 'villager') {
            return this.VILLAGER_MOVE_COST;
        }
        return 0; // free for others
    }

    static addCatBonus(player) {
        player.catBonusMana++;
    }

    static removeCatBonus(player) {
        if (player.catBonusMana > 0) {
            player.catBonusMana--;
        }
    }

    static getTotalMana(player) {
        return player.mana;
    }

    static formatMana(player) {
        const bonus = player.catBonusMana > 0 ? ` (+${player.catBonusMana})` : '';
        return `${player.mana} / ${player.maxMana}${bonus}`;
    }
}

export default ManaSystem;
