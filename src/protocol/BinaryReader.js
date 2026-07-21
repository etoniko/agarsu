class BinaryReader {
  constructor(view) {
    this.view = view;
    this.byteLength = view.byteLength;
    this.offset = 0;
  }
  get canRead() {
    return this.offset < this.byteLength;
  }
  uint8() {
    return this.view.getUint8(this.offset++);
  }
  int8() {
    return this.view.getInt8(this.offset++);
  }
  uint16() {
    return this.view.getUint16((this.offset += 2) - 2, true);
  }
  int16() {
    return this.view.getInt16((this.offset += 2) - 2, true);
  }
  uint32() {
    return this.view.getUint32((this.offset += 4) - 4, true);
  }
  int32() {
    return this.view.getInt32((this.offset += 4) - 4, true);
  }
  utf16() {
    let str = "";
    let char;
    while (this.canRead && (char = this.uint16())) str += String.fromCharCode(char);
    return str;
  }
  utf8() {
    let text = "";
    for (let byte1; byte1 = this.canRead && this.view.getUint8(this.offset++); ) {
      if (byte1 <= 127) text += String.fromCharCode(byte1);
      else if (byte1 <= 223)
        text += String.fromCharCode(
          (byte1 & 31) << 6 | this.view.getUint8(this.offset++) & 63
        );
      else if (byte1 <= 239)
        text += String.fromCharCode(
          (byte1 & 15) << 12 | (this.view.getUint8(this.offset++) & 63) << 6 | this.view.getUint8(this.offset++) & 63
        );
      else {
        let codePoint = (byte1 & 7) << 18 | (this.view.getUint8(this.offset++) & 63) << 12 | (this.view.getUint8(this.offset++) & 63) << 6 | this.view.getUint8(this.offset++) & 63;
        if (codePoint >= 65536) {
          codePoint -= 65536;
          text += String.fromCharCode(55296 | codePoint >> 10, 56320 | codePoint & 1023);
        } else text += String.fromCharCode(codePoint);
      }
    }
    return text;
  }
}
export {
  BinaryReader
};