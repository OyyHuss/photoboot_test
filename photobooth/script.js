/* ═══════════════════════════════════════════════════════════
   SNAPBOOTH — script.js
   Photo Booth: 2×6" strip standard (600×1800px canvas @300dpi)
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─── STATE ───────────────────────────────────────────────
const state = {
  photoCount: 3,
  capturedPhotos: [],   // Array of ImageData / dataURLs
  selectedTemplate: null,
  stream: null,
  isCapturing: false,
};

// ─── STRIP DIMENSIONS (2×6 inch @ 300dpi) ────────────────
const STRIP = {
  W: 600,      // 2 inch × 300dpi
  H: 1800,     // 6 inch × 300dpi
  PADDING: 24,
  GAP: 16,
  HEADER: 60,  // space for date-time watermark at top
  FOOTER: 48,  // branding footer
};

// ─── TEMPLATES CONFIG ─────────────────────────────────────
// Each template references an image in /assets/ folder.
// You can add more by placing PNGs/JPGs in /assets/ and adding entries here.
const TEMPLATES = [
  { id: 'none',      name: 'Polos',       src: null },
  { id: 'classic',   name: 'Classic',     src: 'assets/template-classic.png' },
  { id: 'retro',     name: 'Retro Film',  src: 'assets/template-retro.png' },
  { id: 'garden',    name: 'Garden',      src: 'assets/template-garden.png' },
  { id: 'night',     name: 'Night Sky',   src: 'assets/template-night.png' },
  { id: 'polaroid',  name: 'Polaroid',    src: 'assets/template-polaroid.png' },
  { id: 'pastel',    name: 'Pastel Dream',src: 'assets/template-pastel.png' },
];

// ─── PAGE ROUTING ─────────────────────────────────────────
const pages = {
  landing:  document.getElementById('page-landing'),
  select:   document.getElementById('page-select'),
  camera:   document.getElementById('page-camera'),
  template: document.getElementById('page-template'),
};

function navigateTo(target) {
  Object.entries(pages).forEach(([key, el]) => {
    if (el.classList.contains('active')) {
      el.classList.remove('active');
      el.classList.add('exit');
      setTimeout(() => el.classList.remove('exit'), 500);
    }
  });
  setTimeout(() => {
    pages[target].classList.add('active');
    window.scrollTo(0, 0);
  }, 50);
}

// ─── LANDING ──────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', () => {
  navigateTo('select');
});

// ─── SELECT COUNT ─────────────────────────────────────────
document.querySelectorAll('.count-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.count-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.photoCount = parseInt(card.dataset.count);
    card.querySelector('input').checked = true;
  });
});

document.getElementById('btn-back-select').addEventListener('click', () => navigateTo('landing'));

document.getElementById('btn-to-camera').addEventListener('click', async () => {
  navigateTo('camera');
  await initCamera();
});

// ─── CAMERA ───────────────────────────────────────────────
const video    = document.getElementById('video');
const statusDot   = document.getElementById('status-dot');
const statusText  = document.getElementById('status-text');
const countdownBig  = document.getElementById('cam-countdown-big');
const camInfo       = document.getElementById('cam-info');
const progressStrip = document.getElementById('progress-strip');
const thumbStrip    = document.getElementById('thumb-strip');
const btnCapture    = document.getElementById('btn-capture');
const btnCaptureTxt = document.getElementById('btn-capture-text');
const flashOverlay  = document.getElementById('flash-overlay');

document.getElementById('btn-back-camera').addEventListener('click', () => {
  stopCamera();
  state.capturedPhotos = [];
  state.isCapturing = false;
  navigateTo('select');
});

async function initCamera() {
  setStatus('loading', 'Meminta akses kamera...');
  thumbStrip.innerHTML = '';
  state.capturedPhotos = [];
  progressStrip.style.width = '0%';
  countdownBig.textContent = '';
  camInfo.textContent = `Kamu akan mengambil ${state.photoCount} foto · Tiap foto: 5 detik`;
  btnCapture.disabled = true;
  btnCaptureTxt.textContent = 'Mulai Sesi Foto';

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = state.stream;
    await video.play();
    setStatus('ready', 'Kamera siap!');
    btnCapture.disabled = false;
  } catch (err) {
    setStatus('error', 'Tidak bisa mengakses kamera: ' + err.message);
    camInfo.textContent = 'Pastikan browser memiliki izin kamera.';
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  video.srcObject = null;
}

function setStatus(type, text) {
  statusText.textContent = text;
  statusDot.className = 'status-dot';
  if (type === 'ready') statusDot.classList.add('ready');
  if (type === 'capturing') statusDot.classList.add('capturing');
}

btnCapture.addEventListener('click', () => {
  if (state.isCapturing) return;
  startCaptureSesion();
});

async function startCaptureSesion() {
  state.isCapturing = true;
  state.capturedPhotos = [];
  thumbStrip.innerHTML = '';
  btnCapture.disabled = true;

  setStatus('capturing', `Mengambil foto...`);

  for (let i = 0; i < state.photoCount; i++) {
    const photoNum = i + 1;
    camInfo.textContent = `Foto ${photoNum} dari ${state.photoCount}`;
    await countdown(5, i, state.photoCount);
    takePhoto(i);
    flash();
    updateProgress(photoNum, state.photoCount);

    if (i < state.photoCount - 1) {
      await sleep(400); // brief pause between shots
    }
  }

  setStatus('ready', 'Sesi foto selesai!');
  camInfo.textContent = '✓ Semua foto berhasil diambil! Pilih template sekarang.';
  btnCaptureTxt.textContent = 'Foto Lagi';
  btnCapture.disabled = false;
  countdownBig.textContent = '✓';
  state.isCapturing = false;

  // Auto-proceed to template
  await sleep(800);
  stopCamera();
  buildTemplateGrid();
  navigateTo('template');
  renderStrip();
}

async function countdown(seconds, photoIndex, total) {
  return new Promise(resolve => {
    let remaining = seconds;
    countdownBig.textContent = remaining;
    triggerCountdownAnim();

    const iv = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(iv);
        countdownBig.textContent = '📸';
        resolve();
      } else {
        countdownBig.textContent = remaining;
        triggerCountdownAnim();
      }
    }, 1000);
  });
}

function triggerCountdownAnim() {
  countdownBig.classList.remove('countdown-animate');
  void countdownBig.offsetWidth; // reflow
  countdownBig.classList.add('countdown-animate');
}

function takePhoto(index) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const dataURL = canvas.toDataURL('image/jpeg', 0.95);
  state.capturedPhotos.push(dataURL);

  // Thumbnail
  const thumb = document.createElement('div');
  thumb.className = 'thumb-item';
  const img = document.createElement('img');
  img.src = dataURL;
  thumb.appendChild(img);
  thumbStrip.appendChild(thumb);
}

function flash() {
  flashOverlay.classList.add('flash');
  setTimeout(() => flashOverlay.classList.remove('flash'), 150);
}

function updateProgress(done, total) {
  progressStrip.style.width = `${(done / total) * 100}%`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── TEMPLATE ─────────────────────────────────────────────
document.getElementById('btn-back-template').addEventListener('click', () => {
  state.capturedPhotos = [];
  state.selectedTemplate = null;
  navigateTo('select');
});

document.getElementById('btn-retake').addEventListener('click', () => {
  state.capturedPhotos = [];
  state.selectedTemplate = null;
  navigateTo('select');
});

function buildTemplateGrid() {
  const grid = document.getElementById('template-grid');
  grid.innerHTML = '';

  TEMPLATES.forEach((tmpl, i) => {
    const card = document.createElement('div');
    card.className = 'tmpl-card' + (i === 0 ? ' selected' : '');
    card.dataset.id = tmpl.id;

    if (tmpl.src === null) {
      card.classList.add('no-template');
      card.innerHTML = `<div class="nt-icon">◻</div><div class="nt-label">${tmpl.name}</div>`;
    } else {
      const img = document.createElement('img');
      img.src = tmpl.src;
      img.alt = tmpl.name;
      img.onerror = () => {
        // fallback: show placeholder if asset missing
        card.classList.add('no-template');
        card.innerHTML = `<div class="nt-icon">🖼</div><div class="nt-label">${tmpl.name}</div>`;
      };
      card.appendChild(img);
      const nameEl = document.createElement('div');
      nameEl.className = 'tmpl-card-name';
      nameEl.textContent = tmpl.name;
      card.appendChild(nameEl);
    }

    card.addEventListener('click', () => {
      document.querySelectorAll('.tmpl-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedTemplate = tmpl.src;
      renderStrip();
    });

    grid.appendChild(card);
  });

  state.selectedTemplate = null; // start with 'Polos'
  updateDatetime();
}

// ─── STRIP CANVAS RENDERER ─────────────────────────────────
// Standard photo strip: 2×6 inches @ 300dpi = 600×1800px
async function renderStrip() {
  const canvas = document.getElementById('strip-canvas');
  const ctx = canvas.getContext('2d');
  const n = state.capturedPhotos.length;

  canvas.width  = STRIP.W;
  canvas.height = STRIP.H;

  const usable_h = STRIP.H - STRIP.HEADER - STRIP.FOOTER - STRIP.PADDING * 2 - STRIP.GAP * (n - 1);
  const photoH   = Math.floor(usable_h / n);
  const photoW   = STRIP.W - STRIP.PADDING * 2;

  // ── Background ──
  if (state.selectedTemplate) {
    try {
      const bgImg = await loadImage(state.selectedTemplate);
      ctx.drawImage(bgImg, 0, 0, STRIP.W, STRIP.H);
    } catch {
      drawDefaultBg(ctx);
    }
  } else {
    drawDefaultBg(ctx);
  }

  // ── Photos ──
  for (let i = 0; i < n; i++) {
    const x = STRIP.PADDING;
    const y = STRIP.HEADER + STRIP.PADDING + i * (photoH + STRIP.GAP);

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur  = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'white';
    roundRect(ctx, x - 4, y - 4, photoW + 8, photoH + 8, 6);
    ctx.fill();
    ctx.restore();

    try {
      const img = await loadImage(state.capturedPhotos[i]);
      ctx.save();
      roundRect(ctx, x, y, photoW, photoH, 4);
      ctx.clip();
      // Cover fit
      const ar_img = img.width / img.height;
      const ar_box = photoW / photoH;
      let sx, sy, sw, sh;
      if (ar_img > ar_box) {
        sh = img.height; sw = sh * ar_box;
        sy = 0; sx = (img.width - sw) / 2;
      } else {
        sw = img.width; sh = sw / ar_box;
        sx = 0; sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, photoW, photoH);
      ctx.restore();
    } catch (e) {
      ctx.fillStyle = '#333';
      roundRect(ctx, x, y, photoW, photoH, 4);
      ctx.fill();
    }
  }

  // ── Header: datetime ──
  const now = new Date();
  const dateStr = formatDate(now);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold 18px 'Space Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(dateStr, STRIP.W / 2, 36);

  // ── Footer: branding ──
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `14px 'DM Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('◈ SnapBooth', STRIP.W / 2, STRIP.H - 16);

  updateDatetime(now);
}

function drawDefaultBg(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, STRIP.H);
  grad.addColorStop(0,   '#1a1520');
  grad.addColorStop(0.5, '#221e2d');
  grad.addColorStop(1,   '#120f18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, STRIP.W, STRIP.H);

  // Subtle dot pattern
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let x = 20; x < STRIP.W; x += 30) {
    for (let y = 20; y < STRIP.H; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function formatDate(d) {
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const pad = n => String(n).padStart(2, '0');
  return `${days[d.getDay()]}, ${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function updateDatetime(d) {
  const el = document.getElementById('strip-datetime');
  if (!el) return;
  const now = d || new Date();
  el.textContent = formatDate(now);
}

// ─── DOWNLOAD ─────────────────────────────────────────────
document.getElementById('btn-download').addEventListener('click', async () => {
  // Re-render with current timestamp just before download
  await renderStrip();
  const canvas = document.getElementById('strip-canvas');
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const filename = `SnapBooth_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.jpg`;

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
});