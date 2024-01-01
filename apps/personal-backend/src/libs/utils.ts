// convert uint8array to base64 string
export const uint8ArrayToBase64 = (u8a: Uint8Array) => {
  return Buffer.from(u8a).toString('base64');
};
