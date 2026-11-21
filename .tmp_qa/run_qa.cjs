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
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  const pageErrors = [];
  const consoleErrors = [];
  const badResponses = [];

  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url()}`);
  });

  const snap = async (name) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(outDir, name);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    console.log('Saved', name);
  };

  const domClick = async (text, exact = false) => {
    const ok = await page.evaluate(
      ({ t, ex }) => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((el) => {
          const txt = (el.textContent || '').trim();
          return ex ? txt === t : txt.includes(t);
        });
        if (b) {
          b.click();
          return true;
        }
        return false;
      },
      { t: text, ex: exact }
    );
    if (!ok) console.warn('Button not found:', text);
    return ok;
  };

  console.log('Opening http://127.0.0.1:3000 ...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('button', { hasText: 'Characters' }).waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForTimeout(3000);

  // Switch to Ground Floor cutaway to inspect Lobby & Bays close-up
  await domClick('G', true);
  await page.waitForTimeout(2500);
  await snap('after_g_cutaway.png');

  // Open Character Studio Modal
  await domClick('Characters');
  await page.locator('h2', { hasText: 'Photorealistic 3D Character Studio' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2600);

  // Pause turntable at clean 3/4 view
  await domClick('Turntable ON');
  await page.waitForTimeout(500);
  await snap('studio_amina_full.png');

  await domClick('Face & Hair');
  await page.waitForTimeout(1600);
  await snap('studio_amina_face.png');

  await domClick('Hands & Outfit');
  await page.waitForTimeout(1600);
  await snap('studio_amina_hands.png');

  await domClick('Full Body');
  await domClick('01 · Typing at Desk');
  await page.waitForTimeout(1600);
  await snap('studio_amina_seated.png');

  // Drag OrbitControls horizontally ~90deg to inspect exact right side profile
  const canvasBox = await page.locator('canvas').nth(1).boundingBox().catch(() => null);
  const targetBox = canvasBox || { x: 640, y: 450, width: 400, height: 400 };
  const cx = targetBox.x + targetBox.width * 0.5;
  const cy = targetBox.y + targetBox.height * 0.5;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 210, cy, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  await snap('studio_amina_side.png');

  await domClick('Kamau Njoroge');
  await page.waitForTimeout(800);
  await domClick('Face & Hair');
  await page.waitForTimeout(1600);
  await snap('studio_kamau_face.png');

  await domClick('Wanjiku Kariuki');
  await page.waitForTimeout(800);
  await domClick('Full Body');
  await page.waitForTimeout(1600);
  await snap('studio_wanjiku_full.png');

  await domClick('Nia Adebayo');
  await page.waitForTimeout(800);
  await domClick('Face & Hair');
  await domClick('GLB Pipeline');
  await page.waitForTimeout(1600);
  await snap('studio_nia_face.png');

  await browser.close();

  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors));
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
  console.log('BAD_RESPONSES:', JSON.stringify(badResponses));

  if (pageErrors.length > 0 || badResponses.length > 0) {
    process.exitCode = 1;
  }
})();
