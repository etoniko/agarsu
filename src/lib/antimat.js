/**
 * Simple antimat: exact keywords from word.txt (case-insensitive).
 * No fuzzy / digit-wild / prefix matching — those were censoring normal chat.
 */

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/Ё/g, "е");
}

function cleanEntry(raw) {
  let s = normalize(raw).trim();
  if (!s) return "";
  if (/\s/.test(s)) {
    return s
      .replace(/[^a-zа-я0-9\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return s.replace(/[^a-zа-я0-9]+/g, "");
}

function compileDictionary(rawSet) {
  const words = new Set();
  const phrases = [];
  const seenPhrase = new Set();

  for (const raw of rawSet) {
    const key = cleanEntry(raw);
    if (key.length < 2) continue;
    if (key.includes(" ")) {
      if (seenPhrase.has(key)) continue;
      seenPhrase.add(key);
      phrases.push(key);
    } else {
      words.add(key);
    }
  }

  phrases.sort((a, b) => b.length - a.length);
  return { words, phrases };
}

function getDict(badWordsSet) {
  let dict = badWordsSet._antimatDict;
  if (!dict || dict.from !== badWordsSet) {
    dict = compileDictionary(badWordsSet);
    dict.from = badWordsSet;
    try {
      badWordsSet._antimatDict = dict;
    } catch {
      /* ignore */
    }
  }
  return dict;
}

/** Token = letters/digits (ru + latin). Case already folded via normalize. */
const TOKEN_RE = /[a-zа-я0-9]+/g;

function collectHits(norm, dict) {
  const hits = [];
  const used = new Uint8Array(norm.length);

  const mark = (start, end) => {
    if (end <= start) return false;
    for (let i = start; i < end; i++) {
      if (used[i]) return false;
    }
    for (let i = start; i < end; i++) used[i] = 1;
    hits.push({ start, end });
    return true;
  };

  // Multi-word phrases first (longest first)
  for (const phrase of dict.phrases) {
    let from = 0;
    while (from <= norm.length - phrase.length) {
      const idx = norm.indexOf(phrase, from);
      if (idx === -1) break;
      mark(idx, idx + phrase.length);
      from = idx + phrase.length;
    }
  }

  // Whole-word tokens only
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(norm)) !== null) {
    const token = m[0];
    if (dict.words.has(token)) {
      mark(m.index, m.index + token.length);
    }
  }

  hits.sort((a, b) => a.start - b.start);
  return hits;
}

function censorText(badWordsSet, message) {
  if (!badWordsSet || badWordsSet.size === 0) return message;
  const text = String(message || "");
  if (!text) return text;

  const dict = getDict(badWordsSet);
  const norm = normalize(text);
  if (!norm) return text;

  const hits = collectHits(norm, dict);
  if (!hits.length) return text;

  // Map by code units: normalize only lowercases + ё→е (same length as original for BMP)
  const chars = Array.from(text);
  const normChars = Array.from(norm);
  if (chars.length !== normChars.length) {
    // Rare: surrogate pairs / unexpected — fall back to token replace on string
    let out = text;
    for (const phrase of dict.phrases) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out.replace(re, "***");
    }
    out = out.replace(TOKEN_RE, (tok) => (dict.words.has(normalize(tok)) ? "***" : tok));
    return out;
  }

  let result = "";
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    result += chars.slice(cursor, hit.start).join("");
    result += "***";
    cursor = hit.end;
  }
  result += chars.slice(cursor).join("");
  return result;
}

function countHits(badWordsSet, message) {
  if (!badWordsSet || badWordsSet.size === 0) return 0;
  const text = String(message || "");
  if (!text) return 0;
  return collectHits(normalize(text), getDict(badWordsSet)).length;
}

export {
  censorText,
  countHits,
  cleanEntry as normalizeWord
};
