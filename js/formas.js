/* Las formas que toma la materia. Cada forma reparte las mismas N partículas:
   las primeras `n` dibujan el objeto; el resto queda como polvo en el fondo.
   Coordenadas locales: el objeto cabe en unas 2,6 unidades (tam). */

function azar(semilla) {
  return () => {
    semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lienzo(N) {
  return {
    p: new Float32Array(N * 3), a: new Float32Array(N), g: new Uint8Array(N), k: 0, N,
    add(x, y, z, acc = 0, grupo = 0) {
      if (this.k >= this.N) return -1;
      const i = this.k++;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.a[i] = acc; this.g[i] = grupo;
      return i;
    },
  };
}

const TAU = Math.PI * 2;

// Rota en z los puntos de los grupos indicados, alrededor de (cx, cy)
function girar(local, out, indices, angulo, cx = 0, cy = 0) {
  const c = Math.cos(angulo), s = Math.sin(angulo);
  for (let q = 0; q < indices.length; q++) {
    const i = indices[q] * 3, x = local[i] - cx, y = local[i + 1] - cy;
    out[i] = cx + x * c - y * s;
    out[i + 1] = cy + x * s + y * c;
  }
}

/* ── Ventilador (y su despiece) ─────────────────────────────────────────── */
// grupos: 0 frente del marco, 1 cuerpo del marco, 2 cara trasera, 3 motor y brazos, 4 aspas, 5 buje
function ventilador(N, d, r) {
  const L = lienzo(N);
  const S = 1.2, RE = .2, HUECO = 1.1, Z = .22;
  const n = k => Math.max(6, Math.round(k * d));
  const dentro = (x, y) => {
    const qx = Math.abs(x) - (S - RE), qy = Math.abs(y) - (S - RE);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= RE;
  };
  const tornillo = (x, y) => Math.hypot(Math.abs(x) - 1, Math.abs(y) - 1) < .075;
  const perimetro = () => {
    const recto = 2 * (S - RE), arco = Math.PI * RE / 2, total = 4 * (recto + arco);
    let s = r() * total;
    for (let lado = 0; lado < 4; lado++) {
      const gi = lado * Math.PI / 2, c = Math.cos(gi), sn = Math.sin(gi);
      let x, y;
      if (s < recto) { x = S; y = -(S - RE) + s; }
      else if (s < recto + arco) { const a = (s - recto) / RE; x = S - RE + Math.cos(a) * RE; y = S - RE + Math.sin(a) * RE; }
      else { s -= recto + arco; continue; }
      return [x * c - y * sn, x * sn + y * c];
    }
    return [S, 0];
  };
  // Aspas y buje primero: así, al pasar a formas más pequeñas, lo que se queda es lo que gira
  const R1 = .38, R2 = 1.05;
  for (let b = 0; b < 7; b++) {
    const a0 = b * TAU / 7;
    for (let i = n(420); i--;) {
      const u = r(), borde = r() < .32;
      const v = borde ? (r() < .5 ? 0 : 1) + (r() - .5) * .03 : r();
      const t = Math.sqrt(R1 * R1 + u * (R2 * R2 - R1 * R1)), un = (t - R1) / (R2 - R1);
      const a = a0 + un * .72 + (v - .5) * (.5 + .24 * un);
      L.add(Math.cos(a) * t, Math.sin(a) * t, (v - .5) * .3 * (1 - .35 * un), 0, 4);
    }
  }
  for (let i = n(300); i--;) { const a = r() * TAU, t = Math.sqrt(r()) * .34; L.add(Math.cos(a) * t, Math.sin(a) * t, .1, 0, 5); }
  for (let i = n(170); i--;) { const a = r() * TAU; L.add(Math.cos(a) * .36, Math.sin(a) * .36, -.12 + r() * .22, 0, 5); }
  for (let i = n(120); i--;) { const a = r() * TAU; L.add(Math.cos(a) * .24, Math.sin(a) * .24, .1, 1, 5); }
  for (const z of [Z, -Z]) {
    const g = z > 0 ? 0 : 2;
    for (let k = n(z > 0 ? 1700 : 1000); k > 0;) {
      const x = (r() * 2 - 1) * S, y = (r() * 2 - 1) * S;
      if (!dentro(x, y) || Math.hypot(x, y) < HUECO || tornillo(x, y)) continue;
      L.add(x, y, z, 0, g); k--;
    }
    for (let i = n(340); i--;) { const [x, y] = perimetro(); L.add(x, y, z, 0, g); }
    for (let i = n(300); i--;) { const a = r() * TAU; L.add(Math.cos(a) * HUECO, Math.sin(a) * HUECO, z, 0, g); }
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (let i = n(26); i--;) { const a = r() * TAU; L.add(sx + Math.cos(a) * .075, sy + Math.sin(a) * .075, z, 0, g); }
  }
  for (let i = n(520); i--;) { const [x, y] = perimetro(); L.add(x, y, (r() * 2 - 1) * Z, 0, 1); }
  for (let i = n(760); i--;) { const a = r() * TAU; L.add(Math.cos(a) * HUECO, Math.sin(a) * HUECO, (r() * 2 - 1) * Z, 0, 1); }
  for (let b = 0; b < 4; b++) {
    const a = Math.PI / 4 + b * Math.PI / 2;
    for (let i = n(130); i--;) { const t = .36 + r() * (HUECO - .36), l = (r() - .5) * .07; L.add(Math.cos(a) * t - Math.sin(a) * l, Math.sin(a) * t + Math.cos(a) * l, -Z + .02, 0, 3); }
  }
  for (let i = n(220); i--;) { const a = r() * TAU, t = Math.sqrt(r()) * .36; L.add(Math.cos(a) * t, Math.sin(a) * t, -Z + .02, 0, 3); }
  return L;
}

/* ── Baño de ultrasonido ────────────────────────────────────────────────── */
function ultrasonido(N, d, r) {
  const L = lienzo(N), n = k => Math.round(k * d);
  const radio = new Float32Array(N), ang = new Float32Array(N), semilla = new Float32Array(N), tipo = new Uint8Array(N);
  const poner = (x, y, z, acc, t, rr, aa, s) => { const i = L.add(x, y, z, acc); if (i < 0) return; radio[i] = rr; ang[i] = aa; semilla[i] = s; tipo[i] = t; };
  for (let i = n(5200); i--;) { const rr = Math.sqrt(r()) * 1.3, aa = r() * TAU; poner(Math.cos(aa) * rr, Math.sin(aa) * rr, 0, 0, 0, rr, aa, r()); }
  for (let i = n(1100); i--;) { const aa = r() * TAU; poner(Math.cos(aa) * 1.32, Math.sin(aa) * 1.32, -.55 + r() * .6, 0, 1, 1.32, aa, r()); }
  for (let i = n(1100); i--;) { const rr = Math.sqrt(r()) * 1.05, aa = r() * TAU; poner(Math.cos(aa) * rr, Math.sin(aa) * rr, 0, .55, 2, rr, aa, r()); }
  const quietos = L.p.slice();
  return {
    L, tam: 2.8, pose: { x: -1.02, y: 0, z: .1 },
    anima(t, est, out, acc) {
      out.set(quietos.subarray(0, L.k * 3));
      for (let i = 0; i < L.k; i++) {
        const j = i * 3;
        if (tipo[i] === 0) out[j + 2] = .085 * Math.sin(radio[i] * 11 - t * 5.2) * (1.15 - radio[i] / 1.5);
        else if (tipo[i] === 2) { // el polvo que se suelta y sube
          const f = (t * .32 + semilla[i]) % 1;
          out[j] += Math.sin(t * 2 + semilla[i] * 9) * .03 * f;
          out[j + 2] = f * 1.5;
          acc[i] = .55 * (1 - f);
        }
      }
      return true;
    },
  };
}

/* ── Placa base ─────────────────────────────────────────────────────────── */
function placa(N, d, r) {
  const L = lienzo(N), n = k => Math.max(4, Math.round(k * d));
  const linea = (x1, y1, x2, y2, k, z = 0, acc = 0) => { for (let i = n(k); i--;) { const t = r(); L.add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z, acc); } };
  const rect = (x, y, w, h, k, z = 0, acc = 0) => { const p = 2 * (w + h); linea(x, y, x + w, y, k * w / p, z, acc); linea(x + w, y, x + w, y + h, k * h / p, z, acc); linea(x + w, y + h, x, y + h, k * w / p, z, acc); linea(x, y + h, x, y, k * h / p, z, acc); };
  const relleno = (x, y, w, h, k, z = 0, acc = 0) => { for (let i = n(k); i--;) L.add(x + r() * w, y + r() * h, z, acc); };
  const W = 2.6, H = 2.1, x0 = -W / 2, y0 = -H / 2;
  rect(x0, y0, W, H, 700);
  for (const [hx, hy] of [[-1.15, .9], [1.15, .9], [-1.15, -.9], [1.15, -.9], [0, .9], [0, -.9]]) for (let i = n(24); i--;) { const a = r() * TAU; L.add(hx + Math.cos(a) * .045, hy + Math.sin(a) * .045, 0); }
  // Zócalo del procesador
  rect(-.75, .02, .66, .66, 360, .06); rect(-.68, .09, .52, .52, 260, .06);
  for (let gx = 0; gx < 13; gx++) for (let gy = 0; gy < 13; gy++) if (r() < .85 * d + .1) L.add(-.66 + gx * .04, .11 + gy * .04, .06, .15);
  // Ranuras de memoria
  for (let s = 0; s < 4; s++) { const x = .18 + s * .1; rect(x, -.05, .045, .9, 260, .05); linea(x + .022, -.03, x + .022, .83, 70, .1); }
  // VRM
  for (let v = 0; v < 6; v++) relleno(-.95 + v * .1, .8, .06, .06, 22, .05);
  // Ranuras PCIe
  rect(-1.05, -.42, 1.55, .07, 300, .05, .25); rect(-1.05, -.7, 1.55, .05, 220, .05);
  // Chipset y batería
  rect(.62, -.72, .34, .34, 160, .04); relleno(.66, -.68, .26, .26, 90, .04);
  for (let i = n(90); i--;) { const a = r() * TAU; L.add(.85 + Math.cos(a) * .1, -.15 + Math.sin(a) * .1, .03); }
  // Puerto trasero
  for (let p = 0; p < 4; p++) rect(-1.27, .2 + p * .17, .14, .12, 50, .05);
  // Pistas: caminos en ángulo recto que salen del zócalo
  const origen = () => { const lado = Math.floor(r() * 4), t = r() * .66; return lado === 0 ? [-.75 + t, .02] : lado === 1 ? [-.09, .02 + t] : lado === 2 ? [-.75 + t, .68] : [-.75, .02 + t]; };
  for (let c = 0; c < Math.round(46 * Math.min(1, d + .3)); c++) {
    let [x, y] = origen();
    const tx = x0 + .15 + r() * (W - .3), ty = y0 + .15 + r() * (H - .3);
    const primeroX = r() < .5, quiebre = primeroX ? x + (tx - x) * (.3 + r() * .5) : y + (ty - y) * (.3 + r() * .5);
    const tramos = primeroX ? [[x, y, quiebre, y], [quiebre, y, quiebre, ty], [quiebre, ty, tx, ty]] : [[x, y, x, quiebre], [x, quiebre, tx, quiebre], [tx, quiebre, tx, ty]];
    for (const [a, b, cx, cy] of tramos) linea(a, b, cx, cy, Math.hypot(cx - a, cy - b) * 70, .01, r() < .12 ? .7 : 0);
  }
  return { L, tam: 2.9, pose: { x: .62, y: -.32, z: .06 } };
}

/* ── Procesador con pasta térmica ───────────────────────────────────────── */
function pasta(N, d, r) {
  const L = lienzo(N), n = k => Math.max(4, Math.round(k * d));
  const linea = (x1, y1, x2, y2, k, z) => { for (let i = n(k); i--;) { const t = r(); L.add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z); } };
  const borde = (s, k, z) => { linea(-s, -s, s, -s, k, z); linea(s, -s, s, s, k, z); linea(s, s, -s, s, k, z); linea(-s, s, -s, -s, k, z); };
  // Pasta: una X y un punto central, lo primero de la lista para que nunca falte
  const esPasta = [];
  for (let i = n(1500); i--;) {
    let x, y;
    if (r() < .38) { const a = r() * TAU, t = Math.sqrt(r()) * .17; x = Math.cos(a) * t; y = Math.sin(a) * t; }
    else { const brazo = r() < .5 ? 1 : -1, t = (r() * 2 - 1) * .56, w = (r() - .5) * .07; x = t + w * .7; y = brazo * t - w * .7 * brazo; }
    const k = L.add(x, y, .2 + r() * .03, .35); if (k >= 0) esPasta.push(k);
  }
  // Disipador integrado (IHS) con muesca
  borde(.72, 520, .13); borde(.68, 380, .13);
  for (let i = n(1500); i--;) L.add((r() * 2 - 1) * .7, (r() * 2 - 1) * .7, .13);
  // Sustrato y contactos
  borde(1.02, 520, 0);
  for (let i = n(900); i--;) { const x = (r() * 2 - 1), y = (r() * 2 - 1); if (Math.max(Math.abs(x), Math.abs(y)) > .76) L.add(x, y, 0); }
  for (let i = n(260); i--;) { const a = r() * TAU; L.add(-.86 + Math.cos(a) * .05, .86 + Math.sin(a) * .05, .01, .8); }
  const idx = Uint32Array.from(esPasta), quietos = L.p.slice();
  return {
    L, tam: 2.4, pose: { x: .92, y: -.38, z: .22 },
    anima(t, est, out) {
      out.set(quietos.subarray(0, L.k * 3));
      const s = .9 + .14 * Math.sin(t * 1.3); // la pasta respira como si el disipador la apretara
      for (let q = 0; q < idx.length; q++) { const j = idx[q] * 3; out[j] = quietos[j] * s; out[j + 1] = quietos[j + 1] * s; }
      return false;
    },
  };
}

/* ── Latido: el trazo de diagnóstico ────────────────────────────────────── */
function latido(N, d, r) {
  const L = lienzo(N), n = k => Math.round(k * d);
  const u = new Float32Array(N), grosor = new Float32Array(N), esTrazo = new Uint8Array(N);
  for (let i = n(3600); i--;) { const k = L.add(0, 0, 0); if (k < 0) break; u[k] = r() * 3.2 - 1.6; grosor[k] = (r() - .5) * .022; esTrazo[k] = 1; }
  for (let gx = -16; gx <= 16; gx++) for (let gy = -4; gy <= 4; gy++) { const k = L.add(gx * .1, gy * .2, -.25); if (k >= 0) esTrazo[k] = 0; }
  for (let gx = -8; gx <= 8; gx++) for (let i = n(60); i--;) { const k = L.add(gx * .2, (r() * 2 - 1) * .8, -.25); if (k >= 0) esTrazo[k] = 0; }
  const g = (s, c, a, w) => a * Math.exp(-(((s - c) / w) ** 2));
  // Picos anchos: las partículas tienen masa y un pico demasiado fino pasa antes de que lleguen
  const forma = s => g(s, .14, .1, .04) + g(s, .27, -.12, .022) + g(s, .31, .8, .03) + g(s, .35, -.22, .022) + g(s, .54, .18, .055);
  const quietos = L.p.slice();
  return {
    L, tam: 3.3, pose: { x: .08, y: -.22, z: 0 },
    anima(t, est, out, acc) {
      out.set(quietos.subarray(0, L.k * 3));
      const fase = t * .32;
      for (let i = 0; i < L.k; i++) {
        if (!esTrazo[i]) { acc[i] = 0; continue; }
        const s = (((u[i] + 1.6) / 1.6 - fase) % 1 + 1) % 1, y = forma(s);
        out[i * 3] = u[i]; out[i * 3 + 1] = y + grosor[i]; out[i * 3 + 2] = 0;
        acc[i] = Math.min(1, Math.abs(y) * 2.2);
      }
      return true;
    },
  };
}

/* ── Átomo ──────────────────────────────────────────────────────────────── */
function atomo(N, d, r) {
  const L = lienzo(N), n = k => Math.round(k * d);
  const orbita = new Int8Array(N), fase = new Float32Array(N), desvio = new Float32Array(N);
  for (let i = n(1100); i--;) { const a = r() * TAU, b = Math.acos(2 * r() - 1), t = Math.cbrt(r()) * .28; const k = L.add(t * Math.sin(b) * Math.cos(a), t * Math.sin(b) * Math.sin(a), t * Math.cos(b), .7); if (k >= 0) orbita[k] = -1; }
  for (let o = 0; o < 3; o++) for (let i = n(950); i--;) { const k = L.add(0, 0, 0); if (k < 0) break; orbita[k] = o; fase[k] = r() * TAU; desvio[k] = (r() - .5) * .03; }
  for (let o = 0; o < 3; o++) for (let i = 0; i < Math.max(14, n(36)); i++) { const k = L.add(0, 0, 0, 1); if (k < 0) break; orbita[k] = 3 + o; fase[k] = (r() - .5) * .16; desvio[k] = (r() - .5) * .05; }
  const giros = [0, Math.PI / 3, 2 * Math.PI / 3].map(g => [Math.cos(g), Math.sin(g)]);
  const quietos = L.p.slice();
  return {
    L, tam: 2.8, pose: { x: .5, y: -.35, z: 0 },
    anima(t, est, out) {
      for (let i = 0; i < L.k; i++) {
        const j = i * 3, o = orbita[i];
        if (o < 0) { // el núcleo vibra apenas
          const v = .012 * Math.sin(t * 7 + i);
          out[j] = quietos[j] * (1 + v); out[j + 1] = quietos[j + 1] * (1 + v); out[j + 2] = quietos[j + 2] * (1 + v);
          continue;
        }
        const k = o % 3, a = o < 3 ? fase[i] + t * .22 : fase[i] + t * 1.5 + k * 2.1;
        const ex = Math.cos(a) * (1.25 + desvio[i]), ey = Math.sin(a) * (.42 + desvio[i]);
        const [c, s] = giros[k];
        out[j] = ex * c - ey * s; out[j + 1] = ex * s + ey * c; out[j + 2] = ey * .9 * (k === 1 ? -1 : 1) * .6;
      }
      return false;
    },
  };
}

/* ── "5.0" escrito con partículas ───────────────────────────────────────── */
function cinco(N, d, r) {
  const L = lienzo(N), n = Math.round(5600 * d);
  const c = document.createElement('canvas'), W = 900, H = 420;
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff';
  x.font = '600 380px Geist, system-ui, sans-serif';
  x.textBaseline = 'alphabetic';
  const anchoCinco = x.measureText('5').width, anchoPunto = x.measureText('.').width, total = x.measureText('5.0').width;
  const x0 = (W - total) / 2;
  x.fillText('5.0', x0, H * .86);
  const datos = x.getImageData(0, 0, W, H).data, pixeles = [];
  for (let py = 0; py < H; py += 2) for (let px = 0; px < W; px += 2) if (datos[(py * W + px) * 4 + 3] > 140) pixeles.push(px, py);
  const escala = 2.6 / total;
  for (let i = 0; i < n && pixeles.length; i++) {
    const q = Math.floor(r() * (pixeles.length / 2)) * 2, px = pixeles[q] + r() * 2, py = pixeles[q + 1] + r() * 2;
    const esPunto = px > x0 + anchoCinco && px < x0 + anchoCinco + anchoPunto;
    L.add((px - W / 2) * escala, -(py - H * .52) * escala, (r() - .5) * .08, esPunto ? 1 : 0);
  }
  return { L, tam: 2.1, pose: { x: .05, y: -.18, z: 0 } };
}

/* ── Tarjeta gráfica de doble ventilador ────────────────────────────────── */
function grafica(N, d, r) {
  const L = lienzo(N), n = k => Math.max(4, Math.round(k * d));
  const linea = (x1, y1, x2, y2, k, z = 0, acc = 0, g = 0) => { for (let i = n(k); i--;) { const t = r(); L.add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z, acc, g); } };
  const W = 1.4, H = .52;
  const ventiladores = [-.66, .66];
  // Aspas primero (giran)
  ventiladores.forEach((cx, f) => {
    for (let b = 0; b < 9; b++) {
      const a0 = b * TAU / 9;
      for (let i = n(110); i--;) { const u = r(), t = .1 + u * .3, a = a0 + u * .6 + (r() - .5) * .22; L.add(cx + Math.cos(a) * t, Math.sin(a) * t, .1, 0, 1 + f); }
    }
    for (let i = n(110); i--;) { const a = r() * TAU, t = Math.sqrt(r()) * .09; L.add(cx + Math.cos(a) * t, Math.sin(a) * t, .11, .3, 1 + f); }
  });
  // Carcasa con chaflanes
  const contorno = [[-W, -H + .1], [-W + .1, -H], [W - .1, -H], [W, -H + .1], [W, H - .1], [W - .1, H], [-W + .1, H], [-W, H - .1], [-W, -H + .1]];
  for (let k = 0; k < contorno.length - 1; k++) { const [a, b] = contorno[k], [c, e] = contorno[k + 1]; linea(a, b, c, e, Math.hypot(c - a, e - b) * 260, .1); linea(a, b, c, e, Math.hypot(c - a, e - b) * 120, -.12); }
  ventiladores.forEach(cx => { for (let i = n(300); i--;) { const a = r() * TAU; L.add(cx + Math.cos(a) * .44, Math.sin(a) * .44, .1); } });
  // Aletas del disipador, detrás
  for (let f = 0; f < 46; f++) linea(-W + .06 + f * .061, -H + .06, -W + .06 + f * .061, H - .06, 26, -.04);
  // Conector PCIe dorado (el único color)
  for (let p = 0; p < 34; p++) linea(-.55 + p * .042, -H - .02, -.55 + p * .042, -H - .1, 7, 0, .85);
  // Conector de corriente
  linea(.95, H, 1.2, H, 40, .02); linea(.95, H + .07, 1.2, H + .07, 40, .02);
  const grupos = [[], []];
  for (let i = 0; i < L.k; i++) if (L.g[i] === 1 || L.g[i] === 2) grupos[L.g[i] - 1].push(i);
  const idx = grupos.map(g => Uint32Array.from(g)), quietos = L.p.slice();
  return {
    L, tam: 2.9, pose: { x: .42, y: -.58, z: .05 },
    anima(t, est, out) {
      out.set(quietos.subarray(0, L.k * 3));
      girar(quietos, out, idx[0], -est.angulo * 1.4, ventiladores[0], 0);
      girar(quietos, out, idx[1], -est.angulo * 1.4, ventiladores[1], 0);
      return false;
    },
  };
}

/* ── Caos: el estado en que llega un PC (polvo, calor, desorden) ────────── */
function caos(N, d, r, agitacion) {
  const L = lienzo(N), n = Math.round(N * .82);
  const semilla = new Float32Array(N);
  const grumos = Array.from({ length: 14 }, () => [(r() - .5) * 3, (r() - .5) * 2.1, (r() - .5) * 1.2]);
  for (let i = 0; i < n; i++) {
    let x, y, z;
    if (r() < .4) { const [gx, gy, gz] = grumos[Math.floor(r() * grumos.length)], a = r() * TAU, b = Math.acos(2 * r() - 1), t = Math.cbrt(r()) * .24; x = gx + t * Math.sin(b) * Math.cos(a); y = gy + t * Math.sin(b) * Math.sin(a); z = gz + t * Math.cos(b); }
    else { x = (r() - .5) * 3.4; y = (r() - .5) * 2.3; z = (r() - .5) * 1.8; }
    const s = r();
    // Con más agitación, más partículas calientes (ámbar)
    L.add(x, y, z, s < agitacion * .55 ? -Math.min(1, .4 + agitacion * .6) : 0);
    semilla[i] = s;
  }
  const quietos = L.p.slice();
  return {
    L, tam: 3.1, pose: { x: .1, y: -.2, z: 0 },
    anima(t, est, out) {
      // Vaivén corto, no un giro completo: de canto la nube se vería como una franja plana
      const a = .02 + agitacion * .07, deriva = Math.sin(t * .12) * .35;
      const c = Math.cos(deriva), s = Math.sin(deriva);
      for (let i = 0; i < L.k; i++) {
        const j = i * 3, e = semilla[i] * 40, f = 3 + semilla[i] * 5 + agitacion * 6;
        const x = quietos[j], z = quietos[j + 2];
        out[j] = x * c - z * s + Math.sin(t * f + e) * a;
        out[j + 1] = quietos[j + 1] + Math.cos(t * f * .9 + e * 1.3) * a;
        out[j + 2] = x * s + z * c + Math.sin(t * f * 1.1 + e * .7) * a;
      }
      return false;
    },
  };
}

/* ── Componentes sueltos: memoria RAM, SSD M.2 y fuente de poder ────────── */
function trazos(N, d, r) {
  const L = lienzo(N), n = k => Math.max(4, Math.round(k * d));
  const linea = (x1, y1, x2, y2, k, z = 0, acc = 0) => { for (let i = n(k); i--;) { const t = r(); L.add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z, acc); } };
  const rect = (x, y, w, h, k, z = 0, acc = 0) => { const p = 2 * (w + h); linea(x, y, x + w, y, k * w / p, z, acc); linea(x + w, y, x + w, y + h, k * h / p, z, acc); linea(x + w, y + h, x, y + h, k * w / p, z, acc); linea(x, y + h, x, y, k * h / p, z, acc); };
  const relleno = (x, y, w, h, k, z = 0, acc = 0) => { for (let i = n(k); i--;) L.add(x + r() * w, y + r() * h, z, acc); };
  const circulo = (cx, cy, rad, k, z = 0, acc = 0) => { for (let i = n(k); i--;) { const a = r() * TAU; L.add(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, z, acc); } };
  return { L, linea, rect, relleno, circulo };
}

function ram(N, d, r) {
  const { L, linea, rect, relleno } = trazos(N, d, r);
  rect(-1.35, -.32, 2.7, .64, 900); rect(-1.35, -.32, 2.7, .64, 500, -.06);
  for (let c = 0; c < 8; c++) { const x = -1.2 + c * .3; rect(x, -.16, .22, .3, 160, .05); relleno(x + .02, -.14, .18, .26, 70, .05); }
  for (let p = 0; p < 60; p++) linea(-1.25 + p * .042, -.32, -1.25 + p * .042, -.4, 6, 0, .85);
  rect(-.08, -.42, .06, .12, 30); // muesca
  linea(-1.3, .26, 1.3, .26, 180, .02);
  return { L, tam: 2.8, pose: { x: .5, y: -.55, z: .12 } };
}

function ssd(N, d, r) {
  const { L, linea, rect, relleno, circulo } = trazos(N, d, r);
  rect(-1.3, -.22, 2.6, .44, 800); rect(-1.3, -.22, 2.6, .44, 400, -.04);
  rect(-.7, -.15, .55, .3, 260, .05); relleno(-.68, -.13, .51, .26, 220, .05, .1);
  rect(-.05, -.15, .55, .3, 260, .05); relleno(-.03, -.13, .51, .26, 180, .05);
  rect(.62, -.12, .3, .24, 140, .05);
  for (let p = 0; p < 26; p++) linea(-1.28 + p * .022, -.18, -1.28 + p * .022, .18, 5, 0, .85);
  circulo(1.22, 0, .06, 60);
  return { L, tam: 2.7, pose: { x: .55, y: -.5, z: .1 } };
}

function fuente(N, d, r) {
  const { L, linea, rect, circulo } = trazos(N, d, r);
  const W = 1.1, H = .8, Dz = .55;
  for (const z of [Dz, -Dz]) rect(-W, -H, 2 * W, 2 * H, 520, z);
  for (const [x, y] of [[-W, -H], [W, -H], [W, H], [-W, H]]) for (let i = 0; i < Math.max(8, Math.round(60 * d)); i++) L.add(x, y, -Dz + r() * 2 * Dz);
  // Rejilla del ventilador en la cara frontal
  for (let k = 1; k <= 6; k++) circulo(0, 0, k * .11, 60 + k * 30, Dz + .01);
  linea(-.66, 0, .66, 0, 90, Dz + .01); linea(0, -.66, 0, .66, 90, Dz + .01);
  // Salida de cables
  for (let c = 0; c < 4; c++) rect(-.9 + c * .18, -.7, .12, .1, 30, -Dz, .5);
  return { L, tam: 2.7, pose: { x: .35, y: -.65, z: .05 } };
}

/* ── Catálogo ───────────────────────────────────────────────────────────── */
export function crearFormas(N, d) {
  const r = azar(20261124);
  const formas = [];

  const v = ventilador(N, d, r);
  const giran = [];
  for (let i = 0; i < v.k; i++) if (v.g[i] >= 4) giran.push(i);
  const idxGiro = Uint32Array.from(giran), baseV = v.p;
  formas.push({
    nombre: 'ventilador', n: v.k, local: baseV, acento: v.a, tam: 2.7, pose: { x: .3, y: -.6, z: .06 }, rigidez: 26,
    anima(t, est, out) { out.set(baseV.subarray(0, v.k * 3)); girar(baseV, out, idxGiro, -est.angulo); return false; },
  });

  // Despiece: los mismos puntos del ventilador, separados en capas
  const capa = [1.15, .75, -.7, -1.3, .05, .05];
  const baseD = baseV.slice();
  for (let i = 0; i < v.k; i++) baseD[i * 3 + 2] += capa[v.g[i]];
  formas.push({
    nombre: 'despiece', n: v.k, local: baseD, acento: v.a, tam: 3.7, pose: { x: .28, y: -1.08, z: .04 }, rigidez: 20,
    anima(t, est, out) { out.set(baseD.subarray(0, v.k * 3)); girar(baseD, out, idxGiro, -est.angulo * .5); return false; },
  });

  const desde = (nombre, f, rigidez = 22) => formas.push({ nombre, n: f.L.k, local: f.L.p, acento: f.L.a, tam: f.tam, pose: f.pose, rigidez, anima: f.anima });
  desde('ultrasonido', ultrasonido(N, d, r));
  desde('placa', placa(N, d, r));
  desde('pasta', pasta(N, d, r));
  desde('latido', latido(N, d, r), 70);
  desde('atomo', atomo(N, d, r));
  desde('cinco', cinco(N, d, r));
  desde('grafica', grafica(N, d, r));
  desde('ram', ram(N, d, r));
  desde('ssd', ssd(N, d, r));
  desde('fuente', fuente(N, d, r));
  formas.push({ ...formas.find(f => f.nombre === 'pasta'), nombre: 'procesador' });
  desde('polvo-1', caos(N, d, r, .15), 8);
  desde('calor', caos(N, d, r, .6), 6);
  desde('lento', caos(N, d, r, 1), 5);
  // Ensamble: el ventilador que se arma mientras se llena el formulario (el motor decide cuántas partículas entran)
  formas.push({ ...formas[0], nombre: 'ensamble', rigidez: 18 });
  formas.push({ nombre: 'polvo', n: 0, local: new Float32Array(N * 3), acento: new Float32Array(N), tam: 1, pose: { x: 0, y: 0, z: 0 }, rigidez: 2 });
  return formas;
}
