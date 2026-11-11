# WebXR Clinical Snellen & Visual Acuity Chart

A zero-dependency, single-file (`index.html`) **WebXR VR / AR + Calibrated 2D** visual acuity chart built with pure WebGL2 vector optotypes and exact optometric angular math.

## Key Features

- **Exact 5-Arcminute Angular Sizing (`20/20 = 5.00′`)**
  - Uses WebXR's physical meter scale (`1 unit = 1.0 m`) with exact symmetric chord geometry: $H = 2 D \tan(\theta / 2)$ ($8.87\text{ mm}$ for `20/20` at $20\text{ ft} / 6.096\text{ m}$).
  - **Lean-Proof Angular Lock (`Lock 5′ Angular Size`)**: Tracks the live 3D distance from your active eye (`XRView`) to the chart every frame and dynamically scales the lightbox so leaning forward or backward never lets you "cheat" the angular size.
  - **Pure 3D Vector 5×5 Optotypes**: Every letter, ring, and digit is tessellated as crisp vector triangles rendered at 100% native headset panel resolution (`XRWebGLLayer.getNativeFramebufferScaleFactor`) with hardware MSAA — zero blurry font textures or mipmap degradation.
- **6 Clinical Chart Standards**
  1. **Classic Snellen** (`20/200` down to `20/10`, letters `C D E F L O P T Z`, clinical green/red reference bars + optional historical 1862 preset)
  2. **ETDRS / Sloan LogMAR** (`+1.0` to `-0.3` LogMAR in `0.1` steps, 5 unique Sloan letters `C D H K N O R S V Z` per row, proportional Ferris-Bailey spacing)
  3. **Tumbling E** (4 cardinal orientations `→ ↑ ← ↓`)
  4. **Landolt C — ISO 8596** (exact `5′` outer ring, `3′` inner counter, `1′` parallel slot gap; toggleable 4-direction or 8-direction ISO mode)
  5. **HOTV Symmetric Chart** (`H O T V`)
  6. **Clinical Numbers** (`2 3 4 5 6 8 9` on a strict 5×5 stroke grid)
- **Strict Anti-Memorization Cycling**
  - Every shuffle guarantees **100% of positions change** from the previous chart, prevents adjacent duplicates, and enforces unique letters per row on Sloan/Snellen rows.
  - Supports **Full Chart**, **Single-Line Isolation**, and **Single-Optotype** modes, plus a toggleable **Examiner Answer Key** on desktop.
- **VR & AR Optical Focal Plane Presets (Including Samsung Moohan & XREAL Aura)**
  - Built-in optical focal distance presets for **`0.9 m` (Samsung Project Moohan / Galaxy XR, ~1.11 D, ~35 PPD)**, **`1.3 m` (Meta Quest 3 / Pro, 0.77 D)**, **`1.5 m` / `2.0 m` (PCVR / Quest 2)**, **`3.0 m` / `4.0 m` (XREAL Aura / Birdbath OST & ETDRS)**, **`20 ft / 6.096 m` (Standard Snellen)**, plus **Custom Distance (`0.4–10.0 m`)**. Placing the virtual chart at your headset's optical focal plane eliminates **Vergence-Accommodation Conflict (VAC)** while preserving exact `5.00′` retinal subtense.
  - **OST Dark / Reverse Polarity Mode (XREAL Aura & Additive AR)**: On additive optical see-through glasses (`environmentBlendMode === 'additive'`), `#000000` is transparent and a white chart board causes waveguide glare. **OST Dark Mode** auto-activates on additive displays (and can be toggled anytime) to render crisp luminous white vector optotypes without background glare.
  - Live **HMD Pixels-Per-Degree (PPD) & Nyquist Floor** telemetry computed directly from the headset's stereo projection matrix and eye-buffer resolution.
- **Hand Tracking (`XRHand`) & Eye Tracking (`transient-pointer` + Gaze Dwell)**
  - **Articulated Hand Tracking**: Renders 3D hand joints in VR/AR, supports **pinch-ray pointing**, and supports **direct 3D index-finger poking** on the floating console buttons.
  - **Eye Tracking**: Supports **`transient-pointer` look-and-pinch** (Android XR on Samsung Moohan & XREAL Aura, plus Apple Vision Pro), **`gaze` eye rays**, and an optional **hands-free `1.1s` Eye/Head Gaze Dwell-to-Click** mode with visual progress bars on buttons.
- **Virtual Monocular Eye Occluder (`OU` / `OD` / `OS`)**
  - Test **Right Eye (`OD`)** or **Left Eye (`OS`)** in VR without trying to reach inside the headset facial interface — cleanly occludes the opposite eye's stereo pass with a low-rivalry neutral dark field.
- **Adaptive Clinical Scoring (Voice + 3D Virtual Keypad + Thumbstick + Keyboard)**
  - **Clinical Staircase & 5-Optotype Threshold Protocol**: Rapid 1-per-row screening descent followed by 5-trial threshold verification (`>= 3/5` majority pass), computing exact **Snellen modifier notation** (`20/25 +2`, `20/20 -1`), **Metric (`6/X`)**, **interpolated LogMAR** (`0.02 LogMAR` per letter), **Decimal acuity**, and a persistent **`OD / OS / OU` Session Scorecard**.
  - **4 Seamless Ways to Answer (Zero OS QWERTY Hassle in VR)**:
    1. **In-VR 3D Virtual Optotype Keypad**: Floating 3D console automatically switches to oversized target buttons for *only* the active chart's valid letters or directions (`C D E F L O P T Z`, `↑ ↓ ← →`, etc.) + `? Can't Read (Skip)`.
    2. **Hands-Free Voice Recognition (`🎤 Voice`)**: Uses the Web Speech API with an optometric phonetic/homophone parser (`"Charlie"` / `"see"` → `C`, `"tea"` → `T`, `"ate"` → `8`, `"up"` / `"left"` → `↑` / `←`, `"skip"` / `"can't read"` → `Skip`).
    3. **VR Controller Thumbstick Flick**: On Tumbling E & 4-way Landolt C exams, flicking the thumbstick Up/Down/Left/Right submits the orientation without looking away from the chart (`A/X` = Skip).
    4. **Physical Keyboard**: Type the letter/number, press Arrow keys for directions, or press `Space`/`?`/`Backspace` to skip.
- **2D Calibrated Flat-Screen Mode**
  - Includes a built-in **ISO Credit Card (`85.60 mm`) ruler calibrator** so friends without a VR headset can also use it at exact physical scale on any monitor or laptop.

---

## Sharing With a Friend (GitHub Pages vs. Raw HTML)

Everything lives inside **`index.html`** with **zero external dependencies**, so both sharing methods work:

### Option 1: GitHub Repo + GitHub Pages (Recommended for VR Headsets)
WebXR browsers (Meta Quest Browser, Apple Vision Pro Safari, PCVR Chrome/Edge) **require HTTPS** (`https://` or `localhost`) to enable `navigator.xr`. Hosting via GitHub Pages gives your friend a direct `https://` link they can open straight inside their headset:

1. Push this folder to a GitHub repository.
2. On GitHub, go to **Settings → Pages → Build and deployment → Source: Deploy from a branch (`main` / `/root`)**.
3. Share the resulting `https://<your-username>.github.io/<repo-name>/` URL!

### Option 2: Send `index.html` Directly
- You can send `index.html` by itself — double-clicking it opens the **3D Room Preview** and **2D Calibrated Screen Mode** offline in any browser.
- To enter **WebXR VR/AR** from a downloaded copy, serve it locally:
  ```bash
  python3 -m http.server 8080
  # Open http://localhost:8080
  ```

---

## Controls

| Action | VR / AR Headset | Keyboard / Desktop |
| :--- | :--- | :--- |
| **Shuffle / Cycle Chart** | Point at **↻ Cycle** (or pull **Trigger** / press **A / X**) | `Space` or `R` |
| **Select Acuity Row** | **Thumbstick ↑ / ↓** or 3D Console `▲ / ▼ Row` | `↑` / `↓` Arrows |
| **Switch Chart Type** | **Thumbstick ← / →** or 3D Console buttons | `1` – `6` |
| **Cycle Eye Occluder (`OU`/`OD`/`OS`)** | **B / Y** button or 3D Console | `E` |
| **Layout (`Full` / `Line` / `1 Optotype`)** | 3D Console buttons | `M` |
| **Toggle 5′ Lean Lock** | 3D Console `Lock 5′ Angle` | `L` |
| **Recenter Chart** | **Grip / Squeeze** or 3D Console `Recenter` | `C` |

## Running Automated Tests

```bash
node tests/snellen.test.mjs
node tests/xr_runtime.test.mjs
```
