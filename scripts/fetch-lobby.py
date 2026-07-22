import base64
import json
import subprocess
from pathlib import Path

raw = subprocess.check_output(
    [r"C:\Program Files\GitHub CLI\gh.exe", "api", "repos/etoniko/agarsu/contents/src/ui/lobby.js"]
)
data = json.loads(raw)
text = base64.b64decode(data["content"]).decode("utf-8")
Path("src/ui/lobby.remote.js").write_text(text, encoding="utf-8")
print(len(text), text.splitlines()[0])
