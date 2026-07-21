function normalizeNick(nick) {
  if (!nick) return "";
  let n = nick.trim();
  if (n.startsWith("[")) {
    const endIndex = n.indexOf("]");
    if (endIndex === -1) return "";
    const innerNick = n.substring(1, endIndex).trim();
    if (!innerNick || innerNick !== n.substring(1, endIndex)) return "";
    return `[${innerNick}]`.toLowerCase();
  }
  if (!n || n.trim() !== n) return "";
  return n.toLowerCase();
}
function normalizeNickInner(nick) {
  if (!nick) return "";
  let n = nick.trim();
  const brackets = { "[": "]", "{": "}", "(": ")", "|": "|" };
  const firstChar = n.charAt(0);
  const lastChar = n.charAt(n.length - 1);
  if (brackets[firstChar]) {
    const closeChar = brackets[firstChar];
    const endIndex = n.indexOf(closeChar, 1);
    if (endIndex === -1) return "";
    const innerNick = n.substring(1, endIndex);
    if (!innerNick || innerNick.trim() !== innerNick) return "";
    n = innerNick;
  } else if (!n || n.trim() !== n) {
    return "";
  }
  return n.toLowerCase();
}
export {
  normalizeNick,
  normalizeNickInner
};