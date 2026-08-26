export class Storage {
    get settings() {
        const defaultSettings = {
            skins: true,
            names: true,
            mass: true,
            background: true,
            sectors: false
        };

        let parsedSettings = {};
        try {
            const raw = localStorage.getItem("cigar3-settings");
            if (raw) parsedSettings = JSON.parse(raw) || {};
        } catch (_) {
            parsedSettings = {};
        }

        // Всегда добавляем недостающие ключи и сохраняем обратно
        const normalized = { ...defaultSettings, ...parsedSettings };
        localStorage.setItem("cigar3-settings", JSON.stringify(normalized));
        return normalized;
    }

    set settings(settings) {
        localStorage.setItem("cigar3-settings", JSON.stringify(settings))
    }

    get name() {
        return localStorage.getItem("cigar3-name")
    }

    set name(name) {
        localStorage.setItem("cigar3-name", name)
    }

}
