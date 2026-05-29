import { getPixi } from "../render/pixi.js";

export class SkinManager {
    constructor(core) {
        this.core = core;
        this.nickToCode = new Map();
        this.textureCache = new Map();
        this.ready = false;
    }

    async init() {
        try {
            const res = await fetch("https://api.agar.su/skinlist.txt", { cache: "no-store" });
            const text = await res.text();
            for (const raw of text.split(/\r?\n/)) {
                const line = raw.trim();
                if (!line || line.startsWith("#")) continue;
                const m = line.match(/^(.+?)[\s:]+(\d+)\s*$/);
                if (m) this.nickToCode.set(m[1].trim().toLowerCase(), m[2].trim());
            }
        } catch (_) {
        } finally {
            this.ready = true;
        }
    }

    getCodeForName(name) {
        if (!name) return null;
        const explicit = String(name).match(/(?:^|\s)nick:(\d+)(?:\s|$)/i);
        if (explicit) return explicit[1];
        return this.nickToCode.get(String(name).trim().toLowerCase()) || null;
    }

    getTextureForCode(code) {
        const PIXI = getPixi();
        if (!code) return null;
        if (this.textureCache.has(code)) return this.textureCache.get(code);
        const tex = PIXI.Texture.from(`https://api.agar.su/skins/${code}.png`);
        if (tex?.baseTexture) {
            tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
            tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
        }
        this.textureCache.set(code, tex);
        return tex;
    }

    applyToCell(cell, name) {
        const PIXI = getPixi();
        const code = this.getCodeForName(name);
        if (!code) {
            if (cell.skinSprite) { cell.skinSprite.destroy({ children: true }); cell.skinSprite = null; }
            if (cell.skinMask) { cell.skinMask.destroy(); cell.skinMask = null; }
            return;
        }

        const tex = this.getTextureForCode(code);
        if (!tex) return;

        if (!cell.skinSprite) {
            const s = new PIXI.Sprite(tex);
            s.anchor.set(0.5);
            s.zIndex = 2;
            s.roundPixels = false;
            cell.sprite.addChild(s);
            cell.skinSprite = s;

            const mask = new PIXI.Graphics();
            mask.zIndex = 3;
            cell.sprite.addChild(mask);
            s.mask = mask;
            cell.skinMask = mask;
            cell._updateSkinLayout?.(cell._usesSimpleRender?.() ?? true, cell.r);
        } else {
            cell.skinSprite.texture = tex;
            cell._updateSkinLayout?.(cell._usesSimpleRender?.() ?? true, cell._bigPointSize ?? cell.r);
        }
    }
}
