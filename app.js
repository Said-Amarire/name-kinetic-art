(() => {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const triggerBtn = document.getElementById('triggerBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const closeBtn = document.getElementById('closeBtn');
  const nameForm = document.getElementById('nameForm');
  const nameInput = document.getElementById('nameInput');

  const GLYPHS = ['Ω', 'Δ', 'Ψ', 'Φ', 'Σ', 'λ', 'θ', 'π', '0', '1', '{ }', '</>', '//', '0x', '✦', '◈'];
  const MAX_CHARS = 24;

  const urlParams = new URLSearchParams(window.location.search);
  const paramName = urlParams.get('name');
  const initialWord = paramName 
    ? paramName.replace(/[^a-zA-Z\s_-]/g, '').replace(/_/g, ' ').slice(0, MAX_CHARS) 
    : 'AMARIRE';

  if (paramName) {
    document.title = initialWord;
  }

  const state = {
    word: initialWord,
    width: 0,
    height: 0,
    dpr: 1,
    intro: 0,
    time: 0,
    fontSize: 100,
    particles: [],
    nodes: [],
    glyphs: [],
    ripples: [],
    pointer: {
      x: -9999,
      y: -9999,
      active: false
    }
  };

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;

    canvas.width = state.width * state.dpr;
    canvas.height = state.height * state.dpr;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    buildScene();
    buildTypography(false);
  }

  function buildScene() {
    const { width, height } = state;
    const area = width * height;
    const nodeTotal = Math.min(Math.max(Math.floor(area / 22000), 22), 65);
    const glyphTotal = Math.min(Math.max(Math.floor(area / 38000), 14), 38);

    state.nodes = Array.from({ length: nodeTotal }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 1.4 + 0.8
    }));

    state.glyphs = Array.from({ length: glyphTotal }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      char: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      size: Math.floor(Math.random() * 5) + 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.25 - 0.08,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.006,
      phase: Math.random() * Math.PI * 2
    }));
  }

  function measureFontSize(measureCtx, text, maxWidth, maxHeight) {
    let fontSize = Math.min(maxWidth * 0.22, maxHeight * 0.28);
    measureCtx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
    const measuredWidth = measureCtx.measureText(text).width;
    const targetWidth = maxWidth * 0.86;

    if (measuredWidth > targetWidth) {
      fontSize *= targetWidth / measuredWidth;
    }

    return Math.max(fontSize, 20);
  }

  function buildTypography(resetIntro = true) {
    const { width, height, word } = state;
    const scale = 3;
    const buffer = document.createElement('canvas');
    const bCtx = buffer.getContext('2d');

    buffer.width = width * scale;
    buffer.height = height * scale;
    bCtx.scale(scale, scale);

    bCtx.fillStyle = '#000000';
    bCtx.fillRect(0, 0, width, height);

    const fontSize = measureFontSize(bCtx, word, width, height);
    state.fontSize = fontSize;

    bCtx.fillStyle = '#ffffff';
    bCtx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillText(word, width * 0.5, height * 0.5);

    const rawStep = fontSize / 36;
    const step = Math.min(Math.max(rawStep, 1.0), 5.6);
    const radius = Math.min(Math.max(step * 0.33, 0.36), 1.45);

    const bufW = buffer.width;
    const bufH = buffer.height;
    const pixels = bCtx.getImageData(0, 0, bufW, bufH).data;
    const maxSpread = Math.min(width, height) * 0.45;

    if (resetIntro) {
      state.intro = 0;
    }

    state.particles = [];

    for (let y = 0; y < height; y += step) {
      const py = Math.min(Math.round(y * scale), bufH - 1);
      for (let x = 0; x < width; x += step) {
        const px = Math.min(Math.round(x * scale), bufW - 1);
        if (pixels[(py * bufW + px) * 4] > 105) {
          const theta = Math.random() * Math.PI * 2;
          const dist = Math.random() * maxSpread + 60;
          const startX = width * 0.5 + Math.cos(theta) * dist;
          const startY = height * 0.5 + Math.sin(theta) * dist;

          state.particles.push({
            baseX: x,
            baseY: y,
            startX,
            startY,
            x: resetIntro ? startX : x,
            y: resetIntro ? startY : y,
            vx: 0,
            vy: 0,
            size: radius,
            tone: Math.random()
          });
        }
      }
    }
  }

  function spawnRipple(x, y) {
    state.ripples.push({
      x,
      y,
      radius: 4,
      maxRadius: Math.min(state.width, state.height) * 0.28,
      alpha: 0.25
    });
  }

  function openModal() {
    modalOverlay.classList.add('is-open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 80);
  }

  function closeModal() {
    modalOverlay.classList.remove('is-open');
    modalOverlay.setAttribute('aria-hidden', 'true');
  }

  function sanitizeInput(value) {
    return value.replace(/[^a-zA-Z\s-]/g, '').slice(0, MAX_CHARS);
  }

  function applyCustomWord(rawText) {
    const cleaned = sanitizeInput(rawText).trim();
    if (!cleaned) return;

    const formattedForUrl = cleaned.replace(/\s+/g, '_');

    const params = new URLSearchParams(window.location.search);
    params.set('name', formattedForUrl);
    window.location.search = params.toString();
  }

  function renderScene() {
    const { width, height, nodes, glyphs, ripples, pointer, time } = state;
    const linkDist = Math.min(width, height) * 0.18;
    const pointerLinkDist = linkDist * 1.3;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      a.x += a.vx;
      a.y += a.vy;

      if (a.x < 0 || a.x > width) a.vx *= -1;
      if (a.y < 0 || a.y > height) a.vy *= -1;

      if (pointer.active) {
        const d = Math.hypot(pointer.x - a.x, pointer.y - a.y);
        if (d < pointerLinkDist) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.strokeStyle = `rgba(37, 99, 235, ${(1 - d / pointerLinkDist) * 0.16})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < linkDist) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(148, 163, 184, ${(1 - d / linkDist) * 0.18})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      g.x += g.vx + Math.sin(time + g.phase) * 0.15;
      g.y += g.vy;
      g.angle += g.spin;

      if (g.y < -25) {
        g.y = height + 25;
        g.x = Math.random() * width;
      }
      if (g.x < -25) g.x = width + 25;
      if (g.x > width + 25) g.x = -25;

      const alpha = 0.08 + Math.sin(time * 1.5 + g.phase) * 0.04;

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.font = `600 ${g.size}px 'Space Grotesk', monospace`;
      ctx.fillStyle = `rgba(71, 85, 105, ${alpha})`;
      ctx.fillText(g.char, 0, 0);
      ctx.restore();
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.radius += 2.8;
      r.alpha *= 0.965;

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(37, 99, 235, ${r.alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (r.radius >= r.maxRadius || r.alpha < 0.005) {
        ripples.splice(i, 1);
      }
    }
  }

  function renderTypography() {
    const { width, height, particles, ripples, pointer, intro, fontSize } = state;
    const ease = 1 - Math.pow(1 - intro, 4);
    const interactRadius = Math.min(Math.max(fontSize * 0.72, 26), Math.min(width, height) * 0.09);
    const highlightRadius = interactRadius * 0.8;
    const pushStrength = Math.min(Math.max(fontSize * 0.14, 7), 20);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const tx = p.startX + (p.baseX - p.startX) * ease;
      const ty = p.startY + (p.baseY - p.startY) * ease;

      const dx = pointer.x - p.x;
      const dy = pointer.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (pointer.active && dist < interactRadius && intro >= 1) {
        const force = (1 - dist / interactRadius) * pushStrength;
        const angle = Math.atan2(dy, dx);
        p.vx -= Math.cos(angle) * force;
        p.vy -= Math.sin(angle) * force;
      }

      for (let j = 0; j < ripples.length; j++) {
        const r = ripples[j];
        const rdx = p.x - r.x;
        const rdy = p.y - r.y;
        const rdist = Math.hypot(rdx, rdy);
        if (Math.abs(rdist - r.radius) < 12) {
          const angle = Math.atan2(rdy, rdx);
          p.vx += Math.cos(angle) * 3.5;
          p.vy += Math.sin(angle) * 3.5;
        }
      }

      p.vx = (p.vx + (tx - p.x) * 0.14) * 0.72;
      p.vy = (p.vy + (ty - p.y) * 0.14) * 0.72;
      p.x += p.vx;
      p.y += p.vy;

      const active = pointer.active && dist < highlightRadius;

      ctx.beginPath();
      ctx.arc(p.x, p.y, active ? p.size * 1.28 : p.size, 0, Math.PI * 2);

      if (active) {
        ctx.fillStyle = '#2563eb';
      } else if (p.tone > 0.9) {
        ctx.fillStyle = '#1d4ed8';
      } else if (p.tone > 0.55) {
        ctx.fillStyle = '#0f172a';
      } else {
        ctx.fillStyle = '#334155';
      }

      ctx.fill();
    }
  }

  function frame() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, state.width, state.height);

    state.time += 0.02;
    if (state.intro < 1) {
      state.intro = Math.min(state.intro + 0.016, 1);
    }

    renderScene();
    renderTypography();

    requestAnimationFrame(frame);
  }

  function clearPointer() {
    state.pointer.active = false;
    state.pointer.x = -9999;
    state.pointer.y = -9999;
  }

  nameInput.addEventListener('input', () => {
    const filtered = sanitizeInput(nameInput.value);
    if (nameInput.value !== filtered) {
      nameInput.value = filtered;
    }
  });

  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openModal();
  });

  closeBtn.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('is-open')) {
      closeModal();
    }
  });

  nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    applyCustomWord(nameInput.value);
  });

  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (e) => {
    if (modalOverlay.classList.contains('is-open')) return;
    state.pointer.x = e.clientX;
    state.pointer.y = e.clientY;
    state.pointer.active = true;
  });

  window.addEventListener('pointerdown', (e) => {
    if (modalOverlay.classList.contains('is-open') || e.target === triggerBtn) return;
    state.pointer.x = e.clientX;
    state.pointer.y = e.clientY;
    state.pointer.active = true;
    spawnRipple(e.clientX, e.clientY);
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') clearPointer();
  });

  window.addEventListener('pointerleave', clearPointer);
  window.addEventListener('pointercancel', clearPointer);

  document.fonts.ready.then(() => {
    resize();
    frame();
  });
})();