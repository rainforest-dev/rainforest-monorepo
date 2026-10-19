import sharp from 'sharp';

export async function writtenPage(
  seed: number,
  { width = 600, height = 850, quality = 90 } = {},
): Promise<Uint8Array> {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const strokes = Array.from({ length: 60 }, () => ({
    x: random() * 0.8 + 0.1,
    y: random() * 0.8 + 0.1,
    w: random() * 0.25 + 0.05,
  }));
  const data = Buffer.alloc(width * height, 245);
  for (const { x, y, w } of strokes) {
    const top = Math.round(y * height);
    const left = Math.round(x * width);
    for (let dy = 0; dy < Math.max(2, height * 0.01); dy++) {
      for (let dx = 0; dx < w * width && left + dx < width; dx++) {
        data[(top + dy) * width + left + dx] = 40;
      }
    }
  }
  const jpeg = await sharp(data, { raw: { width, height, channels: 1 } })
    .jpeg({ quality })
    .toBuffer();
  return new Uint8Array(jpeg);
}
