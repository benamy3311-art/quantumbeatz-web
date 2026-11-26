/* Comportamiento de la página: entradas al aparecer (una vez), el pulso del trayecto,
   y el cierre: el formulario ensambla el ventilador a medida que se llena y abre WhatsApp. */
(() => {
  'use strict';
  const WHATSAPP = '573150578569';
  const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Entrada escalonada: cada bloque una sola vez ──
  const entradas = new IntersectionObserver(registros => {
    registros.filter(r => r.isIntersecting).forEach((r, i) => {
      r.target.style.setProperty('--retardo', Math.min(i, 7) * 40 + 'ms');
      r.target.dataset.visto = '';
      entradas.unobserve(r.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-aparece]').forEach(el => entradas.observe(el));

  // ── Trayecto: un pulso recorre la línea y enciende cada punto al pasar ──
  const trayecto = document.querySelector('.trayecto');
  if (trayecto) {
    const pasos = [...trayecto.querySelectorAll('.trayecto__paso')];
    new IntersectionObserver(([en], obs) => {
      if (!en.isIntersecting) return;
      obs.disconnect();
      const ultimo = pasos.at(-1).querySelector('.trayecto__nodo').getBoundingClientRect();
      const primero = pasos[0].querySelector('.trayecto__nodo').getBoundingClientRect();
      trayecto.style.setProperty('--hasta-x', (ultimo.left - primero.left) + 'px');
      trayecto.style.setProperty('--hasta-y', (ultimo.top - primero.top) + 'px');
      if (reducido()) { pasos.forEach(p => (p.dataset.encendido = '')); return; }
      trayecto.dataset.pulso = '';
      pasos.forEach((p, i) => setTimeout(() => (p.dataset.encendido = ''), 80 + i * 1400 / (pasos.length - 1)));
    }, { threshold: .6 }).observe(trayecto);
  }

  // ── Filas que cambian la forma: señalar, tocar o enfocar una fila redibuja la materia ──
  // Mientras nadie toca, la sección se recorre sola una vez por fila para enseñar que se puede.
  document.querySelectorAll('[data-selector]').forEach(seccion => {
    const filas = [...seccion.querySelectorAll('.fila')];
    let k = 0, tocado = false, reloj = 0, visible = false;
    const elegir = (n, porPersona) => {
      k = n;
      filas.forEach((f, i) => f.setAttribute('aria-pressed', String(i === k)));
      seccion.dataset.forma = filas[k].dataset.opcion;
      seccion.dataset.lectura = filas[k].dataset.lectura;
      if (porPersona && window.tacto) tacto.sentir('seleccion');
    };
    const conCursor = matchMedia('(hover: hover) and (pointer: fine)');
    filas.forEach((f, i) => {
      f.addEventListener('click', () => { tocado = true; elegir(i, true); });
      f.addEventListener('focus', () => { tocado = true; elegir(i, false); });
      f.addEventListener('pointerenter', () => { if (conCursor.matches) { tocado = true; if (i !== k) elegir(i, false); } });
    });
    const avanzar = () => {
      clearTimeout(reloj);
      if (tocado || !visible || reducido()) return;
      reloj = setTimeout(() => { if (!tocado && visible) { elegir((k + 1) % filas.length, false); avanzar(); } }, 3600);
    };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; avanzar(); }, { threshold: .55 }).observe(seccion);
  });

  // ── Reseñas: una voz a la vez; flechas, teclado y deslizar ──
  const voces = document.querySelector('.voces');
  if (voces) {
    const todas = [...voces.querySelectorAll('.voz')];
    const actual = voces.querySelector('.voces__actual');
    let k = 0;
    const ir = n => {
      k = (n + todas.length) % todas.length;
      todas.forEach((v, i) => { v.toggleAttribute('data-activa', i === k); v.setAttribute('aria-hidden', i === k ? 'false' : 'true'); });
      const txt = String(k + 1).padStart(2, '0');
      if (window.tacto) { tacto.cifra(actual, txt); tacto.sentir('seleccion'); } else actual.textContent = txt;
    };
    voces.querySelector('.voces__atras').addEventListener('click', () => ir(k - 1));
    voces.querySelector('.voces__adelante').addEventListener('click', () => ir(k + 1));
    voces.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') ir(k - 1);
      if (e.key === 'ArrowRight') ir(k + 1);
    });
    let x0 = null;
    const escenario = voces.querySelector('.voces__escenario');
    escenario.addEventListener('pointerdown', e => { x0 = e.clientX; });
    escenario.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) ir(k + (dx < 0 ? 1 : -1));
    });
    escenario.style.touchAction = 'pan-y';
  }

  // ── Cierre ──
  const form = document.getElementById('pedido');
  if (!form) return;
  const boton = form.querySelector('.boton--enviar');
  const cifra = document.querySelector('.ensamblado__cifra');
  const ancla = document.querySelector('.cierre__ancla');
  let volver, tocoTipo = false, ultimo = -1;

  // En móvil, mientras el formulario se ve, su botón es la acción y la barra inferior se aparta
  const barra = document.querySelector('.acciones-movil');
  const movil = matchMedia('(max-width: 879px)');
  new IntersectionObserver(([en]) => {
    const tapa = en.isIntersecting && movil.matches;
    document.body.toggleAttribute('data-formulario-visible', tapa);
    if (barra) barra.inert = tapa;
  }, { threshold: .2 }).observe(form);

  // Cuánto se ha armado el equipo: cada respuesta suma partículas al ventilador
  function progreso() {
    const d = new FormData(form);
    let p = .35; // desde el principio se reconoce el ventilador; cada respuesta lo completa
    if (tocoTipo) p += .1;
    if (d.getAll('nota').length) p += .25;
    if ((d.get('componentes') || '').trim()) p += .1;
    if ((d.get('barrio') || '').trim().length > 2) p += .2;
    return Math.min(1, p);
  }
  function avisar(valor) {
    document.dispatchEvent(new CustomEvent('qb:progreso', { detail: valor }));
    const pct = Math.round(valor * 100);
    if (pct === ultimo || !cifra) return;
    ultimo = pct;
    if (window.tacto) tacto.cifra(cifra, String(pct)); else cifra.textContent = pct;
  }
  form.addEventListener('change', e => { if (e.target.name === 'equipo') tocoTipo = true; avisar(progreso()); });
  form.addEventListener('input', () => avisar(progreso()));
  avisar(progreso());

  function mensaje() {
    const d = new FormData(form);
    const notas = d.getAll('nota');
    const componentes = (d.get('componentes') || '').trim();
    const barrio = (d.get('barrio') || '').trim();
    const lineas = ['Hola Quantum Beatz, quiero agendar un mantenimiento.', '', `Equipo: ${d.get('equipo')}`];
    if (notas.length) lineas.push(`Lo que noto: ${notas.join(', ')}`);
    if (componentes) lineas.push(`Componentes: ${componentes}`);
    if (barrio) lineas.push(`Barrio: ${barrio}`);
    return lineas.join('\n');
  }

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje())}`;
    form.dataset.ultimoEnlace = url;
    // La acción clave: el equipo queda armado al 100 %, late y arranca; el botón confirma
    avisar(1);
    const r = (ancla || boton).getBoundingClientRect();
    document.dispatchEvent(new CustomEvent('qb:latido', { detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }));
    if (window.tacto) { tacto.cara(boton, 1); tacto.sentir('exito'); }
    if (!form.dataset.sinAbrir) window.open(url, '_blank', 'noopener');
    clearTimeout(volver);
    volver = setTimeout(() => window.tacto && tacto.cara(boton, 0), 2600);
  });
})();
