(function(){
  let currentStep = 1;
  let chosenSkin = null, chosenType = null, chosenPrice = 0, processedImageUrl = null;
  let serviceType = 'self';
  let timer = 10*60, timerInterval = null;

  const stepContents = document.querySelectorAll('#step-content > div.step');
  const chosenTitleEl = document.getElementById('chosenTitle');
  const finalTitleEl = document.getElementById('finalTitle');
  const priceEl = document.getElementById('price');
  const countdownEl = document.getElementById('countdown');
  const passLabel = document.getElementById('passLabel');
  const nicknameInput = document.getElementById('nickname');
  const passwordInput = document.getElementById('password');
  const uploadCircle = document.getElementById('uploadCircle');
  const imageInput = document.getElementById('imageFile');
  const expiredBox = document.getElementById('expiredBox');
  const paidBtn = document.getElementById('paidBtn');
  const skinsGrid = document.getElementById('skinsGrid');
  const serviceRadios = document.querySelectorAll('input[name="serviceType"]');
  const backToChoose = document.getElementById('backToChoose');
  const backToData = document.getElementById('backToData');
  const restartBtn = document.getElementById('restartBtn');

  // Уведомления
const notificationEl = document.createElement('div');
notificationEl.id = 'shopNotification';
notificationEl.classList.add('shopntf');
document.body.appendChild(notificationEl);

function notify(msg, duration = 3000) {
  notificationEl.textContent = msg;
  notificationEl.classList.add('show');
  setTimeout(() => {
    notificationEl.classList.remove('show');
  }, duration);
}

  // Проверка адблокера
  async function checkAdBlocker() {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', 'https://api.agar.su/api/test', true);
      xhr.send();
      return new Promise(resolve => {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            resolve(xhr.status === 200);
          }
        };
      });
    } catch (e) {
      notify('⚠ Пожалуйста, отключите блокировщик рекламы для этого сайта.');
      return false;
    }
  }

  // Переключение для себя / клана
  serviceRadios.forEach(r => {
    r.addEventListener('change', () => {
      serviceType = r.value;
      nicknameInput.placeholder = serviceType === 'clan' ? 'клан' : 'ник';
      nicknameInput.title = serviceType === 'clan' ? 'Введите название клана' : 'Введите ник';

      document.querySelectorAll('#skinsGrid .skin-card').forEach(card => {
        const base = Number(card.dataset.base);
        const price = serviceType === 'clan' ? base * 2 : base;
        card.querySelector('.price-label').textContent = `Цена: ${price}`;
        card.querySelector('img').src = serviceType === 'clan' ? card.dataset.srcClan : card.dataset.srcSelf;

        if (card.dataset.type === 'pass') {
          card.querySelector('h4').textContent = serviceType === 'clan' ? 'Пароль на клан' : 'Пароль на ник';
        }
      });
    });
  });

  // Выбор товара
  skinsGrid.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON') {
      const card = e.target.closest('.skin-card');
      chosenSkin = card.querySelector('h4').textContent;
      chosenType = card.dataset.type;

      const base = Number(card.dataset.base);
      const rand = Math.floor(Math.random() * 10);
      chosenPrice = (serviceType === 'clan' ? base * 2 : base) + rand;

      passLabel.style.display = chosenType === 'pass' ? 'block' : 'none';
      uploadCircle.style.display = chosenType === 'pass' ? 'none' : 'flex';

      chosenTitleEl.textContent = `Вы выбрали: ${chosenSkin}`;
      priceEl.textContent = `${chosenPrice}₽`;
      setActiveStep(2);
    }
  });

  // Загрузка файла с проверкой размера
  uploadCircle.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      notify('❌ Файл больше 10MB');
      imageInput.value = '';
      return;
    }

    const name = file.name.toLowerCase();
    if (chosenType === 'gif' && !name.endsWith('.gif')) {
      notify('❌ Только GIF!');
      imageInput.value = '';
      return;
    }
    if (chosenType === 'image' && !(/\.(png|jpg|jpeg)$/i.test(name))) {
      notify('❌ Разрешены PNG/JPG!');
      imageInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        uploadCircle.innerHTML = '';
        uploadCircle.appendChild(img);
      };
      img.src = e.target.result;
      processedImageUrl = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Ограничение ввода ника
  nicknameInput.addEventListener('blur', () => {
    let nick = nicknameInput.value.trim();
    nicknameInput.value = nick.replace(/['`";:]/g, '').slice(0, 20);

    if (serviceType === 'clan') {
  const clanPattern = /^\[.*\]$/;
  if (!clanPattern.test(nick)) {
    notify('❌ У клана должны быть квадратные скобки [ ]');
    return;
  }
} else if (serviceType === 'self') {
  if (/\[.*\]/.test(nick)) {
    notify('❌ Ник не может содержать [ ]');
    nicknameInput.value = nick.replace(/\[|\]/g, ''); // убираем скобки
    return;
  }
}
  });

  // Переход к оплате
  document.getElementById('dataForm').addEventListener('submit', e => {
    e.preventDefault();
    const nick = nicknameInput.value.trim();
    const pass = passwordInput.value.trim();

    if (!nick) {
      notify(serviceType === 'clan' ? 'Введите название клана' : 'Введите ник');
      return;
    }
    if (serviceType === 'clan') {
  const clanPattern = /^\[.*\]$/;
  if (!clanPattern.test(nick)) {
    notify('❌ У клана должны быть квадратные скобки [ ]');
    return;
  }
} else if (serviceType === 'self') {
  if (/\[.*\]/.test(nick)) {
    notify('❌ Ник не может содержать [ ]');
    return;
  }
}
    if (chosenType === 'pass') {
      if (!pass) {
        notify('❌ Введите пароль');
        return;
      }
      if (pass.length > 5) {
        notify('❌ Пароль ≤5 символов');
        return;
      }
    }
    if (chosenType !== 'pass' && !processedImageUrl) {
      notify('❌ Загрузите изображение');
      return;
    }

    finalTitleEl.textContent = `Оплата — ${chosenSkin}`;
    priceEl.textContent = `${chosenPrice}₽`;
    paidBtn.disabled = false;
    expiredBox.classList.add('hiddenn');
    startTimer();
    setActiveStep(3);
  });

  // Таймер
  function startTimer() {
    clearInterval(timerInterval);
    timer = 10 * 60;
    updateTimer();
    timerInterval = setInterval(() => {
      if (timer > 0) {
        timer--;
        updateTimer();
      } else {
        clearInterval(timerInterval);
        onExpired();
      }
    }, 1000);
  }
  function updateTimer() {
    const m = Math.floor(timer / 60), s = timer % 60;
    countdownEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }
  function onExpired() {
    countdownEl.textContent = '00:00';
    expiredBox.classList.remove('hiddenn');
    paidBtn.disabled = true;
  }

  // Кнопки назад
  backToChoose.addEventListener('click', () => setActiveStep(1));
  backToData.addEventListener('click', () => setActiveStep(2));

  // Отправка данных
  paidBtn.addEventListener('click', async () => {
    if (!(await checkAdBlocker())) return;

    const nick = nicknameInput.value.trim();
    const pass = passwordInput.value.trim();
    const formData = new FormData();
    formData.append('nickname', nick);
    formData.append('price', chosenPrice);
    formData.append('serviceType', serviceType);
    formData.append('submissionType', chosenType);
    if (chosenType === 'pass') {
      formData.append('password', pass);
    } else {
      if (!imageInput.files[0]) {
        notify('❌ Файл не выбран');
        return;
      }
      formData.append('file', imageInput.files[0]);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.agar.su/api/submit', true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            notify('✅ Идет модерация 10-30 минут.');
            resetShop();
          } else {
            notify('❌ Ошибка: ' + data.error);
          }
        } else {
          notify('⚠ Ошибка сети: ' + xhr.statusText);
        }
      }
    };
    xhr.send(formData);
  });

  // Начать заново
  restartBtn.addEventListener('click', resetShop);
  function resetShop() {
    clearInterval(timerInterval);
    setActiveStep(1);
    imageInput.value = '';
    uploadCircle.innerHTML = '<span>Загрузите изображение</span>';
    nicknameInput.value = '';
    passwordInput.value = '';
    processedImageUrl = null;
    expiredBox.classList.add('hiddenn');
    paidBtn.disabled = false;
    finalTitleEl.textContent = 'Оплата';
    priceEl.textContent = '100.00₽';
    chosenSkin = null;
    chosenType = null;
    chosenPrice = 0;
  }

  function setActiveStep(step) {
    currentStep = step;
    stepContents.forEach(c => c.classList.toggle('active', Number(c.dataset.step) === step));
  }

  setActiveStep(1);
})();

