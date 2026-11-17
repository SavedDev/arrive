// Generates iOS template images from the exact Lucide glyphs used in the React Native UI.
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve('.');
const output = path.join(root, 'assets/widgets');
const iconDirectory = path.join(root, 'node_modules/lucide-react-native/dist/esm/icons');

const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const kebab = (value) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const assetName = (name) => `ArrivePreset${name[0].toUpperCase()}${name.slice(1)}`;

(async () => {
  const icons = JSON.parse(await fs.readFile(path.join(output, 'preset-icons.json'), 'utf8'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, sourceName] of Object.entries(icons)) {
    const source = await fs.readFile(path.join(iconDirectory, `${sourceName}.mjs`), 'utf8');
    const match = source.match(/const iconData = (\{[\s\S]*?\n\});/);
    if (!match) throw new Error(`Could not read Lucide icon ${sourceName}`);
    const data = vm.runInNewContext(`(${match[1]})`);
    const nodes = data.node
      .map(([tag, attrs]) => {
        const values = Object.entries(attrs)
          .filter(([key]) => key !== 'key')
          .map(([key, value]) => `${kebab(key)}="${escape(value)}"`)
          .join(' ');
        return `<${tag} ${values}/>`;
      })
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${nodes}</svg>`;
    for (const scale of [1, 2, 3]) {
      const size = 32 * scale;
      const suffix = scale === 1 ? '' : `@${scale}x`;
      // A fresh page per size: resizing one page can capture before it redraws, leaving the
      // larger images blank.
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: { width: size, height: size },
      });
      await page.setContent(
        `<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{width:100%;height:100%}</style>${svg}`,
      );
      await page.screenshot({
        path: path.join(output, `preset-${name}${suffix}.png`),
        omitBackground: true,
      });
      await page.close();
    }
    process.stdout.write(`${assetName(name)}\n`);
  }
  await browser.close();
})();
