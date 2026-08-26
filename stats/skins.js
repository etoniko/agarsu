(function () {
  const SKINLIST_URL = window.SKINLIST_URL || "https://api.agar.su/skinlist.txt";
  const SKINS_BASE = (window.SKINS_BASE || "https://api.agar.su/skins").replace(/\/$/, "");
  const DEFAULT_SKIN = window.DEFAULT_SKIN_URL || SKINS_BASE + "/4.png";
  const STRIP_MS = 100;
  const STRIP_SELECTOR = ".avatar, img.avatar, .skin-avatar";

  let skinMap = null;
  let loadPromise = null;
  const imageCache = new Map();
  let stripRaf = 0;
  let lastStripTick = 0;
  const FAVICON_SIZE = 32;
  const faviconState = {
    url: "",
    link: null,
    canvas: null,
    ctx: null,
    lastFrame: -1,
    lastDataUrl: "",
  };

  function parseSkinlist(text) {
    const map = new Map();
    String(text || "")
      .split("\n")
      .forEach((line) => {
        const idx = line.indexOf(":");
        if (idx < 0) return;
        const nick = line.slice(0, idx).trim().toLowerCase();
        const id = line.slice(idx + 1).trim();
        if (nick && id) map.set(nick, id);
      });
    return map;
  }

  function lookupSkinId(nick) {
    if (!skinMap || !nick) return null;
    const raw = String(nick).trim();
    if (skinMap.has(raw.toLowerCase())) return skinMap.get(raw.toLowerCase());
    const m = raw.match(/^\[[^\]]+\](.+)$/);
    if (m && m[1]) {
      const base = m[1].trim().toLowerCase();
      if (skinMap.has(base)) return skinMap.get(base);
    }
    return null;
  }

  function skinUrlForNick(nick) {
    const id = lookupSkinId(nick);
    return id ? SKINS_BASE + "/" + id + ".png" : DEFAULT_SKIN;
  }

  function resolveAvatar(row) {
    if (!row) return DEFAULT_SKIN;
    const nicks = [];
    if (row.nick) nicks.push(row.nick);
    if (row.clan) nicks.push(row.clan);
    if (Array.isArray(row.nicks)) nicks.push(...row.nicks);
    if (Array.isArray(row.members)) nicks.push(...row.members);
    for (const n of nicks) {
      const id = lookupSkinId(n);
      if (id) return SKINS_BASE + "/" + id + ".png";
    }
    return DEFAULT_SKIN;
  }

  async function loadSkins(force) {
    if (!force && skinMap) return skinMap;
    if (!force && loadPromise) return loadPromise;
    loadPromise = fetch(SKINLIST_URL, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("skinlist");
        return r.text();
      })
      .then((text) => {
        skinMap = parseSkinlist(text);
        return skinMap;
      })
      .catch(() => skinMap || new Map())
      .finally(() => {
        loadPromise = null;
      });
    return loadPromise;
  }

  function extractCssUrl(value) {
    if (!value || value === "none") return "";
    const m = String(value).match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
    return m ? m[1] : "";
  }

  function getElementSkinUrl(el) {
    if (!el) return "";
    if (el.tagName === "IMG") return el.currentSrc || el.getAttribute("src") || el.src || "";
    const data = el.getAttribute("data-skin-url");
    if (data) return data;
    const inline = extractCssUrl(el.style.backgroundImage);
    if (inline) return inline;
    try {
      return extractCssUrl(getComputedStyle(el).backgroundImage);
    } catch (e) {
      return "";
    }
  }

  function loadCachedImage(url) {
    if (!url) return null;
    const hit = imageCache.get(url);
    if (hit instanceof Image) return hit;
    if (hit === "error") return null;
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    imageCache.set(url, img);
    img.onload = () => imageCache.set(url, img);
    img.onerror = () => imageCache.set(url, "error");
    img.src = url;
    return img;
  }

  function getStripInfo(img) {
    if (!img) return { isStrip: false, frames: 1, fw: 0, fh: 0 };
    const fw = img.naturalWidth || img.width || 0;
    const fh = img.naturalHeight || img.height || 0;
    if (fw <= 0 || fh <= 0) return { isStrip: false, frames: 1, fw, fh };
    const frames = fw > fh ? Math.max(1, Math.floor(fw / fh)) : 1;
    return { isStrip: frames > 1, frames, fw, fh };
  }

  function frameIndex(frames, now) {
    if (!frames || frames <= 1) return 0;
    return Math.floor((now != null ? now : Date.now()) / STRIP_MS) % frames;
  }

  function clearStrip(el) {
    if (!el || el.dataset.skinStrip !== "1") return;
    if (el.tagName === "IMG") {
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      el.style.removeProperty("max-width");
      el.style.removeProperty("transform");
      el.style.removeProperty("object-fit");
      el.style.removeProperty("border-radius");
      el.style.removeProperty("border");
      el.style.removeProperty("box-shadow");
      el.style.removeProperty("display");
      el.classList.remove("skin-strip-anim");
      delete el.dataset.skinStripSide;
    } else {
      el.style.backgroundSize = "";
      el.style.backgroundPosition = "";
      el.style.backgroundRepeat = "";
      el.classList.remove("skin-strip-bg");
    }
    delete el.dataset.skinStrip;
  }

  function applyBackgroundStrip(el, frames, frame) {
    const w = el.clientWidth || el.offsetWidth;
    const h = el.clientHeight || el.offsetHeight;
    const side = Math.max(1, Math.min(w || h, h || w));
    if (!side) return;
    el.classList.add("skin-strip-bg");
    el.style.backgroundRepeat = "no-repeat";
    el.style.backgroundSize = frames * side + "px " + side + "px";
    el.style.backgroundPosition = "-" + frame * side + "px center";
    el.dataset.skinStrip = "1";
  }

  function ensureImgHost(img) {
    const parent = img.parentElement;
    if (!parent) return null;
    if (parent.classList.contains("skin-strip-host")) return parent;
    const cs = getComputedStyle(img);
    const side = Math.max(
      1,
      Math.round(
        Math.min(parseFloat(cs.width) || img.clientWidth || 0, parseFloat(cs.height) || img.clientHeight || 0) || 72
      )
    );
    const wrap = document.createElement("span");
    wrap.className = "skin-strip-host";
    wrap.style.cssText =
      "width:" +
      side +
      "px;height:" +
      side +
      "px;min-width:" +
      side +
      "px;min-height:" +
      side +
      "px;overflow:hidden;border-radius:50%;display:inline-block;flex-shrink:0;box-sizing:border-box;vertical-align:middle;position:relative;";
    if (cs.borderTopWidth && cs.borderTopWidth !== "0px") {
      wrap.style.border = cs.borderTopWidth + " solid " + (cs.borderTopColor || "currentColor");
    }
    parent.insertBefore(wrap, img);
    wrap.appendChild(img);
    img.dataset.skinStripWrapped = "1";
    return wrap;
  }

  function applyImgStrip(img, frames, frame) {
    const host = ensureImgHost(img);
    if (!host) return;
    let side = parseInt(img.dataset.skinStripSide || "", 10);
    if (!side) {
      side = Math.max(
        1,
        Math.round(Math.min(host.clientWidth || host.offsetWidth || 0, host.clientHeight || host.offsetHeight || 0) || 72)
      );
      img.dataset.skinStripSide = String(side);
    }
    img.classList.add("skin-strip-anim");
    img.style.setProperty("width", frames * side + "px", "important");
    img.style.setProperty("height", side + "px", "important");
    img.style.setProperty("max-width", "none", "important");
    img.style.setProperty("border-radius", "0", "important");
    img.style.setProperty("border", "none", "important");
    img.style.setProperty("object-fit", "fill", "important");
    img.style.setProperty("display", "block", "important");
    img.style.setProperty("transform", "translateX(-" + frame * side + "px)", "important");
    img.dataset.skinStrip = "1";
  }

  function updateStripEl(el, now) {
    const url = getElementSkinUrl(el);
    if (!url) {
      clearStrip(el);
      return;
    }
    const img = loadCachedImage(url);
    if (!(img instanceof Image) || !img.complete || !(img.naturalWidth || img.width)) return;
    const info = getStripInfo(img);
    if (!info.isStrip) {
      clearStrip(el);
      return;
    }
    const frame = frameIndex(info.frames, now);
    if (el.tagName === "IMG") applyImgStrip(el, info.frames, frame);
    else applyBackgroundStrip(el, info.frames, frame);
  }

  function injectStripCss() {
    if (document.getElementById("stats-skin-strip-css")) return;
    const style = document.createElement("style");
    style.id = "stats-skin-strip-css";
    style.textContent =
      ".avatar{background-size:cover;background-position:center;background-repeat:no-repeat;}" +
      ".avatar.skin-strip-bg{background-repeat:no-repeat !important;}" +
      ".skin-strip-host{overflow:hidden !important;border-radius:50% !important;display:inline-block !important;flex-shrink:0;box-sizing:border-box;vertical-align:middle;position:relative;}" +
      "img.skin-strip-anim{max-width:none !important;object-fit:fill !important;border-radius:0 !important;border:none !important;display:block !important;}";
    document.head.appendChild(style);
  }

  function getPageIconLink() {
    if (faviconState.link && faviconState.link.isConnected) return faviconState.link;
    let link = document.getElementById("pageIcon");
    if (!link) {
      link = document.createElement("link");
      link.id = "pageIcon";
      link.rel = "icon";
      link.type = "image/png";
      document.head.appendChild(link);
    }
    faviconState.link = link;
    return link;
  }

  function drawFaviconDataUrl(img, frame) {
    if (!faviconState.canvas) {
      faviconState.canvas = document.createElement("canvas");
      faviconState.ctx = faviconState.canvas.getContext("2d");
    }
    const canvas = faviconState.canvas;
    const ctx = faviconState.ctx;
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;
    ctx.clearRect(0, 0, FAVICON_SIZE, FAVICON_SIZE);
    const info = getStripInfo(img);
    const fw = img.naturalWidth || img.width || 0;
    const fh = img.naturalHeight || img.height || 0;
    if (fw <= 0 || fh <= 0) return "";
    if (info.isStrip) {
      ctx.drawImage(img, frame * fh, 0, fh, fh, 0, 0, FAVICON_SIZE, FAVICON_SIZE);
    } else {
      ctx.drawImage(img, 0, 0, fw, fh, 0, 0, FAVICON_SIZE, FAVICON_SIZE);
    }
    try {
      return canvas.toDataURL("image/png");
    } catch (e) {
      return "";
    }
  }

  function setFaviconStatic(url) {
    const link = getPageIconLink();
    faviconState.lastFrame = -1;
    faviconState.lastDataUrl = "";
    if (link.href !== url) link.href = url;
  }

  /** Animated favicon for strip skins (canvas → link.href). */
  function setFavicon(url) {
    const next = String(url || DEFAULT_SKIN);
    if (faviconState.url === next) return;
    faviconState.url = next;
    faviconState.lastFrame = -1;
    faviconState.lastDataUrl = "";
    const img = loadCachedImage(next);
    if (!(img instanceof Image)) {
      setFaviconStatic(DEFAULT_SKIN);
      return;
    }
    const apply = () => {
      if (faviconState.url !== next) return;
      if (skinImageCacheIsError(next)) {
        setFaviconStatic(DEFAULT_SKIN);
        return;
      }
      if (!img.complete || !(img.naturalWidth || img.width)) return;
      const info = getStripInfo(img);
      if (!info.isStrip) {
        setFaviconStatic(next);
        return;
      }
      updateFavicon(Date.now());
    };
    apply();
    if (!img.complete) {
      img.addEventListener("load", apply, { once: true });
      img.addEventListener("error", () => setFaviconStatic(DEFAULT_SKIN), { once: true });
    }
  }

  function skinImageCacheIsError(url) {
    return imageCache.get(url) === "error";
  }

  function updateFavicon(now) {
    if (!faviconState.url || document.hidden) return;
    const img = loadCachedImage(faviconState.url);
    if (!(img instanceof Image) || !img.complete || !(img.naturalWidth || img.width)) return;
    const info = getStripInfo(img);
    if (!info.isStrip) return;
    const frame = frameIndex(info.frames, now);
    if (frame === faviconState.lastFrame && faviconState.lastDataUrl) return;
    const dataUrl = drawFaviconDataUrl(img, frame);
    if (!dataUrl) {
      setFaviconStatic(faviconState.url);
      return;
    }
    faviconState.lastFrame = frame;
    faviconState.lastDataUrl = dataUrl;
    getPageIconLink().href = dataUrl;
  }

  function startStripAnimator() {
    if (stripRaf) return;
    injectStripCss();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && faviconState.url) updateFavicon(Date.now());
    });
    function loop() {
      stripRaf = requestAnimationFrame(loop);
      const now = Date.now();
      if (now - lastStripTick < 50) return;
      lastStripTick = now;
      const nodes = document.querySelectorAll(STRIP_SELECTOR);
      for (let i = 0; i < nodes.length; i++) updateStripEl(nodes[i], now);
      updateFavicon(now);
    }
    stripRaf = requestAnimationFrame(loop);
  }

  /** Avatar markup helper: prefers div+background (stable strip clip). */
  function avatarHtml(url, className) {
    const safe = String(url || DEFAULT_SKIN).replace(/'/g, "%27").replace(/"/g, "&quot;");
    const cls = className || "avatar";
    return (
      '<div class="' +
      cls +
      '" role="img" data-skin-url="' +
      safe +
      '" style="background-image:url(\'' +
      safe +
      "')\"></div>"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startStripAnimator);
  } else {
    startStripAnimator();
  }

  window.statsSkins = {
    loadSkins,
    skinUrlForNick,
    resolveAvatar,
    avatarHtml,
    setFavicon,
    startStripAnimator,
  };
})();
