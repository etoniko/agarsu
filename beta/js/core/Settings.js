export class Settings {
    constructor(core) {
        this.core = core;
        this._settings = this.core.store.settings;
    }

    get rawSettings() { return this._settings; }

    get skins() { return this.rawSettings.skins; }
    set skins(value) {
        this.rawSettings.skins = value;
        for (const cell of this.core.app.cells) {
            if (!value) {
                if (cell.skinSprite) { cell.skinSprite.destroy({ children: true }); cell.skinSprite = null; }
                if (cell.skinMask) { cell.skinMask.destroy(); cell.skinMask = null; }
            } else {
                cell.hasChanged = true;
                cell.name = cell.name;
            }
        }
    }

    get names() { return this.rawSettings.names; }
    set names(value) {
        for (const cell of this.core.app.cells) cell.hasChanged = true;
        this.rawSettings.names = value;
    }

    get mass() { return this.rawSettings.mass; }
    set mass(value) {
        for (const cell of this.core.app.cells) cell.hasChanged = true;
        this.rawSettings.mass = value;
    }

    get background() { return this.rawSettings.background; }
    set background(value) {
        if (this.core.app.backgroundSprite) {
            this.core.app.backgroundSprite.visible = value;
        }
        this.rawSettings.background = value;
    }

    get grid() { return this.rawSettings.grid; }
    set grid(value) {
        if (this.core.app.gridSprite) this.core.app.gridSprite.visible = value;
        this.rawSettings.grid = value;
    }

    get border() { return this.rawSettings.border; }
    set border(value) {
        if (this.core.app.borderGraphics) this.core.app.borderGraphics.visible = value;
        this.rawSettings.border = value;
    }

    get sectors() { return this.rawSettings.sectors; }
    set sectors(value) {
        if (this.core.app.sectorContainer) this.core.app.sectorContainer.visible = value;
        this.rawSettings.sectors = value;
    }
}
