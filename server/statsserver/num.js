/** Всегда число — защита от "42" + 0 → "420" */
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export { toNum };
