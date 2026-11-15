import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const match = html.match(/<script id="snellen-engine">([\s\S]*?)<\/script>/);
assert.ok(match, 'Could not find <script id="snellen-engine"> in index.html');

const sandbox = { Math, Float32Array, Map, Set, console };
vm.createContext(sandbox);
vm.runInContext(`${match[1]}\n;globalThis.SnellenCore = SnellenCore;`, sandbox);
const { SnellenCore } = sandbox;

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

function pointInTri(px, py, ax, ay, bx, by, cx, cy) {
  const v0x = cx - ax, v0y = cy - ay;
  const v1x = bx - ax, v1y = by - ay;
  const v2x = px - ax, v2y = py - ay;
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-12) return false;
  const inv = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  return u >= -1e-6 && v >= -1e-6 && (u + v) <= 1 + 1e-6;
}

function glyphCovers(glyph, px, py) {
  const t = glyph.tris;
  for (let i = 0; i < t.length; i += 6) {
    if (pointInTri(px, py, t[i], t[i + 1], t[i + 2], t[i + 3], t[i + 4], t[i + 5])) {
      return true;
    }
  }
  return false;
}

console.log('\nRunning SnellenCore Optometric & Geometry Test Suite...');

test('Exact Snellen physical height at 20 ft (6.096 m) matches clinical standard (8.866 mm for 20/20)', () => {
  const h20_20 = SnellenCore.optotypeHeightMeters(6.096, 1.0);
  const h20_200 = SnellenCore.optotypeHeightMeters(6.096, 10.0);
  const hETDRS_4m = SnellenCore.optotypeHeightMeters(4.0, 1.0);
  const hVR_1_3m = SnellenCore.optotypeHeightMeters(1.3, 1.0);

  assert.ok(Math.abs(h20_20 * 1000 - 8.86627) < 0.002, `Expected ~8.866 mm, got ${h20_20 * 1000}`);
  assert.ok(Math.abs(h20_200 * 1000 - 88.6629) < 0.02, `Expected ~88.663 mm, got ${h20_200 * 1000}`);
  assert.ok(Math.abs(hETDRS_4m * 1000 - 5.81776) < 0.002, `Expected ~5.818 mm, got ${hETDRS_4m * 1000}`);
  assert.ok(Math.abs(hVR_1_3m * 1000 - 1.89077) < 0.002, `Expected ~1.891 mm, got ${hVR_1_3m * 1000}`);

  // Stroke width must be strictly 1/5th of optotype height (1 arcminute at 20/20)
  assert.ok(Math.abs(SnellenCore.strokeWidthMeters(6.096, 1.0) * 5 - h20_20) < 1e-12);
});

test('Angular subtense invariance across all VR focal planes & lean-lock distances', () => {
  const nominalDistances = [6.096, 4.0, 2.0, 1.5, 1.3];
  const liveLeanDistances = [0.65, 1.1, 1.3, 1.5, 2.2, 4.0, 6.096];

  for (const dNom of nominalDistances) {
    const baseH = SnellenCore.optotypeHeightMeters(dNom, 1.0);
    assert.ok(Math.abs(SnellenCore.subtendedArcmin(baseH, dNom) - 5.0) < 1e-7);

    for (const dLive of liveLeanDistances) {
      const leanScale = dLive / dNom;
      const scaledH = baseH * leanScale;
      const arcmin = SnellenCore.subtendedArcmin(scaledH, dLive);
      assert.ok(Math.abs(arcmin - 5.0) < 1e-5, `Expected 5.00', got ${arcmin} at dLive=${dLive}`);
    }
  }
});

test('All 24 vector 5x5 optotypes stay strictly within [0, 5] x [0, 5] with valid triangles', () => {
  const allGlyphs = [
    'C', 'D', 'E', 'F', 'H', 'K', 'L', 'N', 'O', 'P', 'R', 'S', 'T', 'V', 'Z',
    'TUMBLING_E', 'LANDOLT_C',
    '2', '3', '4', '5', '6', '8', '9'
  ];

  for (const id of allGlyphs) {
    const g = SnellenCore.getGlyph(id);
    assert.ok(g.tris.length >= 12 && g.tris.length % 6 === 0, `Invalid triangle array for ${id}`);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < g.tris.length; i += 2) {
      const x = g.tris[i], y = g.tris[i + 1];
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `NaN/Inf in ${id}`);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    assert.ok(minX >= -1e-5 && maxX <= 5 + 1e-5, `${id} X out of [0,5]: [${minX}, ${maxX}]`);
    assert.ok(minY >= -1e-5 && maxY <= 5 + 1e-5, `${id} Y out of [0,5]: [${minY}, ${maxY}]`);
    assert.ok(Math.abs(minY - 0) < 1e-3 && Math.abs(maxY - 5) < 1e-3, `${id} does not span full 5u height: [${minY}, ${maxY}]`);
    assert.ok((maxX - minX) >= 4.2, `${id} width unexpectedly narrow: [${minX}, ${maxX}]`);
  }
});

test('ISO 8596 Landolt C ring has exact 5u outer, 3u inner, and 1u parallel right gap', () => {
  const lc = SnellenCore.getGlyph('LANDOLT_C');
  // Center hole (2.5, 2.5) must be empty
  assert.equal(glyphCovers(lc, 2.5, 2.5), false, 'Center of Landolt C must be hollow');
  // Left, top, bottom strokes must be solid
  assert.equal(glyphCovers(lc, 0.5, 2.5), true, 'Left stroke must be solid');
  assert.equal(glyphCovers(lc, 2.5, 4.5), true, 'Top stroke must be solid');
  assert.equal(glyphCovers(lc, 2.5, 0.5), true, 'Bottom stroke must be solid');
  // Parallel gap |y - 2.5| < 0.5 on +x must be open
  assert.equal(glyphCovers(lc, 4.4, 2.5), false, 'Gap center must be open');
  assert.equal(glyphCovers(lc, 4.4, 2.95), false, 'Just inside upper gap edge must be open');
  assert.equal(glyphCovers(lc, 4.4, 2.05), false, 'Just inside lower gap edge must be open');
  // Just outside parallel gap (y = 3.08 and y = 1.92 at x = 4.2) must be solid
  assert.equal(glyphCovers(lc, 4.2, 3.08), true, 'Upper lip above 1u gap must be solid');
  assert.equal(glyphCovers(lc, 4.2, 1.92), true, 'Lower lip below 1u gap must be solid');
});

test('Anti-memorization cycling mutates 100% of positions and prevents adjacent duplicates across all 6 charts', () => {
  const chartModes = [
    ['snellen', {}],
    ['etdrs', {}],
    ['tumbling_e', {}],
    ['landolt_c', { landolt8: false }],
    ['landolt_c', { landolt8: true }],
    ['hotv', {}],
    ['numbers', {}]
  ];

  for (const [typeId, opts] of chartModes) {
    let prev = SnellenCore.generateChartData(typeId, null, opts);
    for (let iter = 0; iter < 250; iter++) {
      const next = SnellenCore.generateChartData(typeId, prev, opts);
      for (let r = 0; r < next.rows.length; r++) {
        const items = next.rows[r].items;
        const prevItems = prev.rows[r].items;
        for (let c = 0; c < items.length; c++) {
          assert.notEqual(
            items[c].token,
            prevItems[c].token,
            `[${typeId}] Slot [${r}][${c}] did not change on cycle ${iter}`
          );
          if (c > 0) {
            assert.notEqual(
              items[c].token,
              items[c - 1].token,
              `[${typeId}] Adjacent duplicate in row ${r} at col ${c}`
            );
          }
        }
        if (typeId === 'etdrs') {
          const unique = new Set(items.map(i => i.token));
          assert.equal(unique.size, 5, 'ETDRS row must contain 5 unique Sloan letters');
        }
      }
      prev = next;
    }
  }
});

test('Physical layout engine correctly supports Full Chart, Single Line, and Single Optotype modes', () => {
  const chart = SnellenCore.generateChartData('snellen');
  const full = SnellenCore.layoutChartPhysical(chart, 6.096, 'full', 7);
  assert.equal(full.rowLayouts.length, 10);
  assert.equal(full.optotypes.length, 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 8 + 8);

  const line = SnellenCore.layoutChartPhysical(chart, 6.096, 'line', 7); // 20/20 row
  assert.equal(line.rowLayouts.length, 1);
  assert.equal(line.optotypes.length, 8);
  assert.ok(Math.abs(line.optotypes[0].size * 1000 - 8.86627) < 0.002);

  const single = SnellenCore.layoutChartPhysical(chart, 6.096, 'single', 7);
  assert.equal(single.optotypes.length, 1);
  assert.equal(single.optotypes[0].cx, 0);
  assert.equal(single.optotypes[0].cy, 0);
});

test('HMD PPD & Nyquist acuity estimator matches exact on-axis rectilinear & asymmetric frustum optics', () => {
  // 1. Symmetric 90 deg horizontal FOV -> P[0] = 1 / tan(45 deg) = 1.0, P[8] = 0, W = 2250 px:
  //    Average FOV PPD = 2250 / 90 = 25.0, while exact On-Axis Center Render PPD (theta = 0) = (2250/2) * 1.0 * (pi/180) = 19.634954 PPD
  const sym = SnellenCore.estimateHmdOptics([1.0, 0, 0, 0,  0, 1.0, 0, 0,  0.0, 0, -1, -1,  0, 0, -0.2, 0], 2250);
  assert.ok(Math.abs(sym.hFovDeg - 90.0) < 1e-6);
  assert.ok(Math.abs(sym.avgPPD - 25.0) < 1e-6);
  const expectedCenter = 0.5 * 2250 * 1.0 * (Math.PI / 180);
  assert.ok(Math.abs(sym.centerPPD - expectedCenter) < 1e-6);
  assert.equal(SnellenCore.estimateHmdPPD([1.0, 0, 0, 0], 2250), sym.centerPPD);
  assert.equal(SnellenCore.nyquistSnellenDenom(30.0), 40);

  // 2. Asymmetric HMD stereo frustum (e.g. nasal 42 deg, temporal 54 deg => total hFov = 96 deg):
  const tanL = Math.tan(42 * Math.PI / 180);
  const tanR = Math.tan(54 * Math.PI / 180);
  const p00 = 2 / (tanR + tanL);
  const p02 = (tanR - tanL) / (tanR + tanL);
  const asym = SnellenCore.estimateHmdOptics([p00, 0, 0, 0,  0, 1.0, 0, 0,  p02, 0, -1, -1,  0, 0, -0.2, 0], 3400);
  assert.ok(Math.abs(asym.hFovDeg - 96.0) < 1e-5, `Expected 96 deg asymmetric hFOV, got ${asym.hFovDeg}`);
  assert.ok(Math.abs(asym.centerPPD - (0.5 * 3400 * p00 * Math.PI / 180)) < 1e-5);
});

test('Voice phonetic & homophone parser accurately maps letters, directions, digits, and skips', () => {
  assert.deepEqual(
    [...SnellenCore.parseSpokenTokens('Charlie delta see echo tea zee cant read', 'snellen')],
    ['C', 'D', 'C', 'E', 'T', 'Z', 'SKIP']
  );
  assert.deepEqual(
    [...SnellenCore.parseSpokenTokens('up down left right', 'tumbling_e')],
    [90, 270, 180, 0]
  );
  assert.deepEqual(
    [...SnellenCore.parseSpokenTokens('up right bottom left don\'t know', 'landolt_c', true)],
    [45, 225, 'SKIP']
  );
  assert.deepEqual(
    [...SnellenCore.parseSpokenTokens('two for six ate nine', 'numbers')],
    ['2', '4', '6', '8', '9']
  );
});

test('Clinical adaptive exam engine scores 20/25 +2, 20/20 -1, and < 20/200 accurately', () => {
  // 1. Simulate subject who reads everything down to 20/25, and gets 2 out of 5 on 20/20
  const ex1 = SnellenCore.createExamSession('snellen', 'OD');
  let p2020Trials = 0;
  while (ex1.status === 'active') {
    const row = ex1.chartData.rows[ex1.rowIdx];
    const target = SnellenCore.getExamTargetItem(ex1);
    let ans = target.token;
    if (row.denom === 20) {
      p2020Trials++;
      ans = p2020Trials <= 2 ? target.token : 'SKIP';
    } else if (row.denom < 20) {
      ans = 'SKIP';
    }
    SnellenCore.submitExamResponse(ex1, ans);
  }
  assert.equal(ex1.result.snellen, '20/25 +2');
  assert.equal(ex1.result.metric, '6/7.5 +2');
  assert.ok(Math.abs(ex1.result.logMAR - 0.06) < 0.015, `Expected LogMAR ~0.06, got ${ex1.result.logMAR}`);

  // 2. Simulate subject who gets 4/5 on 20/20 and 0/5 on 20/15 => 20/20 -1 (LogMAR +0.02)
  const ex2 = SnellenCore.createExamSession('etdrs', 'OS');
  let t2020 = 0;
  while (ex2.status === 'active') {
    const row = ex2.chartData.rows[ex2.rowIdx];
    const target = SnellenCore.getExamTargetItem(ex2);
    let ans = target.token;
    if (row.denom === 20) {
      t2020++;
      ans = t2020 <= 4 ? target.token : 'SKIP';
    } else if (row.denom < 20) {
      ans = 'SKIP';
    }
    SnellenCore.submitExamResponse(ex2, ans);
  }
  assert.equal(ex2.result.snellen, '20/20 -1');
  assert.equal(ex2.result.logMAR, 0.02);

  // 3. Simulate subject who cannot pass 20/200 (gets 1/5 on 20/200)
  const ex3 = SnellenCore.createExamSession('tumbling_e', 'OU');
  // Miss screening on 20/200, then get 1/5 on threshold 20/200
  SnellenCore.submitExamResponse(ex3, 'SKIP');
  let t200 = 0;
  while (ex3.status === 'active') {
    t200++;
    const target = SnellenCore.getExamTargetItem(ex3);
    SnellenCore.submitExamResponse(ex3, t200 === 1 ? target.token : 'SKIP');
  }
  assert.equal(ex3.result.snellen, '< 20/200 (+1)');
});

test('Goldmann Size III & V stimulus geometry matches 4 mm² & 64 mm² clinical bowl standards', () => {
  const d3At300mm = SnellenCore.vfStimulusDiameterMeters(0.30, 'III') * 1000; // mm
  const area3Mm2 = Math.PI * Math.pow(d3At300mm * 0.5, 2);
  assert.ok(Math.abs(area3Mm2 - 4.0) < 0.02, `Expected Goldmann III area ~4.00 mm² at 300 mm, got ${area3Mm2}`);

  const d5At300mm = SnellenCore.vfStimulusDiameterMeters(0.30, 'V') * 1000;
  const area5Mm2 = Math.PI * Math.pow(d5At300mm * 0.5, 2);
  assert.ok(Math.abs(area5Mm2 - 64.0) < 0.35, `Expected Goldmann V area ~64.0 mm² at 300 mm, got ${area5Mm2}`);

  // Spherical dome placement preserves exact radius R and inward normal toward eye origin
  for (const [xDeg, yDeg] of [[0, 0], [15, -1.5], [-27, 3], [9, -21]]) {
    const sp = SnellenCore.vfSphericalPointMeters(1.5, xDeg, yDeg);
    const r = Math.hypot(sp.pos[0], sp.pos[1], sp.pos[2]);
    const nLen = Math.hypot(sp.normal[0], sp.normal[1], sp.normal[2]);
    const dot = sp.pos[0] * sp.normal[0] + sp.pos[1] * sp.normal[1] + sp.pos[2] * sp.normal[2];
    assert.ok(Math.abs(r - 1.5) < 1e-9, `Point radius ${r} != 1.5m`);
    assert.ok(Math.abs(nLen - 1.0) < 1e-9, `Normal length ${nLen} != 1`);
    assert.ok(Math.abs(dot + 1.5) < 1e-9, 'Inward normal must point directly back to tested eye center');
  }
});

test('Visual Field grid patterns (24-2, Fast-28, 10-2) & OD/OS nasal-step mirroring', () => {
  const g24OD = SnellenCore.buildVisualFieldGrid('24-2', 'OD');
  const g24OS = SnellenCore.buildVisualFieldGrid('24-2', 'OS');
  assert.equal(g24OD.points.length, 54, 'Humphrey 24-2 grid must contain exactly 54 points');
  assert.equal(g24OS.points.length, 54, 'Humphrey 24-2 OS grid must contain exactly 54 points');
  assert.equal(g24OD.points.filter(p => p.isBlindSpotLocus).length, 2, '24-2 OD should flag (+15, ±3) blind-spot loci');
  assert.ok(g24OD.points.some(p => p.xDeg === -27 && p.yDeg === 3), 'OD 24-2 nasal step must lie at -27° (left/nasal)');
  assert.ok(!g24OD.points.some(p => p.xDeg === 27), 'OD 24-2 must not have temporal +27° points');
  assert.ok(g24OS.points.some(p => p.xDeg === 27 && p.yDeg === 3), 'OS 24-2 nasal step must mirror to +27° (right/nasal)');
  assert.ok(g24OS.points.some(p => p.xDeg === -15 && p.isBlindSpotLocus), 'OS blind spot must mirror to -15° temporal');

  const gFast = SnellenCore.buildVisualFieldGrid('fast-28', 'OD');
  assert.equal(gFast.points.length, 28, 'Fast-28 screening grid should contain 28 points');

  const g10 = SnellenCore.buildVisualFieldGrid('10-2', 'OD');
  assert.equal(g10.points.length, 24, '10-2 central macular grid should contain 24 points');
  assert.ok(g10.points.every(p => Math.abs(p.xDeg) <= 10 && Math.abs(p.yDeg) <= 10 && !p.isBlindSpotLocus));
});

test('Photopic perimetry decibel-to-luminance physics & ~14 dB HMD contrast floor', () => {
  const highSensitivity = SnellenCore.vfDecibelToLuminance(32); // dim increment
  const midSensitivity = SnellenCore.vfDecibelToLuminance(22);
  const floorStim = SnellenCore.vfDecibelToLuminance(14);
  const subFloorStim = SnellenCore.vfDecibelToLuminance(6); // exceeds 150 cd/m^2 consumer HMD peak

  assert.ok(Math.abs(highSensitivity.floorDb - 13.6) < 0.25, `Expected ~13.6 dB floor for 150 cd/m², got ${highSensitivity.floorDb}`);
  assert.equal(highSensitivity.isFloorClamped, false);
  assert.equal(floorStim.isFloorClamped, false);
  assert.equal(subFloorStim.isFloorClamped, true, '6 dB exceeds consumer HMD luminance ceiling and must report isFloorClamped=true');
  assert.equal(subFloorStim.stimSrgb, 1.0, 'Clamped stimulus saturates at peak sRGB 1.0');
  assert.ok(
    floorStim.stimSrgb > midSensitivity.stimSrgb && midSensitivity.stimSrgb > highSensitivity.stimSrgb,
    'Lower dB (brighter flash) must map monotonically to higher sRGB brightness above background'
  );
  assert.ok(highSensitivity.stimSrgb > highSensitivity.bgSrgb, '32 dB flash must remain brighter than 10 cd/m² background');
});

test('Visual Field 4–2 dB threshold staircase & suprathreshold engines detect arcuate scotomas', () => {
  // Deterministic PRNG for reproducible catch-trial & order simulation
  const makeSeededRng = (seed = 42) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // 1. Healthy normal eye on 24-2 4-2 dB threshold staircase
  const normSession = SnellenCore.createVisualFieldSession({
    patternId: '24-2',
    strategy: 'threshold',
    eyeMode: 'OD',
    rng: makeSeededRng(101)
  });
  while (normSession.status === 'active') {
    const stim = SnellenCore.nextVisualFieldStimulus(normSession);
    if (!stim) break;
    let seen = false;
    if (stim.kind === 'false_positive' || stim.kind === 'blind_spot') {
      seen = false;
    } else if (stim.kind === 'false_negative') {
      seen = true;
    } else {
      const p = normSession.points[stim.pointIdx];
      seen = !p.isBlindSpotLocus && stim.db <= p.expectedDb;
    }
    SnellenCore.resolveVisualFieldStimulus(normSession, seen);
  }
  assert.equal(normSession.status, 'complete');
  assert.equal(normSession.result.evaluatedPoints, 52);
  assert.ok(Math.abs(normSession.result.meanDeviation) <= 1.5, `Normal eye MD should be near 0 dB, got ${normSession.result.meanDeviation}`);
  assert.ok(normSession.result.patternStdDev < 2.0, `Normal eye PSD should be < 2 dB, got ${normSession.result.patternStdDev}`);
  assert.equal(normSession.result.seenPct, 100);
  assert.equal(normSession.result.reliable, true);

  // 2. Simulated Glaucomatous Superior Arcuate Scotoma (superior nasal/arcuate yDeg >= 9 depressed to <14 dB)
  const scotomaSession = SnellenCore.createVisualFieldSession({
    patternId: '24-2',
    strategy: 'threshold',
    eyeMode: 'OD',
    rng: makeSeededRng(202)
  });
  while (scotomaSession.status === 'active') {
    const stim = SnellenCore.nextVisualFieldStimulus(scotomaSession);
    if (!stim) break;
    let seen = false;
    if (stim.kind === 'false_negative') {
      seen = true;
    } else if (stim.kind === 'point') {
      const p = scotomaSession.points[stim.pointIdx];
      if (!p.isBlindSpotLocus) {
        const trueSensDb = p.yDeg >= 9 ? 10 : (p.yDeg === 3 && p.xDeg < 0 ? p.expectedDb - 7 : p.expectedDb);
        seen = stim.db <= trueSensDb;
      }
    }
    SnellenCore.resolveVisualFieldStimulus(scotomaSession, seen);
  }
  assert.ok(scotomaSession.result.meanDeviation < -5.5, `Arcuate scotoma should yield negative MD < -5.5 dB, got ${scotomaSession.result.meanDeviation}`);
  assert.ok(scotomaSession.result.patternStdDev > 5.0, `Localized superior defect must elevate PSD > 5 dB, got ${scotomaSession.result.patternStdDev}`);
  assert.ok(scotomaSession.result.deepCount >= 18, `Expected >= 18 deep (<14 dB) superior points, got ${scotomaSession.result.deepCount}`);
  assert.ok(scotomaSession.result.relativeCount >= 3, `Expected nasal relative defect points, got ${scotomaSession.result.relativeCount}`);
});

test('Heijl–Krakau blind-spot fixation losses, false positives, & spoken response parser', () => {
  let s = 777;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const noisy = SnellenCore.createVisualFieldSession({
    patternId: 'fast-28',
    strategy: 'suprathreshold',
    eyeMode: 'OS',
    rng
  });
  noisy.unsolicitedClicks = 3;
  while (noisy.status === 'active') {
    const stim = SnellenCore.nextVisualFieldStimulus(noisy);
    if (!stim) break;
    // Simulate poor fixation & trigger-happy clicking on EVERY catch trial, while missing FN catch trials
    const seen = stim.kind === 'false_negative' ? false : true;
    SnellenCore.resolveVisualFieldStimulus(noisy, seen);
  }
  assert.ok(noisy.result.bsCatchTotal >= 1 && noisy.result.fixationLosses === noisy.result.bsCatchTotal);
  assert.ok(noisy.result.falsePositives >= 4, 'Should tally blank FP catch trials + unsolicited ISI clicks');
  assert.equal(noisy.result.reliable, false, 'High FL/FP exam must be flagged as low reliability');
  assert.ok(noisy.result.reliabilityStatus.includes('Caution:'));

  assert.equal(SnellenCore.parseVfSpokenResponse('Seen!'), true);
  assert.equal(SnellenCore.parseVfSpokenResponse('yes flash'), true);
  assert.equal(SnellenCore.parseVfSpokenResponse('nothing'), false);
});

console.log(`\nAll ${passed} test suites passed!\n`);
