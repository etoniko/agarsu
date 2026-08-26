const COLORS = [
    "#FF0000", // красный
    "#FF8000", // оранжевый
    "#FFFF00", // жёлтый
    "#80FF00", // салатовый
    "#00FF00", // зелёный
    "#00FF80", // бирюзовый
    "#00FFFF", // голубой
    "#0080FF", // синий
    "#0000FF", // тёмно-синий
    "#8000FF", // фиолетовый
    "#FF00FF", // розовый
    "#FF0080", // малиновый
    "#FFFFFF", // белый
    "#C0C0C0", // серый
    "#808080", // тёмно-серый
    "#000000"  // чёрный
];

const COLOR_MAP = new Map();
COLORS.forEach((hex, id) => {
    COLOR_MAP.set(hex.toLowerCase(), id);
    COLOR_MAP.set(hex.replace("#", "").toLowerCase(), id);
});

/**
 * Возвращает ID цвета (0–15) по значению из localStorage
 */
export function getColorId(storedColor) {
  if (!storedColor) return 0;
  const key = storedColor.toString().toLowerCase().trim();
  return COLOR_MAP.has(key) ? COLOR_MAP.get(key) : 0;
}

export function setSelectedColor(hex) {
  if (hex && hex.startsWith("#")) {
    localStorage.setItem("selectedColor", hex.toUpperCase());
  }
}
