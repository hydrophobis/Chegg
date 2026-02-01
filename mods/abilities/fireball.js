export default {
    id: 'fireball',
    name: 'Fireball',
    cost: 2,
    description: 'Launch a fireball that explodes on impact (range 3)',

    getValidTargets(minion, gameState) {
        // simple range check for now
        return [];
    },

    execute(minion, target, gameState) {
        console.log('Fireball cast!');
        return true;
    }
};
