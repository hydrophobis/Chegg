# Chegg Modding Guide
<small>AI generated documentation</small>

This guide explains how to extend Chegg with custom minions, abilities, and arena layouts.

## Directory Structure

```
mods/
├── minions/           # Custom minion JSON configs
│   └── my_minion.json
├── abilities/         # Custom ability scripts
│   └── my_ability.js
└── arenas/            # Custom board layouts
    └── my_arena.json
```

## Creating Custom Minions

Create a JSON file in `mods/minions/`:

### Basic Format

```json
{
    "id": "my_custom_minion",
    "name": "Custom Minion",
    "cost": 3,
    "description": "A custom minion that does something cool.",
    "movement": {
        "pattern": "surrounding",
        "range": 2
    },
    "attack": {
        "pattern": "lateral",
        "range": 3
    },
    "image": "my_custom_minion.png"
}
```

### Movement Patterns

| Pattern | Description |
|---------|-------------|
| `lateral` | 4 cardinal directions (up, down, left, right) |
| `diagonal` | 4 diagonal directions |
| `surrounding` | All 8 adjacent tiles |
| `knight` | L-shaped like chess knight |
| `forward` | Only forward tiles (for Zombie) |

### Attack Options

```json
"attack": {
    "pattern": "diagonal",
    "range": 3,
    "aoe": true,           // Hits all targets at once
    "sweep": true,         // Hits 3 tiles in a direction
    "splash": true,        // Damages adjacent tiles too
    "selfDestruct": true   // Minion dies after attack
}
```

### Special Flags

```json
{
    "cannotMove": true,      // Cannot move (Cat, Enderman)
    "cannotAttack": true,    // Cannot attack (Pig, Frog)
    "canJump": true,         // Can jump over pieces (Rabbit, Slime)
    "onlyDarkTiles": true,   // Phantom restriction
    "movesToAttack": true    // Moves to target on attack (Slime)
}
```

### Adding Abilities

```json
{
    "abilities": ["drawOnSpawn", "drawOnDeath"],
    "abilityCost": 1
}
```

Built-in abilities:
- `drawOnSpawn` - Draw a card when spawned
- `drawOnDeath` - Draw a card when killed
- `manaBonus` - +1 mana per turn while alive
- `drawFromEnemy` - Draw from enemy deck on spawn
- `discardOnDeath` - Discard cards on death
- `spawnExplosion` - Destroy surrounding tiles on spawn
- `teleport` - Swap with another minion
- `pull` - Pull a minion closer
- `copyAttack` - Copy adjacent minion's attack

## Adding Your Minion Image

Place your image in:
```
assets/minions/my_custom_minion.png
```

Recommended: 100x100px PNG with transparent background.

## Loading Custom Minions

Custom minions in `config/minions/` are loaded automatically if you create a `manifest.json`:

```json
{
    "minions": ["my_custom_minion", "another_minion"]
}
```

## Creating Custom Abilities

For complex abilities, create a JavaScript module:

```javascript
// mods/abilities/my_ability.js
export default {
    id: 'my_custom_ability',
    name: 'Custom Ability',
    cost: 2,
    description: 'Does something special',
    
    getValidTargets(minion, gameState) {
        // Return array of valid target positions
        return [];
    },
    
    execute(minion, target, gameState) {
        // Perform the ability
        return true; // Return true if successful
    }
};
```

Register it in `main.js`:
```javascript
import myAbility from '../mods/abilities/my_ability.js';
this.abilitySystem.register(myAbility.id, myAbility);
```

## Example: Creating a "Dragon" Minion

`config/minions/dragon.json`:
```json
{
    "id": "dragon",
    "name": "Dragon",
    "cost": 6,
    "description": "Flies over pieces. Breathes fire in lateral direction (range 4).",
    "movement": {
        "pattern": "surrounding",
        "range": 3
    },
    "attack": {
        "pattern": "lateral",
        "range": 4,
        "splash": true
    },
    "canJump": true,
    "attackCost": 2,
    "image": "dragon.png"
}
```

## Tips

1. **Balance is key** - Higher cost minions should have proportionally stronger abilities
2. **Test thoroughly** - Play multiple games to ensure your minion isn't overpowered
3. **Synergies** - Think about how your minion interacts with existing ones
4. **Unique identity** - Each minion should fill a distinct role
