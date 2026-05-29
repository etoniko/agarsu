

export const LEADERBOARD_THEME_MAGIC = 0x4854424c;

const MAX_JSON = 8192;


export const LEADERBOARD_THEME_CSS_VARS = new Set([
    "--hud-lb-panel-bg",
    "--hud-lb-panel-border",
    "--hud-lb-panel-shadow",
    "--hud-lb-backdrop",
    "--hud-lb-header-bg",
    "--hud-lb-header-justify",
    "--hud-lb-list-bg",
    "--hud-lb-row-bg",
    "--hud-lb-rank-color",
    "--hud-lb-rank-bg",
    "--hud-lb-rank-border",
    "--hud-lb-nick",
    "--hud-lb-nick-me",
    "--hud-lb-me-row-bg",
    "--hud-lb-me-row-border",
    "--hud-lb-me-row-shadow",
    "--hud-lb-me-rank-color",
    "--hud-lb-me-rank-bg",
    "--hud-lb-me-rank-border",
    "--hud-lb-you-color",
    "--hud-lb-you-bg",
    "--hud-lb-you-border",
    "--hud-lb-divider-color",
    "--hud-lb-title-size",
    "--hud-lb-title-tracking",
    "--hud-lb-title-transform",
    "--hud-lb-subtitle-opacity",
]);

function isSafeCssCustomPropertyValue(v) {
    const s = String(v).slice(0, 280);
    if (/[;{}<>`]|expression\s*\(|javascript:|@import|behavior\s*:|\\0/i.test(s)) return false;
    if (/url\s*\(\s*["']?\s*data:/i.test(s)) return false;
    return true;
}

/**
 * @param {unknown} obj
 * @returns {{ vars: Record<string, string>, title?: string|null, subtitle?: string|null, hideHeaderMark: boolean }|null}
 */
export function normalizeLeaderboardTheme(obj) {
    if (!obj || typeof obj !== "object") return null;

    /** @type {Record<string, string>} */
    const vars = {};
    if (obj.vars && typeof obj.vars === "object") {
        for (const key of Object.keys(obj.vars)) {
            if (!LEADERBOARD_THEME_CSS_VARS.has(key)) continue;
            const val = obj.vars[key];
            if (val === undefined || val === null) continue;
            if (!isSafeCssCustomPropertyValue(val)) continue;
            vars[key] = String(val);
        }
    }

    let title;
    if (obj.title === null) title = null;
    else if (typeof obj.title === "string") title = obj.title.slice(0, 120);

    let subtitle;
    if (obj.subtitle === null) subtitle = null;
    else if (typeof obj.subtitle === "string") subtitle = obj.subtitle.slice(0, 120);

    const hideHeaderMark = !!obj.hideHeaderMark;

    if (
        Object.keys(vars).length === 0 &&
        title === undefined &&
        subtitle === undefined &&
        !hideHeaderMark
    ) {
        return null;
    }

    return { vars, title, subtitle, hideHeaderMark };
}

/**
 * If the reader has a valid theme extension, consumes it and returns the theme; otherwise leaves offset unchanged.
 * @param {import("./binary.js").Reader} reader
 */
export function tryConsumeLeaderboardTheme(reader) {
    if (reader.remaining() < 9) return null;
    if (reader.peekUint32() !== LEADERBOARD_THEME_MAGIC) return null;
    reader.getUint32();
    const version = reader.getUint8();
    if (version !== 1) return null;
    if (reader.remaining() < 4) return null;
    const jsonLen = reader.getUint32();
    if (jsonLen > MAX_JSON || reader.remaining() < jsonLen) return null;
    if (jsonLen === 0) return null;
    const buf = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader._o, jsonLen);
    reader._o += jsonLen;
    try {
        const text = new TextDecoder().decode(buf);
        const parsed = JSON.parse(text);
        return normalizeLeaderboardTheme(parsed);
    } catch {
        return null;
    }
}
