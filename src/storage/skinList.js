import {
  TTL_MS,
  loadSkinListMap,
  applySkinListToState,
  getSkinIdForNick,
  getSkinUrlForNick,
  invalidateStatsRenderCaches
} from "./staticLists.js";
import { SKIN_FALLBACK_URL } from "../config/endpoints.js";
function getSkinFallbackUrl() {
  return SKIN_FALLBACK_URL;
}
export {
  TTL_MS,
  applySkinListToState,
  getSkinFallbackUrl,
  getSkinIdForNick,
  getSkinUrlForNick,
  invalidateStatsRenderCaches,
  loadSkinListMap
};