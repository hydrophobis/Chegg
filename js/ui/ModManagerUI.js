export class ModManagerUI {
    constructor(modManager) {
        this.modManager = modManager;
        this.isVisible = false;
        this.overlay = null;
    }

    show() {
        if (this.isVisible) return;
        this.isVisible = true;
        this.render();
    }

    hide() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    async handleReload() {
        const btn = this.overlay.querySelector('#btn-reload-mods');
        const originalText = btn.textContent;
        btn.textContent = 'Reloading...';
        btn.disabled = true;

        const results = await this.modManager.reload();

        // if we are in game, we might need to refresh shit
        // but for now lets just rerender the UI
        btn.textContent = originalText;
        btn.disabled = false;

        this.renderContent(); // refresh list
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay active';
        this.overlay.style.zIndex = '2000'; // above everything else

        this.overlay.innerHTML = `
            <div class="modal mod-manager-modal" style="width: 600px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Mod Manager</h2>
                    <button class="close-btn" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>

                <div class="mod-list-container" style="flex: 1; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; margin-bottom: 20px;">
                    <!-- content goes here -->
                </div>

                <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="action-btn secondary" id="btn-reload-mods">Reload Mods</button>
                    <button class="action-btn primary" id="btn-close-mods">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        this.overlay.querySelector('.close-btn').addEventListener('click', () => this.hide());
        this.overlay.querySelector('#btn-close-mods').addEventListener('click', () => this.hide());
        this.overlay.querySelector('#btn-reload-mods').addEventListener('click', () => this.handleReload());

        // close on background click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        this.renderContent();
    }

    renderContent() {
        const container = this.overlay.querySelector('.mod-list-container');
        const { minions, abilities } = this.modManager.getLoadedMods();
        const errors = this.modManager.getErrors();
        const warnings = this.modManager.getWarnings();

        let html = '';

        // Errors section
        if (errors.length > 0) {
            html += `<div style="margin-bottom: 20px;">
                <h3 style="color: #ef4444; margin-top: 0;">Errors (${errors.length})</h3>
                ${errors.map(err => `
                    <div style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 10px; margin-bottom: 8px; font-size: 0.9em;">
                        <div style="font-weight: bold;">${err.path}</div>
                        <div>${err.error}</div>
                    </div>
                `).join('')}
            </div>`;
        }

        // Warnings section
        if (warnings.length > 0) {
            html += `<div style="margin-bottom: 20px;">
                <h3 style="color: #f59e0b; margin-top: 0;">Warnings (${warnings.length})</h3>
                ${warnings.map(w => `
                    <div style="background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; padding: 10px; margin-bottom: 8px; font-size: 0.9em;">
                        <div style="font-weight: bold;">${w.path || w}</div>
                        <div>${w.warnings ? w.warnings.join(', ') : w}</div>
                    </div>
                `).join('')}
            </div>`;
        }

        // Minions list
        html += `<h3 style="margin-top: 0;">Minions (${minions.length})</h3>`;
        if (minions.length === 0) {
            html += `<div style="color: var(--text-muted); font-style: italic;">No custom minions loaded</div>`;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 8px;">
                ${minions.map(m => `
                    <div style="display: flex; align-items: center; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 4px;">
                        <span style="color: #10b981; margin-right: 10px;">✅</span>
                        <div>
                            <div style="font-weight: 500;">${m.name}</div>
                            <div style="font-size: 0.8em; color: var(--text-secondary);">${m.id}</div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }

        // Abilities list
        html += `<h3 style="margin-top: 20px;">Abilities (${abilities.length})</h3>`;
        if (abilities.length === 0) {
            html += `<div style="color: var(--text-muted); font-style: italic;">No custom abilities loaded</div>`;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 8px;">
                ${abilities.map(a => `
                    <div style="display: flex; align-items: center; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 4px;">
                        <span style="color: #10b981; margin-right: 10px;">✅</span>
                        <div>
                            <div style="font-weight: 500;">${a.name}</div>
                            <div style="font-size: 0.8em; color: var(--text-secondary);">${a.id}</div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }

        container.innerHTML = html;
    }
}
