// central hub for all mod loading
// handles auto-discovery, validation, and hot reload

export class ModManager {
    constructor() {
        this.minions = new Map();
        this.abilities = new Map();
        this.errors = [];
        this.warnings = [];
        this.loaded = false;
    }

    // load everything from the mods folder
    async loadAll() {
        this.errors = [];
        this.warnings = [];

        await Promise.all([
            this.loadMinions(),
            this.loadAbilities()
        ]);

        this.loaded = true;
        this.logSummary();
    }

    // scan mods/minions for json files via index
    async loadMinions() {
        try {
            const indexResponse = await fetch('mods/mods.json');
            if (!indexResponse.ok) {
                this.warnings.push('No mods.json found, skipping custom minions');
                return;
            }

            const index = await indexResponse.json();
            const minionFiles = index.minions || [];

            for (const filename of minionFiles) {
                await this.loadMinionFile(`mods/minions/${filename}`);
            }
        } catch (e) {
            this.warnings.push(`Could not load mod index: ${e.message}`);
        }
    }

    async loadMinionFile(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                this.errors.push({ type: 'minion', path, error: `Failed to fetch: ${response.status}` });
                return;
            }

            const config = await response.json();
            const validation = this.validateMinion(config);

            if (!validation.valid) {
                this.errors.push({ type: 'minion', path, error: validation.errors.join(', '), config });
                return;
            }

            if (validation.warnings.length > 0) {
                this.warnings.push({ type: 'minion', path, warnings: validation.warnings });
            }

            this.minions.set(config.id, { config, path, status: 'loaded' });
            console.log(`[ModManager] Loaded minion: ${config.name} (${config.id})`);

        } catch (e) {
            this.errors.push({ type: 'minion', path, error: `Parse error: ${e.message}` });
        }
    }

    // validate minion config structure
    validateMinion(config) {
        const errors = [];
        const warnings = [];

        // required fields
        if (!config.id) errors.push('Missing required field: id');
        if (!config.name) errors.push('Missing required field: name');
        if (config.cost === undefined) errors.push('Missing required field: cost');

        // type checks
        if (config.cost !== undefined && typeof config.cost !== 'number') {
            errors.push('cost must be a number');
        }
        if (config.cost < 0) errors.push('cost cannot be negative');

        // movement/attack patterns
        const validPatterns = ['lateral', 'diagonal', 'surrounding', 'knight', 'forward', 'none'];

        if (config.movement) {
            if (!validPatterns.includes(config.movement.pattern)) {
                errors.push(`Invalid movement pattern: ${config.movement.pattern}`);
            }
            if (config.movement.range !== undefined && typeof config.movement.range !== 'number') {
                errors.push('movement.range must be a number');
            }
        }

        if (config.attack) {
            if (!validPatterns.includes(config.attack.pattern)) {
                errors.push(`Invalid attack pattern: ${config.attack.pattern}`);
            }
        }

        // warnings for optional but recommended fields
        if (!config.description) warnings.push('No description provided');
        if (!config.movement && !config.cannotMove) warnings.push('No movement defined');

        return { valid: errors.length === 0, errors, warnings };
    }

    // scan mods/abilities for js files
    async loadAbilities() {
        try {
            const indexResponse = await fetch('mods/mods.json');
            if (!indexResponse.ok) return;

            const index = await indexResponse.json();
            const abilityFiles = index.abilities || [];

            for (const filename of abilityFiles) {
                // construct full URL to avoid bare module specifier errors
                // relative to this file: ../../mods/abilities/
                const fullUrl = new URL(`../../mods/abilities/${filename}`, import.meta.url).href;
                await this.loadAbilityFile(fullUrl, `mods/abilities/${filename}`);
            }
        } catch (e) {
            // already warned in loadMinions
        }
    }

    async loadAbilityFile(url, displayPath) {
        try {
            const module = await import(url);
            const ability = module.default;
            const path = displayPath || url;

            if (!ability || !ability.id) {
                this.errors.push({ type: 'ability', path, error: 'Ability must export default with id' });
                return;
            }

            const validation = this.validateAbility(ability);
            if (!validation.valid) {
                this.errors.push({ type: 'ability', path, error: validation.errors.join(', ') });
                return;
            }

            this.abilities.set(ability.id, { ability, path, status: 'loaded' });
            console.log(`[ModManager] Loaded ability: ${ability.name} (${ability.id})`);

        } catch (e) {
            this.errors.push({ type: 'ability', path, error: `Import error: ${e.message}` });
        }
    }

    validateAbility(ability) {
        const errors = [];

        if (!ability.id) errors.push('Missing required field: id');
        if (!ability.name) errors.push('Missing required field: name');

        // must have either execute or be passive
        if (!ability.execute && !ability.passive) {
            errors.push('Ability must have execute() function or be marked passive');
        }

        return { valid: errors.length === 0, errors };
    }

    // hot reload everything
    async reload() {
        console.log('[ModManager] Reloading all mods...');
        this.minions.clear();
        this.abilities.clear();
        await this.loadAll();
        return { minions: this.minions.size, abilities: this.abilities.size, errors: this.errors.length };
    }

    // get all loaded minion configs
    getMinionConfigs() {
        return Array.from(this.minions.values()).map(m => m.config);
    }

    // get all loaded abilities
    getAbilities() {
        return Array.from(this.abilities.values()).map(a => a.ability);
    }

    getLoadedMods() {
        return {
            minions: Array.from(this.minions.entries()).map(([id, data]) => ({
                id,
                name: data.config.name,
                path: data.path,
                status: data.status
            })),
            abilities: Array.from(this.abilities.entries()).map(([id, data]) => ({
                id,
                name: data.ability.name,
                path: data.path,
                status: data.status
            }))
        };
    }

    getErrors() {
        return this.errors;
    }

    getWarnings() {
        return this.warnings;
    }

    logSummary() {
        console.log(`[ModManager] Loaded`);
        console.log(`[ModManager] Minions: ${this.minions.size} loaded`);
        console.log(`[ModManager] Abilities: ${this.abilities.size} loaded`);

        if (this.errors.length > 0) {
            console.warn(`[ModManager] ${this.errors.length} error(s):`);
            for (const err of this.errors) {
                console.error(`[ModManager] ${err.path}: ${err.error}`);
            }
        }

        if (this.warnings.length > 0) {
            console.info(`[ModManager] ${this.warnings.length} warning(s)`);
        }
    }
}

export default ModManager;
