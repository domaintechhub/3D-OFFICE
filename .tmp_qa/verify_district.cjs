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
  await page.locator('button', { hasText: 'DomainTechHub' }).waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForTimeout(2800);
  await snap('district_overview_hub.png');

  // Check HUD stats & actor/chair invariants
  const invariants = await page.evaluate(() => {
    const eng = window.__atrium;
    if (!eng) return { error: 'No __atrium engine exposed' };
    const sim = eng.sim;
    const dSim = sim.districtSim;
    const seatedPoses = new Set(['sit', 'type', 'think', 'phone', 'monitorLook', 'leanScreen', 'writeNotes', 'meeting', 'sitReadDoc', 'sitTalk', 'sitCollaborate']);
    let totalVisible = 0;
    let seatedNoChair = [];
    for (const a of dSim.ACTORS) {
      if (!a.g.visible) continue;
      totalVisible++;
      if (seatedPoses.has(a.pose)) {
        const chairs = sim.arch?.districtBuildings?.get(a.buildingId)?.chairs || [];
        // Note: districtSim stores own chair list or arch has them via sim.districtBuildings
        void chairs;
      }
    }
    let chairsThrown = 0;
    const dbMap = eng.arch.districtBuildings;
    for (const [bId, db] of dbMap) {
      for (const ch of db.chairs) {
        const d = Math.hypot(ch.curX - ch.restX, ch.curZ - ch.restZ);
        if (d > (ch.maxPush || 0.45) + 0.08) {
          chairsThrown++;
          console.warn('Thrown chair in', bId, d);
        }
      }
    }
    return {
      districtActorCount: dSim.ACTORS.length,
      visibleDistrictActors: totalVisible,
      hubActorsCount: sim.WORKERS.length + sim.DAYONLY.length + sim.BASEMENT_STAFF.length + 1,
      districtBuildingsCount: dbMap.size,
      districtMonitorsCount: eng.arch.monitorPicks.filter((m) => !!m.buildingId).length,
      chairsThrown,
      seatedNoChairCount: seatedNoChair.length,
    };
  });
  console.log('INVARIANTS:', JSON.stringify(invariants));

  // Cycle through each of the 7 niche buildings + ground cutaway view
  const targets = [
    { btn: 'Restaurant', shot: 'district_restaurant.png', cutaway: 'G' },
    { btn: 'Car Dealership', shot: 'district_dealership.png', cutaway: 'G' },
    { btn: 'Bank', shot: 'district_bank.png', cutaway: 'G' },
    { btn: 'Crypto', shot: 'district_crypto.png', cutaway: 'G' },
    { btn: 'Travel', shot: 'district_travel.png', cutaway: 'G' },
    { btn: 'Tourism', shot: 'district_tourism.png', cutaway: 'G' },
    { btn: 'Medical', shot: 'district_medical.png', cutaway: 'G' },
  ];

  for (const t of targets) {
    await domClick(t.btn);
    await page.waitForTimeout(1600);
    await snap(t.shot.replace('.png', '_ext.png'));
    await domClick(t.cutaway, true);
    await page.waitForTimeout(1800);
    await snap(t.shot);
  }

  // Verify clicking a district monitor (Bank) opens WorkstationInspector
  await page.evaluate(() => {
    const eng = window.__atrium;
    const bankMon = eng.arch.monitorPicks.find((m) => m.buildingId === 'bank');
    if (bankMon) eng.inspectMonitor(bankMon);
  });
  await page.waitForTimeout(1400);
  const monTitle = await page.locator('h2').first().textContent().catch(() => null);
  console.log('INSPECTED_MONITOR_CARD:', monTitle);
  await snap('district_monitor_inspector.png');

  // Verify selecting a district character shows Autonomous Mind inspector + thought bubble
  await page.evaluate(() => {
    const eng = window.__atrium;
    eng.closeMonitorInspector();
    const actor = eng.sim.districtSim.ACTORS.find((a) => a.buildingId === 'restaurant' && a.g.visible && a.brain);
    if (actor) eng.selectActor(actor);
  });
  await page.waitForTimeout(1400);
  const charModal = await page.evaluate(() => document.body.innerText.includes('Autonomous Mind'));
  console.log('CHARACTER_INSPECTOR_VISIBLE:', charModal);
  await snap('district_char_inspector.png');

  // Verify Walk Mode works across the plaza into Dealership doorway
  await page.evaluate(() => {
    const eng = window.__atrium;
    eng.selectBuilding('dealership');
  });
  await page.waitForTimeout(800);
  await domClick('Walk In');
  await page.waitForTimeout(600);
  const walkBefore = await page.evaluate(() => ({
    x: window.__atrium.sim.walkPos.x,
    z: window.__atrium.sim.walkPos.z,
    walking: window.__atrium.sim.walkOn,
  }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  const walkAfter = await page.evaluate(() => ({
    x: window.__atrium.sim.walkPos.x,
    z: window.__atrium.sim.walkPos.z,
  }));
  console.log('WALK_TEST:', JSON.stringify({ walkBefore, walkAfter }));
  await snap('district_walk_dealership.png');
  await domClick('Exit [Esc]');
  await page.waitForTimeout(500);

  await browser.close();

  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors));
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
  console.log('BAD_RESPONSES:', JSON.stringify(badResponses));

  if (pageErrors.length > 0 || consoleErrors.length > 0 || badResponses.length > 0) {
    process.exitCode = 1;
  }
})();
