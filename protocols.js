/**
 * Compatibility shim — full adapters live in multiprotocol.js.
 * Keep this file so old cached <script src="protocols.js"> still resolve AgarProtocols
 * if multiprotocol.js already loaded; otherwise no-op.
 */
(function (global) {
  "use strict";
  if (global.AgarProtocols) return;
  console.warn("[protocols.js] load multiprotocol.js instead — AgarProtocols missing");
})(typeof window !== "undefined" ? window : globalThis);
