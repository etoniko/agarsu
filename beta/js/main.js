import { installArrayExtensions } from "./utils/extensions.js";
import { Core } from "./core/Core.js";

installArrayExtensions();

const core = new Core();
globalThis.CORE = core;

export { core as CORE };
