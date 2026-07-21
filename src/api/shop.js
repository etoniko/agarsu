import { SHOP_API } from "../config/endpoints.js";
async function checkNickname(nickname) {
  const res = await fetch(SHOP_API.checkNickname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname })
  });
  return res.json();
}
async function createPayment(payload) {
  const res = await fetch(SHOP_API.createPayment, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}
export {
  checkNickname,
  createPayment
};