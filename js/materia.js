/* La materia de Quantum Beatz: un solo sistema de partículas que recorre toda la página.
   Las mismas partículas son el ventilador, el polvo, el calor, el despiece, la placa, el latido…
   y al final se ensamblan mientras la persona llena el formulario.
   Física real: cada partícula tiene velocidad, un muelle hacia su sitio, el cursor la empuja
   como aire comprimido y un clic manda una onda (el latido). */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { crearFormas } from './formas.js';

const lienzo = document.querySelector('.materia');
const reducido = matchMedia('(prefers-reduced-motion: reduce)');
const conCursor = matchMedia('(hover: hover) and (pointer: fine)');
const DIST = 10, FOV = 35;

async function iniciar() {
  if (!lienzo) return;
  const movil = matchMedia('(max-width: 879px)').matches;
  const N = movil ? 6500 : 14000;
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch {}

  let renderizador;
  try {
    renderizador = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    document.documentElement.dataset.sinMateria = '';
    return;
  }
  renderizador.setClearColor(0x000000, 0);

  const formas = crearFormas(N, N / 14000);
  const porNombre = Object.fromEntries(formas.map(f => [f.nombre, f]));

  // ── Escenas: cada [data-forma] de la página, en orden ──
  const escenas = [...document.querySelectorAll('[data-forma]')].map((el, i) => ({
    el, i,
    forma: porNombre[el.dataset.forma] || porNombre.polvo,
    ancla: el.dataset.ancla ? document.querySelector(el.dataset.ancla) : (el.querySelector(':scope .ancla') || el),
    lectura: el.dataset.lectura || '',
  }));
  if (!escenas.length) return;

  // ── Estado de las partículas ──
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  const energia = new Float32Array(N), acento = new Float32Array(N), presencia = new Float32Array(N);
  const tam = new Float32Array(N), alfa = new Float32Array(N);
  const polvo = new Float32Array(N * 3), fasePolvo = new Float32Array(N), turno = new Float32Array(N);
  let s0 = 7;
  const azar = () => ((s0 = (s0 * 16807) % 2147483647) / 2147483647);
  for (let j = 0; j < N; j++) {
    polvo[j * 3] = azar() * 2.3 - 1.15;
    polvo[j * 3 + 1] = azar() * 2.3 - 1.15;
    polvo[j * 3 + 2] = -5 + azar() * 6.5;
    fasePolvo[j] = azar() * 100;
    turno[j] = azar();                      // orden en que cada partícula entra al ensamble
    tam[j] = 1.3 + azar() * 1.2;
    alfa[j] = .45 + azar() * .5;
  }
  const geo = new THREE.BufferGeometry();
  const atributo = (arr, k) => { const a = new THREE.BufferAttribute(arr, k); a.setUsage(THREE.DynamicDrawUsage); return a; };
  geo.setAttribute('position', atributo(pos, 3));
  geo.setAttribute('aEnergia', atributo(energia, 1));
  geo.setAttribute('aAcento', atributo(acento, 1));
  geo.setAttribute('aPresencia', atributo(presencia, 1));
  geo.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('aAlfa', new THREE.BufferAttribute(alfa, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

  const uniformes = { uEscala: { value: 1 }, uTiempo: { value: 0 }, uPulso: { value: new THREE.Vector4(0, 0, -10, 0) } };
  const material = new THREE.ShaderMaterial({
    uniforms: uniformes, transparent: true, depthWrite: false, depthTest: false,
    vertexShader: /* glsl */`
      attribute float aEnergia, aAcento, aPresencia, aTam, aAlfa;
      uniform float uEscala, uTiempo; uniform vec4 uPulso;
      varying vec3 vColor; varying float vAlfa;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float edad = uTiempo - uPulso.z;
        float onda = 0.0;
        if (edad > 0.0 && edad < 1.6) {
          float d = length(position.xy - uPulso.xy);
          onda = exp(-pow((d - edad * 6.0) / 0.35, 2.0)) * (1.0 - edad / 1.6);
        }
        // El degradado de la marca vive en las partículas: cian a la izquierda, azul eléctrico e índigo a la derecha
        float gx = clamp(gl_Position.x / gl_Position.w * 0.5 + 0.5, 0.0, 1.0);
        vec3 tinta = vec3(.90, .93, 1.0);
        vec3 grad = gx < .55 ? mix(vec3(.27, .88, .95), vec3(.24, .48, 1.0), smoothstep(.1, .55, gx)) : mix(vec3(.24, .48, 1.0), vec3(.48, .42, 1.0), smoothstep(.55, .95, gx));
        vec3 ambar = vec3(1.0, .69, .27);
        float frio = max(aAcento, 0.0), calor = max(-aAcento, 0.0);
        vec3 c = mix(tinta, grad, clamp(frio + aEnergia * 1.1 + onda, 0.0, 1.0));
        vColor = mix(c, ambar, calor * (1.0 - onda));
        float lejos = clamp((-mv.z - 9.0) / 6.0, 0.0, 1.0);
        vAlfa = min(1.0, aAlfa * mix(.38, 1.0, aPresencia) * (1.0 - .55 * lejos) + aEnergia * .4 + onda * .6);
        gl_PointSize = aTam * uEscala * (1.0 + aEnergia * .9 + onda * 1.2) * mix(.8, 1.0, aPresencia) / -mv.z;
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying vec3 vColor; varying float vAlfa;
      void main() {
        float d = length(gl_PointCoord - .5);
        float a = smoothstep(.5, .28, d) * vAlfa;
        if (a < .01) discard;
        gl_FragColor = vec4(vColor, a);
      }`,
  });
  const nube = new THREE.Points(geo, material);
  nube.frustumCulled = false;
  const escena = new THREE.Scene();
  escena.add(nube);
  const camara = new THREE.PerspectiveCamera(FOV, 1, .1, 100);
  camara.position.z = DIST;

  // ── Medidas ──
  let vw = 1, vh = 1, medioAlto = 1, medioAncho = 1, upp = 1;
  function medir() {
    vw = innerWidth; vh = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    renderizador.setPixelRatio(dpr);
    renderizador.setSize(vw, vh, false);
    camara.aspect = vw / vh; camara.updateProjectionMatrix();
    medioAlto = DIST * Math.tan(FOV * Math.PI / 360); medioAncho = medioAlto * camara.aspect;
    upp = 2 * medioAlto / vh;
    uniformes.uEscala.value = dpr * DIST * (movil ? 1.05 : 1);
  }
  medir();
  addEventListener('resize', medir);

  // ── Estado compartido ──
  const est = { angulo: 0, giro: .6, tGiro: -10, progreso: .35, progresoSuave: 0 };
  let T = 0;
  const cursor = { x: 0, y: 0, vx: 0, vy: 0, activo: false, ultimo: 0, tx: 0, ty: 0 };
  let pulso = { x: 0, y: 0, t0: -10 };

  const aMundo = (px, py) => [(px - vw / 2) * upp, -(py - vh / 2) * upp];
  function mover(px, py) {
    const [x, y] = aMundo(px, py), ahora = performance.now();
    if (cursor.activo) {
      const dt = Math.max(8, ahora - cursor.ultimo) / 1000;
      cursor.vx = cursor.vx * .6 + ((x - cursor.x) / dt) * .4;
      cursor.vy = cursor.vy * .6 + ((y - cursor.y) / dt) * .4;
    }
    cursor.x = x; cursor.y = y; cursor.activo = true; cursor.ultimo = ahora;
    cursor.tx = (px / vw) * 2 - 1; cursor.ty = (py / vh) * 2 - 1;
  }
  addEventListener('pointermove', e => mover(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) mover(t.clientX, t.clientY); }, { passive: true });
  document.addEventListener('pointerleave', () => { cursor.activo = false; });
  addEventListener('touchend', () => { cursor.activo = false; }, { passive: true });

  function latir(px, py, encender = true) {
    const [x, y] = aMundo(px, py);
    pulso = { x, y, t0: T };
    uniformes.uPulso.value.set(x, y, T, 1);
    if (encender) est.tGiro = T;
  }
  document.addEventListener('click', e => {
    if (e.target.closest('a, button, input, label, textarea, select, summary, form, .barra')) return;
    latir(e.clientX, e.clientY);
  });
  document.addEventListener('qb:latido', e => {
    const d = e.detail || {};
    latir(d.x ?? vw * .7, d.y ?? vh * .5);
  });
  document.addEventListener('qb:progreso', e => { est.progreso = e.detail; });

  // ── Colocación de cada escena según su ancla ──
  const rot = (p) => {
    const cx = Math.cos(p.x), sx = Math.sin(p.x), cy = Math.cos(p.y), sy = Math.sin(p.y), cz = Math.cos(p.z), sz = Math.sin(p.z);
    return [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
            sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
            -sy, cy * sx, cy * cx];
  };
  const bufA = { p: new Float32Array(N * 3), a: new Float32Array(N) }, bufB = { p: new Float32Array(N * 3), a: new Float32Array(N) };
  function preparar(esc, buf, inclinar) {
    // La forma se lee en cada cuadro: una lista puede cambiarla al tocar o señalar una fila
    esc.forma = porNombre[esc.el.dataset.forma] || esc.forma;
    const f = esc.forma, r = esc.ancla.getBoundingClientRect();
    const [cx, cy] = aMundo(r.left + r.width / 2, r.top + r.height / 2);
    const s = Math.max(.2, Math.min(r.width, r.height) * upp / f.tam * .8);
    const pose = { x: f.pose.x + inclinar.y * .14, y: f.pose.y + inclinar.x * .2, z: f.pose.z };
    let local = f.local, acc = f.acento;
    if (f.anima) {
      buf.a.set(f.acento.subarray(0, f.n));
      const escribeAcento = f.anima(reducido.matches ? 0 : T, est, buf.p, buf.a);
      local = buf.p; acc = escribeAcento ? buf.a : f.acento;
    }
    return { f, local, acc, m: rot(pose), s, cx, cy, n: f.n, ensamble: f.nombre === 'ensamble' };
  }

  // Qué escena manda: la que tiene su centro más cerca del centro de la ventana; entre dos, una mezcla
  let activa = -1;
  function mezcla() {
    const mitad = vh / 2;
    let i = 0;
    const centros = escenas.map(e => { const r = e.el.getBoundingClientRect(); return r.top + r.height / 2; });
    for (let k = 0; k < centros.length; k++) if (centros[k] <= mitad) i = k;
    const j = Math.min(i + 1, escenas.length - 1);
    let t = 0;
    if (j !== i && centros[i] <= mitad) {
      t = (mitad - centros[i]) / Math.max(1, centros[j] - centros[i]);
      t = Math.min(1, Math.max(0, (t - .28) / .44));
      t = t * t * (3 - 2 * t);
    }
    return { i, j, t };
  }

  const lectura = {
    n: document.querySelector('.lectura__n'), nombre: document.querySelector('.lectura__nombre'), dato: document.querySelector('.lectura__dato'),
  };
  let ultimoDato = 0, ultimaLectura = '';
  function anunciar(k, hero) {
    const texto = escenas[k].el.dataset.lectura || '';
    if (k !== activa || texto !== ultimaLectura) {
      escenas[activa]?.el.removeAttribute('data-activo');
      escenas[k].el.setAttribute('data-activo', '');
      activa = k; ultimaLectura = texto;
      if (lectura.nombre) {
        lectura.nombre.textContent = texto;
        lectura.nombre.animate([{ opacity: 0, transform: 'translateY(4px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 250, easing: 'cubic-bezier(.22,1,.36,1)' });
        lectura.n && window.tacto && tacto.cifra(lectura.n, String(k + 1).padStart(2, '0'));
      }
      document.dispatchEvent(new CustomEvent('qb:escena', { detail: { indice: k, nombre: escenas[k].forma.nombre } }));
    }
    const ahora = performance.now();
    if (lectura.dato && ahora - ultimoDato > 160) {
      ultimoDato = ahora;
      const texto = hero ? `${Math.round(est.giro * 60 / (2 * Math.PI) / 10) * 10} rpm` : `${N.toLocaleString('es-CO')} partículas`;
      if (lectura.dato.textContent !== texto) lectura.dato.textContent = texto;
    }
  }

  // ── Zonas de lectura: los textos marcados con [data-despeja] apartan la materia ──
  // Cada partícula cuyo destino caiga sobre un texto se corre fuera de él, repartida en una franja
  // de ancho distinto por partícula: queda un claro limpio de borde suave, no un contorno de caja.
  const despejables = [...document.querySelectorAll('[data-despeja]')];
  const zonasBuf = new Float32Array(4 * 24);
  function zonas() {
    let n = 0;
    for (const el of despejables) {
      if (n >= 24) break;
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < -40 || r.top > vh + 40) continue;
      const pad = 22;
      const [x1, y1] = aMundo(r.left - pad, r.top - pad), [x2, y2] = aMundo(r.right + pad, r.bottom + pad);
      zonasBuf[n * 4] = x1; zonasBuf[n * 4 + 1] = y2; zonasBuf[n * 4 + 2] = x2; zonasBuf[n * 4 + 3] = y1;
      n++;
    }
    return n * 4;
  }

  // ── El bucle ──
  let previo = 0, cuadro = 0, primera = true;
  const RADIO = movil ? .75 : .95, EMPUJE = 70, VIENTO = 1.6;
  function paso(ahora) {
    const dt = Math.min(1 / 30, (ahora - (previo || ahora)) / 1000) || 1 / 60;
    previo = ahora;
    const quieto = reducido.matches;
    if (!quieto) T += dt;
    uniformes.uTiempo.value = T;

    // Ventilador: reposo vivo y arranque tras un latido
    const e = T - est.tGiro;
    est.giro = .6 + (e >= 0 ? 15 * Math.exp(-e / 1.3) * Math.min(1, e / .15) : 0);
    if (!quieto) est.angulo += est.giro * dt;
    est.progresoSuave += (est.progreso - est.progresoSuave) * Math.min(1, dt * 3);

    const { i, j, t } = mezcla();
    anunciar(t < .5 ? i : j, escenas[t < .5 ? i : j].forma.nombre === 'ventilador');
    const incl = conCursor.matches && !quieto ? { x: cursor.tx, y: cursor.ty } : { x: 0, y: 0 };
    const A = preparar(escenas[i], bufA, incl), B = j === i ? A : preparar(escenas[j], bufB, incl);
    const kPolvo = 1.4;

    if (!cursor.activo || performance.now() - cursor.ultimo > 1200) { cursor.vx *= .9; cursor.vy *= .9; }
    const empujar = cursor.activo && !quieto;
    const edadPulso = T - pulso.t0, hayPulso = edadPulso > 0 && edadPulso < 1.4 && !quieto;
    const derivaX = medioAncho, derivaY = medioAlto;
    const nz = zonas(), Z = zonasBuf;

    for (let q = 0; q < N; q++) {
      const q3 = q * 3;
      // Destino según la escena A
      let ax, ay, az, aDentro, aAcc;
      const enA = q < A.n && (!A.ensamble || turno[q] < est.progresoSuave);
      if (enA) {
        const lx = A.local[q3], ly = A.local[q3 + 1], lz = A.local[q3 + 2], m = A.m;
        ax = (m[0] * lx + m[1] * ly + m[2] * lz) * A.s + A.cx;
        ay = (m[3] * lx + m[4] * ly + m[5] * lz) * A.s + A.cy;
        az = (m[6] * lx + m[7] * ly + m[8] * lz) * A.s;
        aDentro = 1; aAcc = A.acc[q];
      } else { aDentro = 0; aAcc = 0; }
      let bx, by, bz, bDentro, bAcc;
      const enB = q < B.n && (!B.ensamble || turno[q] < est.progresoSuave);
      if (enB) {
        const lx = B.local[q3], ly = B.local[q3 + 1], lz = B.local[q3 + 2], m = B.m;
        bx = (m[0] * lx + m[1] * ly + m[2] * lz) * B.s + B.cx;
        by = (m[3] * lx + m[4] * ly + m[5] * lz) * B.s + B.cy;
        bz = (m[6] * lx + m[7] * ly + m[8] * lz) * B.s;
        bDentro = 1; bAcc = B.acc[q];
      } else { bDentro = 0; bAcc = 0; }
      // El polvo del fondo: lento, a la deriva, llenando la ventana a su profundidad
      const dz = polvo[q3 + 2], esc = (DIST - dz) / DIST, fp = fasePolvo[q];
      const dx = polvo[q3] * derivaX * esc + Math.sin(T * .06 + fp) * .35;
      const dy = polvo[q3 + 1] * derivaY * esc + Math.cos(T * .05 + fp * 1.3) * .35;
      if (!enA) { ax = dx; ay = dy; az = dz; }
      if (!enB) { bx = dx; by = dy; bz = dz; }
      let tx = ax + (bx - ax) * t, ty = ay + (by - ay) * t, tz = az + (bz - az) * t;
      let k = (aDentro ? A.f.rigidez : kPolvo) + ((bDentro ? B.f.rigidez : kPolvo) - (aDentro ? A.f.rigidez : kPolvo)) * t;
      let pres = aDentro + (bDentro - aDentro) * t, acc = aAcc + (bAcc - aAcc) * t;
      if (nz && pres > 0) { // zona de lectura: lo que caería sobre un texto vuelve al polvo tenue del fondo
        const f = DIST / (DIST - tz), sx = tx * f, sy = ty * f, BORDE = .45, azarQ = (fp * 7.13) % 1;
        for (let z = 0; z < nz; z += 4) {
          // Borde suave: en una franja alrededor del texto se apaga solo una parte, más cuanto más cerca
          const fuera = Math.max(Z[z] - sx, sx - Z[z + 2], Z[z + 1] - sy, sy - Z[z + 3]);
          if (fuera < BORDE && azarQ > fuera / BORDE) {
            tx = dx; ty = dy; tz = dz; k = kPolvo; pres = 0; acc = 0;
            break;
          }
        }
      }
      presencia[q] = pres;
      acento[q] = acc;

      let px = pos[q3], py = pos[q3 + 1], pz = pos[q3 + 2];
      if (primera) { px = pos[q3] = polvo[q3] * derivaX; py = pos[q3 + 1] = polvo[q3 + 1] * derivaY; pz = pos[q3 + 2] = polvo[q3 + 2]; }
      if (quieto) { pos[q3] = tx; pos[q3 + 1] = ty; pos[q3 + 2] = tz; energia[q] = 0; continue; }

      const c = 2 * Math.sqrt(k) * .7;
      let fx = (tx - px) * k - vel[q3] * c, fy = (ty - py) * k - vel[q3 + 1] * c, fz = (tz - pz) * k - vel[q3 + 2] * c;
      if (empujar) { // aire comprimido: aparta y arrastra en la dirección del gesto
        const ddx = px - cursor.x, ddy = py - cursor.y, d2 = ddx * ddx + ddy * ddy;
        if (d2 < RADIO * RADIO) {
          const d = Math.sqrt(d2) + 1e-4, w = (1 - d / RADIO) ** 2;
          fx += (ddx / d) * w * EMPUJE + cursor.vx * w * VIENTO;
          fy += (ddy / d) * w * EMPUJE + cursor.vy * w * VIENTO;
          fz -= w * 18;
        }
      }
      if (hayPulso) {
        const ddx = px - pulso.x, ddy = py - pulso.y, d = Math.sqrt(ddx * ddx + ddy * ddy) + 1e-4;
        const w = Math.exp(-(((d - edadPulso * 6) / .45) ** 2)) * (1 - edadPulso / 1.4);
        if (w > .01) { fx += (ddx / d) * w * 120; fy += (ddy / d) * w * 120; fz += w * 40; }
      }
      const vx = vel[q3] += fx * dt, vy = vel[q3 + 1] += fy * dt, vz = vel[q3 + 2] += fz * dt;
      pos[q3] = px + vx * dt; pos[q3 + 1] = py + vy * dt; pos[q3 + 2] = pz + vz * dt;
      const rapidez = Math.sqrt(vx * vx + vy * vy + vz * vz);
      energia[q] += (Math.min(1, rapidez * .16) - energia[q]) * .25;
    }
    primera = false;
    for (const nombre of ['position', 'aEnergia', 'aAcento', 'aPresencia']) geo.attributes[nombre].needsUpdate = true;
    renderizador.render(escena, camara);
    cuadro = quieto ? 0 : requestAnimationFrame(paso);
  }

  const arrancar = () => { if (!cuadro && !document.hidden) { previo = 0; cuadro = requestAnimationFrame(paso); } };
  const parar = () => { cancelAnimationFrame(cuadro); cuadro = 0; };
  document.addEventListener('visibilitychange', () => (document.hidden ? parar() : arrancar()));
  // Con movimiento reducido no hay bucle: se pinta al desplazar
  addEventListener('scroll', () => { if (reducido.matches) requestAnimationFrame(paso); }, { passive: true });
  reducido.addEventListener('change', () => { parar(); arrancar(); });
  arrancar();
  document.documentElement.dataset.materia = 'lista';
  setTimeout(() => { if (!reducido.matches) latir(vw * (movil ? .5 : .72), vh * (movil ? .3 : .5)); }, 900);

  window.qbMateria = { N, est, get escena() { return escenas[activa]?.forma.nombre; } };
}

iniciar();
