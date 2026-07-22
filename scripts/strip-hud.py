from pathlib import Path

p = Path("index.html")
t = p.read_text(encoding="utf-8")
start = t.find('  <div id="onmap">')
end = t.find("</body>")
if start < 0 or end < 0:
    raise SystemExit(f"bad markers {start} {end}")
p.write_text(t[:start] + t[end:], encoding="utf-8")
print("removed", end - start, "chars")
