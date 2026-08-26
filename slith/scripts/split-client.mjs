import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, "..");
const srcPath = path.join(clientDir, "main.js");
const jsDir = path.join(clientDir, "js");

const raw = fs.readFileSync(srcPath, "utf8");
let body = raw
  .replace(/^\(function \(global\) \{\r?\n/, "")
  .replace(/\r?\n    global\.CORE = new main\(\);\r?\n\}\)\(window\);\r?\n?$/, "");

function extractClass(name) {
  const re = new RegExp(`    class ${name}[\\s\\S]*?(?=\\n    class |\\n    const |\\n    function |$)`);
  const m = body.match(re);
  if (!m) throw new Error(`Class ${name} not found`);
  return m[0].replace(/^    /gm, "");
}

function extractConst(name) {
  const re = new RegExp(`    const ${name}[\\s\\S]*?;\\r?\\n`);
  const m = body.match(re);
  if (!m) throw new Error(`Const ${name} not found`);
  return m[0].replace(/^    /gm, "");
}

function extractFunction(name) {
  const re = new RegExp(`    function ${name}[\\s\\S]*?\\n    \\}\\n`);
  const m = body.match(re);
  if (!m) throw new Error(`Function ${name} not found`);
  return m[0].replace(/^    /gm, "");
}

function write(rel, content) {
  const file = path.join(jsDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trimEnd() + "\n", "utf8");
  console.log("wrote", rel);
}

fs.rmSync(jsDir, { recursive: true, force: true });

write(
  "config/servers.js",
  `export const servers = ${body.match(/const servers = ([\s\S]*?);\r?\n\r?\n/)[1]};`
);

write(
  "utils/array.js",
  `export function removeFromArray(arr, item) {
  const i = arr.indexOf(item);
  return i !== -1 && arr.splice(i, 1);
}
`
);

write(
  "utils/colors.js",
  `${extractConst("COLORS")}
${body.match(/    const COLOR_MAP[\s\S]*?    \}\);/)[0].replace(/^    /gm, "")}

/**
 * Возвращает ID цвета (0–15) по значению из localStorage
 */
export function getColorId(storedColor) {
  if (!storedColor) return 0;
  const key = storedColor.toString().toLowerCase().trim();
  return COLOR_MAP.has(key) ? COLOR_MAP.get(key) : 0;
}

export function setSelectedColor(hex) {
  if (hex && hex.startsWith("#")) {
    localStorage.setItem("selectedColor", hex.toUpperCase());
  }
}
`
);

write(
  "utils/math.js",
  `${extractConst("getXp")}
${extractConst("getLevel")}
${extractConst("normalizeFractlPart")}

export { getXp, getLevel, normalizeFractlPart };
`
);

write(
  "utils/binary.js",
  `export const prepareData = a => new DataView(new ArrayBuffer(a));

${extractClass("BinaryReader")}

export class Writer {
${extractClass("Writer").replace(/^class Writer \{\n/, "").replace(/\n\}$/, "")}
}

export class Reader {
${extractClass("Reader").replace(/^class Reader \{\n/, "").replace(/\n\}$/, "")}
}
`
);

write("game/Star.js", `export ${extractClass("Star").replace(/^class /, "class ")}`);

write(
  "input/coordinates.js",
  `/**
 * Экранные координаты (относительно canvas) → мировые координаты игры.
 * Учитывает pivot/scale камеры Pixi и размеры viewport canvas.
 */
export function screenToWorld(camera, screenX, screenY, viewWidth, viewHeight) {
  return {
    x: camera.x + (screenX - viewWidth / 2) / camera.s,
    y: camera.y + (screenY - viewHeight / 2) / camera.s
  };
}

export function clientToScreen(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    width: rect.width,
    height: rect.height
  };
}

export function clientToWorld(camera, clientX, clientY, canvas) {
  const screen = clientToScreen(clientX, clientY, canvas);
  return screenToWorld(camera, screen.x, screen.y, screen.width, screen.height);
}

export function clampToBorder(world, border) {
  if (!border || !border.right) return world;
  return {
    x: Math.max(border.left, Math.min(border.right, world.x)),
    y: Math.max(border.top, Math.min(border.bottom, world.y))
  };
}

export function getMouseWorld(core) {
  const app = core.app;
  const canvas = app.view;
  const { x, y } = core.ui.mouse;
  const world = clientToWorld(app.camera, x, y, canvas);
  return clampToBorder(world, core.net.border);
}
`
);

write("settings/Storage.js", `export ${extractClass("Storage").replace(/^class /, "class ")}`);
write("settings/Settings.js", `export ${extractClass("Settings").replace(/^class /, "class ")}`);
write("ui/ModalSystem.js", `export ${extractClass("ModalSystem").replace(/^class /, "class ")}`);
write("captcha/Captcha.js", `export ${extractClass("Captcha").replace(/^class /, "class ")}`);
write("skins/SkinManager.js", `export ${extractClass("SkinManager").replace(/^class /, "class ")}`);

write(
  "game/Cell.js",
  `import { removeFromArray } from "../utils/array.js";

export ${extractClass("Cell").replace(/^class /, "class ").replace(
    "this.core.app.cells.remove(this)",
    "removeFromArray(this.core.app.cells, this)"
  ).replace(
    "if (this.core.app.ownedCells.remove(this.id)",
    "if (removeFromArray(this.core.app.ownedCells, this.id)"
  )}`
);

write(
  "game/Application.js",
  `import { Cell } from "./Cell.js";
import { Star } from "./Star.js";

export ${extractClass("Application").replace(/^class /, "class ")}`
);

const networkSrc = extractClass("Network")
  .replace(/CORE\.net/g, "this.core.net")
  .replace(/CORE\.app/g, "this.core.app");

write(
  "net/Network.js",
  `import { Cell } from "../game/Cell.js";
import { getColorId } from "../utils/colors.js";
import { getLevel, normalizeFractlPart } from "../utils/math.js";
import { prepareData, Writer, Reader, BinaryReader } from "../utils/binary.js";
import { getMouseWorld } from "../input/coordinates.js";

export ${networkSrc.replace(/^class /, "class ").replace(
    `this.mouseMoveInterval = setInterval(() => {
                this.sendMouseMove(
                    (this.core.ui.mouse.x - innerWidth / 2) / this.core.app.camera.s + this.core.app.camera.x,
                    (this.core.ui.mouse.y - innerHeight / 2) / this.core.app.camera.s + this.core.app.camera.y
                );
            }, 40);`,
    `this.mouseMoveInterval = setInterval(() => {
                const world = getMouseWorld(this.core);
                this.sendMouseMove(world.x, world.y);
            }, 40);`
  ).replace(
    `writer.setUint32(x);
            writer.setUint32(y);`,
    `writer.setInt32(Math.round(x));
            writer.setInt32(Math.round(y));`
  )}`
);

const uiSrc = extractClass("UserInterface")
  .replace(/CORE\./g, "this.core.");

write(
  "ui/UserInterface.js",
  `import { ModalSystem } from "./ModalSystem.js";
import { getMouseWorld, clientToWorld, clampToBorder } from "../input/coordinates.js";

export ${uiSrc.replace(/^class /, "class ").replace(
    `onMouseMove({
            clientX,
            clientY
        }) {
            this.mouse.x = clientX
            this.mouse.y = clientY
        }`,
    `onMouseMove({ clientX, clientY }) {
            this.mouse.x = clientX;
            this.mouse.y = clientY;
        }

        getMouseWorld() {
            return getMouseWorld(this.core);
        }`
  ).replace(
    `const updateMouseAim = () => {

                const X = (this.core.ui.mouse.x - innerWidth / 2) / this.core.app.camera.s + this.core.app.camera.x;
                const Y = (this.core.ui.mouse.y - innerHeight / 2) / this.core.app.camera.s + this.core.app.camera.y;

                let x = X < this.core.net.border.right ? X : this.core.net.border.right;
                let y = Y < this.core.net.border.bottom ? Y : this.core.net.border.bottom;
                x = -this.core.net.border.right > x ? -this.core.net.border.right : x;
                y = -this.core.net.border.bottom > y ? -this.core.net.border.bottom : y;

                // change cords
                this.core.app.camera.target.x = x;
                this.core.app.camera.target.y = y;

            };`,
    `const updateMouseAim = () => {
                const world = this.getMouseWorld();
                this.core.app.camera.target.x = world.x;
                this.core.app.camera.target.y = world.y;
            };`
  )}`
);

write(
  "core/Game.js",
  `import { servers } from "../config/servers.js";
import { Application } from "../game/Application.js";
import { Storage } from "../settings/Storage.js";
import { Settings } from "../settings/Settings.js";
import { Captcha } from "../captcha/Captcha.js";
import { Network } from "../net/Network.js";
import { UserInterface } from "../ui/UserInterface.js";
import { SkinManager } from "../skins/SkinManager.js";

export class Game {
  constructor() {
    this.init();
  }

  async init() {
    this.app = new Application(this);
    this.store = new Storage();
    this.settings = new Settings(this);
    this.captcha = new Captcha({ sitekey: "0x4AAAAAAA0keHJ56_KNR0MU", theme: "dark" });
    this.net = new Network(this);
    this.ui = new UserInterface(this);
    this.app.servers = servers;
    this.skins = new SkinManager(this);
    this.account = { xp: 0, uid: localStorage.accountToken || "" };

    await this.skins.init();

    const url = location.hostname
      ? \`ws\${location.protocol === "https:" ? "s" : ""}://\${Object.keys(servers)[0]}\`
      : "ws://localhost:3000/";
    this.defaultServerUrl = url;
    console.log("Prepared to connect to", url);

    const token = location.hostname ? await this.captcha.getToken() : "";
    this.net.connect(url, token);
  }
}
`
);

write(
  "main.js",
  `import { Game } from "./core/Game.js";

const core = new Game();
window.CORE = core;
`
);

console.log("Done. Modules in client/js/");
