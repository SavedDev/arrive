const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      console.log(m.type(), m.text().slice(0, 800));
  });
  await page.goto('http://127.0.0.1:8093');
  await page.getByText('Quick check-in', { exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/inspect-home.png' });
  console.log(
    await page.evaluate(() => ({
      size: [innerWidth, innerHeight],
      text: document.body.innerText.slice(0, 1200),
    })),
  );
  await b.close();
})();
