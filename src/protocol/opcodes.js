const ClientOpcode = {
  NICK: 0,
  SPECTATE: 1,
  PING: 2,
  MOUSE: 16,
  SPLIT: 17,
  EJECT_Q: 18,
  Q_UP: 19,
  CLEAR: 20,
  EJECT: 21,
  MACRO_E: 22,
  MACRO_R: 23,
  MACRO_T: 24,
  MACRO_P: 25,
  CHAT: 99,
  STICKER: 200,
  HANDSHAKE_PROTO: 254,
  HANDSHAKE_KEY: 255
};
const ServerOpcode = {
  PING: 2,
  UPDATE_NODES: 16,
  UPDATE_CAMERA: 17,
  CLEAR_NODES: 20,
  CUSTOM_LB: 48,
  FFA_LB: 49,
  BORDERS: 64,
  BAN: 91,
  CHAT: 99,
  XP: 114,
  STICKER: 200
};
function prepareData(byteLength) {
  return new DataView(new ArrayBuffer(byteLength));
}
function encodeHandshake() {
  const proto = prepareData(5);
  proto.setUint8(0, ClientOpcode.HANDSHAKE_PROTO);
  proto.setUint32(1, 5, true);
  const key = prepareData(5);
  key.setUint8(0, ClientOpcode.HANDSHAKE_KEY);
  key.setUint32(1, 0, true);
  return [proto, key];
}
function encodePing() {
  return new Uint8Array([ClientOpcode.PING]);
}
export {
  ClientOpcode,
  ServerOpcode,
  encodeHandshake,
  encodePing,
  prepareData
};