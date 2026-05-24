export function normalizeNick(nick) {
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

export function parseFullNick(full) {
    const str = String(full || "").trim();
    const [nickPart, pass = ""] = str.split("#", 2);
    const hasClan = /\[[^\]]+\]/.test(nickPart);
    const cleanNick = nickPart.replace(/\[|\]/g, "").trim();
    return { str, nickPart, pass: pass.trim(), hasClan, cleanNick };
}
