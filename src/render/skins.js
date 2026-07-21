import { SKIN_CDN, SKIN_FALLBACK_URL } from "../config/endpoints.js";
const skinImageCache = new Map();
function getSkinImageUrl(skinId, fallbackId = "4") {
  const id = skinId && String(skinId).trim() || fallbackId;
  return `${SKIN_CDN}/${id}.png`;
}
function resolveAssetUrl(url) {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}
function setImgSrc(img, url) {
  if (!img || !url) return;
  const resolved = resolveAssetUrl(url);
  if (img.dataset.resolvedSrc === resolved) return;
  img.dataset.resolvedSrc = resolved;
  img.src = resolved;
}
function loadCachedImage(url) {
  const entry = skinImageCache.get(url);
  if (entry instanceof Image) return entry;
  if (entry === "error") {
    if (url === SKIN_FALLBACK_URL) return null;
    return loadCachedImage(SKIN_FALLBACK_URL);
  }
  const img = new Image();
  img.decoding = "async";
  skinImageCache.set(url, img);
  img.onload = () => skinImageCache.set(url, img);
  img.onerror = () => {
    skinImageCache.set(url, "error");
    if (url !== SKIN_FALLBACK_URL) loadCachedImage(SKIN_FALLBACK_URL);
  };
  img.src = url;
  return img;
}
function getSkinImage(skinId) {
  return loadCachedImage(getSkinImageUrl(skinId));
}
export {
  SKIN_FALLBACK_URL,
  getSkinImage,
  getSkinImageUrl,
  loadCachedImage,
  resolveAssetUrl,
  setImgSrc,
  skinImageCache
};