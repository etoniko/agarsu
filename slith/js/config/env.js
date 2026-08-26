/** Локальная разработка — без капчи, ws://localhost:6009 */
export function isLocalDev() {
    const h = location.hostname;
    return !h || h === "localhost" || h === "127.0.0.1";
}

export function getServerWsUrl(servers) {
    if (isLocalDev()) {
        return "ws://localhost:6009";
    }
    const host = Object.keys(servers)[0];
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${host}`;
}

export function needsCaptcha() {
    return !isLocalDev();
}
