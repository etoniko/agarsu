export function installArrayExtensions() {
    if (Array.prototype.remove) return;
    Array.prototype.remove = function (item) {
        const i = this.indexOf(item);
        return i !== -1 && this.splice(i, 1);
    };
}
