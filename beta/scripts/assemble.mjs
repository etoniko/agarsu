import fs from "fs";

const networkHeader = `import { WS_PROTOCOL } from "../config/constants.js";
import { fetchConnectToken } from "../net/challenge.js";
import { prepareData, BinaryReader, Reader, Writer } from "../utils/binary.js";
import { getColorId, rgbToHex } from "../utils/color.js";
import { getLevel, normalizeFractlPart } from "../utils/math.js";
import { Cell } from "../entities/Cell.js";

`;

let network = fs.readFileSync("js/services/_Network.body.js", "utf8");
network = network.replace(/^class Network/, "export class Network");
network = network.replace('this.protocol = "eSejeKSVdysQvZs0ES1H"', "this.protocol = WS_PROTOCOL");
network = network.replace(
    /const hex = \(\(r << 16\) \| \(g << 8\) \| b\);\s*let color = "#" \+ \("000000" \+ hex\.toString\(16\)\)\.slice\(-6\)\.toUpperCase\(\);/,
    "let color = rgbToHex(r, g, b);"
);
network = network.replace(
    /addCell\(id, x, y, r, name, color\) \{[\s\S]*?cells\.push\(cell\);\s*\}/,
    `addCell(id, x, y, r, name, color) {
            const cellsByID = this.core.app.cellsByID;
            const cells = this.core.app.cells;
            const sprite = this.core.app.acquireCellSprite();
            const cell = new Cell(this.core, id, x, y, r, sprite, name, color);
            cellsByID.set(id, cell);
            cells.push(cell);
        }`
);
fs.writeFileSync("js/services/Network.js", networkHeader + network);

const appHeader = `import { getPixi } from "./pixi.js";
import { Star } from "../entities/Star.js";
import { Cell } from "../entities/Cell.js";
import {
    createMainRenderer,
    createMinimapRenderer,
    createCellTexture,
    SpritePool
} from "./RendererManager.js";

`;

let app = fs.readFileSync("js/render/_Application.body.js", "utf8");
app = app.replace(/new PIXI\./g, "new (getPixi()).");
app = app.replace(/PIXI\./g, "getPixi().");
app = app.replace(
    /initRenderer\(\) \{[\s\S]*?Cell\.SPRITE = new PIXI\.Sprite\(cellRenderTexture\)\s*\}/,
    `initRenderer() {
            const view = this.view = document.getElementById("view");
            this.renderer = createMainRenderer(view);
            this.stage = new (getPixi()).Container();
            this.stage.sortableChildren = true;

            const cellRenderTexture = createCellTexture(this.renderer);
            this.textures = { cell: cellRenderTexture };
            this.cellSpritePool = new SpritePool(() => {
                const PIXI = getPixi();
                const sprite = new PIXI.Sprite(cellRenderTexture);
                sprite.anchor.set(0.5);
                sprite.roundPixels = false;
                this.stage.addChild(sprite);
                return sprite;
            });
        }

        acquireCellSprite() {
            return this.cellSpritePool.acquire();
        }

        releaseCellSprite(sprite) {
            this.cellSpritePool.release(sprite);
        }`
);
app = app.replace(
    /initMinimap\(\) \{[\s\S]*?stage\.addChild\(sprite\)\s*\}/,
    `initMinimap() {
            const view = this.minimapView = document.getElementById("minimap-view");
            this.minimapRenderer = createMinimapRenderer(view);
            const PIXI = getPixi();
            const sprite = this.minimapEntity = new PIXI.Sprite(PIXI.Texture.WHITE);
            sprite.width = 10;
            sprite.height = 10;
            sprite.anchor.set(0.5);
            const stage = this.minimapStage = new PIXI.Container();
            stage.addChild(sprite);
        }`
);
fs.writeFileSync("js/render/Application.js", appHeader + app);

const uiHeader = `import { ModalSystem } from "./ModalSystem.js";

`;

let ui = fs.readFileSync("js/ui/_UserInterface.body.js", "utf8");
ui = ui.replace(/onServers\(\) \{[\s\S]*?this\.modalSystem\.addModal\(400, 500, \"\"\)\s*\}/, "");
ui = ui.replace(/\bCORE\./g, "this.core.");
fs.writeFileSync("js/ui/UserInterface.js", uiHeader + ui);

console.log("Assembled modules");
