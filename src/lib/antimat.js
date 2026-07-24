/**
 * Own antimat: normalize obfuscation so
 * "Пизда" / "пиз да" / "п.и.з.д.а" / "pizda" / "blya" → словарь
 * Mask: full asterisks (no first letter kept)
 *
 * Сколько «схожих» латиница↔кириллица:
 * — визуальных близнецов (выглядят одинаково): ~12 (a/а, e/е, o/о, p/р, c/с, x/х, y/у, H/Н, K/К, M/М, T/Т, B/В)
 * — для чата важнее транслит: вся латиница a–z → русские звуки (p→п, не р!), иначе "pizda" станет "ризда"
 * — плюс греческие, leet-цифры, диграфы ya/zh/sh…
 */

/** Latin single letters → Russian (phonetic translit for chat) */
const LATIN = {
  a: "а",
  b: "б",
  c: "с",
  d: "д",
  e: "е",
  f: "ф",
  g: "г",
  h: "х",
  i: "и",
  j: "й",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "к",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  w: "ш",
  x: "х",
  y: "й",
  z: "з"
};

/** Visual / Greek / leet extras → Russian */
const EXTRA = {
  α: "а",
  β: "в",
  ε: "е",
  η: "н",
  ι: "и",
  κ: "к",
  ο: "о",
  ρ: "р",
  τ: "т",
  υ: "у",
  χ: "х",
  φ: "ф",
  "0": "о",
  "1": "и",
  "3": "з",
  "4": "ч",
  "5": "с",
  "6": "б",
  "7": "т",
  "8": "в",
  "9": "д",
  "@": "а",
  $: "с"
};

/** Rare Cyrillic → Russian */
const CYR_VARIANT = {
  ё: "е",
  і: "и",
  ї: "и",
  ґ: "г",
  є: "е",
  ў: "у",
  һ: "н",
  ѕ: "с"
};

/** Latin digraphs / trigraphs (longest first) */
const DIGRAPHS = [
  ["shch", "щ"],
  ["sch", "щ"],
  ["yo", "е"],
  ["zh", "ж"],
  ["kh", "х"],
  ["ts", "ц"],
  ["tc", "ц"],
  ["ch", "ч"],
  ["sh", "ш"],
  ["ya", "я"],
  ["ja", "я"],
  ["yu", "ю"],
  ["ju", "ю"],
  ["ye", "е"],
  ["je", "е"],
  ["yi", "и"],
  ["iy", "ий"]
];

const SHORT_MAX = 3;
const LOOKALIKE_COUNT = Object.keys(LATIN).length + Object.keys(EXTRA).length;
const VISUAL_TWIN_COUNT = 12; // aа eе oо pр cс xх yу HН KК MМ TТ BВ

function foldFullwidth(ch) {
  const code = ch.codePointAt(0);
  if (code >= 0xff21 && code <= 0xff3a) return String.fromCharCode(code - 0xff21 + 97);
  if (code >= 0xff41 && code <= 0xff5a) return String.fromCharCode(code - 0xff41 + 97);
  return ch;
}

function isLatinLetter(ch) {
  return /^[a-z]$/i.test(foldFullwidth(ch));
}

/**
 * Extract letter-like stream: latin kept as a-z for digraphs; cyr/leet already folded.
 */
function extractSeq(chars) {
  const seq = [];
  for (let i = 0; i < chars.length; i++) {
    let c = foldFullwidth(chars[i]).toLowerCase();
    if (CYR_VARIANT[c]) {
      seq.push({ ch: CYR_VARIANT[c], i, latin: false });
      continue;
    }
    if (/[а-я]/i.test(c)) {
      seq.push({ ch: c, i, latin: false });
      continue;
    }
    if (/[a-z]/i.test(c)) {
      seq.push({ ch: c, i, latin: true });
      continue;
    }
    if (EXTRA[c]) {
      seq.push({ ch: EXTRA[c], i, latin: false });
    }
    // junk skipped
  }
  return seq;
}

function seqToNorm(seq) {
  const norm = [];
  const indexMap = [];
  const indexMapEnd = [];
  let i = 0;
  while (i < seq.length) {
    if (seq[i].latin) {
      let matched = false;
      for (const [from, to] of DIGRAPHS) {
        if (i + from.length > seq.length) continue;
        let ok = true;
        for (let k = 0; k < from.length; k++) {
          if (!seq[i + k].latin || seq[i + k].ch !== from[k]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const startI = seq[i].i;
        const endI = seq[i + from.length - 1].i;
        for (const outCh of to) {
          norm.push(outCh);
          indexMap.push(startI);
          indexMapEnd.push(endI);
        }
        i += from.length;
        matched = true;
        break;
      }
      if (matched) continue;
      norm.push(LATIN[seq[i].ch] || seq[i].ch);
      indexMap.push(seq[i].i);
      indexMapEnd.push(seq[i].i);
      i++;
      continue;
    }
    norm.push(seq[i].ch);
    indexMap.push(seq[i].i);
    indexMapEnd.push(seq[i].i);
    i++;
  }
  return { norm: norm.join(""), indexMap, indexMapEnd };
}

function mapChar(ch) {
  // used for boundary checks — anything that survives extractSeq
  let c = foldFullwidth(ch).toLowerCase();
  if (CYR_VARIANT[c] || /[а-я]/i.test(c) || /[a-z]/i.test(c) || EXTRA[c]) return true;
  return null;
}

function flattenMessage(text) {
  const chars = Array.from(String(text || ""));
  const seq = extractSeq(chars);
  const { norm, indexMap, indexMapEnd } = seqToNorm(seq);
  return { norm, indexMap, indexMapEnd, chars };
}

function normalizeWord(word) {
  return flattenMessage(word).norm;
}

function compileDictionary(rawSet) {
  const byLen = new Map();
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

function findMatches(flat, dict) {
  const { norm, indexMap, indexMapEnd, chars } = flat;
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
      for (let j = idx; j < idx + len; j++) {
        if (used[j]) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        const origStart = indexMap[idx];
        const origEnd = (indexMapEnd || indexMap)[idx + len - 1];
        const short = len <= SHORT_MAX;
        const leftOk = !isLetterAt(chars, origStart - 1);
        const rightOk = !isLetterAt(chars, origEnd + 1);
        if (!short || (leftOk && rightOk)) {
          for (let j = idx; j < idx + len; j++) used[j] = 1;
          hits.push({ origStart, origEnd, key });
        }
      }
      from = idx + 1;
    }
  }

  hits.sort((a, b) => a.origStart - b.origStart);
  return hits;
}

function maskSpan(chars, start, end) {
  const len = Math.max(3, (end - start + 1) | 0);
  return "*".repeat(len);
}

function getDict(badWordsSet) {
  let dict = badWordsSet._antimatDict;
  if (!dict || dict.from !== badWordsSet) {
    dict = compileDictionary(badWordsSet);
    dict.from = badWordsSet;
    try {
      badWordsSet._antimatDict = dict;
    } catch {
    }
  }
  return dict;
}

function censorText(badWordsSet, message) {
  if (!badWordsSet || badWordsSet.size === 0) return message;
  const text = String(message || "");
  if (!text) return text;
  const dict = getDict(badWordsSet);
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
  return findMatches(flattenMessage(text), getDict(badWordsSet)).length;
}

export {
  LOOKALIKE_COUNT,
  VISUAL_TWIN_COUNT,
  SHORT_MAX,
  censorText,
  countHits,
  flattenMessage,
  normalizeWord
};
