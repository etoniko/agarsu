export class Storage {
    get settings() {
        const defaultSettings = {
            skins: true,
            names: true,
            mass: true,
            background: true,
            grid: false,
            border: false,
            sectors: false
        };

        let parsedSettings = {};
        try {
            const raw = localStorage.getItem("cigar3-settings");
            if (raw) parsedSettings = JSON.parse(raw) || {};
        } catch (_) {
            parsedSettings = {};
        }

        const normalized = { ...defaultSettings, ...parsedSettings, grid: false };
        localStorage.setItem("cigar3-settings", JSON.stringify(normalized));
        return normalized;
    }

    set settings(settings) {
        localStorage.setItem("cigar3-settings", JSON.stringify(settings));
    }

    get name() {
        const raw = localStorage.getItem("cigar3-name");
        const trimmed = (raw || "").trim();
        return trimmed || "Игрок";
    }

    set name(name) {
        localStorage.setItem("cigar3-name", name);
    }

    get pass() {
        return localStorage.getItem("cigar3-pass") || "";
    }

    set pass(pass) {
        localStorage.setItem("cigar3-pass", pass || "");
    }
}
