import { getAccountToken } from "../storage/local.js";
import { mountPanel, unmountPanel } from "./panels/mount.js";
import shopHtml from "./panels/shop.html?raw";
const ALLOWTXT_LOCAL = "/allowtxt.txt";
const ALLOWTXT_API = "https://api.agar.su/allowtxt.txt";
const ALLOWED_CHARS = new Set();
let allowTxtReady = null;
function parseAllowTxt(text) {
  ALLOWED_CHARS.clear();
  for (const line of String(text || "").split(/\r?\n/)) {
    // One allowed character per line (ignore blank / HTML garbage lines)
    if (line.length === 1) ALLOWED_CHARS.add(line);
  }
  return ALLOWED_CHARS.size > 0;
}
function loadAllowTxt() {
  if (!allowTxtReady) {
    allowTxtReady = fetch(ALLOWTXT_LOCAL).then((r) => {
      if (!r.ok) throw new Error("local allowtxt");
      return r.text();
    }).then((text) => {
      if (!parseAllowTxt(text)) throw new Error("empty allowtxt");
    }).catch(() => fetch(ALLOWTXT_API).then((r) => {
      if (!r.ok) throw new Error("api allowtxt");
      return r.text();
    }).then((text) => {
      if (!parseAllowTxt(text)) throw new Error("empty api allowtxt");
    }));
  }
  return allowTxtReady;
}
function isNicknameCharAllowed(char, allowBrackets) {
  if (!allowBrackets && (char === "[" || char === "]")) return false;
  // Until the list loads (or if load failed), do not wipe the nickname
  if (ALLOWED_CHARS.size === 0) return true;
  return ALLOWED_CHARS.has(char);
}
function isAllowedNickname(value, allowBrackets) {
  if (!value) return true;
  for (const char of value) {
    if (!isNicknameCharAllowed(char, allowBrackets)) return false;
  }
  return true;
}
function stripInvalidNicknameChars(value, allowBrackets) {
  if (ALLOWED_CHARS.size === 0) return value;
  return [...value].filter((char) => isNicknameCharAllowed(char, allowBrackets)).join("");
}
const allowedPattern = { test: (v) => isAllowedNickname(v, false) };
const allowedWithBracketsPattern = { test: (v) => isAllowedNickname(v, true) };
const paymentRules = { maxFileSize: 5 * 1024 * 1024 };
let isNicknameTaken = false;
const SHOP_TOAST_TIMEOUT = 4500;
const errorCooldownMs = 1400;
const errorCache = new Map();
function showShopFloatAlert(el, duration = 5e3) {
  if (!el) return;
  clearTimeout(el._hideTimer);
  el.classList.remove("is-hiding");
  el.hidden = false;
  el.style.display = "block";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add("is-visible"));
  });
  el._hideTimer = setTimeout(() => dismissShopFloatAlert(el), duration);
}
function dismissShopFloatAlert(el) {
  if (!el || !el.classList.contains("is-visible")) {
    if (el) {
      el.classList.remove("is-visible", "is-hiding");
      el.style.display = "none";
      el.hidden = true;
    }
    return;
  }
  el.classList.remove("is-visible");
  el.classList.add("is-hiding");
  const onEnd = (e) => {
    if (e.propertyName !== "opacity") return;
    el.classList.remove("is-hiding");
    el.style.display = "none";
    el.hidden = true;
    el.removeEventListener("transitionend", onEnd);
  };
  el.addEventListener("transitionend", onEnd);
  clearTimeout(el._dismissFallback);
  el._dismissFallback = setTimeout(() => {
    if (!el.classList.contains("is-hiding")) return;
    el.classList.remove("is-hiding", "is-visible");
    el.style.display = "none";
    el.hidden = true;
  }, 450);
}
function showError(elementId, message, withToast = false) {
  const errorEl = document.getElementById(elementId);
  if (!errorEl) return;
  const cacheKey = `${elementId}:${message}`;
  const now = Date.now();
  const lastShownAt = errorCache.get(cacheKey) || 0;
  if (now - lastShownAt < errorCooldownMs) return;
  errorCache.set(cacheKey, now);
  errorEl.textContent = message;
  showShopFloatAlert(errorEl, 5e3);
  if (withToast) showToast(message, "error");
}
function hideError(elementId) {
  dismissShopFloatAlert(document.getElementById(elementId));
}
function showWarning(id, show) {
  document.getElementById(id).style.display = show ? "block" : "none";
}
function showToast(message, type = "info") {
  const container = document.getElementById("shopToastContainer");
  if (!container || !message) return;
  const toast = document.createElement("div");
  toast.className = `shop-toast shop-toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 260);
  }, SHOP_TOAST_TIMEOUT);
}
function updateShopAuthNotice() {
  const notice = document.getElementById("shopAuthNotice");
  const shop = document.getElementById("shop");
  if (!notice || !shop) return;
  const onShop = shop.classList.contains("active");
  if (!onShop || getAccountToken()) {
    dismissShopFloatAlert(notice);
    notice.textContent = "";
    return;
  }
  notice.innerHTML = "\u0412\u044B \u043D\u0435 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u043E\u0432\u0430\u043D\u044B.<br>\u041F\u043E\u043A\u0443\u043F\u043A\u0438 \u043D\u0435 \u0431\u0443\u0434\u0443\u0442 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u044B \u043A \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0443.";
  showShopFloatAlert(notice, 6e3);
}
function updateCharCount() {
  const input = document.getElementById("nickname");
  const clan = document.getElementById("clan");
  const counter = document.getElementById("charCount");
  if (!input || !clan || !counter) return;
  const max = clan.checked ? 6 : 16;
  const length = input.value.length;
  counter.textContent = `${length}/${max}`;
}
function updateNicknameDisplay() {
  const clan = document.getElementById("clan");
  const input = document.getElementById("nickname");
  if (!clan || !input) return;
  const isClan = clan.checked;
  input.value = "";
  if (isClan) {
    input.placeholder = "[\u043A\u043B\u0430\u043D]";
    input.maxLength = 6;
  } else {
    input.placeholder = "\u0412\u0430\u0448 \u043D\u0438\u043A";
    input.maxLength = 16;
  }
  updateCharCount();
}
function blockForbiddenChars(input) {
  input.addEventListener("input", () => {
    const isClan = document.getElementById("clan").checked;
    let value = input.value;
    if (value && !allowedWithBracketsPattern.test(value)) {
      const cleaned = stripInvalidNicknameChars(value, true);
      if (cleaned !== value) {
        input.value = cleaned;
        showError(input.id + "Error", "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u0441\u0438\u043C\u0432\u043E\u043B\u044B \u0432 \u043D\u0438\u043A\u0435");
      }
    }
    if (input.id === "nickname") {
      if (!isClan && /[\[\]]/.test(input.value)) {
        input.value = input.value.replace(/[\[\]]/g, "");
        showError("nicknameError", "\u0421\u043A\u043E\u0431\u043A\u0438 [] \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u044B \u0434\u043B\u044F \u043B\u0438\u0447\u043D\u043E\u0433\u043E \u043D\u0438\u043A\u0430");
      }
      updateCharCount();
    }
  });
}

let shopBound = false;
let nicknameInput, passwordInput, invisibleNickCheckbox, rotationNickCheckbox;
let previewContainer, fileInput, skinCanvas, skinCtx, gifPreview;

function previewSkin(file) {
  const url = URL.createObjectURL(file);
  const isGif = file.type === "image/gif";
  if (isGif) {
    skinCanvas.style.display = "none";
    gifPreview.style.display = "block";
    gifPreview.src = url;
  } else {
    gifPreview.style.display = "none";
    skinCanvas.style.display = "block";
    const img = new Image();
    img.onload = () => {
      skinCtx.clearRect(0, 0, skinCanvas.width, skinCanvas.height);
      skinCtx.save();
      skinCtx.beginPath();
      skinCtx.arc(skinCanvas.width / 2, skinCanvas.height / 2, skinCanvas.width / 2, 0, Math.PI * 2);
      skinCtx.closePath();
      skinCtx.clip();
      const scale = Math.max(512 / img.width, 512 / img.height);
      const x = (512 - img.width * scale) / 2;
      const y = (512 - img.height * scale) / 2;
      skinCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
      skinCtx.restore();
    };
    img.onerror = () => {
      skinCtx.fillStyle = "#ccc";
      skinCtx.fillRect(0, 0, skinCanvas.width, skinCanvas.height);
      skinCtx.fillStyle = "#666";
      skinCtx.font = "20px Arial";
      skinCtx.textAlign = "center";
      skinCtx.fillText("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438", 256, 256);
    };
    img.src = url;
  }
}
function getMultiplier() {
  return document.getElementById("clan").checked ? 2 : 1;
}
function setPriceRow(rowId, label, amount) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const labelEl = row.querySelector("span");
  const amountEl = row.querySelector("strong");
  if (labelEl && label) labelEl.textContent = label;
  if (amountEl) amountEl.textContent = amount;
}
function setReceiptVisible(show) {
  const calculator = document.getElementById("calculator");
  if (calculator) calculator.hidden = !show;
}
function calculateCost() {
  if (!nicknameInput || !passwordInput || !fileInput || !invisibleNickCheckbox || !rotationNickCheckbox) return;
  const nickname = nicknameInput.value.trim();
  const password = passwordInput.value.trim();
  const file = fileInput.files[0];
  const multiplier = getMultiplier();
  const buyButton = document.getElementById("buyButton");
  const totalEl = document.getElementById("totalAmount");
  if (!buyButton || !totalEl) return;
  const hasOrderItem = !!(password || file || invisibleNickCheckbox.checked || rotationNickCheckbox.checked);
  if (!nickname || isNicknameTaken || !hasOrderItem) {
    setReceiptVisible(false);
    buyButton.disabled = true;
    return;
  }
  const passwordCost = password ? 150 : 0;
  const invisibleCost = invisibleNickCheckbox.checked ? 500 : 0;
  const rotationCost = rotationNickCheckbox.checked ? 500 : 0;
  let skinCost = 0;
  let skinLabel = "\u0421\u043A\u0438\u043D";
  if (file) {
    skinCost = file.type === "image/gif" ? 4500 : 150;
    skinLabel = file.type === "image/gif" ? "\u0421\u043A\u0438\u043D GIF" : "\u0421\u043A\u0438\u043D PNG";
  }
  const total = (passwordCost + skinCost + invisibleCost + rotationCost) * multiplier;
  setReceiptVisible(true);
  document.getElementById("multiplierText").textContent = multiplier === 2 ? "2x" : "1x";
  setPriceRow("passwordCost", "\u041F\u0430\u0440\u043E\u043B\u044C", password ? `${passwordCost * multiplier} \u20BD` : "0 \u20BD");
  setPriceRow("skinCost", skinLabel, file ? `${skinCost * multiplier} \u20BD` : "0 \u20BD");
  const invisibleRow = document.getElementById("invisibleCost");
  if (invisibleNickCheckbox.checked) {
    setPriceRow("invisibleCost", "\u041D\u0435\u0432\u0438\u0434\u0438\u043C\u044B\u0439 \u043D\u0438\u043A", `${invisibleCost * multiplier} \u20BD`);
    invisibleRow.style.display = "flex";
  } else {
    invisibleRow.style.display = "none";
  }
  const rotationRow = document.getElementById("rotationCost");
  if (rotationNickCheckbox.checked) {
    setPriceRow("rotationCost", "\u041F\u043E\u0432\u043E\u0440\u043E\u0442 \u0441\u043A\u0438\u043D\u0430", `${rotationCost * multiplier} \u20BD`);
    rotationRow.style.display = "flex";
  } else {
    rotationRow.style.display = "none";
  }
  if (total > 0) {
    totalEl.textContent = `${total} \u20BD`;
    buyButton.disabled = false;
  } else {
    setReceiptVisible(false);
    buyButton.disabled = true;
  }
}
async function sendForm(formData, headers = {}) {
  try {
    const res = await fetch("https://api.agar.su/create-payment", {
      method: "POST",
      headers,
      body: formData
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.warning) {
      showError("formError", data.warning, false);
      setTimeout(() => hideError("formError"), 8e3);
    }
    if (data?.confirmation?.confirmation_url) {
      showToast("\u041F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u043C \u043A \u043E\u043F\u043B\u0430\u0442\u0435...", "success");
      window.location.href = data.confirmation.confirmation_url;
    } else if (data?.redirect) {
      showToast("\u041F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u043C \u043A \u043E\u043F\u043B\u0430\u0442\u0435...", "success");
      window.location.href = data.redirect;
    } else if (data?.error) {
      showError("formError", `\u041E\u0448\u0438\u0431\u043A\u0430: ${data.error.description || data.error}`, true);
    } else {
      showError("formError", "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u043B\u0430\u0442\u0435\u0436\u0430.", true);
    }
  } catch (err) {
    console.error(err);
    showError("formError", "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.", true);
  }
}

function bindShopDom() {
  if (shopBound) return;
  if (!document.getElementById("nickname")) return;
  shopBound = true;
  nicknameInput = document.getElementById("nickname");
  passwordInput = document.getElementById("password");
  document.querySelectorAll('input[name="serviceType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      updateNicknameDisplay();
      calculateCost();
    });
  });
  document.getElementById("paymentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const rawNickname = nicknameInput.value.trim();
    const nickname = rawNickname.toLowerCase();
    const password = passwordInput.value.trim().toLowerCase();
    const file = fileInput.files[0];
    const serviceType = document.querySelector('input[name="serviceType"]:checked')?.value || "";
    if (!nickname) {
      showError("formError", "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0438\u043A/\u043A\u043B\u0430\u043D.");
      return;
    }
    if (!password && !file && !invisibleNickCheckbox.checked && !rotationNickCheckbox.checked) {
      showError("formError", "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043F\u0430\u0440\u043E\u043B\u044C \u0438\u043B\u0438 \u0441\u043A\u0438\u043D \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B");
      return;
    }
    const multiplier = getMultiplier();
    const passwordCost = password ? 1 : 0;
    const skinCost = file ? file.type === "image/gif" ? 2 : 1 : 0;
    const amount = (passwordCost + skinCost) * multiplier;
    const formData = new FormData();
    formData.append("name", nickname);
    formData.append("amount", amount);
    formData.append("serviceType", serviceType);
    if (password) formData.append("password", password);
    if (invisibleNickCheckbox.checked) formData.append("invisible", "1");
    if (rotationNickCheckbox.checked) formData.append("rotation", "1");
    const headers = {};
    if (getAccountToken()) {
      headers["Authorization"] = `Game ${getAccountToken()}`;
    }
    if (file) {
      if (file.type === "image/gif") {
        formData.append("image", file, file.name);
        await sendForm(formData, headers);
      } else {
        skinCanvas.toBlob(async (blob) => {
          if (!blob) {
            showError("formError", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439 \u0444\u0430\u0439\u043B.");
            return;
          }
          formData.append("image", blob, "skin.png");
          await sendForm(formData, headers);
        }, "image/png");
      }
    } else {
      await sendForm(formData, headers);
    }
  });
  loadAllowTxt().then(() => {
    blockForbiddenChars(nicknameInput);
    blockForbiddenChars(passwordInput);
  }).catch(() => {
    // Still bind input handlers; without a char list we won't strip nicknames
    blockForbiddenChars(nicknameInput);
    blockForbiddenChars(passwordInput);
    showToast("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C allowtxt.txt", "error");
  });
  nicknameInput.addEventListener("blur", async () => {
    const isClan = document.getElementById("clan").checked;
    let value = nicknameInput.value.trim();
    if (isClan) {
      let innerText = value.replace(/^\[|\]$/g, "");
      innerText = innerText.replace(/[\[\]]/g, "");
      if (innerText.length > 4) {
        innerText = innerText.substring(0, 4);
        setTimeout(() => {
          showError("nicknameError", "\u0422\u0435\u043A\u0441\u0442 \u043E\u0431\u0440\u0435\u0437\u0430\u043D \u0434\u043E 4 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432");
        }, 100);
      }
      nicknameInput.value = `[${innerText}]`;
    } else {
      if (value && !allowedPattern.test(value)) {
        value = stripInvalidNicknameChars(value);
        showError("nicknameError", "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u0441\u0438\u043C\u0432\u043E\u043B\u044B \u0432 \u043D\u0438\u043A\u0435");
      }
      if (/[\[\]]/.test(value)) {
        value = value.replace(/[\[\]]/g, "");
        showError("nicknameError", "\u0421\u043A\u043E\u0431\u043A\u0438 [] \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u044B \u0434\u043B\u044F \u043B\u0438\u0447\u043D\u043E\u0433\u043E \u043D\u0438\u043A\u0430");
      }
      if (value.length > 16) {
        value = value.substring(0, 16);
        setTimeout(() => {
          showError("nicknameError", `\u041B\u0438\u0447\u043D\u044B\u0439 \u043D\u0438\u043A \u043E\u0431\u0440\u0435\u0437\u0430\u043D \u0434\u043E 16 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432`);
        }, 100);
      }
      nicknameInput.value = value;
    }
    updateCharCount();
    try {
      const headers = { "Content-Type": "application/json" };
      if (getAccountToken()) {
        headers["Authorization"] = `Game ${getAccountToken()}`;
      }
      const res = await fetch("https://api.agar.su/check-nickname", {
        method: "POST",
        headers,
        body: JSON.stringify({ nickname: nicknameInput.value.trim() })
      });
      const data = await res.json();
      if (getAccountToken() && data.taken) {
        const meRes = await fetch("https://api.agar.su/api/me/nicknames", {
          headers: { "Authorization": `Game ${getAccountToken()}` }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          const myNicks = (meData.nicknames || []).map((n) => n.nickname.toLowerCase());
          const currentNick = nicknameInput.value.trim().toLowerCase();
          if (myNicks.includes(currentNick)) {
            hideError("nicknameError");
            nicknameInput.setCustomValidity("");
            isNicknameTaken = false;
            calculateCost();
            return;
          }
        }
      }
      if (data.taken) {
        showError("nicknameError", data.error || "\u041D\u0438\u043A \u0437\u0430\u043D\u044F\u0442");
        nicknameInput.setCustomValidity("\u041D\u0438\u043A \u0437\u0430\u043D\u044F\u0442");
        isNicknameTaken = true;
      } else {
        hideError("nicknameError");
        nicknameInput.setCustomValidity("");
        isNicknameTaken = false;
      }
    } catch (err) {
      console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043D\u0438\u043A\u0430:", err);
      isNicknameTaken = false;
      hideError("nicknameError");
    }
    calculateCost();
  });
  nicknameInput.addEventListener("input", () => {
    updateCharCount();
    calculateCost();
  });
  invisibleNickCheckbox = document.getElementById("invisibleNick");
  rotationNickCheckbox = document.getElementById("rotationNick");
  passwordInput.addEventListener("input", () => {
    if (passwordInput.value.length > 5) {
      passwordInput.value = passwordInput.value.substring(0, 5);
      showError("passwordError", "\u041F\u0430\u0440\u043E\u043B\u044C \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0434\u043B\u0438\u043D\u043D\u0435\u0435 5 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432");
    } else {
      hideError("passwordError");
    }
    calculateCost();
  });
  previewContainer = document.getElementById("previewContainer");
  fileInput = document.getElementById("fileInput");
  skinCanvas = document.getElementById("previewCanvas");
  skinCtx = skinCanvas.getContext("2d");
  gifPreview = document.getElementById("previewGif");
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > paymentRules.maxFileSize) {
      fileInput.value = "";
      showError("fileError", "\u0424\u0430\u0439\u043B \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 (\u043C\u0430\u043A\u0441. 5MB)");
      return;
    }
    if (!["image/png", "image/jpeg", "image/gif"].includes(file.type)) {
      fileInput.value = "";
      showError("fileError", "\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442. \u0422\u043E\u043B\u044C\u043A\u043E PNG, JPG, GIF");
      return;
    }
    previewSkin(file);
    previewContainer.classList.add("has-image");
    calculateCost();
  });
  const togglePassword = document.getElementById("togglePassword");
    const togglePasswordIcon = togglePassword?.querySelector("i");
  togglePassword?.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePasswordIcon?.classList.toggle("fa-eye");
    togglePasswordIcon?.classList.toggle("fa-eye-slash");
  });
  invisibleNickCheckbox.addEventListener("change", calculateCost);
  rotationNickCheckbox.addEventListener("change", calculateCost);
  window.addEventListener("storage", (event) => {
    if (event.key === "accountToken") updateShopAuthNotice();
  });
  updateNicknameDisplay();
  calculateCost();
}

function resetShopPanel() {
  shopBound = false;
  nicknameInput = passwordInput = invisibleNickCheckbox = rotationNickCheckbox = null;
  previewContainer = fileInput = skinCanvas = skinCtx = gifPreview = null;
  unmountPanel("shop");
}

async function ensureShopPanel() {
  mountPanel("shop", shopHtml);
  bindShopDom();
  updateShopAuthNotice();
}

async function openShopPurchase(nickname, options = {}) {
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
  if (options.focusPassword) {
    passwordInput.focus();
  } else {
    passwordInput.value = "";
    hideError("passwordError");
  }
  if (options.focusSkin) {
    fileInput.click();
  }
  calculateCost();
  nicknameInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

window.openShopPurchase = openShopPurchase;
window.updateShopAuthNotice = updateShopAuthNotice;
window.ensureShopPanel = ensureShopPanel;
export {
  ensureShopPanel,
  openShopPurchase,
  resetShopPanel,
  updateShopAuthNotice
};
