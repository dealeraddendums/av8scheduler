// Generate iOS app icons + splash from the shared logo.
//
// Outputs:
//   apps/ios/assets/icon.png            1024×1024 navy bg, logo at 60% width
//   apps/ios/assets/splash.png          1242×2436 navy bg, logo at 40% width + "AV8 Scheduler" text
//   apps/ios/assets/adaptive-icon.png   1024×1024 transparent bg, logo at 70% width
//
// Run: node scripts/generate-ios-assets.mjs   (or `pnpm ios:assets`)

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const LOGO = path.join(ROOT, 'apps/web/src/assets/logo.png');
const OUT_DIR = path.join(ROOT, 'apps/ios/assets');
const NAVY = '#0f2744';

async function logoBufferAt(targetPx) {
  return sharp(LOGO)
    .resize({ width: targetPx, height: targetPx, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
}

async function generateIcon() {
  const W = 1024;
  const logoW = Math.round(W * 0.6);
  const logo = await logoBufferAt(logoW);
  await sharp({
    create: { width: W, height: W, channels: 4, background: NAVY },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT_DIR, 'icon.png'));
  console.log(`  icon.png: ${W}×${W}, logo ${logoW}px`);
}

async function generateAdaptiveIcon() {
  const W = 1024;
  const logoW = Math.round(W * 0.7);
  const logo = await logoBufferAt(logoW);
  await sharp({
    create: { width: W, height: W, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT_DIR, 'adaptive-icon.png'));
  console.log(`  adaptive-icon.png: ${W}×${W}, logo ${logoW}px, transparent`);
}

async function generateSplash() {
  const W = 1242;
  const H = 2436;
  const logoW = Math.round(W * 0.4);
  const logo = await logoBufferAt(logoW);
  // Logo positioned slightly above vertical center; text 80px below the logo's lower edge.
  const logoY = Math.round(H * 0.42) - Math.round(logoW / 2);
  const textY = logoY + logoW + 80 + 56; // baseline below logo bottom (+ font height padding)
  const textSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <text x="${W / 2}" y="${textY}"
            font-family="-apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif"
            font-size="72" font-weight="600" fill="white" text-anchor="middle">
        AV8 Scheduler
      </text>
    </svg>`
  );
  await sharp({
    create: { width: W, height: H, channels: 4, background: NAVY },
  })
    .composite([
      { input: logo, top: logoY, left: Math.round((W - logoW) / 2) },
      { input: textSvg, top: 0, left: 0 },
    ])
    .png()
    .toFile(path.join(OUT_DIR, 'splash.png'));
  console.log(`  splash.png: ${W}×${H}, logo ${logoW}px @ y=${logoY}, text @ y=${textY}`);
}

async function main() {
  console.log('Generating iOS assets…');
  console.log(`  source: ${LOGO}`);
  await generateIcon();
  await generateAdaptiveIcon();
  await generateSplash();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
