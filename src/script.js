/* ===================== INTRO CONFIG ===================== */
const INTRO_STAGE2_DELAY = 600;
const CELL = 40;
const FADE_MS_PER_LAYER = 18;
const FADE_DUR_MS = 220;
const INTRO_FADE_MS = 550;
const HARD_TIMEOUT_MS = 8000;

/* ▶︎ SCALING KNOB — how much larger than .stamp */
const PANEL_SCALE = window.innerWidth >= 900 ? 1.9 : 1.55;

/* ===================== INTRO ===================== */
function startIntro() {
  const intro  = document.getElementById('intro');
  const host   = intro?.querySelector('.intro__mosaic');
  if (!intro || !host) return;

  setTimeout(() => {
    intro.classList.add('intro--stage2');
    runMosaicCanvas(intro, host, () => {
      intro.classList.add('is-done');
      spawnClickHints();
      setTimeout(() => intro.remove(), INTRO_FADE_MS);
      requestAnimationFrame(syncGlassPanelToStamp);
      /* start the in-stamp headline AFTER intro is done */
      startBigType();
    });
  }, INTRO_STAGE2_DELAY);

  setTimeout(() => {
    if (!intro.classList.contains('is-done')) {
      intro.classList.add('is-done');
      spawnClickHints();
      setTimeout(() => intro.remove(), INTRO_FADE_MS);
      requestAnimationFrame(syncGlassPanelToStamp);
      startBigType(); // fallback if hard-timeout triggers
    }
  }, HARD_TIMEOUT_MS);
}

function runMosaicCanvas(intro, host, onDone){
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.floor(window.innerWidth * DPR);
  const H = Math.floor(window.innerHeight * DPR);

  const cssCell = Math.round(CELL * DPR) / DPR;
  intro.style.backgroundSize = `${cssCell}px ${cssCell}px, ${cssCell}px ${cssCell}px`;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const tileW = Math.round(CELL * DPR), tileH = tileW;
  const sprite = document.createElement('canvas');
  sprite.width = tileW; sprite.height = tileH;
  const sg = sprite.getContext('2d');
  sg.fillStyle = '#fff'; sg.fillRect(0,0,tileW,tileH);
  sg.strokeStyle = 'rgba(0,0,0,0.06)';
  sg.lineWidth = Math.max(1, Math.round(1 * DPR));
  sg.strokeRect(0.5*sg.lineWidth, 0.5*sg.lineWidth, tileW - sg.lineWidth, tileH - sg.lineWidth);

  const cols = Math.ceil(W / tileW), rows = Math.ceil(H / tileH);

  const mask = document.createElement('canvas');
  mask.width = W; mask.height = H;
  const mg = mask.getContext('2d');
  mg.fillStyle = '#000'; mg.fillRect(0,0,W,H);
  mg.fillStyle = '#fff';
  const base = Math.max(W, H);
  const fontPx = Math.round(base * 0.12);
  mg.font = `900 ${fontPx}px Inter, Arial, system-ui, sans-serif`;
  mg.textBaseline = 'top'; mg.textAlign = 'left';
  const phrase = 'CONNECT THE DOTS';
  const tw = mg.measureText(phrase).width;
  const xStep = tw + base * 0.04;
  const yStep = fontPx * 1.25;
  for (let y = -yStep * 0.5; y < H + yStep; y += yStep) {
    const xOffset = ((y / yStep) % 2) ? -xStep * 0.4 : 0;
    for (let x = -xStep; x < W + xStep; x += xStep) mg.fillText(phrase, x + xOffset, y);
  }
  const mdata = mg.getImageData(0,0,W,H).data;
  const alphaAt = (px,py)=>mdata[((py|0)*W + (px|0))*4 + 3];

  const idx = (x,y)=>y*cols+x;
  const visited = new Uint8Array(cols*rows);
  const q = [];
  for (let y=0;y<rows;y++){
    for (let x=0;x<cols;x++){
      const cx = x*tileW + tileW/2, cy = y*tileH + tileH/2;
      if (alphaAt(cx,cy) > 32){ visited[idx(x,y)]=1; q.push([x,y,0]); }
    }
  }
  if (!q.length){ const cx=(cols/2)|0, cy=(rows/2)|0; visited[idx(cx,cy)]=1; q.push([cx,cy,0]); }
  const N = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  const tiles = new Array(cols*rows);
  let head = 0;
  while (head < q.length){
    const [x,y,layer] = q[head++]; tiles[idx(x,y)] = {x,y,layer, reveal:0};
    for (let i=N.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [N[i],N[j]]=[N[j],N[i]]; }
    for (const [dx,dy] of N){
      const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=cols||ny>=rows) continue;
      const id=idx(nx,ny); if(visited[id]) continue; visited[id]=1; q.push([nx,ny,layer+1]);
    }
  }

  const startTime = performance.now() + 40;
  let maxRevealEnd = 0;
  for (const t of tiles){
    if (!t) continue;
    const jitter = Math.random()*22;
    t.reveal = startTime + t.layer*FADE_MS_PER_LAYER + jitter;
    maxRevealEnd = Math.max(maxRevealEnd, t.reveal + FADE_DUR_MS);
  }

  let remaining = tiles.length;
  function draw(now){
    ctx.clearRect(0,0,W,H);
    for (let i=0;i<tiles.length;i++){
      const t = tiles[i]; if (!t) continue;
      const px = t.x*tileW, py = t.y*tileH;
      const dt = now - t.reveal;
      if (dt <= 0){ ctx.globalAlpha = 1; ctx.drawImage(sprite, px, py); }
      else if (dt < FADE_DUR_MS){
        const k = dt / FADE_DUR_MS; const a = 1 - (k*k*(3-2*k));
        ctx.globalAlpha = a; ctx.drawImage(sprite, px, py);
      } else { tiles[i] = undefined; remaining--; }
    }
    if (now < maxRevealEnd && remaining > 0) requestAnimationFrame(draw);
    else onDone();
  }
  requestAnimationFrame(draw);
}

/* ---------- Click hints ---------- */
const clickHintsEl = document.getElementById('click-hints');
let hintsCleared = false;
function spawnClickHints(){
  if (!clickHintsEl || hintsCleared) return;
  const area = innerWidth * innerHeight;
  const count = Math.max(4, Math.min(8, Math.round(area / 240000)));
  for (let i = 0; i < count; i++){
    const el = document.createElement('div');
    el.className = 'hint'; el.textContent = 'click';
    const pad = 72, x = Math.random()*(innerWidth-pad*2)+pad, y = Math.random()*(innerHeight-pad*2)+pad;
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
    el.style.setProperty('--delay', `${Math.random()*1.6}s`);
    el.style.setProperty('--dur',   `${1.6 + Math.random()*0.9}s`);
    clickHintsEl.appendChild(el);
  }
}
function clearClickHints(){
  if (hintsCleared) return; hintsCleared = true;
  if (!clickHintsEl) return; clickHintsEl.classList.add('is-gone');
  setTimeout(()=>{ clickHintsEl.innerHTML=''; }, 400);
}
window.addEventListener('DOMContentLoaded', startIntro);

/* ===== Big headline: word-by-word typer (loops) INSIDE .stamp ===== */
function startBigType(){
  const host = document.getElementById('bigtype');
  if (!host) return;

  const phrase = "this is just a landing page, yes but it's pretty cool tho";
  const words = phrase.split(' ');

  host.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'row';
  host.appendChild(row);

  const spans = words.map(w => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    row.appendChild(s);
    return s;
  });

  const IN_PER_WORD   = 240;   // ms between each word appearing
  const HOLD_AFTER_IN = 1200;  // pause after full line is visible
  const OUT_PER_WORD  = 65;    // ms between each word disappearing

  function cycle(){
    // reveal words
    spans.forEach((s,i) => setTimeout(() => s.classList.add('on'), i * IN_PER_WORD));

    const totalIn = IN_PER_WORD * spans.length + HOLD_AFTER_IN;

    // hide words, then reset & loop
    setTimeout(() => {
      spans.forEach((s,i) => setTimeout(() => {
        s.classList.remove('on');
        s.classList.add('off');
      }, i * OUT_PER_WORD));

      const totalOut = OUT_PER_WORD * spans.length + 420;
      setTimeout(() => {
        spans.forEach(s => s.className = 'w'); // reset classes
        cycle(); // loop
      }, totalOut);
    }, totalIn);
  }

  cycle();
}

/* ===================== THREE.JS APP ===================== */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* page background grid */
document.body.style.margin = "0";
document.body.style.backgroundColor = "#f6f3e9";
document.body.style.backgroundImage =
  `linear-gradient(rgba(114,174,194,.35) 1px, transparent 1px),
   linear-gradient(90deg, rgba(114,174,194,.35) 1px, transparent 1px),
   linear-gradient(rgba(114,174,194,.18) 1px, transparent 1px),
   linear-gradient(90deg, rgba(114,174,194,.18) 1px, transparent 1px)`;
document.body.style.backgroundSize = "28px 28px, 28px 28px, 112px 112px, 112px 112px";

/* renderer / scene / camera */
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearAlpha(0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;

renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
let viewSize = 20;
const camera = new THREE.OrthographicCamera();
function updateCamera(){
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = (-viewSize * aspect) / 2;
  camera.right = (viewSize * aspect) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.near = -100; camera.far = 100;
  camera.position.set(0,0,10); camera.lookAt(0,0,0);
  camera.updateProjectionMatrix();
} updateCamera();

/* lights / env */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0xf0ead6, 0.55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.25);
sun.position.set(6,9,8); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.radius=3;
const s = 22; Object.assign(sun.shadow.camera,{left:-s,right:s,top:s,bottom:-s,near:1,far:40}); scene.add(sun);
const shadowMat = new THREE.ShadowMaterial({ opacity: 0.16 });
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), shadowMat);
shadowPlane.position.z = -0.6; shadowPlane.receiveShadow = true; scene.add(shadowPlane);

/* ======= nodes & lines (unchanged) ======= */
const NODE_RADIUS = 0.2;
const nodeGeo = new THREE.SphereGeometry(NODE_RADIUS, 48, 48);
const nodeMat = new THREE.MeshPhysicalMaterial({
  color: 0xe81a51, metalness: 0.0, roughness: 0.05, transmission: 1.0, thickness: 1.4,
  opacity: 0.2, ior: 1.52, attenuationColor: 0xffb3d1, attenuationDistance: 8.0,
  clearcoat: 1.0, clearcoatRoughness: 0.05, envMapIntensity: 1.3, specularIntensity: 1.0
});
const solidLineMat  = new THREE.LineBasicMaterial({ color: 0x6f8fb7, transparent:true, opacity:0.6 });

/* ======= GLASS PANEL — Multi-mode Iridescent Panel Shader ======= */
const glassUniforms = {
  uTime:   { value: 0 },
  uSize:   { value: new THREE.Vector2(1,1) },
  uAlpha:  { value: 0.98 },
  uRadius: { value: 0.0 }, // UV units (0..0.5)
  uMode:   { value: 0 },   // 0..5

  uCreamBG:  { value: new THREE.Color(0xf7efe7) },
  uOrange:   { value: new THREE.Color(0xde1818) },
  uPink:     { value: new THREE.Color(0x5aa9cb) },
  uWhiteHi:  { value: new THREE.Color(0xfffaf3) },
  uEdgeCol:  { value: new THREE.Color(0xb4fad8) },

  uSpeed:      { value: 1.05 },
  uFlowWarp:   { value: 0.08 },
  uMouse:      { value: new THREE.Vector2(0.5,0.5) },
  uParallax:   { value: 0.0035 },

  uWaveAmp:    { value: 1.45 },
  uWaveAmp2:   { value: 0.08 },
  uWaveFreq:   { value: 1.08 },
  uWaveWidth:  { value: 1.05 },
  uWidthVar:   { value: 3.10 },

  uEdgeSoft:    { value: 0.55 },
  uEdgeStrength:{ value: 0.024 },
  uGrain:       { value: 0.018 },
  uSaturation:  { value: 2.0 },
  uContrast:    { value: 1.02 },

  uAberration:  { value: 0.0025 },
  uIridescence: { value: 1.0 },
  uRefract:     { value: 0.035 },
  uNoiseScale:  { value: 1.0 },
};

const glassMat = new THREE.ShaderMaterial({
  uniforms: glassUniforms,
  transparent: true,
  depthWrite: false,
  vertexShader: `
    varying vec2 vUv;
    varying vec2 vCentered;
    varying vec3 vViewDir;
    void main(){
      vUv = uv;
      vCentered = uv - 0.5;
      vViewDir = normalize(vec3(0.0,0.0,1.0)); // ortho cam
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    #ifdef GL_OES_standard_derivatives
    #extension GL_OES_standard_derivatives : enable
    #endif

    varying vec2 vUv;
    varying vec2 vCentered;
    varying vec3 vViewDir;

    uniform float uTime, uAlpha, uRadius;
    uniform vec2  uSize, uMouse;
    uniform int   uMode;

    uniform vec3 uCreamBG, uOrange, uPink, uWhiteHi, uEdgeCol;
    uniform float uSpeed, uFlowWarp, uParallax;
    uniform float uWaveAmp, uWaveAmp2, uWaveFreq, uWaveWidth, uWidthVar;
    uniform float uEdgeSoft, uEdgeStrength, uGrain, uSaturation, uContrast;
    uniform float uAberration, uIridescence, uRefract, uNoiseScale;

    float hash(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
      return fract(sin(p.x+p.y)*43758.5453123);
    }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash(i+vec2(0,0)),hash(i+vec2(1,0)),u.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
    }
    float fbm(vec2 p){
      float a=0.5, v=0.0;
      for(int i=0;i<5;i++){
        v += a * noise(p);
        p = mat2(0.8,0.6,-0.6,0.8)*p*1.85;
        a *= 0.56;
      }
      return v;
    }
    vec2 flow(vec2 p, float t){
      float e = 0.04;
      float n1 = fbm(p + vec2( e,0.0) + vec2(t*0.10,-t*0.07));
      float n2 = fbm(p + vec2(-e,0.0) + vec2(t*0.10,-t*0.07));
      float n3 = fbm(p + vec2(0.0, e) + vec2(-t*0.08, t*0.09));
      float n4 = fbm(p + vec2(0.0,-e) + vec2(-t*0.08, t*0.09));
      vec2 g = vec2(n1-n2, n3-n4)/(2.0*e);
      return vec2(-g.y, g.x);
    }
    vec3 sat(vec3 c, float s){ float l = dot(c, vec3(0.2126,0.7152,0.0722)); return mix(vec3(l), c, s); }
    vec3 aces(vec3 x){
      const float a=2.51; const float b=0.03; const float c=2.43; const float d=0.59; const float e=0.14;
      return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
    }
    vec3 iridescence(vec3 base, float ndv, float str){
      float shift = pow(1.0 - ndv, 2.0) * 2.2 * str;
      vec3 k = vec3(0.57735);
      float s = sin(shift), c = cos(shift);
      return base*c + cross(k, base)*s + k*dot(k,base)*(1.0-c);
    }
    float rrectMask(vec2 uv){
      vec2 s = vec2(1.0);
      vec2 dd = abs(uv - 0.5) - (s*0.5 - uRadius);
      float dist = length(max(dd,0.0)) - uRadius;
      return smoothstep(0.006, 0.0, dist);
    }

    vec3 modeLava(vec2 p, float t){
      vec2 q = p; // p already aspect-corrected in main
      float aspect = uSize.x / max(uSize.y,1.0e-4);
      vec2 m = (uMouse - 0.5) * vec2(aspect,1.0);
      q -= m * uParallax;
      vec2 w = flow(q*1.2, t) * uFlowWarp;
      q += w;

      float xPhase = q.x * uWaveFreq * 3.14159;
      float yWave  = uWaveAmp  * sin(xPhase + t*0.9)
                   + uWaveAmp2 * sin(xPhase*2.0 - t*0.7);

      float widthBase = uWaveWidth;
      float widthMod  = 1.0 + uWidthVar * (0.5 * sin(xPhase*0.9 + t*0.5) + 0.5 * sin(xPhase*1.7 - t*0.3));
      float wth = max(0.001, widthBase * widthMod);
      float d = (q.y - yWave);

      float edgeWiggle = (fbm(q*2.2 + vec2(t*0.35,-t*0.22)) - 0.5) * 0.22;
      float soft = max(0.0005, uEdgeSoft * (1.0 + edgeWiggle));

      float k = 1.0 - smoothstep(wth, wth+soft, abs(d));
      float core = 1.0 - smoothstep(0.0, wth*0.55, abs(d));
      float hi = exp(-pow((d + wth*0.33)/(wth*0.55), 2.0)) * 0.85;
      float edge = pow(smoothstep(wth*0.85, wth*1.04, abs(d)), 1.4) * uEdgeStrength;

      vec3 col = uCreamBG;
      col = mix(col, uPink,   smoothstep(0.02, 0.85, k));
      col = mix(col, uOrange, smoothstep(0.35, 0.98, core));
      col = mix(col, uWhiteHi, clamp(hi * 0.8, 0.0, 1.0));
      col = mix(col, uEdgeCol, clamp(edge, 0.0, 1.0));
      float vig = smoothstep(0.98, 0.40, length(p*1.04));
      col = mix(uCreamBG, col, vig);
      return col;
    }

    vec3 modeIridescent(vec2 p, float t){
      vec2 uv = p*1.2;
      uv += flow(uv, t)*0.15;
      float ndv = clamp(abs(vViewDir.z), 0.0, 1.0);
      vec3 base = mix(uPink, uOrange, 0.5 + 0.5*sin(t*0.6 + fbm(uv*2.0)));
      base = iridescence(base, ndv, uIridescence);
      float phase = fbm(uv*3.0 + t*0.5);
      base += 0.25*vec3(sin(6.283*(phase+0.00)),
                         sin(6.283*(phase+0.33)),
                         sin(6.283*(phase+0.66)));
      float gx = abs(fract(uv.x*8.0-0.5)-0.5);
      float gy = abs(fract(uv.y*8.0-0.5)-0.5);
      float grid = exp(-30.0*min(gx,gy));
      return base + uWhiteHi*grid*0.08;
    }

    vec3 modeCaustics(vec2 p, float t){
      vec2 uv = p;
      uv += flow(uv*1.3, t)*uRefract;
      float bands = sin( (uv.x+uv.y*0.6)*12.0 + fbm(uv*2.4+t*0.6)*6.0 );
      float mask = smoothstep(0.2, 0.95, bands*0.5+0.5);
      vec2 dR = flow(uv+0.01, t)*uAberration*55.0;
      vec2 dG = flow(uv+0.02, t)*uAberration*35.0;
      vec2 dB = flow(uv+0.03, t)*uAberration*15.0;
      float r = smoothstep(0.65, 0.95, sin((uv.x+dR.x)*16.0 + t)*0.5+0.5);
      float g = smoothstep(0.65, 0.95, sin((uv.x+dG.x)*16.0 + t*1.02)*0.5+0.5);
      float b = smoothstep(0.65, 0.95, sin((uv.x+dB.x)*16.0 + t*0.98)*0.5+0.5);
      vec3 ca = vec3(r,g,b)*0.9 + mask*0.1;
      return mix(uCreamBG, mix(uPink, uOrange, mask), 0.25) + ca*0.85;
    }

    vec3 modeNeonGrid(vec2 p, float t){
      vec2 uv = p*1.1;
      uv += flow(uv, t)*0.12;
      vec2 g = sin(uv*9.0 + vec2(t*0.7, -t*0.6));
      float lines = exp(-24.0*min(abs(g.x),abs(g.y)));
      vec3 glow = mix(uPink, uOrange, 0.5+0.5*sin(t));
      glow = iridescence(glow, 0.6, uIridescence);
      return mix(uCreamBG, glow, clamp(lines*1.8,0.0,1.0));
    }

    vec3 modeMetaballs(vec2 p, float t){
      vec2 uv = p*1.3;
      vec2 c1 = vec2(0.3*sin(t*0.7), 0.3*cos(t*0.6));
      vec2 c2 = vec2(0.25*sin(t*0.9+1.2), -0.28*cos(t*0.8));
      vec2 c3 = vec2(-0.32*cos(t*0.4), 0.27*sin(t*0.5));
      float f = 0.23/length(uv-c1) + 0.23/length(uv-c2) + 0.23/length(uv-c3);
      float cell = smoothstep(1.1, 1.35, f);
      float rim = smoothstep(1.35, 1.42, f) - smoothstep(1.42, 1.55, f);
      vec3 col = mix(uCreamBG, mix(uPink, uOrange, cell), cell);
      col += uWhiteHi * rim * 0.5;
      return col;
    }

    vec3 modeRipples(vec2 p, float t){
      vec2 uv = p;
      uv += flow(uv*1.1, t)*uRefract;
      float r = length(uv);
      float ring = 0.5 + 0.5*sin(18.0*r - t*4.0 + fbm(uv*3.0)*2.5);
      ring = smoothstep(0.55, 0.85, ring);
      vec3 col = mix(uCreamBG, mix(uPink, uOrange, ring), 0.85);
      return col;
    }

    void main(){
      float t = uTime * uSpeed;
      float aspect = uSize.x / max(uSize.y, 1e-4);
      vec2 p = vUv - 0.5;
      p.x *= aspect;

      vec3 col;
      if      (uMode == 0) col = modeLava(p, t);
      else if (uMode == 1) col = modeIridescent(p, t);
      else if (uMode == 2) col = modeCaustics(p, t);
      else if (uMode == 3) col = modeNeonGrid(p, t);
      else if (uMode == 4) col = modeMetaballs(p, t);
      else                 col = modeRipples(p, t);

      float grain = (hash(p*1400.0 + t*11.0) * 2.0 - 1.0) * uGrain;
      col += grain;
      col = sat(col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;
      col = aces(col);

      float alpha = uAlpha * rrectMask(vUv);
      gl_FragColor = vec4(clamp(col,0.0,1.0), alpha);
    }
  `
});
glassMat.extensions = { derivatives: true };

const glassPanel = new THREE.Mesh(new THREE.PlaneGeometry(1,1), glassMat);
glassPanel.position.set(0,0,0.12);
scene.add(glassPanel);

/* ===================== PERF CAP ===================== */
const MAX_TOTAL_NODES = 500;

/* ===================== UTILS ===================== */
function rand(min,max){return Math.random()*(max-min)+min}
function screenToWorld(x,y){
  const ndc = new THREE.Vector3((x/window.innerWidth)*2-1, -(y/window.innerHeight)*2+1, 0);
  ndc.unproject(camera); return ndc;
}
function smoothstep(x){ return x<=0?0:x>=1?1:x*x*(3-2*x); }

/* keep glass aligned to the .stamp rect + feed shader its size */
function syncGlassPanelToStamp(){
  const el = document.querySelector('.stamp');
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const aspect = window.innerWidth / window.innerHeight;

  const xPerPx = (viewSize * aspect) / window.innerWidth;
  const yPerPx =  viewSize            / window.innerHeight;

  // Three.js plane size
  const w = rect.width  * xPerPx * PANEL_SCALE;
  const h = rect.height * yPerPx * PANEL_SCALE;

  // center over the .stamp
  const cxPx = rect.left + rect.width/2 - window.innerWidth/2;
  const cyPx = window.innerHeight/2 - (rect.top + rect.height/2);
  const x = cxPx * xPerPx;
  const y = cyPx * yPerPx;

  glassPanel.position.set(x, y, 0.12);
  glassPanel.scale.set(w, h, 1);
  glassUniforms.uSize.value.set(w, h);

  // Make CSS glass match WebGL plane
  el.style.setProperty('--panel-scale', PANEL_SCALE.toString());

  // send border radius in UV units (0..0.5)
  const cs = getComputedStyle(el);
  const brPx = parseFloat(cs.borderRadius) || 0;
  const brWorld = brPx * Math.min(xPerPx, yPerPx) * PANEL_SCALE;
  const rUV = brWorld / Math.min(w, h);
  glassUniforms.uRadius.value = Math.max(0.0, Math.min(0.5 - 0.001, rUV));
}

/* ===================== TREE GEN (unchanged) ===================== */
function makeTree({
  spineSegments = 12, segmentLen = 2.0, turnStdDeg = 15,
  clusterChance = 0.85, clusterMin = 2, clusterMax = 5,
  clusterLen = 0.9, clusterDepth = 2
} = {}){
  const toRad = d=>d*Math.PI/180;
  const group = new THREE.Group();
  const positions=[]; const parents=[];
  const add = (pos, parentIdx=-1)=>{ const i=positions.length; positions.push(pos.clone()); parents[i]=parentIdx; return i; };

  const base = new THREE.Vector3(0, -segmentLen*1.2, 0);
  const root = new THREE.Vector3(0, 0, 0);
  const iBase = add(base, -1);
  const iRoot = add(root, -1);

  let dir = new THREE.Vector2(1, 0), angle = toRad(rand(-8, 8));
  dir.set(Math.cos(angle), Math.sin(angle));
  let prevIdx = iRoot, cur = root.clone();

  for (let s=0; s<spineSegments; s++){
    angle += toRad(rand(-turnStdDeg, turnStdDeg));
    dir.set(Math.cos(angle), Math.sin(angle));
    const len = segmentLen * rand(0.85, 1.15);
    cur = new THREE.Vector3(cur.x + dir.x*len, cur.y + dir.y*len, 0);
    const idx = add(cur, prevIdx); prevIdx = idx;

    if (Math.random() < clusterChance){
      const n = Math.floor(rand(clusterMin, clusterMax+1));
      for (let i=0;i<n;i++){
        const a = toRad(rand(0,360));
        const r = clusterLen*rand(0.45,1.05);
        const p = new THREE.Vector3(cur.x + Math.cos(a)*r, cur.y + Math.sin(a)*r, 0);
        const ci = add(p, idx);
        if (clusterDepth>1 && Math.random() < 0.45){
          const aa = a + toRad(rand(-40,40));
          const rr = r*rand(0.45,0.8);
          const pp = new THREE.Vector3(p.x + Math.cos(aa)*rr, p.y + Math.sin(aa)*rr, 0);
          add(pp, ci);
        }
      }
    }
  }

  const edgesSolid = [[iRoot, iBase]];
  for (let i=0;i<positions.length;i++) if (parents[i] >= 0) edgesSolid.push([parents[i], i]);

  const depth = positions.map((_,i)=>{
    let d=0, v=i; while (parents[v] >= 0){ v = parents[v]; d++; }
    return (i===iBase || i===iRoot) ? 0 : d;
  });

  const nodeMeshes = positions.map((p,i)=>{
    const m = new THREE.Mesh(nodeGeo, nodeMat);
    m.position.copy(p); m.castShadow=true;
    const dir = new THREE.Vector2(Math.random()*2-1, Math.random()*2-1).normalize();
    m.userData.wobble={base:p.clone(), dir, amp:rand(0.05,0.11), freq:rand(0.7,1.15), phase:rand(0,Math.PI*2)};
    m.userData.repel={offset:new THREE.Vector2(0,0), vel:new THREE.Vector2(0,0)};
    m.userData.depth = depth[i];
    m.scale.setScalar(0.001); m.visible = false; group.add(m); return m;
  });

  function buildVisibleLines(pairs, mat, visibleDepth){
    const vis = pairs.filter(([a,b])=>{
      const da=nodeMeshes[a]?.userData.depth ?? 0, db=nodeMeshes[b]?.userData.depth ?? 0;
      return da<=visibleDepth && db<=visibleDepth;
    });
    const g=new THREE.BufferGeometry();
    const pos=new Float32Array(Math.max(1,vis.length)*2*3);
    let k=0; for (const [ai,bi] of vis){
      const a=nodeMeshes[ai].position, b=nodeMeshes[bi].position;
      pos[k++]=a.x; pos[k++]=a.y; pos[k++]=0; pos[k++]=b.x; pos[k++]=b.y; pos[k++]=0;
    }
    if (vis.length===0){ pos[0]=pos[1]=pos[2]=pos[3]=pos[4]=pos[5]=9999; }
    g.setAttribute("position", new THREE.BufferAttribute(pos,3));
    const line=new THREE.LineSegments(g,mat); line.userData.allPairs = pairs; group.add(line); return line;
  }
  const solidLines = buildVisibleLines(edgesSolid, solidLineMat, 0);

  const grow = { start: performance.now(), perLevelMs: 160, scaleMs: 170, maxDepth: depth.reduce((a,b)=>Math.max(a,b),0) };
  group.userData={ nodeMeshes, solidLines, nodeCount: nodeMeshes.length, grow, edgesSolid };
  return group;
}

/* lifecycle (FIFO) */
const allTrees=[]; let totalNodes=0;
function destroyTree(tree){ if(!tree) return; scene.remove(tree); if(tree.userData.solidLines) tree.userData.solidLines.geometry.dispose(); totalNodes -= tree.userData.nodeCount||0; }
function addTree(tree){
  const need = tree.userData.nodeCount||0;
  while(totalNodes + need > 500 && allTrees.length) destroyTree(allTrees.shift());
  scene.add(tree); allTrees.push(tree); totalNodes += need;
}

/* interactions */
window.addEventListener("click",(e)=>{
  clearClickHints();
  const p=screenToWorld(e.clientX,e.clientY);
  const tree=makeTree({
    spineSegments: Math.floor(rand(10, 18)),
    segmentLen:    rand(1.6, 2.6),
    turnStdDeg:    rand(8, 22),
    clusterChance: rand(0.7, 0.92),
    clusterMin:    2,
    clusterMax:    Math.floor(rand(3,6)),
    clusterLen:    rand(0.7, 1.1),
    clusterDepth:  Math.random()<0.65 ? 2 : 1
  });
  tree.position.set(p.x,p.y,0); addTree(tree);
});

const mouseWorld=new THREE.Vector2(0,0);
window.addEventListener("pointermove",(e)=>{
  const p=screenToWorld(e.clientX,e.clientY); mouseWorld.set(p.x,p.y);
  const BRUSH_R=2.0, IMPULSE=2.6;
  for(const tree of allTrees){
    const local = new THREE.Vector2(mouseWorld.x-tree.position.x, mouseWorld.y-tree.position.y);
    for(const m of tree.userData.nodeMeshes){
      const w=m.userData.wobble, r=m.userData.repel, cx=w.base.x, cy=w.base.y;
      const to=new THREE.Vector2(cx-local.x, cy-local.y); const d=to.length();
      if(d<BRUSH_R && d>1e-4){ to.divideScalar(d); const s=(1 - d/BRUSH_R)*IMPULSE; r.vel.addScaledVector(to,s); }
    }
  }
});

/* mouse in panel UV for shader parallax */
const mousePanel = new THREE.Vector2(0.5, 0.5);
window.addEventListener("pointermove", (e) => {
  const el = document.querySelector('.stamp');
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / Math.max(1, r.width);
  const y = (e.clientY - r.top)  / Math.max(1, r.height);
  mousePanel.set(THREE.MathUtils.clamp(x,0,1), THREE.MathUtils.clamp(y,0,1));
});

/* seed */
(()=>{
  const left  = makeTree({spineSegments:14, segmentLen:2.1, turnStdDeg:14, clusterChance:0.85, clusterLen:0.9});
  left.position.set(-6,-1,0); addTree(left);
  const right = makeTree({spineSegments:11, segmentLen:1.9, turnStdDeg:18, clusterChance:0.8,  clusterLen:1.0});
  right.position.set(6,3,0); addTree(right);
})();

/* resize + animate */
window.addEventListener("resize",()=>{
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  updateCamera();
  syncGlassPanelToStamp();
});
requestAnimationFrame(syncGlassPanelToStamp);

const clock=new THREE.Clock();
function animate(){
  const tNow = performance.now() * 0.001;
  glassUniforms.uTime.value = tNow;
  glassUniforms.uMouse.value.copy(mousePanel);

  const dt=Math.min(0.033, clock.getDelta());
  const DAMP=0.88, SPRING=6.0, MAX_OFF=0.9;

  for(const tree of allTrees){
    const {nodeMeshes,solidLines,edgesSolid,grow}=tree.userData;
    const elapsed = performance.now() - grow.start;
    const visibleDepth = Math.min(grow.maxDepth, Math.floor(elapsed / grow.perLevelMs));

    for(const m of nodeMeshes){
      const w=m.userData.wobble, r=m.userData.repel, dpth=m.userData.depth;
      const born = (elapsed - dpth*grow.perLevelMs) / grow.scaleMs;
      const pop = smoothstep(Math.min(1, Math.max(0, born)));
      m.visible = pop > 0; m.scale.setScalar(Math.max(0.001, pop));

      r.vel.addScaledVector(r.offset.clone().multiplyScalar(-SPRING), dt);
      r.vel.multiplyScalar(DAMP); r.offset.addScaledVector(r.vel, dt);
      if(r.offset.lengthSq()>MAX_OFF*MAX_OFF) r.offset.setLength(MAX_OFF);
      const s=Math.sin(tNow*w.freq + w.phase)*w.amp;
      m.position.set(w.base.x + w.dir.x*s + r.offset.x, w.base.y + w.dir.y*s + r.offset.y, 0);
    }

    const vis = edgesSolid.filter(([a,b])=>{
      const da=nodeMeshes[a].userData.depth, db=nodeMeshes[b].userData.depth;
      return (da<=visibleDepth && db<=visibleDepth);
    });
    const needLen = Math.max(1, vis.length)*2*3;
    let g = solidLines.geometry; let arr = g.attributes.position?.array;
    if (!arr || arr.length !== needLen){
      solidLines.geometry.dispose();
      g = new THREE.BufferGeometry();
      arr = new Float32Array(needLen);
      g.setAttribute("position", new THREE.BufferAttribute(arr,3));
      solidLines.geometry = g;
    }
    let k=0;
    for(const [ai,bi] of vis){
      const a=nodeMeshes[ai].position, b=nodeMeshes[bi].position;
      arr[k++]=a.x; arr[k++]=a.y; arr[k++]=0; arr[k++]=b.x; arr[k++]=b.y; arr[k++]=0;
    }
    if (vis.length===0){ arr[0]=arr[1]=arr[2]=arr[3]=arr[4]=arr[5]=9999; }
    g.attributes.position.needsUpdate=true;
  }

  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
animate();
