from pathlib import Path

path = Path(r"c:/Users/root/Desktop/client/githubagarsu/src/ui/shop.js")
# restore from git if we corrupted - read current
text = path.read_text(encoding="utf-8")
if text.strip() == "PENDING":
    raise SystemExit("shop.js was corrupted; restore from git first")

marker = 'const nicknameInput = document.getElementById("nickname");'
idx = text.find(marker)
if idx < 0:
    raise SystemExit("bind marker not found")

# Drop old import line from head; we'll add new imports
head = text[:idx]
if head.startswith('import { getAccountToken } from "../storage/local.js";\n'):
    head = head[len('import { getAccountToken } from "../storage/local.js";\n') :]

# Extract bind body until openShopPurchase function
tail = text[idx:]
fn = tail.find("\nfunction openShopPurchase")
if fn < 0:
    raise SystemExit("openShopPurchase not found")
bind_body = tail[:fn].rstrip() + "\n"

# rewrite consts to assignments
replacements = [
    (
        'const nicknameInput = document.getElementById("nickname");\nconst passwordInput = document.getElementById("password");',
        'nicknameInput = document.getElementById("nickname");\npasswordInput = document.getElementById("password");',
    ),
    (
        'const invisibleNickCheckbox = document.getElementById("invisibleNick");\nconst rotationNickCheckbox = document.getElementById("rotationNick");',
        'invisibleNickCheckbox = document.getElementById("invisibleNick");\nrotationNickCheckbox = document.getElementById("rotationNick");',
    ),
    (
        'const previewContainer = document.getElementById("previewContainer");\nconst fileInput = document.getElementById("fileInput");\nconst skinCanvas = document.getElementById("previewCanvas");\nconst skinCtx = skinCanvas.getContext("2d");\nconst gifPreview = document.getElementById("previewGif");',
        'previewContainer = document.getElementById("previewContainer");\nfileInput = document.getElementById("fileInput");\nskinCanvas = document.getElementById("previewCanvas");\nskinCtx = skinCanvas.getContext("2d");\ngifPreview = document.getElementById("previewGif");',
    ),
    (
        'const togglePassword = document.getElementById("togglePassword");\nconst togglePasswordIcon = togglePassword?.querySelector("i");',
        'const togglePassword = document.getElementById("togglePassword");\n  const togglePasswordIcon = togglePassword?.querySelector("i");',
    ),
]
for a, b in replacements:
    if a not in bind_body:
        print("WARN missing chunk", a[:50])
    bind_body = bind_body.replace(a, b, 1)

indented = "\n".join(("  " + line if line.strip() else line) for line in bind_body.splitlines())

out = f'''import {{ getAccountToken }} from "../storage/local.js";
import {{ mountPanel }} from "./panels/mount.js";
import shopHtml from "./panels/shop.html?raw";
{head}
let shopBound = false;
let nicknameInput, passwordInput, invisibleNickCheckbox, rotationNickCheckbox;
let previewContainer, fileInput, skinCanvas, skinCtx, gifPreview;

function bindShopDom() {{
  if (shopBound) return;
  if (!document.getElementById("nickname")) return;
  shopBound = true;
{indented}
}}

async function ensureShopPanel() {{
  mountPanel("shop", shopHtml);
  bindShopDom();
  updateShopAuthNotice();
}}

async function openShopPurchase(nickname, options = {{}}) {{
  await ensureShopPanel();
  if (typeof showContent === "function") showContent("shop");
  const isClan = !!options.clan;
  const personal = document.getElementById("personal");
  const clan = document.getElementById("clan");
  if (personal) personal.checked = !isClan;
  if (clan) clan.checked = isClan;
  updateNicknameDisplay();
  nicknameInput.value = String(nickname || "").trim();
  updateCharCount();
  hideError("nicknameError");
  nicknameInput.setCustomValidity("");
  isNicknameTaken = false;
  invisibleNickCheckbox.checked = !!options.invisible;
  rotationNickCheckbox.checked = !!options.rotation;
  if (options.focusPassword) {{
    passwordInput.focus();
  }} else {{
    passwordInput.value = "";
    hideError("passwordError");
  }}
  if (options.focusSkin) {{
    fileInput.click();
  }}
  calculateCost();
  nicknameInput.scrollIntoView({{ behavior: "smooth", block: "center" }});
}}

window.openShopPurchase = openShopPurchase;
window.updateShopAuthNotice = updateShopAuthNotice;
window.ensureShopPanel = ensureShopPanel;
export {{
  ensureShopPanel,
  openShopPurchase,
  updateShopAuthNotice
}};
'''

path.write_text(out, encoding="utf-8")
print("shop.js rewritten", path.stat().st_size)
