/**
 * Own antimat: normalize obfuscation so
 * "Пизда" / "пиз да" / "п.и.з.д.а" / "пи,зда" → "пизда"
 * Mask: first letter + "***"  (п***)
 */

/** Latin / lookalike → Cyrillic (common chat bypass) */
const LOOKALIKE = {
  a: "а",
  b: "в",
  c: "с",
  e: "е",
  h: "н",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
  y: "у",
  "0": "о",
  "3": "з",
  "4": "ч",
  "6": "б",
  "@": "а",
  $: "с"
};

const SHORT_MAX = 3; // short words need letter-boundaries in original

function mapChar(ch) {
  const lower = ch.toLowerCase().replace(/ё/g, "е");
  if (LOOKALIKE[lower]) return LOOKALIKE[lower];
  if (/[a-zа-я0-9]/i.test(lower)) return lower;
  return null;
}

/**
 * Keep only meaningful letters; remember original indices.
 * Junk between letters (space, ., ,, *, ZWSP, …) is dropped.
 */
function flattenMessage(text) {
  const chars = Array.from(String(text || ""));
  const norm = [];
  const indexMap = []; // normOffset → original char index
  for (let i = 0; i < chars.length; i++) {
    const mapped = mapChar(chars[i]);
    if (mapped == null) continue;
    // digits only keep if lookalike mapped or as-is digit used in leet
    norm.push(mapped);
    indexMap.push(i);
  }
  return { norm: norm.join(""), indexMap, chars };
}

/** Dictionary entry → letters-only key */
function normalizeWord(word) {
  const out = [];
  for (const ch of Array.from(String(word || ""))) {
    const m = mapChar(ch);
    if (m != null) out.push(m);
  }
  return out.join("");
}

function compileDictionary(rawSet) {
  const byLen = new Map(); // length → Set of keys
  const list = [];
  for (const raw of rawSet) {
    const key = normalizeWord(raw);
    if (key.length < 2) continue;
    if (!byLen.has(key.length)) byLen.set(key.length, new Set());
    const bucket = byLen.get(key.length);
    if (bucket.has(key)) continue;
    bucket.add(key);
    list.push(key);
  }
  list.sort((a, b) => b.length - a.length);
  return { list, byLen };
}

function isLetterAt(chars, idx) {
  if (idx < 0 || idx >= chars.length) return false;
  return mapChar(chars[idx]) != null;
}

/**
 * Find non-overlapping matches in flattened string.
 * Short keys require original letter-boundaries to cut false positives.
 */
function findMatches(flat, dict) {
  const { norm, indexMap, chars } = flat;
  const n = norm.length;
  const used = new Uint8Array(n);
  const hits = [];

  for (const key of dict.list) {
    const len = key.length;
    if (len > n) continue;
    let from = 0;
    while (from <= n - len) {
      const idx = norm.indexOf(key, from);
      if (idx === -1) break;
      let overlap = false;
      for (let i = idx; i < idx + len; i++) {
        if (used[i]) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        const origStart = indexMap[idx];
        const origEnd = indexMap[idx + len - 1];
        const short = len <= SHORT_MAX;
        const leftOk = !isLetterAt(chars, origStart - 1);
        const rightOk = !isLetterAt(chars, origEnd + 1);
        if (!short || (leftOk && rightOk)) {
          for (let i = idx; i < idx + len; i++) used[i] = 1;
          hits.push({ normStart: idx, normEnd: idx + len - 1, origStart, origEnd, key });
        }
      }
      from = idx + 1;
    }
  }

  hits.sort((a, b) => a.origStart - b.origStart);
  return hits;
}

function maskSpan(chars, start, end) {
  const first = chars[start];
  return first + "***";
}

/**
 * @param {Set<string>|Iterable<string>} badWordsSet
 * @param {string} message
 * @returns {string}
 */
function censorText(badWordsSet, message) {
  if (!badWordsSet || badWordsSet.size === 0) return message;
  const text = String(message || "");
  if (!text) return text;

  let dict = badWordsSet._antimatDict;
  if (!dict || dict.from !== badWordsSet) {
    dict = compileDictionary(badWordsSet);
    dict.from = badWordsSet;
    try {
      badWordsSet._antimatDict = dict;
    } catch {
      // Set may be frozen; keep local only this call
    }
  }

  const flat = flattenMessage(text);
  if (!flat.norm) return text;
  const hits = findMatches(flat, dict);
  if (!hits.length) return text;

  const chars = flat.chars;
  let out = "";
  let cursor = 0;
  for (const hit of hits) {
    if (hit.origStart < cursor) continue;
    out += chars.slice(cursor, hit.origStart).join("");
    out += maskSpan(chars, hit.origStart, hit.origEnd);
    cursor = hit.origEnd + 1;
  }
  out += chars.slice(cursor).join("");
  return out;
}

function countHits(badWordsSet, message) {
  if (!badWordsSet || badWordsSet.size === 0) return 0;
  const text = String(message || "");
  if (!text) return 0;
  let dict = badWordsSet._antimatDict;
  if (!dict || dict.from !== badWordsSet) {
    dict = compileDictionary(badWordsSet);
    dict.from = badWordsSet;
    try {
      badWordsSet._antimatDict = dict;
    } catch {
    }
  }
  return findMatches(flattenMessage(text), dict).length;
}

export {
  SHORT_MAX,
  censorText,
  countHits,
  flattenMessage,
  normalizeWord
};
