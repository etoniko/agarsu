from pathlib import Path

root = Path(__file__).resolve().parents[1]
text = (root / "index.html").read_text(encoding="utf-8")
out = root / "src" / "ui" / "panels"
out.mkdir(parents=True, exist_ok=True)


def extract_inner(open_tag: str, after_panel_marker: str) -> str:
    i = text.find(open_tag)
    if i < 0:
        raise SystemExit(f"open tag not found: {open_tag}")
    j = text.find(after_panel_marker, i + len(open_tag))
    if j < 0:
        raise SystemExit(f"end marker not found after {open_tag}: {after_panel_marker}")
    block = text[i:j]
    first_nl = block.find("\n")
    inner_lines = block[first_nl + 1 :].rstrip().splitlines(True)
    while inner_lines and inner_lines[-1].strip() == "":
        inner_lines.pop()
    if inner_lines and inner_lines[-1].strip() == "</div>":
        inner_lines.pop()
    return "".join(inner_lines)


shop = extract_inner(
    '<div id="shop" class="content">',
    '        <div id="settings" class="content">',
)
settings = extract_inner(
    '        <div id="settings" class="content">',
    '        <div id="skinslist"',
)
store = extract_inner(
    '        <div id="store" class="content">',
    '      </div>\n    </div>\n\t  <div class="rating-home"',
)

(out / "shop.html").write_text(shop, encoding="utf-8")
(out / "settings.html").write_text(settings, encoding="utf-8")
(out / "store.html").write_text(store, encoding="utf-8")
print("ok", len(shop), len(settings), len(store))
