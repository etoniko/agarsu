export class Settings {
    constructor(core) {
        this.core = core
        this._settings = this.core.store.settings
    }

    get rawSettings() {
        return this._settings
    }
    get skins() {
        return this.rawSettings.skins;
    }

    set skins(value) {
        this.rawSettings.skins = value;

        // Применить сразу ко всем клеткам
        for (const cell of this.core.app.cells) {
            if (!value) {
                // Выключили — убрать спрайт и маску
                if (cell.skinSprite) { cell.skinSprite.destroy({ children: true }); cell.skinSprite = null; }
                if (cell.skinMask) { cell.skinMask.destroy(); cell.skinMask = null; }
            } else {
                // Включили — принудительно переустановить имя, чтобы SkinManager навесил скин
                cell.hasChanged = true;
                cell.name = cell.name;
            }
        }
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

    get background() {
        return this.rawSettings.background
    }

    set background(value) {
        if (this.core.app.backgroundSprite) {
            this.core.app.backgroundSprite.visible = value;
        }
        this.rawSettings.background = value;
    }


    get sectors() {
        return this.rawSettings.sectors
    }

    set sectors(value) {
        this.core.app.sectorContainer.visible = value
        this.rawSettings.sectors = value
    }
}
