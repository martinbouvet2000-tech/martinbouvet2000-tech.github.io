// Martin Bouvet — portfolio. Vanilla JS, no dependencies.
document.documentElement.classList.add("js");

// Theme toggle (remembered per viewer; storage may be blocked)
(() => {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("theme");
    if (saved) root.dataset.theme = saved;
  } catch {}
  const btn = document.querySelector(".theme-btn");
  if (!btn) return;
  const isDark = () =>
    root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const paint = () => (btn.textContent = isDark() ? "☀" : "☾");
  paint();
  btn.addEventListener("click", () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
    paint();
  });
})();

// Reveal on scroll
(() => {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("in"));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  els.forEach((e) => io.observe(e));
})();

// 24h dial: when the systems run, in Paris time, with a live "now" hand
(() => {
  const svg = document.querySelector(".dial");
  const data = document.getElementById("jobs");
  if (!svg || !data) return;
  const jobs = JSON.parse(data.textContent);
  const NS = "http://www.w3.org/2000/svg";
  const C = 200, R = 150;
  const el = (tag, attrs, parent = svg) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  };
  const pt = (h, r) => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const arc = (h1, h2, r) => {
    const [x1, y1] = pt(h1, r), [x2, y2] = pt(h2, r);
    const large = ((h2 - h1 + 24) % 24) > 12 ? 1 : 0;
    return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  el("path", { d: arc(22, 7, R), class: "night", "stroke-width": 44 });
  el("circle", { cx: C, cy: C, r: R, class: "ring" });
  el("circle", { cx: C, cy: C, r: R - 34, class: "ring", "stroke-dasharray": "2 6" });
  for (let h = 0; h < 24; h++) {
    const [x1, y1] = pt(h, R + 4), [x2, y2] = pt(h, R + (h % 6 ? 9 : 14));
    el("line", { x1, y1, x2, y2, class: "tick" });
    if (h % 3 === 0) {
      const [tx, ty] = pt(h, R + 28);
      el("text", { x: tx, y: ty + 4, "text-anchor": "middle", class: "hour" }).textContent = String(h).padStart(2, "0");
    }
  }
  for (const j of jobs) {
    for (const t of j.at) {
      const [x, y] = pt(t, R - 17);
      el("circle", { cx: x, cy: y, r: 9, class: "pulse" });
      const dot = el("circle", { cx: x, cy: y, r: 5, class: "job" });
      el("title", {}, dot).textContent = `${j.label} — ${fmt(t)}`;
    }
  }
  const hand = el("line", { x1: C, y1: C, x2: C, y2: C - R + 30, class: "hand" });
  el("circle", { cx: C, cy: C, r: 4, fill: "currentColor" });
  const center = el("text", { x: C, y: C + 52, "text-anchor": "middle", class: "center" });
  el("text", { x: C, y: C + 72, "text-anchor": "middle", class: "center-sub" }).textContent = "PARIS TIME";

  function fmt(h) {
    const m = Math.round((h % 1) * 60);
    return `${String(Math.floor(h)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const legend = document.querySelector(".legend");
  function tick() {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date());
    const h = +parts.find((p) => p.type === "hour").value % 24;
    const m = +parts.find((p) => p.type === "minute").value;
    const now = h + m / 60;
    const [x, y] = pt(now, R - 30);
    hand.setAttribute("x2", x); hand.setAttribute("y2", y);
    center.textContent = fmt(now);
    if (legend) {
      // highlight the next job to run
      let best = null, bestD = 99;
      jobs.forEach((j, i) => j.at.forEach((t) => { const d = (t - now + 24) % 24; if (d < bestD) { bestD = d; best = i; } }));
      legend.querySelectorAll("li").forEach((li, i) => li.classList.toggle("live", i === best));
    }
  }
  if (legend) {
    legend.innerHTML = jobs.map((j) => `<li><time>${j.at.map(fmt).join(" · ")}</time><span>${j.label}</span></li>`).join("");
  }
  tick();
  setInterval(tick, 30000);
})();

// Other-work filters
(() => {
  const bar = document.querySelector(".filters");
  if (!bar) return;
  const items = document.querySelectorAll(".other li");
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    bar.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    const f = b.dataset.f;
    items.forEach((li) => (li.hidden = f !== "all" && !li.dataset.cat.split(" ").includes(f)));
  });
})();
