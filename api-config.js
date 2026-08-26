/** API-only lists and CDN — never serve pass/skinlist from GitHub Pages. */
(function (w) {
  var api = "https://api.agar.su";
  w.AGAR_API = api;
  w.AGAR_STATS_API = api + "/stats-api";
  w.AGAR_SKIN_CDN = api + "/skins";
  w.AGAR_STICKER_CDN = api + "/stickers";
  w.AGAR_LISTS = {
    pass: api + "/pass.txt",
    skinlist: api + "/skinlist.txt",
    stickerlist: api + "/stickerlist.txt",
    invisible: api + "/invisible.txt",
    rotation: api + "/rotation.txt",
    word: api + "/word.txt",
    allowtxt: api + "/allowtxt.txt",
  };
})(window);
