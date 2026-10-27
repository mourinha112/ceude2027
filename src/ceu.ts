/* Céu noturno 3D: estrelas e via láctea, horizonte com cidade (Cristo e Pão de Açúcar), mar escuro e milhares de
   lanternas (geometria + brilho) animadas no shader: balançam, sobem quando nascem, piscam como chama.
   Tipos: 0 normal · 1 dourada · 2 empresa · 3 casal. Virada: as lanternas viram fogos coloridos + estouros. */
import * as T from 'three';
import { rnd, type Tipo } from './dados';

const GLSL_POS = `
uniform float uT; uniform float uCid; uniform float uVir; uniform float uSel;
attribute vec3 aBase; attribute float aFase; attribute float aNasc; attribute float aTipo; attribute float aCid; attribute float aForca; attribute float aId;
vec3 posL() {
  vec3 p = aBase;
  p.x += sin(uT * 0.13 + aFase * 6.0) * 2.2; p.z += cos(uT * 0.11 + aFase * 4.0) * 2.2;
  p.y += sin(uT * 0.32 + aFase * 9.0) * 1.3 + max(aForca, 0.0) * 6.0;
  float k = clamp((uT - aNasc) / 9.0, 0.0, 1.0); k = 1.0 - pow(1.0 - k, 3.0);
  p.y = mix(-1.0, p.y, k);
  p.x += (1.0 - k) * sin(uT * 3.0 + aFase * 20.0) * 0.6;
  return p;
}
vec3 corL() {
  vec3 c = aTipo < 0.5 ? vec3(1.0, 0.56, 0.2) : aTipo < 1.5 ? vec3(1.0, 0.86, 0.45) : aTipo < 2.5 ? vec3(0.25, 0.95, 0.9) : vec3(1.0, 0.45, 0.68);
  float v = uT - uVir;
  if (v > 0.0 && v < 6.0) { float h = fract(aFase * 7.0 + v * 0.6); c = mix(c, 0.5 + 0.5 * cos(6.283 * (h + vec3(0.0, 0.33, 0.67))), smoothstep(0.0, 0.4, v) * (1.0 - smoothstep(4.5, 6.0, v))); }
  return c;
}
float alfaL() { return aCid < -0.5 ? (uCid < -0.5 ? 0.5 : 0.08) : (uCid < -0.5 || abs(uCid - aCid) < 0.5) ? 1.0 : 0.12; }
float escalaL() { return (aTipo < 0.5 ? 1.0 : aTipo < 1.5 ? 1.7 : aTipo < 2.5 ? 2.0 : 1.3) * (1.0 + aForca * 0.35) * (abs(aId - uSel) < 0.5 ? 1.6 : 1.0); }
float ambL() { return aCid < -0.5 ? 0.45 : 1.0; }
`;

export type Lanterna = { id: number; handle: string; desejo: string; cid: number; tipo: Tipo; forca: number; par?: string; de?: string; empresa?: { nome: string; ig: string; oferta: string; cor: string } };

export function criarCeu(canvas: HTMLCanvasElement) {
  const cel = innerWidth < 760;
  const renderer = new T.WebGLRenderer({ canvas, antialias: !cel, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, cel ? 1.5 : 2));
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(62, 1, 0.3, 3000);
  camera.position.set(0, 4, 0);
  const uni = { uT: { value: 0 }, uCid: { value: -1 }, uVir: { value: -99 }, uSel: { value: -1 } };

  /* céu: degradê de virada de ano + estrelas + via láctea */
  scene.add(new T.Mesh(new T.SphereGeometry(1500, 48, 24), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, uniforms: uni,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform float uVir; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        float y = vD.y;
        vec3 c = mix(vec3(0.95,0.42,0.32), vec3(0.32,0.16,0.42), smoothstep(-0.02, 0.1, y));
        c = mix(c, vec3(0.06,0.06,0.2), smoothstep(0.08, 0.35, y)); c = mix(c, vec3(0.01,0.015,0.06), smoothstep(0.35, 0.9, y));
        vec3 g = floor(vD * 260.0); float s = h(g); float tw = 0.6 + 0.4 * sin(uT * 2.0 + s * 50.0);
        c += step(0.9965, s) * tw * smoothstep(0.05, 0.3, y) * vec3(1.0, 0.95, 0.9);
        vec3 g2 = floor(vD * 700.0); c += step(0.999, h(g2)) * 0.6 * smoothstep(0.1, 0.4, y);
        float band = exp(-pow((vD.x * 0.6 + vD.y - 0.55 + vD.z * 0.3) * 4.0, 2.0)); c += band * vec3(0.12, 0.1, 0.2) * smoothstep(0.1, 0.5, y);
        float v = uT - uVir; if (v > 0.0 && v < 8.0) c += vec3(0.25, 0.15, 0.3) * exp(-v * 0.6) * smoothstep(0.0, 0.3, y);
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));

  /* mar escuro com reflexo do céu */
  const mar = new T.Mesh(new T.CircleGeometry(1400, 64), new T.ShaderMaterial({
    uniforms: uni,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT; varying vec3 vW;
      void main(){ float d = length(vW.xz); vec3 c = mix(vec3(0.02,0.03,0.09), vec3(0.22,0.1,0.2), smoothstep(150.0, 1100.0, d));
        float o = sin(vW.x * 0.08 + uT * 0.8) * sin(vW.z * 0.11 - uT * 0.6); c += max(0.0, o) * 0.05 * vec3(1.0, 0.6, 0.35) * (1.0 - smoothstep(0.0, 600.0, d));
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  mar.rotation.x = -Math.PI / 2; scene.add(mar);

  /* horizonte: prédios recortados com janelas, morros, Cristo e Pão de Açúcar */
  const silh = new T.MeshBasicMaterial({ color: '#070a1a' });
  const NP = cel ? 220 : 380, predios = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), silh, NP);
  const jan: number[] = [], M = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
  for (let i = 0; i < NP; i++) {
    const a = rnd() * Math.PI * 2, r = 430 + rnd() * 120, w = 8 + rnd() * 14, h = 10 + rnd() ** 2 * 70;
    Q.setFromAxisAngle(Y, -a); V.set(Math.cos(a) * r, 0, Math.sin(a) * r); S.set(w, h, w); M.compose(V, Q, S); predios.setMatrixAt(i, M);
    for (let k = 0; k < h / 5; k++) if (rnd() < 0.35) jan.push(V.x + (rnd() - 0.5) * w * 0.8, 3 + k * 5, V.z + (rnd() - 0.5) * w * 0.8);
  }
  scene.add(predios);
  const gj = new T.BufferGeometry(); gj.setAttribute('position', new T.Float32BufferAttribute(jan, 3));
  scene.add(new T.Points(gj, new T.PointsMaterial({ color: '#ffcf7a', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.85 })));
  const morro = (x: number, z: number, r: number, h: number) => { const m = new T.Mesh(new T.ConeGeometry(r, h, 9, 1).translate(0, h / 2, 0), new T.MeshBasicMaterial({ color: '#0a0d20' })); m.position.set(x, 0, z); scene.add(m); };
  const ang0 = -1.2;   // direção do Cristo
  const px = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r] as const;
  { const [x, z] = px(ang0, 620); morro(x, z, 110, 230); const [x2, z2] = px(ang0 - 0.25, 640); morro(x2, z2, 140, 140); const [x3, z3] = px(ang0 + 0.3, 650); morro(x3, z3, 130, 160); }
  const pedra = new T.MeshBasicMaterial({ color: '#f4ecdc' }), cristo = new T.Group();
  const cp = (g: T.BufferGeometry, y: number) => { const m = new T.Mesh(g, pedra); m.position.y = y; cristo.add(m); };
  cp(new T.BoxGeometry(6, 6, 6), 3); cp(new T.CylinderGeometry(2, 3.2, 16, 8), 14); cp(new T.BoxGeometry(24, 2.4, 2.4), 20); cp(new T.SphereGeometry(1.9, 8, 6), 24);
  { const [x, z] = px(ang0, 620); cristo.position.set(x, 228, z); cristo.lookAt(0, 228, 0); scene.add(cristo); }
  const brilho = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,245,220,1)'); g.addColorStop(1, 'rgba(255,245,220,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();
  const aura = new T.Sprite(new T.SpriteMaterial({ map: brilho, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.55 })); aura.scale.set(110, 110, 1); aura.position.copy(cristo.position).add(new T.Vector3(0, 18, 0)); scene.add(aura);
  { const [x, z] = px(ang0 + 0.9, 560); const p = new T.Mesh(new T.SphereGeometry(30, 12, 8), new T.MeshBasicMaterial({ color: '#0a0d20' })); p.scale.set(1, 2.2, 1); p.position.set(x, 0, z); scene.add(p); }

  /* lanternas */
  const AMB = cel ? 700 : 1200, N = (cel ? 5200 : 8200) + AMB;
  const aBase = new Float32Array(N * 3), aFase = new Float32Array(N), aNasc = new Float32Array(N).fill(1e9), aTipo = new Float32Array(N), aCid = new Float32Array(N).fill(-1), aForca = new Float32Array(N), aId = new Float32Array(N);
  const L: (Lanterna | null)[] = new Array(N).fill(null);
  const porId = new Map<number, number>();
  let usados = AMB;
  const sortearBase = (i: number, perto = false, longe = false) => {
    const a = rnd() * Math.PI * 2, r = perto ? 24 + rnd() * 30 : longe ? 220 + rnd() * 160 : 26 + rnd() ** 1.25 * 260, h = (perto ? 22 : 14) + rnd() ** 0.8 * (r * 0.75 + 30);
    aBase.set([Math.cos(a) * r, h, Math.sin(a) * r], i * 3);
  };
  for (let i = 0; i < N; i++) { aFase[i] = rnd(); aId[i] = i; }
  // luzes de ambiente: bem longe e fracas (só cenário)
  for (let i = 0; i < AMB; i++) { sortearBase(i, false, true); aTipo[i] = 0; aForca[i] = -0.55; aNasc[i] = -50; }
  const attrs = { aBase: [aBase, 3], aFase: [aFase, 1], aNasc: [aNasc, 1], aTipo: [aTipo, 1], aCid: [aCid, 1], aForca: [aForca, 1], aId: [aId, 1] } as const;
  // corpo de papel (só aparece de perto) — geometria instanciada à mão
  const base = new T.CylinderGeometry(0.55, 0.4, 1.15, 8, 1, false);
  const gL = new T.InstancedBufferGeometry(); gL.index = base.index; gL.setAttribute('position', base.attributes.position); gL.setAttribute('uv', base.attributes.uv); gL.instanceCount = N;
  for (const [k, [arr, n]] of Object.entries(attrs)) gL.setAttribute(k, new T.InstancedBufferAttribute(arr, n));
  const corpo = new T.Mesh(gL, new T.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false,
    vertexShader: GLSL_POS + `varying float vY; varying vec3 vC; varying float vA;
      void main(){ vY = uv.y; vC = corL(); vA = alfaL(); vec3 p = posL() + position * escalaL(); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uT; varying float vY; varying vec3 vC; varying float vA;
      void main(){ vec3 c = mix(vC * 1.6, vC * 0.55, vY); gl_FragColor = vec4(c, 0.92 * vA); }`,
  }));
  corpo.frustumCulled = false; scene.add(corpo);
  // brilho (o que se vê de longe)
  const gP = new T.BufferGeometry(); gP.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 3), 3));
  for (const [k, [arr, n]] of Object.entries(attrs)) gP.setAttribute(k, new T.BufferAttribute(arr, n));
  const pxRatio = renderer.getPixelRatio();
  const halo = new T.Points(gP, new T.ShaderMaterial({
    uniforms: { ...uni, uPx: { value: pxRatio * (cel ? 1.15 : 1) } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: GLSL_POS + `uniform float uPx; varying vec3 vC; varying float vA; varying float vF;
      void main(){ vC = corL(); vA = alfaL(); vec4 mv = viewMatrix * vec4(posL(), 1.0); gl_Position = projectionMatrix * mv;
        vF = 0.85 + 0.15 * sin(uT * 13.0 + aFase * 40.0) * sin(uT * 7.0 + aFase * 11.0);
        float v = uT - uVir; float boom = (v > 0.0 && v < 6.0) ? 1.0 + 1.8 * exp(-v * 0.8) : 1.0;
        gl_PointSize = clamp(150.0 * escalaL() * boom / -mv.z, 2.0, 90.0) * uPx; }`,
    fragmentShader: `varying vec3 vC; varying float vA; varying float vF;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-d * d * 4.5) * 0.9 + exp(-d * d * 40.0) * 0.6; gl_FragColor = vec4(vC * vF, a * vA * vF); }`,
  }));
  halo.frustumCulled = false; scene.add(halo);
  let lote = false;
  const sujo = () => { for (const g of [gL, gP]) for (const k of Object.keys(attrs)) (g.getAttribute(k) as T.BufferAttribute).needsUpdate = true; };

  /* posição na CPU (igual ao shader) para tocar e etiquetar */
  const pos = (i: number, out = new T.Vector3()) => {
    const t = uni.uT.value, f = aFase[i];
    let x = aBase[i * 3] + Math.sin(t * 0.13 + f * 6) * 2.2, y = aBase[i * 3 + 1] + Math.sin(t * 0.32 + f * 9) * 1.3 + Math.max(0, aForca[i]) * 6, z = aBase[i * 3 + 2] + Math.cos(t * 0.11 + f * 4) * 2.2;
    let k = Math.min(1, Math.max(0, (t - aNasc[i]) / 9)); k = 1 - (1 - k) ** 3; y = -1 + (y + 1) * k; x += (1 - k) * Math.sin(t * 3 + f * 20) * 0.6;
    return out.set(x, y, z);
  };

  /* fogos da virada */
  const NF = cel ? 2600 : 4800, fp = new Float32Array(NF * 3), fv = new Float32Array(NF * 3), fc = new Float32Array(NF * 3), fl = new Float32Array(NF);
  const gF = new T.BufferGeometry(); gF.setAttribute('position', new T.BufferAttribute(fp, 3)); gF.setAttribute('color', new T.BufferAttribute(fc, 3));
  const fogos = new T.Points(gF, new T.PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
  fogos.frustumCulled = false; fogos.visible = false; scene.add(fogos);
  let fi = 0, estouros = 0, proxEstouro = 0;
  const PALETA = ['#ffd84d', '#ff5d8f', '#5de0ff', '#8dff6a', '#ffffff', '#b98cff', '#ff8a3d'];
  function estourar() {
    const a = rnd() * Math.PI * 2, r = 90 + rnd() * 200, cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 70 + rnd() * 110, cor = new T.Color(PALETA[Math.floor(rnd() * PALETA.length)]), n = cel ? 140 : 220, vel = 14 + rnd() * 16;
    for (let k = 0; k < n; k++) {
      const i = fi++ % NF, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      fp.set([cx, cy, cz], i * 3); fv.set([Math.sin(ph) * Math.cos(th) * vel, Math.cos(ph) * vel, Math.sin(ph) * Math.sin(th) * vel], i * 3); fl[i] = 1.6 + rnd() * 0.8;
      fc.set([cor.r, cor.g, cor.b], i * 3);
    }
  }

  /* câmera: arrastar olha em volta, pinça/roda aproxima */
  const olhar = { yaw: 0.4, pitch: 0.42, fov: 62, alvo: null as null | { yaw: number; pitch: number; fov: number; t0: number; de: { yaw: number; pitch: number; fov: number } }, auto: true, segue: -1 };
  let arr: { x: number; y: number; t: number; mov: number } | null = null; const toques = new Map<number, { x: number; y: number }>(); let pinca0 = 0;
  let aoTocar: (i: number | null) => void = () => {};
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); arr = { x: e.clientX, y: e.clientY, t: performance.now(), mov: 0 }; olhar.auto = false; olhar.alvo = null; olhar.segue = -1; if (toques.size === 2) { const [a, b] = [...toques.values()]; pinca0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  canvas.addEventListener('pointermove', (e) => {
    const ant = toques.get(e.pointerId); if (!ant || !arr) return;
    if (toques.size === 2) { toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...toques.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); olhar.fov = Math.min(75, Math.max(28, olhar.fov * (pinca0 / d))); pinca0 = d; arr.mov = 99; return; }
    const dx = e.clientX - ant.x, dy = e.clientY - ant.y; toques.set(e.pointerId, { x: e.clientX, y: e.clientY }); arr.mov += Math.abs(dx) + Math.abs(dy);
    const k = (olhar.fov / 62) * 0.0042; olhar.yaw -= dx * k; olhar.pitch = Math.min(1.35, Math.max(-0.05, olhar.pitch + dy * k));
  });
  const solta = (e: PointerEvent) => {
    toques.delete(e.pointerId); if (!arr || toques.size) return;
    if (arr.mov < 8 && performance.now() - arr.t < 450) aoTocar(achar(e.clientX, e.clientY));
    arr = null;
  };
  canvas.addEventListener('pointerup', solta); canvas.addEventListener('pointercancel', solta);
  canvas.addEventListener('wheel', (e) => { olhar.fov = Math.min(75, Math.max(28, olhar.fov * (1 + e.deltaY * 0.001))); }, { passive: true });
  const P = new T.Vector3();
  function achar(x: number, y: number) {
    const r = canvas.getBoundingClientRect(); let melhor = -1, md = 34 * 34;
    for (let i = AMB; i < usados; i++) {
      if (!L[i] || (uni.uCid.value >= 0 && aCid[i] !== uni.uCid.value)) continue;
      pos(i, P).project(camera); if (P.z > 1) continue;
      const sx = (P.x * 0.5 + 0.5) * r.width, sy = (-P.y * 0.5 + 0.5) * r.height, d = (sx - (x - r.left)) ** 2 + (sy - (y - r.top)) ** 2;
      if (d < md) { md = d; melhor = i; }
    }
    return melhor >= 0 ? melhor : null;
  }
  function mirar(i: number, fov = 40) {
    pos(i, P); const d = P.clone().sub(camera.position);
    let yaw = Math.atan2(d.x, -d.z); while (yaw - olhar.yaw > Math.PI) yaw -= Math.PI * 2; while (yaw - olhar.yaw < -Math.PI) yaw += Math.PI * 2;
    olhar.alvo = { yaw, pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)), fov, t0: uni.uT.value, de: { yaw: olhar.yaw, pitch: olhar.pitch, fov: olhar.fov } };
    olhar.auto = false;
  }

  (window as unknown as { __render: () => void }).__render = () => renderer.render(scene, camera);
  function tamanho() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', tamanho); tamanho();
  const passos: ((t: number) => void)[] = [];
  const clock = new T.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta()); uni.uT.value += dt; const t = uni.uT.value;
    if (olhar.auto) olhar.yaw += dt * 0.018;
    if (olhar.segue >= 0) {   // acompanha a lanterna subindo
      pos(olhar.segue, P); const d = P.clone().sub(camera.position);
      olhar.yaw += ((Math.atan2(d.x, -d.z) - olhar.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 3);
      olhar.pitch += (Math.atan2(d.y, Math.hypot(d.x, d.z)) - olhar.pitch) * Math.min(1, dt * 3);
    } else if (olhar.alvo) {
      const k = Math.min(1, (t - olhar.alvo.t0) / 1.4), e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2, a = olhar.alvo;
      olhar.yaw = a.de.yaw + (a.yaw - a.de.yaw) * e; olhar.pitch = a.de.pitch + (a.pitch - a.de.pitch) * e; olhar.fov = a.de.fov + (a.fov - a.de.fov) * e; if (k >= 1) olhar.alvo = null;
    }
    camera.fov += (olhar.fov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
    camera.lookAt(camera.position.x + Math.sin(olhar.yaw) * Math.cos(olhar.pitch), camera.position.y + Math.sin(olhar.pitch), camera.position.z - Math.cos(olhar.yaw) * Math.cos(olhar.pitch));
    if (fogos.visible) {
      if (t < uni.uVir.value + 16 && t > proxEstouro) { estourar(); estouros++; proxEstouro = t + (estouros < 25 ? 0.12 : 0.35) * (0.5 + rnd()); }
      let vivo = false;
      for (let i = 0; i < NF; i++) { if (fl[i] <= 0) continue; vivo = true; fl[i] -= dt; fv[i * 3 + 1] -= 9.8 * dt; for (let k = 0; k < 3; k++) { fp[i * 3 + k] += fv[i * 3 + k] * dt; fv[i * 3 + k] *= 0.985; } if (fl[i] < 0.6) { fc[i * 3] *= 0.93; fc[i * 3 + 1] *= 0.93; fc[i * 3 + 2] *= 0.93; } if (fl[i] <= 0) fp[i * 3 + 1] = -999; }
      gF.attributes.position.needsUpdate = true; gF.attributes.color.needsUpdate = true;
      if (!vivo && t > uni.uVir.value + 17) fogos.visible = false;
    }
    for (const f of passos) f(t);
    renderer.render(scene, camera);
  });

  return {
    L, get usados() { return usados; },
    aoTocar(f: (i: number | null) => void) { aoTocar = f; },
    aoPasso(f: (t: number) => void) { passos.push(f); },
    /** coloca uma lanterna real. nascendo = sobe da água agora; perto = na frente da câmera (a sua). Devolve o índice. */
    colocar(l: Lanterna, nascendo = false, perto = false) {
      const ja = porId.get(l.id);
      if (ja !== undefined) { L[ja] = l; aTipo[ja] = l.tipo; aForca[ja] = l.forca; aCid[ja] = l.cid; sujo(); return ja; }
      if (usados >= N) return -1;
      const i = usados++;
      L[i] = l; porId.set(l.id, i); sortearBase(i, perto);
      if (perto) { const a = olhar.yaw + (rnd() - 0.5) * 0.5, r = 34; aBase[i * 3] = Math.sin(a) * r; aBase[i * 3 + 2] = -Math.cos(a) * r; aBase[i * 3 + 1] = 30 + rnd() * 10; }
      aTipo[i] = l.tipo; aCid[i] = l.cid; aForca[i] = l.forca; aNasc[i] = nascendo ? uni.uT.value : -50 - rnd() * 10;
      if (!lote) sujo();
      return i;
    },
    lote(f: () => void) { lote = true; try { f(); } finally { lote = false; sujo(); } },
    indice: (id: number) => porId.get(id) ?? -1,
    forca(i: number, f: number) { aForca[i] = f; if (L[i]) L[i]!.forca = f; sujo(); },
    seguir(i: number) { olhar.segue = i; olhar.alvo = null; olhar.auto = false; },
    pararSeguir() { olhar.segue = -1; },
    mirar, selecionar(i: number | null) { uni.uSel.value = i ?? -1; },
    filtrar(cid: number) { uni.uCid.value = cid; },
    virada() { uni.uVir.value = uni.uT.value; fogos.visible = true; estouros = 0; proxEstouro = uni.uT.value; olhar.alvo = { yaw: olhar.yaw, pitch: 0.55, fov: 70, t0: uni.uT.value, de: { yaw: olhar.yaw, pitch: olhar.pitch, fov: olhar.fov } }; },
    girar(on: boolean) { olhar.auto = on; },
    tela(i: number) { pos(i, P).project(camera); const r = canvas.getBoundingClientRect(); return { x: (P.x * 0.5 + 0.5) * r.width, y: (-P.y * 0.5 + 0.5) * r.height, ok: P.z < 1 && Math.abs(P.x) < 1.1 && Math.abs(P.y) < 1.1 }; },

  };
}
export type Ceu = ReturnType<typeof criarCeu>;
