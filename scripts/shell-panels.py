from pathlib import Path

p = Path(r"c:/Users/root/Desktop/client/githubagarsu/index.html")
text = p.read_text(encoding="utf-8")


def replace_panel(open_tag: str, end_marker: str, shell: str) -> None:
    global text
    i = text.find(open_tag)
    j = text.find(end_marker, i + len(open_tag))
    if i < 0 or j < 0:
        raise SystemExit(f"fail {open_tag!r} -> {end_marker!r}")
    text = text[:i] + shell + text[j:]


replace_panel(
    '<div id="shop" class="content">',
    '        <div id="settings" class="content">',
    '<div id="shop" class="content"></div>\n',
)
replace_panel(
    '        <div id="settings" class="content">',
    '        <div id="skinslist"',
    '        <div id="settings" class="content"></div>\n        ',
)
replace_panel(
    '        <div id="store" class="content">',
    '      </div>\n    </div>\n\t  <div class="rating-home"',
    '        <div id="store" class="content"></div>\n',
)

p.write_text(text, encoding="utf-8")
print("paymentForm", "paymentForm" in text)
print("myNicknamesBlock", "myNicknamesBlock" in text)
print("settings-layout", "settings-layout" in text)
print("shop shell", '<div id="shop" class="content"></div>' in text)
