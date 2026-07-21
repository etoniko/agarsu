const log = {
  info(str) {
    console.debug("[INFO]", str);
  },
  warn(str) {
    console.warn("[WARN]", str);
  },
  err(str) {
    console.error("[ERROR] ", str);
  },
  debug(str) {
    console.info("[DEBUG] ", str);
  }
};
if (typeof window !== "undefined") {
  window.log = log;
}
export {
  log
};