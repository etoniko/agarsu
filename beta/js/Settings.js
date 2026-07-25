export default class {
    constructor(core) {
        this.core = core 
        this._settings = this.core.store.settings
    }

    get rawSettings() {
        return this._settings
    }

    get skins() {
        return this.rawSettings.skins 
    }

    set skins(value) {
        for (const cell of this.core.app.cells) cell.hasChanged = true
        this.rawSettings.skins = value
    }

    get names() {
        return this.rawSettings.names 
    }

    set names(value) {
        for (const cell of this.core.app.cells) cell.hasChanged = true
        this.rawSettings.names = value
    }

    get mass() {
        return this.rawSettings.mass
    }

    set mass(value) {
        for (const cell of this.core.app.cells) cell.hasChanged = true
        this.rawSettings.mass = value
    }

    get sectors() {
        return !!this.rawSettings.sectors
    }

    set sectors(value) {
        this.rawSettings.sectors = value
        if (this.core.app.sectorContainer) this.core.app.sectorContainer.visible = value
    }
}
