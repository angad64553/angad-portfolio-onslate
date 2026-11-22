/*
 * Page-wide WebGL scene — one field of particles that re-forms as you move
 * through the page: a ringed globe in the hero (its three callouts are the DOM
 * labels), stacked layers for the work and skills sections, a knot behind the
 * story sections, and a rippling disc on the horizon at the contact section.
 * Progressive enhancement only: the CSS globe stays if WebGL is unavailable.
 */
const root = document.documentElement;
const canvas = document.getElementById('scene-canvas');
const anchor = document.querySelector('[data-scene-anchor]');
const labels = [...document.querySelectorAll('[data-scene-label]')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const compact = matchMedia('(max-width: 900px)');

const GLOBE = 0;
const LAYERS = 1;
const KNOT = 2;
const DISC = 3;
// Bounding radius of each shape in scene units, used to size it in pixels.
const RADIUS = [3.95, 3.3, 3.3, 8.5];
const TILT_X = [0.3, 0.52, 0.28, 0.42];
const TILT_Z = [0.36, 0, 0.2, 0];
const SPIN = [0.1, 0.13, 0.11, 0.03];

// Where the system sits per section: x/y are viewport fractions, r is the radius
// as a fraction of the smaller viewport side (rw: of the width), o is opacity.
const STAGES = [
    // Listed in page order: pickStage() walks this array top to bottom.
    { id: 'home', shape: GLOBE, o: 1 },
    { id: 'about', shape: KNOT, x: 0.94, y: 0.6, r: 0.42, o: 0.3 },
    { id: 'experience', shape: KNOT, x: 0.03, y: 0.5, r: 0.46, o: 0.2 },
    { id: 'projects', shape: LAYERS, x: 0.86, y: 0.44, r: 0.3, o: 0.55 },
    { id: 'skills', shape: LAYERS, x: 0.04, y: 0.42, r: 0.36, o: 0.3 },
    { id: 'credentials', shape: KNOT, x: 0.9, y: 0.5, r: 0.38, o: 0.3 },
    { id: 'github', shape: KNOT, x: 0.02, y: 0.58, r: 0.42, o: 0.2 },
    { id: 'contact', shape: DISC, x: 0.5, y: 1.04, rw: 0.62, o: 0.85 }
];

const PALETTES = {
    dark: { base: 0xece6da, accent: 0xff5a1f, additive: true, opacity: 1, soft: 0.5, body: 0x060607, lit: 0x26211b, rim: 0.85, halo: 0.42, dust: 0.85 },
    light: { base: 0x111112, accent: 0xbf3600, additive: false, opacity: 0.78, soft: 0.22, body: 0xcfc7b7, lit: 0xf7f3eb, rim: 0.55, halo: 0.16, dust: 0.5 }
};

const VERTEX = /* glsl */ `
attribute vec3 aLayers;
attribute vec3 aKnot;
attribute vec3 aDisc;
attribute float aSeed;
attribute float aTint;
attribute float aOrbit;
uniform float uTime;
uniform float uFrom;
uniform float uTo;
uniform float uK;
uniform float uSize;
uniform float uDepth;
uniform float uRadius;
uniform float uGlobe;
uniform vec3 uPointer;
varying float vTint;
varying float vAlpha;

vec3 shape(float s) {
    if (s < 0.5) {
        // Ring particles orbit the globe at slightly different speeds.
        vec3 g = position;
        float a = uTime * (0.07 + 0.1 * aSeed) * aOrbit;
        float c = cos(a);
        float n = sin(a);
        g.xz = vec2(c * g.x - n * g.z, n * g.x + c * g.z);
        return g;
    }
    if (s < 1.5) {
        vec3 l = aLayers;
        l.y += sin(l.x * 1.3 + uTime * 0.9 + l.y) * cos(l.z * 1.1 + uTime * 0.7) * 0.12;
        return l;
    }
    if (s < 2.5) return aKnot;
    vec3 d = aDisc;
    d.y += sin(length(d.xz) * 1.4 - uTime * 1.2) * 0.22;
    return d;
}

void main() {
    // Each particle leaves and arrives on its own schedule.
    float k = clamp(uK * 1.6 - aSeed * 0.6, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 p = mix(shape(uFrom), shape(uTo), k);

    // Scatter while travelling between shapes, plus a slow idle drift.
    vec3 dir = normalize(vec3(sin(aSeed * 91.7), cos(aSeed * 47.3), sin(aSeed * 23.1 + 1.7)));
    p += dir * sin(k * 3.14159265) * (0.5 + aSeed * 1.4);
    p += 0.03 * vec3(sin(uTime * 0.7 + aSeed * 40.0), cos(uTime * 0.6 + aSeed * 71.0), sin(uTime * 0.5 + aSeed * 23.0));

    // The pointer pushes nearby particles aside.
    vec3 away = p - uPointer;
    p += normalize(away + 0.0001) * 0.55 * smoothstep(1.5, 0.0, length(away));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = clamp((-mv.z - uDepth) / uRadius, -1.0, 1.0);
    vAlpha = mix(1.0, 0.2, depth * 0.5 + 0.5);
    // On the globe, light the surface from the upper left so it reads as a solid sphere.
    vec3 normal = normalize(mat3(modelViewMatrix) * p);
    float lit = 0.26 + 0.74 * smoothstep(-0.35, 0.9, dot(normal, normalize(vec3(-0.55, 0.6, 0.58))));
    vAlpha *= mix(1.0, lit, uGlobe * (1.0 - aOrbit));
    vTint = aTint;
    // Exaggerated perspective: near particles are clearly larger than far ones.
    float scale = uDepth / -mv.z;
    gl_PointSize = uSize * (0.55 + aSeed * 0.9) * scale * scale * (1.0 + max(-depth, 0.0) * 0.5);
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uBase;
uniform vec3 uAccent;
uniform float uOpacity;
uniform float uSoft;
varying float vTint;
varying float vAlpha;

void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.5 - uSoft, d);
    gl_FragColor = vec4(mix(uBase, uAccent, vTint), edge * vAlpha * uOpacity * mix(1.0, 1.25, vTint));
}
`;

// The globe's solid body: shaded from the upper left, with a rim of atmosphere.
const CORE_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
}
`;

const CORE_FRAGMENT = /* glsl */ `
precision mediump float;
uniform vec3 uBody;
uniform vec3 uLit;
uniform vec3 uRim;
uniform float uRimPower;
varying vec3 vNormal;
varying vec3 vView;
void main() {
    vec3 n = normalize(vNormal);
    float diffuse = smoothstep(-0.2, 1.0, dot(n, normalize(vec3(-0.55, 0.6, 0.58))));
    float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.6);
    gl_FragColor = vec4(mix(mix(uBody, uLit, diffuse), uRim, rim * uRimPower), 1.0);
}
`;

// Dust spread through the whole depth of the scene. It drifts upward as the page
// scrolls, so near specks rush past and far ones barely move.
const DUST_VERTEX = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uScroll;
uniform float uSize;
varying float vTint;
varying float vAlpha;
void main() {
    vec3 p = position;
    p.y = mod(p.y + uScroll * (0.6 + aSeed * 0.8) + uTime * 0.05 + 11.0, 22.0) - 11.0;
    p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    float blur = abs(dist - 12.0) / 12.0; // out of focus away from the main plane
    gl_PointSize = uSize * (12.0 / dist) * (0.6 + aSeed) * (1.0 + blur * 2.6);
    vAlpha = 0.6 / (1.0 + blur * blur * 7.0) * smoothstep(0.6, 3.0, dist);
    vTint = step(0.88, aSeed);
}
`;

function glowTexture(THREE) {
    const size = 128;
    const surface = document.createElement('canvas');
    surface.width = surface.height = size;
    const context = surface.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.32, 'rgba(255,255,255,.42)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(surface);
}

function supportsWebGL() {
    try {
        const probe = document.createElement('canvas');
        return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
    } catch (error) {
        return false;
    }
}

function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'assets/vendor/three.r128.min.js';
        script.async = true;
        const timeout = setTimeout(() => reject(new Error('Three.js load timeout')), 15000);
        script.onload = () => { clearTimeout(timeout); resolve(window.THREE); };
        script.onerror = () => { clearTimeout(timeout); reject(new Error('Three.js unavailable')); };
        document.head.append(script);
    });
}

// Small seeded generator so the shapes are identical on every visit.
function seeded(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/*
 * Four target positions per particle. The first 72% of particles are the
 * "body"; the rest are the accent group, which becomes the globe's ring, the
 * top layer, one arc of the knot, and the disc's outer rim.
 */
function buildShapes(count) {
    const random = seeded(64553);
    const globe = new Float32Array(count * 3);
    const layers = new Float32Array(count * 3);
    const knot = new Float32Array(count * 3);
    const disc = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const tint = new Float32Array(count);
    const orbit = new Float32Array(count);
    const body = Math.floor(count * 0.72);
    const put = (array, i, x, y, z) => { array[i * 3] = x; array[i * 3 + 1] = y; array[i * 3 + 2] = z; };

    // Globe (fibonacci sphere) and its banded ring.
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i += 1) {
        seed[i] = random();
        if (i < body) {
            const y = 1 - (i / (body - 1)) * 2;
            const r = Math.sqrt(1 - y * y);
            put(globe, i, Math.cos(golden * i) * r * 2.2, y * 2.2, Math.sin(golden * i) * r * 2.2);
            tint[i] = random() < 0.05 ? 1 : 0;
        } else {
            const band = random();
            const r = band < 0.2 ? 2.85 + random() * 0.22 : band < 0.82 ? 3.2 + random() * 0.42 : 3.78 + random() * 0.17;
            const angle = random() * Math.PI * 2;
            put(globe, i, Math.cos(angle) * r, (random() - 0.5) * 0.05, Math.sin(angle) * r);
            tint[i] = random() < 0.82 ? 1 : 0;
            orbit[i] = 1;
        }
    }

    // Three stacked sheets.
    const sheet = (start, end, y) => {
        const side = Math.ceil(Math.sqrt(end - start));
        for (let i = start; i < end; i += 1) {
            const n = i - start;
            put(layers, i, ((n % side) / (side - 1) - 0.5) * 4.6, y, (Math.floor(n / side) / (side - 1) - 0.5) * 4.6);
        }
    };
    const half = Math.floor(body / 2);
    sheet(0, half, -1.4);
    sheet(half, body, 0);
    sheet(body, count, 1.4);

    // Torus knot: points on a tube around the curve.
    const curve = (t) => {
        const r = 2 + 0.85 * Math.cos(3 * t);
        return [r * Math.cos(2 * t), r * Math.sin(2 * t), 1.1 * Math.sin(3 * t)];
    };
    for (let i = 0; i < count; i += 1) {
        const t = (i / count) * Math.PI * 2;
        const p = curve(t);
        const q = curve(t + 0.001);
        let tx = q[0] - p[0];
        let ty = q[1] - p[1];
        let tz = q[2] - p[2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        // normal = tangent × z, binormal = tangent × normal
        let nx = ty;
        let ny = -tx;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        const bx = -tz * ny;
        const by = tz * nx;
        const bz = tx * ny - ty * nx;
        const phi = random() * Math.PI * 2;
        const tube = 0.3 + random() * 0.14;
        put(knot, i,
            p[0] + (nx * Math.cos(phi) + bx * Math.sin(phi)) * tube,
            p[1] + (ny * Math.cos(phi) + by * Math.sin(phi)) * tube,
            p[2] + bz * Math.sin(phi) * tube);
    }

    // Disc of concentric rings.
    for (let i = 0; i < count; i += 1) {
        const r = Math.round((0.7 + Math.sqrt(i / (count - 1)) * 7.8) / 0.2) * 0.2;
        const angle = random() * Math.PI * 2;
        put(disc, i, Math.cos(angle) * r, 0, Math.sin(angle) * r);
    }

    return { globe, layers, knot, disc, seed, tint, orbit };
}

function build(THREE) {
    const small = compact.matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 12);

    const data = buildShapes(small ? 9000 : 22000);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.globe, 3));
    geometry.setAttribute('aLayers', new THREE.BufferAttribute(data.layers, 3));
    geometry.setAttribute('aKnot', new THREE.BufferAttribute(data.knot, 3));
    geometry.setAttribute('aDisc', new THREE.BufferAttribute(data.disc, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(data.seed, 1));
    geometry.setAttribute('aTint', new THREE.BufferAttribute(data.tint, 1));
    geometry.setAttribute('aOrbit', new THREE.BufferAttribute(data.orbit, 1));

    const uniforms = {
        uTime: { value: 0 }, uFrom: { value: GLOBE }, uTo: { value: GLOBE }, uK: { value: 1 },
        uSize: { value: 4 }, uDepth: { value: 12 }, uRadius: { value: 4 }, uGlobe: { value: 1 },
        uPointer: { value: new THREE.Vector3(999, 999, 999) },
        uBase: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() },
        uOpacity: { value: 1 }, uSoft: { value: 0.5 }
    };
    const material = new THREE.ShaderMaterial({
        uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
        transparent: true, depthTest: true, depthWrite: false
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false; // positions are computed in the shader
    points.renderOrder = 2;

    // A solid body inside the globe hides the far side, so the ring really passes behind it.
    const coreUniforms = {
        uBody: { value: new THREE.Color() }, uLit: { value: new THREE.Color() },
        uRim: { value: new THREE.Color() }, uRimPower: { value: 1 }
    };
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(2.12, 64, 40),
        new THREE.ShaderMaterial({ uniforms: coreUniforms, vertexShader: CORE_VERTEX, fragmentShader: CORE_FRAGMENT })
    );
    core.renderOrder = 1;
    const haloMaterial = new THREE.SpriteMaterial({ map: glowTexture(THREE), transparent: true, depthWrite: false });
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.setScalar(9.5);

    const system = new THREE.Group();
    system.rotation.order = 'XZY'; // spin about the system's own axis, then tilt it
    system.add(halo, core, points);
    scene.add(system);

    const dustCount = small ? 500 : 1500;
    const dustRandom = seeded(7052);
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSeeds = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i += 1) {
        dustPositions[i * 3] = (dustRandom() - 0.5) * 36;
        dustPositions[i * 3 + 1] = (dustRandom() - 0.5) * 22;
        dustPositions[i * 3 + 2] = dustRandom() * 23 - 16;
        dustSeeds[i] = dustRandom();
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(dustSeeds, 1));
    const dustUniforms = {
        uTime: uniforms.uTime, uScroll: { value: 0 }, uSize: { value: 4 },
        uBase: uniforms.uBase, uAccent: uniforms.uAccent, uOpacity: { value: 1 }, uSoft: { value: 0.5 }
    };
    const dustMaterial = new THREE.ShaderMaterial({
        uniforms: dustUniforms, vertexShader: DUST_VERTEX, fragmentShader: FRAGMENT,
        transparent: true, depthTest: true, depthWrite: false
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    scene.add(dust);

    let paletteOpacity = 1;
    let haloOpacity = 0.4;
    const applyPalette = (name) => {
        const palette = PALETTES[name] || PALETTES.dark;
        uniforms.uBase.value.setHex(palette.base);
        uniforms.uAccent.value.setHex(palette.accent);
        uniforms.uSoft.value = palette.soft;
        [material, dustMaterial, haloMaterial].forEach((item) => {
            item.blending = palette.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
            item.needsUpdate = true;
        });
        coreUniforms.uBody.value.setHex(palette.body);
        coreUniforms.uLit.value.setHex(palette.lit);
        coreUniforms.uRim.value.setHex(palette.accent);
        coreUniforms.uRimPower.value = palette.rim;
        haloMaterial.color.setHex(palette.accent);
        dustUniforms.uOpacity.value = palette.dust;
        paletteOpacity = palette.opacity;
        haloOpacity = palette.halo;
    };

    return {
        renderer, scene, camera, system, core, haloMaterial, uniforms, dustUniforms, applyPalette,
        paletteOpacity: () => paletteOpacity, haloOpacity: () => haloOpacity
    };
}

async function init() {
    if (!canvas || !anchor || !supportsWebGL()) return;
    if (navigator.connection?.saveData) return;

    let THREE;
    let world;
    try {
        THREE = await loadThree();
        world = build(THREE);
    } catch (error) {
        return; // CSS globe remains.
    }
    const { renderer, scene, camera, system, core, haloMaterial, uniforms, dustUniforms, applyPalette, paletteOpacity, haloOpacity } = world;

    const stages = STAGES.map((stage) => ({ ...stage, element: document.getElementById(stage.id) })).filter((stage) => stage.element);
    const state = {
        width: 1, height: 1, unitsPerPx: 0,
        stage: stages[0], from: GLOBE, to: GLOBE, k: 1,
        x: 0, y: 0, scale: 1, opacity: 0, tiltX: TILT_X[GLOBE], tiltZ: TILT_Z[GLOBE], spin: 0.6,
        pointer: { x: 0, y: 0, px: 0, py: 0, active: false }, smooth: { x: 0, y: 0 },
        placed: false, running: false, raf: 0, last: 0, time: 0, anchorRect: null
    };
    // Three fixed points on the globe carry the hero callouts.
    const callouts = [[24, 20], [-12, 150], [38, 265]].map(([lat, lon]) => {
        const a = THREE.MathUtils.degToRad(lat);
        const b = THREE.MathUtils.degToRad(lon);
        return new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)).multiplyScalar(2.2);
    });
    const projected = new THREE.Vector3();
    const ray = new THREE.Vector3();

    const layout = () => {
        state.width = Math.max(1, canvas.clientWidth);
        state.height = Math.max(1, canvas.clientHeight);
        renderer.setSize(state.width, state.height, false);
        camera.aspect = state.width / state.height;
        camera.updateProjectionMatrix();
        const viewHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        state.unitsPerPx = viewHeight / state.height;
        uniforms.uSize.value = renderer.getPixelRatio() * Math.min(1.25, Math.max(0.8, state.height / 900)) * (compact.matches ? 2.1 : 2.4);
        dustUniforms.uSize.value = uniforms.uSize.value * 0.9;
        state.labelWidths = labels.map((label) => label.offsetWidth);
    };

    const pickStage = () => {
        const line = window.innerHeight * 0.62;
        let current = stages[0];
        stages.forEach((stage) => { if (stage.element.getBoundingClientRect().top <= line) current = stage; });
        state.stage = current;
    };

    // Convert the active stage's slot (in viewport pixels) to scene units.
    const target = () => {
        const { stage } = state;
        let cx;
        let cy;
        let radius;
        if (stage.id === 'home') {
            const rect = anchor.getBoundingClientRect();
            state.anchorRect = rect;
            cx = rect.left + rect.width / 2;
            cy = rect.top + rect.height / 2;
            radius = Math.min(rect.width, rect.height) * 0.5;
        } else {
            cx = stage.x * window.innerWidth;
            cy = stage.y * window.innerHeight;
            radius = stage.rw ? stage.rw * window.innerWidth : stage.r * Math.min(window.innerWidth, window.innerHeight);
        }
        return {
            x: (cx - state.width / 2) * state.unitsPerPx,
            y: -(cy - state.height / 2) * state.unitsPerPx,
            scale: (radius * state.unitsPerPx) / RADIUS[stage.shape],
            opacity: stage.o
        };
    };

    const placeLabels = () => {
        const settled = state.stage.id === 'home' && state.to === GLOBE && state.k > 0.98;
        const rect = state.anchorRect;
        labels.forEach((label, index) => {
            if (!settled || !rect || !callouts[index]) { label.style.setProperty('--o', '0'); return; }
            projected.copy(callouts[index]).applyMatrix4(system.matrixWorld);
            const front = projected.z > system.position.z + 0.25 * state.scale;
            projected.project(camera);
            // Keep the label inside the viewport so it never causes horizontal overflow.
            const half = (state.labelWidths[index] || 0) / 2 + 8;
            const px = Math.min(state.width - half, Math.max(half, (projected.x + 1) / 2 * state.width));
            const py = (1 - projected.y) / 2 * state.height;
            label.style.setProperty('--x', `${(px - rect.left).toFixed(1)}px`);
            label.style.setProperty('--y', `${(py - rect.top).toFixed(1)}px`);
            label.style.setProperty('--o', front ? '1' : '0');
        });
    };

    const render = (delta, snap = false) => {
        state.time += delta;

        // Finish the current morph before starting the next one.
        if (snap) { state.from = state.to = state.stage.shape; state.k = 1; }
        else if (state.k < 1) state.k = Math.min(1, state.k + delta / 1.5);
        else if (state.stage.shape !== state.to) { state.from = state.to; state.to = state.stage.shape; state.k = 0; }

        const goal = target();
        const ease = snap || !state.placed ? 1 : 1 - Math.exp(-delta * 4.5);
        const slow = snap || !state.placed ? 1 : 1 - Math.exp(-delta * 2.2);
        state.placed = true;
        state.x += (goal.x - state.x) * ease;
        state.y += (goal.y - state.y) * ease;
        state.scale += (goal.scale - state.scale) * ease;
        state.opacity += (goal.opacity * paletteOpacity() - state.opacity) * slow;
        state.tiltX += (TILT_X[state.stage.shape] - state.tiltX) * slow;
        state.tiltZ += (TILT_Z[state.stage.shape] - state.tiltZ) * slow;
        state.spin += delta * SPIN[state.stage.shape];

        const s = state.smooth;
        const follow = Math.min(1, delta * 3);
        s.x += ((state.pointer.active ? state.pointer.x : 0) - s.x) * follow;
        s.y += ((state.pointer.active ? state.pointer.y : 0) - s.y) * follow;

        // How much of the cloud is currently the globe (1 in the hero, 0 elsewhere).
        const globe = (state.from === GLOBE ? 1 - state.k : 0) + (state.to === GLOBE ? state.k : 0);
        const solid = Math.min(1, Math.max(0, (globe - 0.55) / 0.45));
        const scrollTilt = Math.min(1, window.scrollY / Math.max(1, window.innerHeight)) * 0.5 * globe;

        // The camera orbits slightly with the pointer, so near and far layers shift against each other.
        camera.position.set(s.x * 0.95, -s.y * 0.6, 12);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();

        system.position.set(state.x, state.y, 0);
        system.scale.setScalar(state.scale);
        system.rotation.set(state.tiltX + scrollTilt + s.y * 0.22, state.spin + s.x * 0.45, state.tiltZ);
        core.visible = solid > 0.001;
        core.scale.setScalar(Math.max(0.001, solid * solid * (3 - 2 * solid)));
        haloMaterial.opacity = solid * haloOpacity() * Math.min(1, state.opacity);
        system.updateMatrixWorld();

        // Pointer position on the system's plane, in its local space.
        if (state.pointer.active) {
            ray.set(state.pointer.x, -state.pointer.y, 0.5).unproject(camera).sub(camera.position).normalize();
            const distance = -camera.position.z / ray.z;
            uniforms.uPointer.value.copy(camera.position).addScaledVector(ray, distance);
            system.worldToLocal(uniforms.uPointer.value);
        } else {
            uniforms.uPointer.value.set(999, 999, 999);
        }

        uniforms.uTime.value = state.time;
        uniforms.uFrom.value = state.from;
        uniforms.uTo.value = state.to;
        uniforms.uK.value = state.k;
        uniforms.uOpacity.value = state.opacity;
        uniforms.uRadius.value = Math.max(0.001, state.scale * RADIUS[state.to]);
        uniforms.uGlobe.value = globe;
        uniforms.uDepth.value = -projected.copy(system.position).applyMatrix4(camera.matrixWorldInverse).z;
        dustUniforms.uScroll.value = window.scrollY * state.unitsPerPx * 0.45;
        renderer.render(scene, camera);
        placeLabels();
    };

    const loop = (now) => {
        state.raf = 0;
        if (!state.running) return;
        const delta = state.last ? Math.min((now - state.last) / 1000, 0.05) : 0.016;
        state.last = now;
        render(delta);
        state.raf = requestAnimationFrame(loop);
    };

    const sync = () => {
        const run = !document.hidden && !reduceMotion.matches;
        if (run && !state.running) {
            state.running = true;
            state.last = 0;
            state.raf = requestAnimationFrame(loop);
        } else if (!run && state.running) {
            state.running = false;
            cancelAnimationFrame(state.raf);
            state.raf = 0;
        }
        if (reduceMotion.matches) render(0, true); // one settled frame, no morphing
    };

    // Inputs
    window.addEventListener('pointermove', (event) => {
        if (!finePointer.matches || event.pointerType !== 'mouse') return;
        state.pointer.x = (event.clientX / state.width - 0.5) * 2;
        state.pointer.y = (event.clientY / state.height - 0.5) * 2;
        state.pointer.active = true;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { state.pointer.active = false; });

    const onScroll = () => {
        pickStage();
        if (!state.running) render(0, true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', sync);
    reduceMotion.addEventListener('change', sync);

    let resizeFrame = 0;
    const onResize = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => { layout(); pickStage(); if (!state.running) render(0, true); });
    };
    new ResizeObserver(onResize).observe(canvas);
    window.addEventListener('resize', onResize, { passive: true });

    const theme = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    new MutationObserver(() => { applyPalette(theme()); if (!state.running) render(0, true); })
        .observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        state.running = false;
        cancelAnimationFrame(state.raf);
        root.classList.remove('scene-ready');
    });
    canvas.addEventListener('webglcontextrestored', () => {
        root.classList.add('scene-ready');
        sync();
    });

    applyPalette(theme());
    layout();
    pickStage();
    render(0.016, true);
    root.classList.add('scene-ready');
    sync();
}

// Load after first paint so the 3D never competes with content.
const start = () => ('requestIdleCallback' in window ? requestIdleCallback(init, { timeout: 1200 }) : setTimeout(init, 150));
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
