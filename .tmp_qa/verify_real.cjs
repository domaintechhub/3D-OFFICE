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
    viewport: { width: 1280, height: 760 },
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

  const domClick = async (text) => {
    const ok = await page.evaluate((t) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find((el) => (el.textContent || '').trim().includes(t));
      if (b) {
        b.click();
        return true;
      }
      return false;
    }, text);
    if (!ok) throw new Error(`Button not found: ${text}`);
    return ok;
  };

  const waitFrames = async (minElapsedDelta) => {
    const start = await page.evaluate(() => window.__atrium.elapsed);
    await page.waitForFunction(
      ({ s, d }) => window.__atrium && window.__atrium.elapsed - s >= d,
      { s: start, d: minElapsedDelta },
      { timeout: 45000 }
    );
  };

  console.log('Opening http://127.0.0.1:3000 ...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('button', { hasText: 'Drive Car' }).waitFor({ state: 'visible', timeout: 75000 });
  await waitFrames(0.3);

  // 1. Live Nairobi sync
  console.log('Testing Live Nairobi sync...');
  const nairobiResPromise = page.waitForResponse((r) => r.url().includes('/api/nairobi-live'), { timeout: 15000 });
  await domClick('Live Nairobi');
  const nairobiRes = await nairobiResPromise;
  const nairobiJson = await nairobiRes.json();
  console.log('LIVE_NAIROBI:', JSON.stringify(nairobiJson));

  // Reset to sunny daytime for crystal clear visual inspection of driving shots
  await domClick('Clear');
  await domClick('Morning');
  await waitFrames(0.2);

  // 2. Drive Car mode
  console.log('Entering Drive Car mode...');
  await domClick('Drive Car');
  await waitFrames(0.2);

  const carBefore = await page.evaluate(() => {
    const eng = window.__atrium;
    return {
      driving: eng.sim.isDriving(),
      pos: { x: Number(eng.sim.drivePos.x.toFixed(2)), z: Number(eng.sim.drivePos.z.toFixed(2)) },
    };
  });
  console.log('CAR_BEFORE:', JSON.stringify(carBefore));

  // Hold KeyW + steer onto South Lane toward Main Blvd across enough rendered frames
  await page.keyboard.down('KeyW');
  await waitFrames(1.0);
  await page.keyboard.down('KeyD');
  await waitFrames(0.5);
  await page.keyboard.up('KeyD');
  await waitFrames(0.5);
  await page.keyboard.up('KeyW');

  const carAfter = await page.evaluate(() => {
    const eng = window.__atrium;
    const audio = eng.sim.getDriveAudioState();
    return {
      driving: eng.sim.isDriving(),
      speedAbs: Number(audio.speedAbs.toFixed(2)),
      gear: audio.gear,
      pos: { x: Number(eng.sim.drivePos.x.toFixed(2)), z: Number(eng.sim.drivePos.z.toFixed(2)) },
    };
  });
  console.log('CAR_AFTER_DRIVE:', JSON.stringify(carAfter));
  if (Math.hypot(carAfter.pos.x - carBefore.pos.x, carAfter.pos.z - carBefore.pos.z) < 3) {
    throw new Error('Player car did not move enough during Drive test!');
  }
  await snap('real_drive_chase.png');

  // Switch to Hood Camera [V]
  await page.keyboard.press('KeyV');
  await waitFrames(0.2);
  const camMode = await page.evaluate(() => document.body.innerText.includes('Hood [V]'));
  console.log('HOOD_CAM_ACTIVE:', camMode);
  await snap('real_drive_hood.png');

  // Step Out of Car [F] -> enters Walk Mode beside parked car
  await page.keyboard.press('KeyF');
  await waitFrames(0.2);
  const walkState = await page.evaluate(() => ({
    walking: window.__atrium.sim.walkOn,
    driving: window.__atrium.sim.isDriving(),
    nearCarBtn: Array.from(document.querySelectorAll('button')).some((b) => (b.textContent || '').includes('Get In Car')),
  }));
  console.log('STEP_OUT_STATE:', JSON.stringify(walkState));
  if (!walkState.walking || !walkState.nearCarBtn) {
    throw new Error('Expected Walk Mode with Get In Car button after KeyF!');
  }
  await snap('real_step_out.png');

  // Get back into car [G], then exit Drive Mode
  await page.keyboard.press('KeyG');
  await waitFrames(0.2);
  const backInCar = await page.evaluate(() => window.__atrium.sim.isDriving());
  console.log('BACK_IN_CAR:', backInCar);
  if (!backInCar) throw new Error('KeyG did not re-enter car from Walk Mode!');
  await domClick('Exit [Esc]');
  await waitFrames(0.2);

  // 3. Real Web Browsing & Search inside WorkstationInspector
  console.log('Testing WorkstationInspector real Browser...');
  await page.evaluate(() => {
    const eng = window.__atrium;
    const mon = eng.arch.monitorPicks.find((m) => m.buildingId === 'hub') || eng.arch.monitorPicks[0];
    if (mon) eng.inspectMonitor(mon);
  });
  await page.waitForTimeout(800);

  const browseResPromise = page.waitForResponse((r) => r.url().includes('/api/browse'), { timeout: 20000 });
  await domClick('Web Browser');
  const browseRes = await browseResPromise;
  const browseJson = await browseRes.json();
  console.log('LIVE_BROWSE_INITIAL:', JSON.stringify({ ok: browseJson.ok, status: browseJson.status, title: browseJson.title, domain: browseJson.domain }));
  await page.waitForTimeout(500);

  // Perform a live search query
  const searchResPromise = page.waitForResponse((r) => r.url().includes('/api/search'), { timeout: 20000 });
  await page.fill('input[placeholder*="URL or search"]', 'Kenya tech innovation');
  await domClick('Go');
  const searchRes = await searchResPromise;
  const searchJson = await searchRes.json();
  console.log('LIVE_SEARCH:', JSON.stringify({ ok: searchJson.ok, query: searchJson.query, resultCount: (searchJson.results || []).length }));
  await waitFrames(0.2);
  await snap('real_browser.png');

  await browser.close();

  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors));
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
  console.log('BAD_RESPONSES:', JSON.stringify(badResponses));

  if (pageErrors.length > 0 || consoleErrors.length > 0 || badResponses.length > 0) {
    process.exitCode = 1;
  }
})();
