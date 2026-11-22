const fs = require('fs');
const path = require('path');
const { chromium } = require('/usr/local/share/bun-global/node_modules/playwright');

(async () => {
  const outDir = path.resolve('.tmp_qa');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  const pageErrors = [];
  const consoleErrors = [];
  const badResponses = [];

  page.on('pageerror', (err) => {
    console.error('PAGEERROR:', err.message);
    pageErrors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('CONSOLE_ERROR:', msg.text());
      consoleErrors.push(msg.text());
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.error('BAD_RES:', res.status(), res.url());
      badResponses.push(`${res.status()} ${res.url()}`);
    }
  });

  const snap = async (name) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(outDir, name);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    console.log('Saved', name);
  };

  const setCam = async (pos, target) => {
    await page.evaluate(
      ({ p, t }) => {
        const a = window.__atrium;
        if (!a) return;
        a.sim.cancelFlight();
        a.camera.position.set(p[0], p[1], p[2]);
        a.controls.target.set(t[0], t[1], t[2]);
        a.controls.update();
      },
      { p: pos, t: target }
    );
    await page.waitForTimeout(550);
  };

  console.log('Opening http://127.0.0.1:3000 ...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => Boolean(window.__atrium && window.__atrium.proceduralFoliage), null, {
    timeout: 75000,
  });
  await page.waitForTimeout(2000);

  const stats = await page.evaluate(() => {
    const pf = window.__atrium.proceduralFoliage;
    return {
      replacedHedges: pf.replacedHedges,
      replacedPlanters: pf.replacedPlanters,
      replacedShrubs: pf.replacedShrubs,
      replacedMossWalls: pf.replacedMossWalls,
      variedPottedPlants: pf.variedPottedPlants,
      variedTrees: pf.variedTrees,
      windItems: pf.windItems.length,
      geometries: pf.geometries.length,
      materials: pf.materials.length,
    };
  });
  console.log('PROCEDURAL_FOLIAGE_STATS:', JSON.stringify(stats, null, 2));

  // 1. Roadside / avenue hedges (ROAD_Z=58, hedges at z=47.35, x=-19 & 19)
  await setCam([-24.5, 2.2, 52.8], [-18.5, 0.7, 47.35]);
  await snap('qa_foliage_hedges.png');

  // 2. District bank / Chandarana shrubs, river-stone beds, palms & planters
  await setCam([-40, 3.6, 21], [-48, 1.2, 6]);
  await snap('qa_foliage_bank_planters.png');

  // 3. Hub entrance courtyard shrubs, trees, potted plants & palms
  await setCam([-10, 4.2, 26], [3, 1.2, 14]);
  await snap('qa_foliage_courtyard.png');

  // 4. Hub Level 2 Relax Room biophilic moss wall + TV + sign
  await page.evaluate(() => window.__atrium.selectLevel('l2'));
  await page.waitForTimeout(1600);
  await setCam([-25, 11.4, 9.2], [-25, 10.6, 0.3]);
  await snap('qa_foliage_relax_l2.png');

  // 5. Return to overview & inspect Hub balcony planter troughs
  await page.evaluate(() => window.__atrium.selectLevel('overview'));
  await page.waitForTimeout(1400);
  await setCam([-18, 12.2, 22], [2, 8.8, 11.5]);
  await snap('qa_foliage_balcony_planters.png');

  console.log('PAGE_ERRORS:', pageErrors.length, pageErrors);
  console.log('CONSOLE_ERRORS:', consoleErrors.length, consoleErrors);
  console.log('BAD_RESPONSES:', badResponses.length, badResponses);

  await browser.close();
  if (pageErrors.length || consoleErrors.length || badResponses.length) {
    process.exit(1);
  }
})();
