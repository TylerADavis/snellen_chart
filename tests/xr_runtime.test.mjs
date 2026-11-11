import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

const engineCode = html.match(/<script id="snellen-engine">([\s\S]*?)<\/script>/)[1];
const appCode = html.match(/<script id="snellen-app">([\s\S]*?)<\/script>/)[1];

// Extract all id="..." from HTML so we ensure every getElementById in appCode exists in HTML!
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

function makeClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: c => set.add(c),
    remove: c => set.delete(c),
    toggle: (c, force) => {
      if (force === undefined) {
        if (set.has(c)) { set.delete(c); return false; }
        set.add(c); return true;
      }
      if (force) set.add(c); else set.delete(c);
      return !!force;
    },
    contains: c => set.has(c)
  };
}

function makeMock2DCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    clearRect: (...a) => calls.push(['clearRect', ...a]),
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    beginPath: () => calls.push(['beginPath']),
    closePath: () => calls.push(['closePath']),
    roundRect: (...a) => calls.push(['roundRect', ...a]),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    fill: () => calls.push(['fill']),
    stroke: () => calls.push(['stroke']),
    fillText: (t, x, y) => calls.push(['fillText', t, x, y]),
    save: () => {},
    restore: () => {},
    scale: () => {},
    translate: () => {},
    rotate: () => {}
  };
}

function makeMockWebGL2() {
  const log = [];
  let objId = 1;
  return {
    log,
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88E4,
    DYNAMIC_DRAW: 0x88E8,
    STREAM_DRAW: 0x88E0,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    LINES: 0x0001,
    TEXTURE_2D: 0x0DE1,
    TEXTURE0: 0x84C0,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    LINEAR_MIPMAP_LINEAR: 0x2703,
    CLAMP_TO_EDGE: 0x812F,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    DEPTH_TEST: 0x0B71,
    LEQUAL: 0x0203,
    BLEND: 0x0BE2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    POLYGON_OFFSET_FILL: 0x8037,
    FRAMEBUFFER: 0x8D40,
    createShader: type => ({ id: objId++, type }),
    shaderSource: (sh, src) => { sh.src = src; assert.ok(src.includes('#version 300 es'), 'Must be GLSL ES 3.00'); },
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram: () => ({ id: objId++ }),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    getUniformLocation: (_p, name) => ({ name }),
    createVertexArray: () => ({ id: objId++ }),
    bindVertexArray: () => {},
    createBuffer: () => ({ id: objId++ }),
    bindBuffer: () => {},
    bufferData: () => {},
    deleteBuffer: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    createTexture: () => ({ id: objId++ }),
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    generateMipmap: () => {},
    activeTexture: () => {},
    useProgram: () => {},
    uniformMatrix4fv: () => {},
    uniform4f: (_l, r, g, b, a) => log.push(['uColor', r, g, b, a]),
    uniform1i: () => {},
    uniform1f: () => {},
    clearColor: (r, g, b, a) => log.push(['clearColor', r, g, b, a]),
    clear: () => log.push(['clear']),
    enable: () => {},
    disable: () => {},
    depthFunc: () => {},
    blendFunc: () => {},
    polygonOffset: () => {},
    bindFramebuffer: () => {},
    viewport: (x, y, w, h) => log.push(['viewport', x, y, w, h]),
    drawArrays: (mode, first, count) => log.push(['drawArrays', mode, first, count]),
    makeXRCompatible: async () => {}
  };
}

const mockGL = makeMockWebGL2();
const elements = new Map();

function makeElem(tag, id = '') {
  const listeners = {};
  const ctx2d = makeMock2DCtx();
  const el = {
    tagName: tag.toUpperCase(),
    id,
    value: id === 'selDistance' ? '1.500' : (id === 'selChartType' ? 'snellen' : '3.78'),
    checked: true,
    disabled: false,
    textContent: '',
    innerHTML: '',
    className: '',
    children: [],
    width: 1280,
    height: 800,
    dataset: {},
    style: {},
    classList: makeClassList(),
    appendChild: child => { el.children.push(child); return child; },
    addEventListener: (ev, fn) => {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    dispatch: (ev, payload = {}) => {
      for (const fn of (listeners[ev] || [])) fn(payload);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
    getContext: (kind) => (kind === 'webgl2' ? mockGL : ctx2d),
    _ctx2d: ctx2d
  };
  return el;
}

const layoutBtns = ['full', 'line', 'single'].map(m => {
  const b = makeElem('button');
  b.dataset.layout = m;
  return b;
});
const eyeBtns = ['OU', 'OD', 'OS'].map(m => {
  const b = makeElem('button');
  b.dataset.eye = m;
  return b;
});

// Mock WebXR Session & Frame infrastructure
let activeXRFrameCallback = null;
const xrSessionListeners = {};
const mockXRSession = {
  inputSources: [],
  renderState: {},
  updateRenderState(st) { Object.assign(this.renderState, st); },
  async requestReferenceSpace() { return { kind: 'local-floor' }; },
  addEventListener(ev, fn) {
    xrSessionListeners[ev] = xrSessionListeners[ev] || [];
    xrSessionListeners[ev].push(fn);
  },
  requestAnimationFrame(cb) { activeXRFrameCallback = cb; return 1; },
  end() {
    for (const fn of (xrSessionListeners['end'] || [])) fn();
  }
};

class MockXRWebGLLayer {
  constructor(_session, _gl, opts) {
    this.framebuffer = { id: 'xr-fb' };
    this.opts = opts;
  }
  getViewport(view) {
    return view.eye === 'left'
      ? { x: 0, y: 0, width: 2064, height: 2208 }
      : { x: 2064, y: 0, width: 2064, height: 2208 };
  }
  static getNativeFramebufferScaleFactor() { return 1.35; }
}

let lastSpeechInstance = null;
class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'en-US';
    lastSpeechInstance = this;
  }
  start() { if (this.onstart) this.onstart(); }
  stop() { if (this.onend) this.onend(); }
  emitFinal(transcript) {
    if (!this.onresult) return;
    const resultItem = [{ transcript }];
    resultItem.isFinal = true;
    this.onresult({ resultIndex: 0, results: [resultItem] });
  }
}

const winListeners = {};
const windowObj = {
  isSecureContext: true,
  devicePixelRatio: 2,
  XRWebGLLayer: MockXRWebGLLayer,
  SpeechRecognition: MockSpeechRecognition,
  navigator: {
    xr: {
      isSessionSupported: async (mode) => mode === 'immersive-vr' || mode === 'immersive-ar',
      requestSession: async () => mockXRSession
    }
  },
  addEventListener: (ev, fn) => {
    winListeners[ev] = winListeners[ev] || [];
    winListeners[ev].push(fn);
  },
  requestAnimationFrame: () => 1
};

const documentObj = {
  getElementById(id) {
    assert.ok(htmlIds.has(id), `App referenced #${id} which does not exist in index.html!`);
    if (!elements.has(id)) elements.set(id, makeElem('div', id));
    return elements.get(id);
  },
  createElement(tag) {
    return makeElem(tag);
  },
  querySelectorAll(sel) {
    if (sel === '[data-layout]') return layoutBtns;
    if (sel === '[data-eye]') return eyeBtns;
    return [];
  }
};

// Pre-create canvases with proper tag
elements.set('glCanvas', makeElem('canvas', 'glCanvas'));
elements.set('canvas2d', makeElem('canvas', 'canvas2d'));

const ctx = {
  window: windowObj,
  document: documentObj,
  navigator: windowObj.navigator,
  XRWebGLLayer: MockXRWebGLLayer,
  requestAnimationFrame: windowObj.requestAnimationFrame,
  Math,
  Float32Array,
  Map,
  Set,
  Promise,
  console,
  parseFloat,
  parseInt
};
vm.createContext(ctx);
vm.runInContext(engineCode, ctx);
vm.runInContext(appCode, ctx);

const app = windowObj.__SnellenApp;
assert.ok(app, 'Expected window.__SnellenApp to be initialized');

console.log('\nRunning Full WebXR + WebGL2 + 2D UI Integration Tests...');

// Wait microtasks for initWebXRSupport()
await new Promise(r => setTimeout(r, 10));
assert.equal(documentObj.getElementById('btnEnterVR').disabled, false, 'VR button should be enabled when XR supported');
assert.equal(documentObj.getElementById('btnEnterAR').disabled, false, 'AR button should be enabled when AR supported');
console.log('  ✓ DOM bindings verified & WebXR VR/AR capability detection enabled buttons');

// Start WebXR immersive-vr session
await app.startXR('immersive-vr');
assert.ok(app.state.xrSession, 'XR session should be active');
assert.equal(mockXRSession.renderState.baseLayer.opts.framebufferScaleFactor, 1.35, 'Should request native HMD framebuffer scale');
console.log('  ✓ WebXR session started at 100% native HMD framebuffer resolution scale');

// Build a realistic stereo XRViewerPose (IPD = 64mm: left = -0.032, right = +0.032, height = 1.65m, z = 0)
function makePose(zPos = 0) {
  const identityMat = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 1.65, zPos, 1
  ]);
  const makeView = (eye, xOffset) => ({
    eye,
    projectionMatrix: new Float32Array([1.0, 0, 0, 0,  0, 1.0, 0, 0,  0, 0, -1, -1,  0, 0, -0.2, 0]),
    transform: {
      position: { x: xOffset, y: 1.65, z: zPos },
      inverse: {
        matrix: new Float32Array([
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          -xOffset, -1.65, -zPos, 1
        ])
      }
    }
  });
  return {
    transform: {
      position: { x: 0, y: 1.65, z: zPos },
      matrix: identityMat
    },
    views: [makeView('left', -0.032), makeView('right', +0.032)]
  };
}

// Frame 1: Auto-recenter at 1.5m & stereo render
mockGL.log.length = 0;
activeXRFrameCallback(16, {
  session: mockXRSession,
  getViewerPose: () => makePose(0),
  getPose: () => null
});
assert.ok(Math.abs(app.state.chartAnchorPos[2] - (-1.5)) < 1e-5, 'Chart should anchor at z = -1.5m');
assert.ok(Math.abs(app.state.liveEyeDistance - 1.5) < 1e-5);
assert.ok(Math.abs(app.state.appliedScale - 1.0) < 1e-5);
assert.ok(app.state.hmdPPD > 20, 'Should compute live HMD PPD from XRView');
console.log(`  ✓ Stereo XR frame rendered & auto-calibrated HMD PPD (~${app.state.hmdPPD.toFixed(1)} PPD)`);

// Frame 2: Simulate user leaning 0.45m forward (z = -0.45 => 1.05m from chart)
activeXRFrameCallback(32, {
  session: mockXRSession,
  getViewerPose: () => makePose(-0.45),
  getPose: () => null
});
assert.ok(Math.abs(app.state.liveEyeDistance - 1.05) < 1e-4, `Expected live dist 1.05m, got ${app.state.liveEyeDistance}`);
assert.ok(Math.abs(app.state.appliedScale - (1.05 / 1.5)) < 1e-4, 'Chart must dynamically scale down when leaning forward so 20/20 stays 5.00 arcminutes');
console.log('  ✓ Dynamic lean-proof angular sizing verified in VR (5.00 arcminutes preserved)');

// Frame 3: Test Monocular Right-Eye Only (OD) occlusion in stereo pass
app.setEyeMode('OD');
mockGL.log.length = 0;
activeXRFrameCallback(48, {
  session: mockXRSession,
  getViewerPose: () => makePose(0),
  getPose: () => null
});
const clearColors = mockGL.log.filter(e => e[0] === 'clearColor');
assert.equal(clearColors.length, 2, 'Two eye clears per stereo frame');
assert.ok(Math.abs(clearColors[0][1] - 0.07) < 0.005, 'Left eye must clear to neutral dark occluder in OD mode');
assert.ok(Math.abs(clearColors[1][1] - 0.09) < 0.005, 'Right eye must render normal clinic background in OD mode');
console.log('  ✓ Stereo monocular Virtual Eye Occluder (OD/OS) verified');

// Frame 4: Test 3D VR Controller Laser Raycast clicking the "Cycle / Shuffle Chart" button on the floating console
const prevCycleCount = app.state.cycleCount;
// Aim ray from eye (0, 1.65, 0) toward upper-left Cycle button on panel at state.panelPos
const px = app.state.panelPos[0] - 0.18;
const py = app.state.panelPos[1] + 0.12;
const pz = app.state.panelPos[2];
const dx = px - 0, dy = py - 1.65, dz = pz - 0;
const len = Math.hypot(dx, dy, dz);
// Construct ray transform matrix whose -Z axis points along (dx, dy, dz)/len
const rayMat = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  -dx / len, -dy / len, -dz / len, 0,
  0, 1.65, 0, 1
]);
for (const fn of xrSessionListeners['select']) {
  fn({
    inputSource: { targetRaySpace: {}, targetRayMode: 'tracked-pointer' },
    frame: { getPose: () => ({ transform: { matrix: rayMat } }) }
  });
}
assert.equal(app.state.cycleCount, prevCycleCount + 1, 'Controller select raycast should trigger Cycle Chart');
console.log('  ✓ 3D VR Control Panel laser raycast & trigger action verified');

// End XR session and test 2D Calibrated Screen Mode + Keyboard Shortcuts
mockXRSession.end();
assert.equal(app.state.xrSession, null);

app.setViewportMode('2d');
const c2dCalls = elements.get('canvas2d')._ctx2d.calls;
assert.ok(c2dCalls.some(c => c[0] === 'fill'), '2D calibrated canvas must draw vector optotype polygons');

for (const fn of (winListeners['keydown'] || [])) {
  fn({ code: 'Space', key: ' ', preventDefault: () => {}, target: { tagName: 'BODY' } });
}
assert.equal(app.state.cycleCount, prevCycleCount + 2, 'Spacebar shortcut should shuffle chart');
console.log('  ✓ 2D Calibrated Screen Mode & keyboard controls verified');

// Test Scored Exam with Voice Recognition + Virtual Keypad + Scorecard
app.setEyeMode('OD');
app.setChartType('tumbling_e');
app.startExam();
assert.equal(app.state.exam.status, 'active');
assert.equal(elements.get('examKeypadGrid').children.length, 4, 'Tumbling E keypad should render 4 directional buttons');

// Enable Voice Input & answer first screening prompt via spoken direction!
app.toggleVoiceInput(true);
assert.ok(lastSpeechInstance && app.state.voiceListening, 'SpeechRecognition should start listening');
const firstDir = windowObj.SnellenCore.getExamTargetItem(app.state.exam).token;
const dirWord = { 0: 'right', 90: 'up', 180: 'left', 270: 'down' }[firstDir];
lastSpeechInstance.emitFinal(dirWord);
assert.equal(app.state.exam.rowIdx, 1, 'Spoken answer should advance screening from 20/200 to 20/100');

// Finish remaining exam prompts down to 20/20 perfect score and verify OD scorecard!
while (app.state.exam.status === 'active') {
  const row = app.state.exam.chartData.rows[app.state.exam.rowIdx];
  const expected = windowObj.SnellenCore.getExamTargetItem(app.state.exam).token;
  app.submitExamAnswer(row.denom >= 20 ? expected : 'SKIP');
}
assert.equal(app.state.exam.status, 'complete');
assert.equal(app.state.scores.OD.snellen, '20/20');
assert.equal(elements.get('scoreOD').textContent, '20/20');
console.log('  ✓ Multi-modal Scored Acuity Exam (Voice + Virtual Keypad + OD/OS/OU Scorecard) verified\n');
