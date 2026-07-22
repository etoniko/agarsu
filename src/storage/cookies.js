function getCookie(name) {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : void 0;
}
function cookieSecurityFlags() {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  return `; path=/; SameSite=Lax${secure}`;
}
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1e3);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value || "") + expires + cookieSecurityFlags();
}
function deleteCookie(name) {
  document.cookie = name + "=; Max-Age=0" + cookieSecurityFlags();
}
export {
  deleteCookie,
  getCookie,
  setCookie
};