import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const SIZES = [192, 512];
const BG_COLOR = { r: 255, g: 249, b: 245, alpha: 1 }; // #FFF9F5
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'icons');

async function generateIcon(size: number): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const fontSize = Math.round(size * 0.5);
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="55%" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">🎁</text>
  </svg>`;

  try {
    await sharp({
      create: { width: size, height: size, channels: 4, background: BG_COLOR },
    })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toFile(path.join(OUTPUT_DIR, `icon-${size}.png`));

    console.log(`Generated icon-${size}.png (with emoji)`);
  } catch {
    // Fallback: solid background only if emoji rendering fails
    await sharp({
      create: { width: size, height: size, channels: 4, background: BG_COLOR },
    })
      .png()
      .toFile(path.join(OUTPUT_DIR, `icon-${size}.png`));

    console.log(`Generated icon-${size}.png (solid background fallback)`);
  }
}

Promise.all(SIZES.map(generateIcon)).catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
