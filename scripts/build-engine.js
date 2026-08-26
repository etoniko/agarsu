const fs = require("fs");
const path = require("path");

const srcPath = path.join(__dirname, "..", "main.js");
const outPath = path.join(__dirname, "game", "engine.js");

let s = fs.readFileSync(srcPath, "utf8");
if (s.startsWith("(() => {\n")) s = s.slice("(() => {\n".length);
const trimmed = s.trimEnd();
if (trimmed.endsWith("})();")) s = trimmed.slice(0, -5);

const bootIdx = s.lastIndexOf("async function boot()");
if (bootIdx > 0) s = s.slice(0, bootIdx);

const header =
  "import { tryCreateWebGL2Renderer } from '../render/webgl2-renderer.js';\n" +
  "import { drawCellGL } from '../render/cell-draw-gl.js';\n\n";

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + s);
console.log("engine.js lines:", (header + s).split("\n").length);
