export const uint8ArrayToBase64 = (u8a: Uint8Array) => {
  // return in web-safe base64
  return btoa(String.fromCharCode(...u8a))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};
