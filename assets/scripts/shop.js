const allowedPattern = /^[a-zA-Zа-яА-Я0-9\s\[\]]+$/;
const paymentRules = { maxFileSize: 5 * 1024 * 1024 };
let isNicknameTaken = false;
const SHOP_TOAST_TIMEOUT = 4500;
const errorCooldownMs = 1400;
const errorCache = new Map();

function showShopFloatAlert(el, duration = 5000) {
  if (!el) return;
  clearTimeout(el._hideTimer);
  el.classList.remove('is-hiding');
  el.hidden = false;
  el.style.display = 'block';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('is-visible'));
  });
  el._hideTimer = setTimeout(() => dismissShopFloatAlert(el), duration);
}

function dismissShopFloatAlert(el) {
  if (!el || !el.classList.contains('is-visible')) {
    if (el) {
      el.classList.remove('is-visible', 'is-hiding');
      el.style.display = 'none';
      el.hidden = true;
    }
    return;
  }
  el.classList.remove('is-visible');
  el.classList.add('is-hiding');
  const onEnd = (e) => {
    if (e.propertyName !== 'opacity') return;
    el.classList.remove('is-hiding');
    el.style.display = 'none';
    el.hidden = true;
    el.removeEventListener('transitionend', onEnd);
  };
  el.addEventListener('transitionend', onEnd);
  clearTimeout(el._dismissFallback);
  el._dismissFallback = setTimeout(() => {
    if (!el.classList.contains('is-hiding')) return;
    el.classList.remove('is-hiding', 'is-visible');
    el.style.display = 'none';
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
  showShopFloatAlert(errorEl, 5000);
  if (withToast) showToast(message, 'error');
}
function hideError(elementId) {
  dismissShopFloatAlert(document.getElementById(elementId));
}
function showWarning(id, show) {
  document.getElementById(id).style.display = show ? 'block' : 'none';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('shopToastContainer');
  if (!container || !message) return;

  const toast = document.createElement('div');
  toast.className = `shop-toast shop-toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 260);
  }, SHOP_TOAST_TIMEOUT);
}

function updateShopAuthNotice() {
  const notice = document.getElementById('shopAuthNotice');
  const shop = document.getElementById('shop');
  if (!notice || !shop) return;

  const onShop = shop.classList.contains('active');
  if (!onShop || localStorage.accountToken) {
    dismissShopFloatAlert(notice);
    notice.textContent = '';
    return;
  }

  notice.innerHTML = 'Вы не авторизованы.<br>Покупки не будут привязаны к аккаунту.';
  showShopFloatAlert(notice, 6000);
}

function updateCharCount() {
  const input = document.getElementById("nickname");
  const max = document.getElementById('clan').checked ? 6 : 16;
  const length = input.value.length;
  document.getElementById("charCount").textContent = `${length}/${max}`;
}
function updateNicknameDisplay() {
  const isClan = document.getElementById('clan').checked;
  const input = document.getElementById('nickname');
  input.value = '';
  if (isClan) {
    input.placeholder = '[клан]';
    input.maxLength = 6;
  } else {
    input.placeholder = 'Ваш ник';
    input.maxLength = 16;
  }
  updateCharCount();
}
function blockForbiddenChars(input) {
  input.addEventListener("input", () => {
    const isClan = document.getElementById('clan').checked;
    let value = input.value;
    
    // Временно разрешаем скобки при вводе (потом их обработает blur)
    const tempPattern = /^[a-zA-Zа-яА-Я0-9\s\[\]]+$/;
    
    if (value && !tempPattern.test(value)) {
      const cleaned = value.replace(/[^a-zA-Zа-яА-Я0-9\s\[\]]/g, "");
      if (cleaned !== value) {
        input.value = cleaned;
        showError(input.id + 'Error', 'Разрешены только буквы, цифры, пробел и скобки [] для клана');
      }
    }
    
    if (input.id === 'nickname') {
      if (!isClan && /[\[\]]/.test(input.value)) {
        input.value = input.value.replace(/[\[\]]/g, "");
        showError('nicknameError', 'Скобки [] запрещены для личного ника');
      }
      updateCharCount();
    }
  });
}
/*const emailInput = document.getElementById("email");
emailInput.addEventListener("input", () => {
  hideError('emailError');
  calculateCost(); // чтобы кнопка не активировалась без валидного email
});

emailInput.addEventListener("blur", () => {
  const email = emailInput.value.trim();
  if (!email) {
    showError('emailError', 'Email обязателен');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('emailError', 'Некорректный email');
  } else {
    hideError('emailError');
  }
});*/

const nicknameInput = document.getElementById("nickname");
blockForbiddenChars(nicknameInput);
blockForbiddenChars(document.getElementById("password"));

nicknameInput.addEventListener("blur", async () => {
  const isClan = document.getElementById('clan').checked;
  let value = nicknameInput.value.trim();
  
  // Для клана отдельная проверка
  if (isClan) {
    // Удаляем только левые скобки внутри текста, но сохраняем обрамляющие
    let innerText = value.replace(/^\[|\]$/g, ''); // Убираем внешние скобки
    innerText = innerText.replace(/[\[\]]/g, ''); // Убираем внутренние скобки
    
    if (innerText.length > 4) {
      innerText = innerText.substring(0, 4);
      setTimeout(() => {
        showError('nicknameError', 'Текст обрезан до 4 символов');
      }, 100);
    }
    nicknameInput.value = `[${innerText}]`;
  } else {
    // Для личного ника - проверка без скобок
    if (value && !allowedPattern.test(value)) {
      value = value.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, "");
      showError('nicknameError', 'Только буквы (лат/кир), цифры и пробел');
    }
    
    if (/[\[\]]/.test(value)) {
      value = value.replace(/[\[\]]/g, '');
      showError('nicknameError', 'Скобки [] запрещены для личного ника');
    }
    
    if (value.length > 16) {
      value = value.substring(0, 16);
      setTimeout(() => {
        showError('nicknameError', `Личный ник обрезан до 16 символов`);
      }, 100);
    }
    nicknameInput.value = value;
  }
  
  updateCharCount();

  // === ПРОВЕРКА НИКА С УЧЁТОМ АВТОРИЗАЦИИ ===
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (localStorage.accountToken) {
      headers['Authorization'] = `Game ${localStorage.accountToken}`;
    }
    const res = await fetch('https://api.agar.su/check-nickname', {
      method: 'POST',
      headers,
      body: JSON.stringify({ nickname: nicknameInput.value.trim() })
    });
    const data = await res.json();

    // Если авторизован — проверим, наш ли это ник
    if (localStorage.accountToken && data.taken) {
      // Запросим список своих ников
      const meRes = await fetch('https://api.agar.su/api/me/nicknames', {
        headers: { 'Authorization': `Game ${localStorage.accountToken}` }
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        const myNicks = (meData.nicknames || []).map(n => n.nickname.toLowerCase());
        const currentNick = nicknameInput.value.trim().toLowerCase();
        if (myNicks.includes(currentNick)) {
          // Это НАШ НИК — разрешаем!
          hideError('nicknameError');
          nicknameInput.setCustomValidity('');
          isNicknameTaken = false;
          calculateCost();
          return;
        }
      }
    }

    // Если не наш — обычная логика
    if (data.taken) {
      showError('nicknameError', data.error || 'Ник занят');
      nicknameInput.setCustomValidity('Ник занят');
      isNicknameTaken = true;
    } else {
      hideError('nicknameError');
      nicknameInput.setCustomValidity('');
      isNicknameTaken = false;
    }
  } catch (err) {
    console.error('Ошибка проверки ника:', err);
    isNicknameTaken = false;
    hideError('nicknameError');
  }
  calculateCost();
});

nicknameInput.addEventListener("input", () => {
  updateCharCount();
  calculateCost();
});

const passwordInput = document.getElementById("password");
const invisibleNickCheckbox = document.getElementById("invisibleNick");
const rotationNickCheckbox = document.getElementById("rotationNick");
passwordInput.addEventListener("input", () => {
  if (passwordInput.value.length > 5) {
    passwordInput.value = passwordInput.value.substring(0, 5);
    showError('passwordError', 'Пароль не может быть длиннее 5 символов');
  } else {
    hideError('passwordError');
  }
  calculateCost();
});

const previewContainer = document.getElementById("previewContainer");
const fileInput = document.getElementById("fileInput");
const skinCanvas = document.getElementById("previewCanvas");
const skinCtx = skinCanvas.getContext("2d");
const gifPreview = document.getElementById("previewGif");

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > paymentRules.maxFileSize) {
    fileInput.value = '';
    showError('fileError', 'Файл слишком большой (макс. 5MB)');
    return;
  }
  if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
    fileInput.value = '';
    showError('fileError', 'Неподдерживаемый формат. Только PNG, JPG, GIF');
    return;
  }
  previewSkin(file);
  previewContainer.classList.add('has-image');
  calculateCost();
});

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
      skinCtx.arc(skinCanvas.width/2, skinCanvas.height/2, skinCanvas.width/2, 0, Math.PI*2);
      skinCtx.closePath();
      skinCtx.clip();
      const scale = Math.max(512 / img.width, 512 / img.height);
      const x = (512 - img.width * scale) / 2;
      const y = (512 - img.height * scale) / 2;
      skinCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
      skinCtx.restore();
    };
    img.onerror = () => {
      skinCtx.fillStyle = '#ccc';
      skinCtx.fillRect(0, 0, skinCanvas.width, skinCanvas.height);
      skinCtx.fillStyle = '#666';
      skinCtx.font = '20px Arial';
      skinCtx.textAlign = 'center';
      skinCtx.fillText('Ошибка загрузки', 256, 256);
    };
    img.src = url;
  }
}

function getMultiplier() {
  return document.getElementById('clan').checked ? 2 : 1;
}

function setPriceRow(rowId, label, amount) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const labelEl = row.querySelector('span');
  const amountEl = row.querySelector('strong');
  if (labelEl && label) labelEl.textContent = label;
  if (amountEl) amountEl.textContent = amount;
}

function setReceiptVisible(show) {
  const calculator = document.getElementById('calculator');
  if (calculator) calculator.hidden = !show;
}

function calculateCost() {
  const nickname = nicknameInput.value.trim();
  const password = passwordInput.value.trim();
  const file = fileInput.files[0];
  const multiplier = getMultiplier();
  const buyButton = document.getElementById('buyButton');
  const totalEl = document.getElementById('totalAmount');
  const hasOrderItem = !!(password || file || invisibleNickCheckbox.checked || rotationNickCheckbox.checked);

  if (!nickname || isNicknameTaken || !hasOrderItem) {
    setReceiptVisible(false);
    buyButton.disabled = true;
    return;
  }

  const passwordCost = password ? 100 : 0;
  const invisibleCost = invisibleNickCheckbox.checked ? 500 : 0;
  const rotationCost = rotationNickCheckbox.checked ? 500 : 0;
  let skinCost = 0;
  let skinLabel = 'Скин';
  if (file) {
    skinCost = file.type === 'image/gif' ? 4500 : 100;
    skinLabel = file.type === 'image/gif' ? 'Скин GIF' : 'Скин PNG';
  }
  const total = (passwordCost + skinCost + invisibleCost + rotationCost) * multiplier;

  setReceiptVisible(true);
  document.getElementById('multiplierText').textContent = multiplier === 2 ? '2x' : '1x';
  setPriceRow('passwordCost', 'Пароль', password ? `${passwordCost * multiplier} ₽` : '0 ₽');
  setPriceRow('skinCost', skinLabel, file ? `${skinCost * multiplier} ₽` : '0 ₽');

  const invisibleRow = document.getElementById('invisibleCost');
  if (invisibleNickCheckbox.checked) {
    setPriceRow('invisibleCost', 'Невидимый ник', `${invisibleCost * multiplier} ₽`);
    invisibleRow.style.display = 'flex';
  } else {
    invisibleRow.style.display = 'none';
  }

  const rotationRow = document.getElementById('rotationCost');
  if (rotationNickCheckbox.checked) {
    setPriceRow('rotationCost', 'Поворот скина', `${rotationCost * multiplier} ₽`);
    rotationRow.style.display = 'flex';
  } else {
    rotationRow.style.display = 'none';
  }

  if (total > 0) {
    totalEl.textContent = `${total} ₽`;
    buyButton.disabled = false;
  } else {
    setReceiptVisible(false);
    buyButton.disabled = true;
  }
}

document.querySelectorAll('input[name="serviceType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    updateNicknameDisplay();
    calculateCost();
  });
});

updateNicknameDisplay();
calculateCost();
updateShopAuthNotice();

document.getElementById("paymentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const rawNickname = nicknameInput.value.trim();
  const nickname = rawNickname.toLowerCase();
  const password = passwordInput.value.trim().toLowerCase();
  const file = fileInput.files[0];
  const serviceType = document.querySelector('input[name="serviceType"]:checked')?.value || '';
  /*const email = emailInput.value.trim();
  
  if (!email) {
    showError('formError', 'Введите email для получения чека');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('formError', 'Некорректный email');
    return;
  }*/

  if (!nickname) {
    showError('formError', 'Введите ник/клан.');
    return;
  }
    if (!password && !file && !invisibleNickCheckbox.checked && !rotationNickCheckbox.checked) {
    showError('formError', 'Выберите хотя бы пароль или скин для оплаты');
    return;
  }

  const multiplier = getMultiplier();
  const passwordCost = password ? 1 : 0;
  const skinCost = file ? (file.type === 'image/gif' ? 2 : 1) : 0;
  const amount = (passwordCost + skinCost) * multiplier;

  const formData = new FormData();
  formData.append("name", nickname);
  formData.append("amount", amount);
  formData.append("serviceType", serviceType);
  //formData.append("email", email);
  if (password) formData.append("password", password);
  if (invisibleNickCheckbox.checked) formData.append("invisible", "1");
  if (rotationNickCheckbox.checked) formData.append("rotation", "1");

  const headers = {};
  if (localStorage.accountToken) {
    headers['Authorization'] = `Game ${localStorage.accountToken}`;
  }

  if (file) {
    if (file.type === "image/gif") {
      formData.append("image", file, file.name);
      await sendForm(formData, headers);
    } else {
      skinCanvas.toBlob(async (blob) => {
        if (!blob) {
          showError('formError', 'Не удалось обработать изображение. Попробуйте другой файл.');
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
      showError('formError', data.warning, false);
      setTimeout(() => hideError('formError'), 8000);
    }

    if (data?.confirmation?.confirmation_url) {
      showToast('Переходим к оплате...', 'success');
      window.location.href = data.confirmation.confirmation_url;
    } else if (data?.redirect) {
      showToast('Переходим к оплате...', 'success');
      window.location.href = data.redirect;
    } else if (data?.error) {
      showError('formError', `Ошибка: ${data.error.description || data.error}`, true);
    } else {
      showError('formError', "Неизвестная ошибка платежа.", true);
    }
  } catch (err) {
    console.error(err);
    showError('formError', "Ошибка соединения. Попробуйте позже.", true);
  }
}

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

window.addEventListener('storage', (event) => {
  if (event.key === 'accountToken') updateShopAuthNotice();
});
