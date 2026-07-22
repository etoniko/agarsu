from pathlib import Path

root = Path(__file__).resolve().parents[1]
html_path = root / "index.html"
html = html_path.read_text(encoding="utf-8")
start = html.find('<div id="home" class="content active">')
if start < 0:
    raise SystemExit("home start not found")
open_tag_end = html.find(">", start) + 1
marker = '\n        <div id="rating"'
end = html.find(marker, open_tag_end)
if end < 0:
    raise SystemExit("rating marker not found")
chunk = html[open_tag_end:end]
idx = chunk.rfind("</div>")
if idx < 0:
    raise SystemExit("home close not found")
inner = chunk[:idx].strip() + "\n"
out = root / "src" / "ui" / "panels" / "home.html"
out.write_text(inner, encoding="utf-8")
html2 = html[:start] + '<div id="home" class="content"></div>' + html[end:]
html_path.write_text(html2, encoding="utf-8")
print("wrote", out, "bytes", len(inner))
