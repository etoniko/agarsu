/**
 * Own antimat: normalize obfuscation so
 * "Пизда" / "пиз да" / "п.и.з.д.а" / "pizda" / "пи3орас" / "пидора" → словарь
 * Mask: always "***"
 *
 * — латиница → кириллица (транслит)
 * — цифры = wildcard (одна любая буква): пи3орас ≈ пидорас
 * — 1 ошибка / не дописал (для слов ≥5–6 букв)
 */

const WILD = "\u0001";

/** Latin single letters → Russian (phonetic translit for chat) */
const LATIN = {
  a: "а", b: "б", c: "с", d: "д", e: "е", f: "ф", g: "г", h: "х",
  i: "и", j: "й", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п",
  q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "ш", x: "х",
  y: "й", z: "з"
};

/** Greek / symbols → Russian (digits are wildcards, not here) */
const EXTRA = {
  α: "а", β: "в", ε: "е", η: "н", ι: "и", κ: "к",
  ο: "о", ρ: "р", τ: "т", υ: "у", χ: "х", φ: "ф",
  "@": "а", $: "с"
};

const CYR_VARIANT = {
  ё: "е", і: "и", ї: "и", ґ: "г", є: "е", ў: "у", һ: "н", ѕ: "с"
};

const DIGRAPHS = [
  ["shch", "щ"], ["sch", "щ"], ["yo", "е"], ["zh", "ж"], ["kh", "х"],
  ["ts", "ц"], ["tc", "ц"], ["ch", "ч"], ["sh", "ш"],
  ["ya", "я"], ["ja", "я"], ["yu", "ю"], ["ju", "ю"],
  ["ye", "е"], ["je", "е"], ["yi", "и"], ["iy", "ий"]
];

const SHORT_MAX = 3;
const FUZZY_MIN = 5; // 1 substitution / digit wild for words this long+
const PREFIX_MIN_KEY = 6; // allow missing 1–2 ending letters
const LOOKALIKE_COUNT = Object.keys(LATIN).length + Object.keys(EXTRA).length;
const VISUAL_TWIN_COUNT = 12;

function foldFullwidth(ch) {
  const code = ch.codePointAt(0);
  if (code >= 0xff21 && code <= 0xff3a) return String.fromCharCode(code - 0xff21 + 97);
  if (code >= 0xff41 && code <= 0xff5a) return String.fromCharCode(code - 0xff41 + 97);
  return ch;
}

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
    // digit or * # ? = одна «любая» буква
    if (/[0-9*#?]/.test(c)) {
      seq.push({ ch: WILD, i, latin: false, wild: true });
      continue;
    }
    if (EXTRA[c]) {
      seq.push({ ch: EXTRA[c], i, latin: false });
    }
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
  let c = foldFullwidth(ch).toLowerCase();
  if (CYR_VARIANT[c] || /[а-я]/i.test(c) || /[a-z]/i.test(c) || EXTRA[c] || /[0-9*#?]/.test(c)) {
    return true;
  }
  return null;
}

function flattenMessage(text) {
  const chars = Array.from(String(text || ""));
  const seq = extractSeq(chars);
  const { norm, indexMap, indexMapEnd } = seqToNorm(seq);
  return { norm, indexMap, indexMapEnd, chars };
}

function normalizeWord(word) {
  // dictionary entries: no wildcards, strip junk/digits as letters-only
  return flattenMessage(String(word || "").replace(/[0-9*#?]/g, "")).norm;
}

function compileDictionary(rawSet) {
  const list = [];
  const seen = new Set();
  for (const raw of rawSet) {
    const key = normalizeWord(raw);
    if (key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    list.push(key);
  }
  list.sort((a, b) => b.length - a.length);
  return { list };
}

function isLetterAt(chars, idx) {
  if (idx < 0 || idx >= chars.length) return false;
  return mapChar(chars[idx]) != null;
}

/** Exact match allowing WILD in stream = any key letter */
function matchWildAt(norm, start, key) {
  if (start + key.length > norm.length) return -1;
  let real = 0;
  for (let k = 0; k < key.length; k++) {
    const nch = norm[start + k];
    if (nch === WILD) continue;
    real++;
    if (nch !== key[k]) return -1;
  }
  if (real < minRealLetters(key.length)) return -1;
  return start + key.length;
}

/** Same length, at most 1 letter differs (WILD counts as match) */
function matchOneSubAt(norm, start, key) {
  if (key.length < FUZZY_MIN) return -1;
  if (start + key.length > norm.length) return -1;
  let diff = 0;
  let real = 0;
  for (let k = 0; k < key.length; k++) {
    const nch = norm[start + k];
    if (nch === WILD) continue;
    real++;
    if (nch !== key[k]) {
      diff++;
      if (diff > 1) return -1;
    }
  }
  if (real < minRealLetters(key.length)) return -1;
  return start + key.length;
}

/** One missing letter in the middle/end: stream shorter by 1 */
function matchOneDeleteAt(norm, start, key) {
  if (key.length < FUZZY_MIN) return -1;
  const win = key.length - 1;
  if (win < FUZZY_MIN - 1 || start + win > norm.length) return -1;
  let si = start;
  let skipped = false;
  let real = 0;
  for (let k = 0; k < key.length; k++) {
    if (si >= start + win) {
      if (k === key.length - 1 && !skipped) {
        if (real < minRealLetters(key.length)) return -1;
        return start + win;
      }
      return -1;
    }
    const nch = norm[si];
    if (nch === WILD) {
      si++;
      continue;
    }
    if (nch === key[k]) {
      real++;
      si++;
      continue;
    }
    if (!skipped) {
      skipped = true;
      continue;
    }
    return -1;
  }
  if (si !== start + win) return -1;
  if (real < minRealLetters(key.length)) return -1;
  return si;
}

/** Сколько настоящих букв нужно, чтобы не ловить "123456789" как мат */
function minRealLetters(keyLen) {
  if (keyLen <= 3) return keyLen;
  return Math.max(3, Math.ceil(keyLen * 0.6));
}

function tryAddHit(hits, used, flat, start, end, key) {
  if (end <= start) return false;
  for (let j = start; j < end; j++) {
    if (used[j]) return false;
  }
  const { indexMap, indexMapEnd, chars } = flat;
  const origStart = indexMap[start];
  const origEnd = (indexMapEnd || indexMap)[end - 1];
  const short = key.length <= SHORT_MAX;
  const leftOk = !isLetterAt(chars, origStart - 1);
  const rightOk = !isLetterAt(chars, origEnd + 1);
  if (short && !(leftOk && rightOk)) return false;
  // fuzzy/prefix: always require soft boundaries to cut false positives inside normal words
  if (key.length >= FUZZY_MIN && !(leftOk && rightOk)) {
    // allow inside only for exact-ish? keep boundary for fuzzy
    return false;
  }
  for (let j = start; j < end; j++) used[j] = 1;
  hits.push({ origStart, origEnd, key });
  return true;
}

function findMatches(flat, dict) {
  const { norm } = flat;
  const n = norm.length;
  const used = new Uint8Array(n);
  const hits = [];

  for (const key of dict.list) {
    const klen = key.length;
    if (klen > n + 1) continue;

    for (let start = 0; start < n; start++) {
      if (used[start]) continue;

      // 1) exact / digit-wild
      let end = matchWildAt(norm, start, key);
      if (end !== -1 && tryAddHit(hits, used, flat, start, end, key)) continue;

      // 2) one wrong letter (пидопас ≈ пидорас)
      end = matchOneSubAt(norm, start, key);
      if (end !== -1 && tryAddHit(hits, used, flat, start, end, key)) continue;

      // 3) one letter missing in typing (пидрас / пидора…)
      end = matchOneDeleteAt(norm, start, key);
      if (end !== -1 && tryAddHit(hits, used, flat, start, end, key)) continue;

      // 4) not finished: prefix of long word (пидора → пидорас)
      if (klen >= PREFIX_MIN_KEY) {
        for (const cut of [1, 2]) {
          const plen = klen - cut;
          if (plen < FUZZY_MIN) continue;
          end = matchWildAt(norm, start, key.slice(0, plen));
          if (end !== -1 && tryAddHit(hits, used, flat, start, end, key)) break;
        }
      }
    }
  }

  hits.sort((a, b) => a.origStart - b.origStart);
  return hits;
}

function maskSpan() {
  return "***";
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
    out += maskSpan();
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
