// Builds every platform logo asset from the approved full-color and transparent masters.
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const CREAM = '#FAF0E2';
const imageDir = path.resolve('assets/images');
const widgetDir = path.resolve('assets/widgets');
const masters = {
  icon: path.resolve('assets/brand/arrive-icon-master.png'),
  mark: path.resolve('assets/brand/arrive-mark.svg'),
};

async function dataUrl(file) {
  const mime = path.extname(file) === '.svg' ? 'image/svg+xml' : 'image/png';
  return `data:${mime};base64,${(await fs.readFile(file)).toString('base64')}`;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const sources = {
    icon: await dataUrl(masters.icon),
    mark: await dataUrl(masters.mark),
  };

  async function render(name, size, options = {}) {
    const {
      source,
      imageSize = size,
      background = 'transparent',
      monochrome = false,
      outputDirectory = imageDir,
    } = options;
    await page.setViewportSize({ width: size, height: size });
    const offset = (size - imageSize) / 2;
    await page.setContent(`
      <style>
        html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: ${background}; }
        img {
          position: absolute;
          left: ${offset}px;
          top: ${offset}px;
          width: ${imageSize}px;
          height: ${imageSize}px;
          object-fit: contain;
          ${monochrome ? 'filter: brightness(0) invert(1);' : ''}
        }
      </style>
      ${source ? `<img src="${sources[source]}" />` : ''}
    `);
    if (source) await page.locator('img').evaluate((image) => image.decode());
    await page.screenshot({ path: path.join(outputDirectory, name), omitBackground: true });
  }

  await fs.mkdir(widgetDir, { recursive: true });
  await render('arrive-mark-master.png', 1024, {
    source: 'mark',
    outputDirectory: path.resolve('assets/brand'),
  });

  // Store and web icons use the complete edge-to-edge artwork.
  await render('arrive-icon.png', 1024, { source: 'icon' });
  await render('icon.png', 1024, { source: 'icon' });
  await render('favicon.png', 64, { source: 'icon' });

  // Adaptive icons need generous transparent padding so Android masks never crop the mark.
  await render('arrive-adaptive.png', 1024, { source: 'mark', imageSize: 800 });
  await render('arrive-monochrome.png', 1024, {
    source: 'mark',
    imageSize: 800,
    monochrome: true,
  });
  await render('android-icon-background.png', 512, { background: CREAM });
  await render('android-icon-foreground.png', 512, { source: 'mark', imageSize: 400 });
  await render('android-icon-monochrome.png', 432, {
    source: 'mark',
    imageSize: 338,
    monochrome: true,
  });

  // Launch screens use the full-color mark. Android notification icons must be white on alpha.
  await render('arrive-splash.png', 1024, { source: 'mark' });
  await render('splash-icon.png', 1024, { source: 'mark' });
  await render('arrive-notification.png', 96, {
    source: 'mark',
    imageSize: 76,
    monochrome: true,
  });

  // Widget assets live in the native extension's asset catalog at 1x, 2x and 3x.
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
    await render(`arrive-activity-icon${suffix}.png`, 64 * scale, {
      source: 'icon',
      outputDirectory: widgetDir,
    });
    await render(`arrive-activity-mark${suffix}.png`, 64 * scale, {
      source: 'mark',
      outputDirectory: widgetDir,
    });
  }

  await fs.writeFile(
    path.join(imageDir, 'arrive-icon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><image width="1024" height="1024" href="arrive-icon.png"/></svg>\n',
  );
  await browser.close();
})();
