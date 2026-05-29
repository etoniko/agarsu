import { CELL_NAME_FONT_PRIMARY } from "../config/constants.js";

let _loaded = null;


export function loadGameFonts() {
    if (_loaded) return _loaded;
    _loaded = (async () => {
        try {
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            const fam = CELL_NAME_FONT_PRIMARY;
            await document.fonts.load(`700 120px ${fam}`);
            await document.fonts.load(`600 48px ${fam}`);
        } catch {
            
        }
    })();
    return _loaded;
}
