export const SERVERS = {
    "reg.agar.su": { name: "FFA - Moscow" },
    "ffa.agar.su:6002": { name: "MegaSplit" },
    "ffa.agar.su:6004": { name: "pvp1: 1x1 ffa 1k" },
    "ffa.agar.su:6005": { name: "pvp2: 2x2 ms 1k" }
};

export function getDefaultWsUrl() {
    const host = Object.keys(SERVERS)[0];
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${host}`;
}
