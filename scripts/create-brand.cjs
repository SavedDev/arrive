// Builds every platform logo asset from the approved logo (assets/brand/arrive-logo.png): a
// transparent PNG of the speech-bubble pin with its heart cut out. The full-color mark fills the
// heart white, as the logo shows it; one-color versions keep it cut out so the heart survives.
// The App Store icon puts the mark on white. assets/brand/arrive-wordmark.png is the logo with
// the name, for reference.
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

// White: the app icon's background (iOS requires one). Everywhere else the logo is transparent;
// the launch screen sets its own white background in app.json.
const BACKGROUND = '#FFFFFF';
const imageDir = path.resolve('assets/images');
const widgetDir = path.resolve('assets/widgets');
const brandDir = path.resolve('assets/brand');
const logo = path.join(brandDir, 'arrive-logo.png');

/**
 * In the browser: crops the logo to its artwork and centres it on a square canvas. `fillHeart`
 * paints the enclosed cut-out white; `background` fills the square and fits the mark within
 * `artwork` of it (for the App Store icon). `height` instead keeps the artwork's own shape, at
 * that height (for the wordmark), and `recolor` repaints its dark navy lettering. `gap` widens the
 * space between the pin and the name by that share of the artwork's height. `shiftX` moves the
 * artwork sideways by that share of the canvas's width (negative is left). Returns the image,
 * its width ÷ height, and where the name starts (as a share of the height, from the left).
 */
function prepare([src, { fillHeart, background, artwork = 1, height, recolor, gap, shiftX = 0 }]) {
  return (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = img.width;
    const h = img.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, w, h);
    const a = (i) => data.data[i * 4 + 3];
    if (recolor) {
      // The lettering is the only dark, unsaturated colour; the pin and rays keep theirs.
      const [r, gr, b] = [1, 3, 5].map((k) => parseInt(recolor.slice(k, k + 2), 16));
      for (let i = 0; i < w * h; i++) {
        const d = data.data;
        const [pr, pg, pb] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
        if (a(i) > 0 && pr < 110 && pg < 120 && pb < 130 && pr <= pg + 10) {
          d[i * 4] = r;
          d[i * 4 + 1] = gr;
          d[i * 4 + 2] = b;
        }
      }
      g.putImageData(data, 0, 0);
    }
    // The artwork's bounds.
    let [x0, y0, x1, y1] = [w, h, 0, 0];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (a(y * w + x) > 16) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    if (fillHeart) {
      // Clear pixels that can't be reached from the edge are the heart.
      const outside = new Uint8Array(w * h);
      const stack = [];
      for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
      while (stack.length) {
        const i = stack.pop();
        if (outside[i] || a(i) > 200) continue;
        outside[i] = 1;
        const x = i % w;
        if (x > 0) stack.push(i - 1);
        if (x < w - 1) stack.push(i + 1);
        if (i >= w) stack.push(i - w);
        if (i < w * (h - 1)) stack.push(i + w);
      }
      // Group the enclosed gaps. Only the heart is filled: it's the gap ringed by the coral pin.
      // The gaps inside letters (a, e) stay see-through.
      const hole = new Int32Array(w * h).fill(-1);
      const coral = [];
      let holes = 0;
      for (let start = 0; start < w * h; start++) {
        if (outside[start] || a(start) > 200 || hole[start] >= 0) continue;
        const id = holes++;
        let red = 0;
        let edge = 0;
        const queue = [start];
        hole[start] = id;
        while (queue.length) {
          const i = queue.pop();
          const x = i % w;
          for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
            if (j < 0 || j >= w * h) continue;
            if (a(j) > 200) {
              edge++;
              const d = data.data;
              if (d[j * 4] > 180 && d[j * 4 + 1] < 150) red++;
            } else if (!outside[j] && hole[j] < 0) {
              hole[j] = id;
              queue.push(j);
            }
          }
        }
        coral[id] = edge > 0 && red / edge > 0.5;
      }
      // Paint white under the heart, a few pixels wider so its soft edge blends into white.
      const under = g.createImageData(w, h);
      const grow = 3;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (outside[i] || a(i) > 200 || !coral[hole[i]]) continue;
          for (let dy = -grow; dy <= grow; dy++)
            for (let dx = -grow; dx <= grow; dx++) {
              const j = (y + dy) * w + (x + dx);
              if (j < 0 || j >= w * h || outside[j]) continue;
              under.data.set([255, 255, 255, 255], j * 4);
            }
        }
      const layer = document.createElement('canvas');
      layer.width = w;
      layer.height = h;
      layer.getContext('2d').putImageData(under, 0, 0);
      g.globalCompositeOperation = 'destination-over';
      g.drawImage(layer, 0, 0);
      g.globalCompositeOperation = 'source-over';
    }
    let art = c;
    let nameLeft = null;
    if (gap) {
      // Columns with no ink inside the artwork; the widest run is the space before the name.
      const empty = (x) => {
        for (let y = y0; y <= y1; y++) if (a(y * w + x) > 16) return false;
        return true;
      };
      let best = [0, 0];
      let run = -1;
      for (let x = x0; x <= x1 + 1; x++) {
        if (x <= x1 && empty(x)) {
          if (run < 0) run = x;
        } else if (run >= 0) {
          if (x - run > best[1] - best[0]) best = [run, x];
          run = -1;
        }
      }
      const extra = Math.round((y1 - y0 + 1) * gap);
      const mid = Math.round((best[0] + best[1]) / 2);
      art = document.createElement('canvas');
      art.width = w + extra;
      art.height = h;
      const k = art.getContext('2d');
      k.drawImage(c, 0, 0, mid, h, 0, 0, mid, h);
      k.drawImage(c, mid, 0, w - mid, h, mid + extra, 0, w - mid, h);
      nameLeft = best[1] + extra;
      x1 += extra;
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const ow = height ? Math.round((bw * height) / bh) : 1024;
    const oh = height ?? 1024;
    const out = document.createElement('canvas');
    out.width = ow;
    out.height = oh;
    const o = out.getContext('2d');
    if (background) {
      o.fillStyle = background;
      o.fillRect(0, 0, ow, oh);
    }
    const scale = height ? height / bh : (1024 * artwork) / Math.max(bw, bh);
    o.imageSmoothingQuality = 'high';
    o.drawImage(
      art,
      x0,
      y0,
      bw,
      bh,
      (ow - bw * scale) / 2 + ow * shiftX,
      (oh - bh * scale) / 2,
      bw * scale,
      bh * scale,
    );
    return {
      url: out.toDataURL('image/png'),
      aspect: ow / oh,
      nameStart: nameLeft === null ? null : (nameLeft - x0) / bh,
    };
  })();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const prep = await browser.newPage();
  const source = `data:image/png;base64,${(await fs.readFile(logo)).toString('base64')}`;
  const make = async (options) => (await prep.evaluate(prepare, [source, options])).url;
  const sources = {
    // The App Store and home screen icon: the mark on white, with breathing room.
    // Nudged left: the pin, the logo's weight, sits right of its centre.
    icon: await make({ fillHeart: true, background: BACKGROUND, artwork: 0.74, shiftX: -0.05 }),
    mark: await make({ fillHeart: true }),
    // One-color uses: the heart stays a cut-out.
    cutout: await make({ fillHeart: false }),
  };
  const save = (name, url) =>
    fs.writeFile(path.join(brandDir, name), Buffer.from(url.split(',')[1], 'base64'));
  await save('arrive-icon-master.png', sources.icon);
  await save('arrive-mark-master.png', sources.mark);

  // The logo with the name, for Home's header: navy lettering, and a light version for dark mode.
  const wordmark = `data:image/png;base64,${(await fs.readFile(path.join(brandDir, 'arrive-wordmark.png'))).toString('base64')}`;
  // A little more room between the pin and the name than the source artwork has.
  const GAP = 0.06;
  for (const [name, recolor] of [
    ['arrive-wordmark.png', undefined],
    ['arrive-wordmark-dark.png', '#F0F5ED'],
  ]) {
    const { url, aspect, nameStart } = await prep.evaluate(prepare, [
      wordmark,
      { fillHeart: true, height: 240, recolor, gap: GAP },
    ]);
    await fs.writeFile(path.join(imageDir, name), Buffer.from(url.split(',')[1], 'base64'));
    // Where things sit in it, so lines under the name can line up with it.
    if (!recolor)
      await fs.writeFile(
        path.join(brandDir, 'wordmark-geometry.json'),
        `${JSON.stringify({ aspect, nameStart, baseline: 0.725 }, null, 2)}\n`,
      );
  }
  // The same, for the Lock Screen banner's header (30pt tall) at 1x, 2x and 3x.
  for (const [name, recolor] of [
    ['arrive-activity-wordmark', undefined],
    ['arrive-activity-wordmark-dark', '#F0F5ED'],
  ])
    for (const scale of [1, 2, 3]) {
      const { url } = await prep.evaluate(prepare, [
        wordmark,
        { fillHeart: true, height: 30 * scale, recolor, gap: GAP },
      ]);
      await fs.writeFile(
        path.join(widgetDir, `${name}${scale === 1 ? '' : `@${scale}x`}.png`),
        Buffer.from(url.split(',')[1], 'base64'),
      );
    }

  async function render(name, size, options = {}) {
    const {
      source,
      imageSize = size,
      background = 'transparent',
      monochrome = false,
      outputDirectory = imageDir,
    } = options;
    // A fresh page per image: resizing one page between screenshots can capture a stale layout.
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { width: size, height: size },
    });
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
    await page.close();
  }

  await fs.mkdir(widgetDir, { recursive: true });

  // Store and web icons use the complete edge-to-edge artwork.
  await render('arrive-icon.png', 1024, { source: 'icon' });
  await render('icon.png', 1024, { source: 'icon' });
  await render('favicon.png', 64, { source: 'icon' });

  // Adaptive icons need generous transparent padding so Android masks never crop the mark.
  await render('arrive-adaptive.png', 1024, { source: 'mark', imageSize: 800 });
  await render('arrive-monochrome.png', 1024, {
    source: 'cutout',
    imageSize: 800,
    monochrome: true,
  });
  await render('android-icon-background.png', 512, { background: BACKGROUND });
  await render('android-icon-foreground.png', 512, { source: 'mark', imageSize: 400 });
  await render('android-icon-monochrome.png', 432, {
    source: 'cutout',
    imageSize: 338,
    monochrome: true,
  });

  // Launch screens use the full-color mark. Android notification icons must be white on alpha.
  await render('arrive-splash.png', 1024, { source: 'mark' });
  await render('splash-icon.png', 1024, { source: 'mark' });
  await render('arrive-notification.png', 96, {
    source: 'cutout',
    imageSize: 76,
    monochrome: true,
  });

  // Widget assets live in the native extension's asset catalog at 1x, 2x and 3x. Only the bare
  // mark: the logo never sits on a tile in the widget or on the Lock Screen.
  for (const scale of [1, 2, 3]) {
    const suffix = scale === 1 ? '' : `@${scale}x`;
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
