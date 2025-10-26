export const utf8Encoder = new TextEncoder();
export const utf8Decoder = new TextDecoder();

export function writeUtf16String(dv, offset, str){
  for (let i=0;i<str.length;i++){
    dv.setUint16(offset + i*2, str.charCodeAt(i), true);
  }
  dv.setUint16(offset + str.length*2, 0, true);
  return offset + str.length*2 + 2;
}

// Helper to read zero-terminated UTF-8 from DataView with custom byte getter
export function readUtf8String(dv, nextByte){
  const bytes = [];
  while (true){
    const byte = nextByte();
    if (!byte) break;
    bytes.push(byte);
  }
  try{
    return new TextDecoder().decode(new Uint8Array(bytes));
  }catch{
    return "";
  }
}
