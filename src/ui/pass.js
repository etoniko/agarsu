import { onReady } from "../lib/dom.js";
import { loadPassData } from "../storage/staticLists.js";
onReady(() => {
  const nickInput = document.getElementById("nick");
  const passInput = document.getElementById("pass");
  let allowedNicks = [];
  function normalizeNick(nick) {
    if (!nick) return "";
    let n = nick.trim();
    const brackets = { "[": "]", "{": "}", "(": ")", "|": "|" };
    const firstChar = n.charAt(0);
    const lastChar = n.charAt(n.length - 1);
    if (brackets[firstChar]) {
      const closeChar = brackets[firstChar];
      const endIndex = n.indexOf(closeChar, 1);
      if (endIndex === -1) return "";
      const innerNick = n.substring(1, endIndex);
      if (!innerNick || innerNick.trim() !== innerNick) return "";
      n = innerNick;
    } else {
      if (!n || n.trim() !== n) return "";
    }
    return n.toLowerCase();
  }
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1e3);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/";
  }
  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
    }
    return null;
  }
  loadPassData().then((data) => {
    allowedNicks = data.passUsers || [];
    const savedNick = getCookie("userNick");
    const savedPass = getCookie("userPass");
    if (savedNick) {
      nickInput.value = savedNick;
      checkNickStatus(savedNick);
    }
    if (savedPass) {
      passInput.value = savedPass;
    }
  }).catch((error) => {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0435 pass.txt:", error);
  });
  function checkNickStatus(nick) {
    const normalized = normalizeNick(nick);
    if (allowedNicks.includes(normalized)) {
      passInput.style.display = "block";
    } else {
      passInput.style.display = "none";
    }
  }
  nickInput.addEventListener("input", () => {
    const currentNick = nickInput.value.trim();
    if (currentNick) {
      setCookie("userNick", currentNick, 7);
    } else {
      setCookie("userNick", "", -1);
      passInput.style.display = "none";
    }
    checkNickStatus(currentNick);
  });
  passInput.addEventListener("input", () => {
    const currentPass = passInput.value.trim();
    if (currentPass) {
      setCookie("userPass", currentPass, 7);
    } else {
      setCookie("userPass", "", -1);
    }
  });
});