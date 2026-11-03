// The agent city, turnable. Canvas 2D, no dependency, no tracker.
// Reads ville.json: the profile's published copy first, the copy beside this page if that fails.
// Lots, streets and river mirror scripts/build_ville.py in the profile repo, so the map and the page are one city.
(() => {
  'use strict';
  const REMOTE = 'https://raw.githubusercontent.com/martinbouvet2000-tech/martinbouvet2000-tech/main/assets/ville.json';
  const LOCAL = 'ville.json';

  const LOTS = {
    patron: [7.0, 7.0, 2.6, 2.6, 4.2], comptoir: [2.2, 2.0, 2.4, 2.2, 3.0], prospecteur: [6.8, 2.0, 1.6, 1.6, 2.0],
    plume: [9.0, 2.2, 1.6, 1.6, 2.4], tri: [9.2, 4.2, 1.6, 1.2, 1.6], compteur: [6.8, 4.2, 1.4, 1.2, 1.4],
    ecole: [2.2, 11.3, 2.6, 2.2, 2.2], relecteur: [2.6, 15.2, 1.6, 1.4, 1.6], studio: [15.4, 7.0, 2.8, 2.4, 2.2],
    graphisme: [15.4, 2.4, 1.6, 1.6, 2.6], interface: [17.2, 3.6, 1.3, 1.6, 3.2], mouvement: [17.4, 11.2, 1.4, 1.6, 1.8],
    critique: [15.4, 11.2, 1.6, 1.6, 2.8], medecin: [7.2, 15.0, 2.6, 2.0, 1.8],
  };
  const SPARE = [[9.2, 11.4, 1.4, 1.4, 1.6], [15.6, 15.0, 1.4, 1.4, 1.4], [6.8, 11.4, 1.4, 1.4, 1.8],
    [17.6, 14.8, 1.2, 1.2, 2.0], [10.0, 15.4, 0.8, 0.9, 1.4], [4.4, 15.4, 0.9, 1.0, 1.4]];
  const LIBRARY = [2.4, 7.4, 2.4, 1.8, 1.3];
  const RIVER = [12.4, 13.8];
  const SX = [1.4, 6.0, 11.4, 14.6], SY = [1.0, 6.0, 10.6, 14.2, 18.6];
  const QUARTER = { mairie: 'Town hall', hopital: 'Hospital', business: 'Business quarter', ecole: 'School quarter',
    studio: 'Design studio', faubourg: 'Outskirts', bibliotheque: 'Library' };

  const C = { ground: '#13110e', rim: '#0a0907', street: '#1b1814', water: '#0f2131', flow: 'rgba(121,192,255,.30)',
    top: [46, 50, 58], side: [30, 33, 39], lit: '#f2b66d', dark: '#1f2228', red: '#f85149', accent: '#f0883e',
    ink: '#f1ebdf', mute: '#8f8779', tree: '#1a2a1f', line: '#2c2720' };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (id) => document.getElementById(id);
  const box = $('box'), cv = $('c'), ctx = cv.getContext('2d'), tip = $('tip'), card = $('card'), chips = $('chips');

  // A stable number in [0, 1) from a string: same data, same city.
  const h01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const inside = (x, y) => ((x - 10) / 9.7) ** 4 + ((y - 10) / 9.7) ** 4 < 1;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let data = null, buildings = [], walkers = [], trees = [];
  let theta = Math.PI / 4, vel = 0, auto = !reduce.matches, paused = false;
  let hover = null, selected = null, W = 0, H = 0, scale = 1, cx = 0, cy = 0, dpr = 1;
  let tween = null, lastT = 0, dirty = true;
  const PITCH = 0.5; // vertical squash of the ground: 0.5 is the profile map's isometric angle

  function project(x, y, z) {
    const dx = x - 10, dy = y - 10, c = Math.cos(theta), s = Math.sin(theta);
    const xr = dx * c - dy * s, yr = dx * s + dy * c;
    return [cx + xr * scale, cy + yr * scale * PITCH - z * scale * 0.9, yr];
  }

  function shade(rgb, k) { return `rgb(${rgb.map((v) => Math.round(Math.min(255, v * k))).join(',')})`; }

  // ---------- the city from the counters ----------
  function build(d) {
    data = d;
    const spare = SPARE.slice();
    buildings = d.buildings.map((b) => {
      const lot = LOTS[b.key] || spare.shift();
      return lot && { ...b, lot, windows: makeWindows(b, lot) };
    }).filter(Boolean);
    buildings.push({ key: 'bibliotheque', name: 'La Bibliothèque', quarter: 'bibliotheque', landmark: true,
      role: 'Where agents file their reports into the vault, through one guarded door.',
      writes: d.vault.writes, lot: LIBRARY, windows: [] });

    trees = [];
    for (let i = 0; i < 260 && trees.length < 46; i++) {
      const x = 0.8 + h01('tx' + i) * 18.4, y = 0.8 + h01('ty' + i) * 18.4;
      if (!inside(x, y) || (x > RIVER[0] - 0.5 && x < RIVER[1] + 0.5)) continue;
      if (SX.some((s) => Math.abs(x - s) < 0.9) || SY.some((s) => Math.abs(y - s) < 0.9)) continue;
      if (buildings.some(({ lot: [lx, ly, lw, ld] }) => x > lx - 0.5 && x < lx + lw + 0.5 && y > ly - 0.5 && y < ly + ld + 0.5)) continue;
      trees.push({ x, y, r: 0.22 + h01('tr' + i) * 0.12 });
    }

    const segs = [...SX.map((s) => [[s, 1.6], [s, 18.4]]), ...SY.map((s) => [[1.6, s], [18.4, s]])];
    const n = Math.max(4, Math.min(22, Math.round(d.today.done / 5)));
    walkers = [];
    for (let i = 0; walkers.length < n && i < 80; i++) {
      const [[x0, y0], [x1, y1]] = segs[Math.floor(h01('seg' + i) * segs.length)];
      const a = h01('a' + i), b = Math.min(1, a + 0.2 + h01('b' + i) * 0.5);
      const pa = [x0 + (x1 - x0) * a, y0 + (y1 - y0) * a], pb = [x0 + (x1 - x0) * b, y0 + (y1 - y0) * b];
      if (!inside(...pa) || !inside(...pb)) continue;
      walkers.push({ pa, pb, period: 9000 + h01('p' + i) * 14000, phase: h01('o' + i), warm: h01('w' + i) < 0.35 });
    }
  }

  function makeWindows(b, [x, y, w, d, h]) {
    const share = b.done ? Math.min(1, 0.18 + b.done / 22) : 0;
    const slots = [];
    for (const face of ['+y', '+x', '-y', '-x']) {
      const len = face.endsWith('y') ? w : d;
      const cols = Math.max(1, Math.floor(len / 0.55)), rows = Math.max(1, Math.floor((h - 0.3) / 0.62));
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) slots.push({ face, u: (k + 0.28) * len / cols, z: 0.35 + r * 0.62, ww: len / cols * 0.44 });
    }
    const order = slots.map((_, i) => i).sort((i, j) => h01(b.key + i) - h01(b.key + j));
    const nLit = Math.round(slots.length * share), nRed = b.errors ? Math.min(b.errors, 3) : 0;
    order.forEach((i, rank) => { slots[i].state = rank < nLit ? 'lit' : rank < nLit + nRed ? 'red' : 'dark'; slots[i].flick = h01(b.key + 'f' + i); });
    return slots;
  }

  // ---------- drawing ----------
  function resize() {
    const r = box.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(W / (W < 600 ? 22.5 : 23.5), H / 15.5);
    cx = W / 2; cy = H / 2 + scale * (W < 600 ? 1.2 : 1.6);
    dirty = true;
  }

  function poly(pts, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  const quad = (x0, y0, x1, y1) => [project(x0, y0, 0), project(x1, y0, 0), project(x1, y1, 0), project(x0, y1, 0)];

  function ground() {
    const ring = [];
    for (let i = 0; i < 120; i++) {
      const a = 2 * Math.PI * i / 120, c = Math.cos(a), s = Math.sin(a), r = 9.7 / (c ** 4 + s ** 4) ** 0.25;
      ring.push(project(10 + r * c, 10 + r * s, 0));
    }
    const drop = scale * 0.7;
    poly(ring.map(([x, y]) => [x, y + drop]), C.rim, C.line);
    poly(ring, C.ground, C.line);
    ctx.save();
    ctx.beginPath(); ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
    for (const s of SX) poly(quad(s - 0.45, -1, s + 0.45, 21), C.street);
    for (const s of SY) poly(quad(-1, s - 0.45, 21, s + 0.45), C.street);
    poly(quad(RIVER[0], -1, RIVER[1], 21), C.water);
    const t = reduce.matches || paused ? 0 : performance.now() / 1000;
    ctx.lineWidth = 1;
    [0.35, 0.75, 1.05].forEach((off, k) => {
      const a = project(RIVER[0] + off, -1, 0), b = project(RIVER[0] + off, 21, 0);
      ctx.setLineDash([6 + 4 * k, 14 + 6 * k]); ctx.lineDashOffset = -t * (12 - 3 * k);
      ctx.strokeStyle = C.flow; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    });
    ctx.setLineDash([]);
    for (const s of [SY[1], SY[3]]) poly(quad(RIVER[0] - 0.3, s - 0.45, RIVER[1] + 0.3, s + 0.45), '#2a2620');
    ctx.restore();
  }

  function faces(b) {
    const [x, y, w, d, h] = b.lot;
    const P = (px, py, pz) => project(px, py, pz);
    const all = [
      { id: '+y', n: [0, 1], pts: [P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x, y + d, h)] },
      { id: '+x', n: [1, 0], pts: [P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x + w, y, h)] },
      { id: '-y', n: [0, -1], pts: [P(x, y, 0), P(x + w, y, 0), P(x + w, y, h), P(x, y, h)] },
      { id: '-x', n: [-1, 0], pts: [P(x, y, 0), P(x, y + d, 0), P(x, y + d, h), P(x, y, h)] },
    ];
    const c = Math.cos(theta), s = Math.sin(theta);
    return all.map((f) => ({ ...f, facing: f.n[0] * s + f.n[1] * c, light: f.n[0] * c - f.n[1] * s }))
      .filter((f) => f.facing > 0.001);
  }

  function windowPts(b, slot) {
    const [x, y, w, d] = b.lot, { face, u, z, ww } = slot, P = project;
    if (face === '+y') return [P(x + u, y + d, z), P(x + u + ww, y + d, z), P(x + u + ww, y + d, z + 0.3), P(x + u, y + d, z + 0.3)];
    if (face === '-y') return [P(x + u, y, z), P(x + u + ww, y, z), P(x + u + ww, y, z + 0.3), P(x + u, y, z + 0.3)];
    if (face === '+x') return [P(x + w, y + u, z), P(x + w, y + u + ww, z), P(x + w, y + u + ww, z + 0.3), P(x + w, y + u, z + 0.3)];
    return [P(x, y + u, z), P(x, y + u + ww, z), P(x, y + u + ww, z + 0.3), P(x, y + u, z + 0.3)];
  }

  function drawBuilding(b, now) {
    const [x, y, w, d, h] = b.lot;
    const focus = selected || hover;
    const dim = focus && focus !== b ? 0.62 : 1;
    const hosp = b.quarter === 'hopital', lib = b.landmark;
    const base = lib ? [72, 70, 66] : hosp ? [70, 74, 80] : C.top;
    const sideBase = lib ? [44, 43, 40] : hosp ? [44, 48, 54] : C.side;

    if (b.done) { // warm glow on the ground where the agent worked
      const [gx, gy] = project(x + w / 2, y + d / 2, 0);
      const pulse = reduce.matches || paused ? 1 : 0.8 + 0.2 * Math.sin(now / 1000 + h01(b.key) * 6);
      const r = scale * (1.3 + 0.28 * Math.sqrt(Math.min(b.done, 30)));
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, `rgba(240,136,62,${0.28 * pulse * dim})`); g.addColorStop(1, 'rgba(240,136,62,0)');
      ctx.save(); ctx.translate(gx, gy); ctx.scale(1, PITCH); ctx.translate(-gx, -gy);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const fs = faces(b);
    for (const f of fs) {
      poly(f.pts, shade(sideBase, (0.85 + 0.35 * f.light) * dim));
      if (lib && (f.id === '+y' || f.id === '-y')) { // columns
        ctx.strokeStyle = shade([110, 106, 98], dim); ctx.lineWidth = Math.max(1, scale * 0.07);
        for (let k = 0; k < 5; k++) {
          const px = x + w * (k + 0.5) / 5, py = f.id === '+y' ? y + d : y;
          const a = project(px, py, 0), t = project(px, py, h - 0.2);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(t[0], t[1]); ctx.stroke();
        }
      }
    }
    for (const slot of b.windows) {
      if (!fs.some((f) => f.id === slot.face)) continue;
      let col = C.dark;
      if (slot.state === 'red') col = C.red;
      if (slot.state === 'lit') {
        const fl = slot.flick < 0.3 && !reduce.matches && !paused ? 0.78 + 0.22 * Math.cos(now / 1100 + slot.flick * 40) : 1;
        col = `rgba(242,182,109,${fl * dim})`;
      }
      poly(windowPts(b, slot), col);
    }
    const top = [project(x, y, h), project(x + w, y, h), project(x + w, y + d, h), project(x, y + d, h)];
    poly(top, shade(base, dim), focus === b ? C.accent : null);

    // roof details
    const [rx, ry] = project(x + w / 2, y + d / 2, h);
    if (b.key === 'patron') {
      const t = { key: 'tower', lot: [x + w / 2 - 0.45, y + d / 2 - 0.45, 0.9, 0.9, h + 1.6] };
      for (const f of faces(t)) poly(f.pts, shade(C.side, (0.85 + 0.35 * f.light) * dim));
      poly([project(t.lot[0], t.lot[1], t.lot[4]), project(t.lot[0] + 0.9, t.lot[1], t.lot[4]), project(t.lot[0] + 0.9, t.lot[1] + 0.9, t.lot[4]), project(t.lot[0], t.lot[1] + 0.9, t.lot[4])], shade(C.top, dim));
      const tipPt = project(x + w / 2, y + d / 2, h + 2.5), basePt = project(x + w / 2, y + d / 2, h + 1.6);
      ctx.strokeStyle = C.mute; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(...basePt); ctx.lineTo(tipPt[0], tipPt[1]); ctx.stroke();
      const ping = reduce.matches || paused ? 0 : (now % 3200) / 3200;
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(tipPt[0], tipPt[1], 3, 0, Math.PI * 2); ctx.fill();
      if (ping) { ctx.strokeStyle = `rgba(240,136,62,${0.8 * (1 - ping)})`; ctx.beginPath(); ctx.arc(tipPt[0], tipPt[1], 3 + ping * 10, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (hosp) {
      const col = data.hospital.patients ? C.accent : '#3fb950', k = scale * 0.32;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, scale * 0.13); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rx - k, ry); ctx.lineTo(rx + k, ry); ctx.moveTo(rx, ry - k * 0.6); ctx.lineTo(rx, ry + k * 0.6); ctx.stroke();
    }
    if (b.in_hospital) { ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(rx, ry, 4, 0, Math.PI * 2); ctx.fill(); }
    if (lib && b.writes) { ctx.fillStyle = C.lit; ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill(); }
    if (b.key === 'studio') {
      const st = data.studio, frames = [];
      [['ready', '#3fb950'], ['to_show', C.accent], ['to_rework', C.mute], ['to_score', '#4a4540'], ['no_capture', '#4a4540']]
        .forEach(([k, c]) => { for (let i = 0; i < Math.min(st[k], 4); i++) frames.push(c); });
      ctx.lineWidth = 1.4;
      frames.slice(0, 8).forEach((c, i) => {
        const fx = x + 0.3 + (i % 4) * 0.6, fy = y + 0.35 + Math.floor(i / 4) * 0.9;
        poly([project(fx, fy, h), project(fx + 0.42, fy, h), project(fx + 0.42, fy + 0.6, h), project(fx, fy + 0.6, h)], null, c);
      });
    }

    // silhouette for hit testing: the hull of the eight corners
    const pts = [];
    for (const z of [0, b.key === 'patron' ? h + 2.5 : h]) for (const [px, py] of [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]) pts.push(project(px, py, z));
    b.hit = hull(pts); b.anchor = project(x + w / 2, y + d / 2, b.key === 'patron' ? h + 2.6 : h);
  }

  function hull(p) {
    const s = p.map(([x, y]) => [x, y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of s) { while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
    for (const q of s.reverse()) { while (up.length > 1 && cross(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
    const path = new Path2D(); const all = lo.slice(0, -1).concat(up.slice(0, -1));
    all.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath();
    return path;
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    if (!data) return;
    ground();
    const items = [];
    for (const b of buildings) { const [x, y, w, d] = b.lot; items.push({ z: project(x + w / 2, y + d / 2, 0)[2] + (w + d) / 4, b }); }
    for (const t of trees) items.push({ z: project(t.x, t.y, 0)[2], t });
    const still = reduce.matches || paused;
    for (const wk of walkers) {
      const u = still ? 0.5 : 0.5 - 0.5 * Math.cos(2 * Math.PI * ((now / wk.period + wk.phase) % 1));
      const x = wk.pa[0] + (wk.pb[0] - wk.pa[0]) * u, y = wk.pa[1] + (wk.pb[1] - wk.pa[1]) * u;
      items.push({ z: project(x, y, 0)[2], wk: [x, y, wk.warm] });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.b) drawBuilding(it.b, now);
      else if (it.t) {
        const [x, y] = project(it.t.x, it.t.y, 0), r = it.t.r * scale;
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.tree; ctx.beginPath(); ctx.arc(x, y - r * 1.2, r, 0, Math.PI * 2); ctx.fill();
      } else {
        const [x, y] = project(it.wk[0], it.wk[1], 0.12);
        ctx.fillStyle = it.wk[2] ? C.accent : 'rgba(241,235,223,.85)';
        ctx.beginPath(); ctx.arc(x, y - 2, Math.max(1.8, scale * 0.09), 0, Math.PI * 2); ctx.fill();
      }
    }
    const focus = selected || hover;
    if (focus && focus.anchor) {
      const [x, y] = focus.anchor;
      ctx.font = `500 12px ${getComputedStyle(document.body).getPropertyValue('--mono')}`;
      ctx.textAlign = 'center'; ctx.fillStyle = C.ink;
      ctx.strokeStyle = C.mute; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 18); ctx.stroke();
      ctx.fillText(focus.name.toUpperCase(), x, y - 24);
    }
  }

  // ---------- the side card ----------
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  function renderCard() {
    const d = data, b = selected;
    if (!b) {
      const t = d.today, st = d.studio;
      const max = Math.max(1, ...t.by_hour);
      card.innerHTML = `<div class="fade">
        <div class="kicker">The day of ${esc(d.date)}</div>
        <h2>${t.wakes} wake-ups across ${d.agents.active} agents</h2>
        <p class="role">${d.agents.total} agents exist in the org; the others sleep until they are needed.</p>
        <ul class="rows">
          <li><span>Work done</span><span>${t.done}</span></li>
          <li><span>Errors</span><span class="${t.errors ? 'red' : ''}">${t.errors}</span></li>
          <li><span>Stopped at budget cap</span><span>${t.capped}</span></li>
          <li><span>Hospital</span><span>${d.hospital.patients ? plural(d.hospital.patients, 'agent in', 'agents in') : 'empty'}</span></li>
          <li><span>Studio</span><span>${[['ready', 'ready'], ['to_show', 'to show'], ['to_rework', 'to rework'], ['to_score', 'to score']].filter(([k]) => st[k]).map(([k, l]) => `${st[k]} ${l}`).join(' · ') || 'none'}</span></li>
          <li><span>Vault writes</span><span>${d.vault.writes}</span></li>
          <li><span>Tests declared</span><span>${d.tests.declared}</span></li>
        </ul>
        <div><div class="label-q" style="margin-bottom:8px">Wake-ups by hour</div>
          <div class="hours" aria-label="Wake-ups by hour">${t.by_hour.map((n, i) => `<i class="${n ? '' : 'zero'}" style="height:${n ? Math.max(6, 100 * n / max) : 4}%" title="${String(i).padStart(2, '0')}h: ${n}"></i>`).join('')}</div>
          <div class="hours-scale"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div></div>
      </div>`;
      return;
    }
    const rows = b.landmark
      ? `<li><span>Reports filed today</span><span class="${b.writes ? 'lit' : ''}">${b.writes}</span></li>`
      : `<li><span>Wake-ups</span><span>${b.wakes}</span></li>
         <li><span>Work done</span><span class="${b.done ? 'lit' : ''}">${b.done}</span></li>
         <li><span>Errors</span><span class="${b.errors ? 'red' : ''}">${b.errors}</span></li>
         <li><span>Stopped at budget cap</span><span>${b.capped}</span></li>
         <li><span>Status</span><span>${b.in_hospital ? 'in hospital' : b.done ? 'worked today' : 'asleep today'}</span></li>`;
    card.innerHTML = `<div class="fade">
      <div class="kicker">${esc(QUARTER[b.quarter] || '')}</div>
      <h2>${esc(b.name)}</h2>
      <p class="role">${esc(b.role)}</p>
      <ul class="rows">${rows}</ul>
    </div>
    <button type="button" class="back" id="back">Back to the whole city</button>`;
    $('back').onclick = () => select(null);
  }

  function renderChips() {
    chips.innerHTML = '';
    for (const b of buildings) {
      const li = document.createElement('li'), bt = document.createElement('button');
      bt.type = 'button'; bt.textContent = b.name;
      bt.className = b.errors ? 'err' : (b.done || b.writes) ? 'worked' : '';
      bt.setAttribute('aria-pressed', 'false');
      bt.onclick = () => select(selected === b ? null : b);
      bt.onmouseenter = () => { hover = b; dirty = true; };
      bt.onmouseleave = () => { hover = null; dirty = true; };
      b.chip = bt; li.append(bt); chips.append(li);
    }
  }

  function select(b) {
    selected = b;
    for (const x of buildings) x.chip && x.chip.setAttribute('aria-pressed', String(x === b));
    renderCard(); dirty = true;
    if (b) { auto = false; turnTo(b); }
  }

  // Bring the chosen building toward the viewer: turn so it sits in front, softly.
  function turnTo(b) {
    const [x, y, w, d] = b.lot, dx = x + w / 2 - 10, dy = y + d / 2 - 10;
    if (Math.hypot(dx, dy) < 1.5) return;
    const target = Math.atan2(dx, dy); // yr = dx sin + dy cos peaks there: the building comes forward
    let delta = ((target - theta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    if (Math.abs(delta) < 0.35) return;
    delta -= Math.sign(delta) * 0.35; // stop a little short: three-quarter view, not head-on
    animateTheta(theta + delta);
  }

  function animateTheta(to) {
    if (reduce.matches) { theta = to; dirty = true; return; }
    tween = { from: theta, to, t0: performance.now(), dur: 900 };
  }
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // ---------- input ----------
  let drag = null;
  box.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: 0, last: e.clientX, t: performance.now() };
    box.setPointerCapture(e.pointerId); box.classList.add('dragging'); auto = false; tween = null; vel = 0;
  });
  box.addEventListener('pointermove', (e) => {
    const r = box.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (drag) {
      const dx = e.clientX - drag.last, now = performance.now();
      drag.moved += Math.abs(dx);
      theta += dx * 0.0085; vel = dx * 0.0085 / Math.max(8, now - drag.t) * 16;
      drag.last = e.clientX; drag.t = now; dirty = true;
      $('hint').style.opacity = 0;
      return;
    }
    const hit = pick(mx, my);
    if (hit !== hover) { hover = hit; dirty = true; }
    box.style.cursor = hit ? 'pointer' : '';
    showTip(hit, mx, my);
  });
  box.addEventListener('pointerup', (e) => {
    box.classList.remove('dragging');
    const r = box.getBoundingClientRect();
    if (drag && drag.moved < 6) { const hit = pick(e.clientX - r.left, e.clientY - r.top); select(hit === selected ? null : hit); vel = 0; }
    drag = null;
  });
  box.addEventListener('pointerleave', () => { if (!drag) { hover = null; showTip(null); dirty = true; } });

  function pick(x, y) {
    // the paths are in CSS pixels under the dpr transform; the point must be in device pixels
    const order = buildings.slice().sort((a, b) => project(b.lot[0] + b.lot[2] / 2, b.lot[1] + b.lot[3] / 2, 0)[2] - project(a.lot[0] + a.lot[2] / 2, a.lot[1] + a.lot[3] / 2, 0)[2]);
    return order.find((b) => b.hit && ctx.isPointInPath(b.hit, x * dpr, y * dpr)) || null;
  }

  function showTip(b, x, y) {
    if (!b || matchMedia('(hover: none)').matches) { tip.classList.remove('on'); return; }
    tip.innerHTML = b.landmark ? `${esc(b.name)} · <b>${b.writes}</b> filed` : `${esc(b.name)} · <b>${b.done}</b> done${b.errors ? ` · ${b.errors} err` : ''}`;
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.classList.add('on');
  }

  $('left').onclick = () => { auto = false; animateTheta((tween ? tween.to : theta) - Math.PI / 4); };
  $('right').onclick = () => { auto = false; animateTheta((tween ? tween.to : theta) + Math.PI / 4); };
  $('pause').onclick = (e) => { paused = !paused; auto = false; e.currentTarget.setAttribute('aria-pressed', String(paused)); e.currentTarget.textContent = paused ? 'play' : 'pause'; dirty = true; };
  box.tabIndex = 0;
  box.setAttribute('aria-label', 'City map. Left and right arrows turn it.');
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); $('left').click(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); $('right').click(); }
    if (e.key === 'Escape') select(null);
  });
  reduce.addEventListener?.('change', () => { auto = !reduce.matches && !paused && !selected; dirty = true; });
  new ResizeObserver(resize).observe(box);

  // ---------- loop ----------
  function frame(now) {
    const dt = Math.min(50, now - (lastT || now)); lastT = now;
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.dur);
      theta = tween.from + (tween.to - tween.from) * easeOut(k); dirty = true;
      if (k >= 1) tween = null;
    } else if (!drag && Math.abs(vel) > 0.0004 && !reduce.matches) {
      theta += vel; vel *= Math.pow(0.92, dt / 16); dirty = true;
    } else if (auto && !paused && !reduce.matches) {
      theta += dt * 0.00004; dirty = true;
    }
    const moving = !reduce.matches && !paused;
    if (dirty || moving) { draw(now); dirty = false; }
    requestAnimationFrame(frame);
  }

  async function load() {
    for (const url of [REMOTE, LOCAL]) {
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3500);
        const r = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
        clearTimeout(t);
        if (r.ok) { const d = await r.json(); if (d && d.schema === 1) return d; }
      } catch { /* try the next copy */ }
    }
    throw new Error('no city data');
  }

  load().then((d) => {
    build(d); renderChips(); renderCard(); resize();
    cv.setAttribute('aria-label', `Map of ${d.agents.active} agents on ${d.date}: ${d.today.wakes} wake-ups, ${d.today.done} done, ${d.today.errors} errors.`);
    const age = Math.floor((Date.now() - new Date(d.date + 'T12:00:00')) / 86400000);
    if (age >= 2) { const s = $('stale'); s.hidden = false; s.textContent = `No data for ${age} days: the laptop that hosts the city is off. This is still the last real day.`; }
    requestAnimationFrame(frame);
  }).catch(() => {
    card.innerHTML = '<p class="role">The city could not be loaded. The counters live in a file next to this page; try again in a moment.</p>';
  });
})();
