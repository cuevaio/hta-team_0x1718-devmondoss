// Mule Zero · pitch: navegación y escenas animadas (SMIL en los SVG, CSS en el texto).
// La portada dibuja su red de fondo aquí; las demás escenas están en index.html.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const crear = (tag, attrs, padre) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(e);
    return e;
  };
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Portada: red de víctimas que alimentan una mula
  const red = document.getElementById('net');
  const mula = [1300, 450];
  const entradas = [[1000, 170], [1170, 110], [1460, 130], [1090, 360], [960, 560], [1180, 660], [1060, 800]];
  const salidas = [[1540, 330], [1500, 610], [1420, 810]];
  entradas.forEach(([x, y], i) => {
    const d = `M${x} ${y} L${mula[0]} ${mula[1]}`;
    crear('path', { d, stroke: '#24324a', 'stroke-width': 1.5, fill: 'none' }, red);
    crear('circle', { cx: x, cy: y, r: 7, fill: '#111a2b', stroke: '#7cc4e6', 'stroke-width': 2 }, red);
    const moneda = crear('circle', { r: 4, fill: '#e3b25a' }, red);
    crear('animateMotion', { path: d, dur: '2.6s', begin: `${i * 0.4}s`, repeatCount: 'indefinite' }, moneda);
  });
  salidas.forEach(([x, y], i) => {
    const d = `M${mula[0]} ${mula[1]} L${x} ${y}`;
    crear('path', { d, stroke: '#e5645e', 'stroke-width': 2, 'stroke-dasharray': '6 8', fill: 'none', opacity: 0.6 }, red);
    crear('circle', { cx: x, cy: y, r: 6, fill: '#111a2b', stroke: '#e5645e', 'stroke-width': 2 }, red);
    const moneda = crear('circle', { r: 4, fill: '#e5645e' }, red);
    crear('animateMotion', { path: d, dur: '1.3s', begin: `${1 + i * 0.45}s`, repeatCount: 'indefinite' }, moneda);
  });
  const onda = crear('circle', { cx: mula[0], cy: mula[1], r: 22, fill: 'none', stroke: '#e5645e', 'stroke-width': 2 }, red);
  crear('animate', { attributeName: 'r', values: '22;70', dur: '1.8s', repeatCount: 'indefinite' }, onda);
  crear('animate', { attributeName: 'opacity', values: '0.8;0', dur: '1.8s', repeatCount: 'indefinite' }, onda);
  crear('circle', { cx: mula[0], cy: mula[1], r: 22, fill: '#2a0f14', stroke: '#e5645e', 'stroke-width': 3 }, red);

  // El problema: 14 víctimas hacia una sola cuenta
  const victimas = document.getElementById('victimas');
  for (let i = 0; victimas && i < 14; i++) {
    const y = 70 + i * 34;
    const d = `M92 ${y} Q 280 ${y} 424 300`;
    const t = 0.5 + i * 0.22;
    crear('path', { d, stroke: '#24324a', 'stroke-width': 1.5, fill: 'none', opacity: 0.8 }, victimas);
    const v = crear('circle', { cx: 80, cy: y, r: 9, fill: '#111a2b', stroke: '#7cc4e6', 'stroke-width': 2 }, victimas);
    crear('set', { attributeName: 'stroke', to: '#e5645e', begin: `${t}s` }, v);
    const moneda = crear('circle', { r: 6, fill: '#e3b25a', opacity: 0 }, victimas);
    crear('animateMotion', { path: d, begin: `${t}s`, dur: '0.8s', fill: 'freeze' }, moneda);
    crear('animate', { attributeName: 'opacity', values: '0;1;1;0', keyTimes: '0;0.1;0.85;1', begin: `${t}s`, dur: '0.8s', fill: 'freeze' }, moneda);
  }

  // Navegación
  const deck = document.getElementById('deck');
  const stage = document.getElementById('stage');
  const slides = [...document.querySelectorAll('.slide')];
  const total = slides.length;
  const contador = document.getElementById('count');
  const barrido = document.getElementById('wipe');
  const progreso = document.getElementById('progress');
  const dos = (n) => String(n).padStart(2, '0');
  let actual = 0;
  let temporizadores = [];

  slides.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Ir a la diapositiva ${i + 1}`);
    b.addEventListener('click', () => ir(i));
    progreso.appendChild(b);
  });
  const segmentos = [...progreso.children];

  const escenas = (slide, correr) => {
    slide.querySelectorAll('svg[data-smil]').forEach((s) => {
      try {
        if (!correr) { s.pauseAnimations(); s.setCurrentTime(0); return; }
        if (sinMovimiento) { s.pauseAnimations(); s.setCurrentTime(60); return; }
        s.setCurrentTime(0);
        s.unpauseAnimations();
      } catch {
        // Sin SMIL: la escena queda en su estado inicial.
      }
    });
  };

  const formato = (el, n) => (el.dataset.pre || '') + Math.round(n).toLocaleString('en-US') + (el.dataset.suf || '');
  const contar = (slide) => {
    slide.querySelectorAll('[data-count]').forEach((el) => {
      const fin = Number(el.dataset.count);
      if (sinMovimiento) { el.textContent = formato(el, fin); return; }
      el.textContent = formato(el, 0);
      temporizadores.push(setTimeout(() => {
        const t0 = performance.now();
        const paso = (t) => {
          const p = Math.min(1, (t - t0) / 1400);
          el.textContent = formato(el, fin * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      }, Number(el.dataset.delay || 0) * 1000));
    });
  };

  const contadorVictimas = (slide) => {
    if (slide.id !== 's-problema') return;
    const c = document.getElementById('s2-count');
    if (sinMovimiento) { c.textContent = '14'; return; }
    c.textContent = '0';
    for (let i = 0; i < 14; i++) {
      temporizadores.push(setTimeout(() => { c.textContent = String(i + 1); }, (1.3 + i * 0.22) * 1000));
    }
  };

  function ir(n) {
    n = Math.max(0, Math.min(total - 1, n));
    temporizadores.forEach(clearTimeout);
    temporizadores = [];
    slides.forEach((s, i) => { if (i !== n) { s.classList.remove('is-active'); escenas(s, false); } });
    const s = slides[n];
    s.classList.remove('is-active');
    void s.offsetWidth; // reinicia las animaciones CSS
    s.classList.add('is-active');
    escenas(s, true);
    contar(s);
    contadorVictimas(s);
    actual = n;
    contador.textContent = `${dos(n + 1)} / ${dos(total)}`;
    segmentos.forEach((b, i) => { b.classList.toggle('done', i < n); b.setAttribute('aria-current', String(i === n)); });
    if (barrido && !sinMovimiento) { barrido.classList.remove('run'); void barrido.offsetWidth; barrido.classList.add('run'); }
    try { history.replaceState(null, '', `#${n + 1}`); } catch {
      // Sin historial (archivo local en algunos navegadores): no pasa nada.
    }
  }

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else deck.requestFullscreen?.()?.catch?.(() => {});
  };
  document.getElementById('full').addEventListener('click', pantallaCompleta);
  document.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); ir(actual + 1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); ir(actual - 1); }
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(total - 1);
    else if (e.key === 'f' || e.key === 'F') pantallaCompleta();
  });
  let x0 = null;
  stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 60) ir(actual + (dx < 0 ? 1 : -1));
  });

  slides.forEach((s) => escenas(s, false));
  const m = /^#(\d)$/.exec(location.hash);
  ir(m ? Number(m[1]) - 1 : 0);
})();
