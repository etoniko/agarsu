const forbiddenRegex = /[`'";:ㅤ⁣]/g;
const yookassaRules = { maxFileSize: 5 * 1024 * 1024 };

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => hideError(elementId), 5000);
}

function hideError(elementId) {
  document.getElementById(elementId).style.display = 'none';
}

function showWarning(id, show) {
  document.getElementById(id).style.display = show ? 'block' : 'none';
}

function updateCharCount() {
  const input = document.getElementById("nickname");
  const max = document.getElementById('clan').checked ? 6 : 15;
  document.getElementById("charCount").textContent = `${input.value.length}/${max}`;
}

function updateNicknameDisplay() {
  const isClan = document.getElementById('clan').checked;
  const input = document.getElementById('nickname');
  input.value = '';
  input.placeholder = isClan ? '[клан]' : 'ник';
  input.maxLength = isClan ? 6 : 15;
  updateCharCount();
}

function sanitizeNickname() {
  const input = nicknameInput;
  let value = input.value.replace(forbiddenRegex, '');
  const isClan = document.getElementById('clan').checked;

  if (isClan) {
    value = value.replace(/[\[\]]/g, '');
    if (value.length > 4) value = value.substring(0, 4);
    input.value = `[${value}]`;
  } else {
    if (/[\[\]]/.test(value)) showError('nicknameError', 'Скобки [] запрещены для личного ника');
    input.value = value.replace(/[\[\]]/g, '');
  }
  updateCharCount();
}

const nicknameInput = document.getElementById("nickname");
nicknameInput.addEventListener("input", () => {
  sanitizeNickname();
  if (nicknameInput.value.trim()) showWarning('nicknameWarning', false);
  calculateCost();
});

nicknameInput.addEventListener("blur", async () => {
  sanitizeNickname();
  const value = nicknameInput.value.trim();
  const accountID = document.getElementById("accountID").textContent.replace("ID:", "").trim();

  if (!value) {
    showWarning('nicknameWarning', true);
    return;
  }
  showWarning('nicknameWarning', false);

  try {
    const res = await fetch('https://api.agar.su:8443/check-nickname', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: value, accountID })
    });
    const data = await res.json();
    if (data.taken) {
      showError('nicknameError', 'Ник занят');
      nicknameInput.setCustomValidity('Ник занят');
    } else {
      hideError('nicknameError');
      nicknameInput.setCustomValidity('');
    }
  } catch (err) {
    console.error('Ошибка проверки ника:', err);
  }
  calculateCost();
});

const passwordInput = document.getElementById("password");
passwordInput.addEventListener("input", () => {
  if (passwordInput.value.length > 5) {
    passwordInput.value = passwordInput.value.substring(0, 5);
    showError('passwordError', 'Пароль не может быть длиннее 5 символов');
  } else hideError('passwordError');
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

  if (file.size > yookassaRules.maxFileSize) {
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
      skinCtx.clearRect(0, 0, 512, 512);
      skinCtx.save();
      skinCtx.beginPath();
      skinCtx.arc(256, 256, 256, 0, Math.PI*2);
      skinCtx.closePath();
      skinCtx.clip();
      const scale = Math.min(512 / img.width, 512 / img.height);
      const x = (512 - img.width * scale) / 2;
      const y = (512 - img.height * scale) / 2;
      skinCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
      skinCtx.restore();
    };
    img.onerror = () => {
      skinCtx.fillStyle = '#ccc';
      skinCtx.fillRect(0, 0, 512, 512);
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

function calculateCost() {
  const nickname = nicknameInput.value.trim();
  const password = passwordInput.value.trim();
  const file = fileInput.files[0];
  const multiplier = getMultiplier();

  let passwordCost = password ? 1 : 0;
  let skinCost = 0;
  let skinText = 'Скин: 0 ₽';

  if (file) {
    skinCost = file.type === 'image/gif' ? 2 : 1;
    skinText = `Скин: ${skinCost * multiplier} ₽ (${file.type === 'image/gif' ? 'GIF' : 'PNG/JPG'})`;
  }

  const total = (passwordCost + skinCost) * multiplier;

  document.getElementById('multiplierText').textContent = multiplier === 2 ? '2x (для клана)' : '1x (для себя)';
  document.getElementById('passwordCost').textContent = `Пароль: ${password ? passwordCost * multiplier : 0} ₽`;
  document.getElementById('skinCost').textContent = skinText;

  const calculator = document.getElementById('calculator');
  const buyButton = document.getElementById('buyButton');

  if (total > 0 && nickname && (password || file)) {
    calculator.style.display = 'block';
    document.getElementById('totalAmount').textContent = `Итого: ${total} ₽`;
    buyButton.textContent = `КУПИТЬ ЗА ${total} РУБЛЕЙ`;
    buyButton.disabled = false;
  } else {
    calculator.style.display = 'none';
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

document.getElementById("paymentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = nicknameInput.value.trim();
  if (!nickname) { showWarning('nicknameWarning', true); return; }

  const password = passwordInput.value.trim();
  const file = fileInput.files[0];
  const accountID = document.getElementById("accountID").textContent.replace("ID:", "").trim();
  const serviceType = document.querySelector('input[name="serviceType"]:checked').value;

  if (!password && !file) { showError('formError', 'Выберите хотя бы пароль или скин для оплаты'); return; }

  const multiplier = getMultiplier();
  const passwordCost = password ? 1 : 0;
  const skinCost = file ? (file.type === 'image/gif' ? 2 : 1) : 0;
  const amount = (passwordCost + skinCost) * multiplier;

  const formData = new FormData();
  formData.append("name", nickname);
  formData.append("accountID", accountID);
  formData.append("amount", amount);
  formData.append("serviceType", serviceType);
  if (password) formData.append("password", password);

  if (file) {
    if (file.type === "image/gif") formData.append("image", file, file.name), sendForm(formData);
    else skinCanvas.toBlob(blob => { formData.append("image", blob, "skin.png"); sendForm(formData); }, "image/png");
  } else sendForm(formData);
});

async function sendForm(formData) {
  try {
    const res = await fetch("https://api.agar.su:8443/create-payment", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (data?.confirmation?.confirmation_url) window.location.href = data.confirmation.confirmation_url;
    else if (data?.error) showError('formError', `Ошибка YooKassa: ${data.error.description || 'Неизвестная ошибка'}`);
    else showError('formError', "Ошибка при создании платежа. Проверьте данные.");
  } catch(err) {
    showError('formError', "Ошибка соединения с сервером. Попробуйте позже.");
    console.error(err);
  }
}

const togglePassword = document.getElementById("togglePassword");
togglePassword.addEventListener("click", () => {
  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
  togglePassword.classList.toggle("fa-eye");
  togglePassword.classList.toggle("fa-eye-slash");
});
