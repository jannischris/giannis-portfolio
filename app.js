// 3D Research Wall (curved tiles) + Inline article (NO modal) — mouse tilt only

const sections = ["home", "research", "about", "contact"];

let postsData = [];
let currentPost = null;

const tilesEl = document.getElementById("posts");
const statusEl = document.getElementById("status");
const searchInput = document.getElementById("searchInput");
const tagSelect = document.getElementById("tagSelect");

const stageEl = document.getElementById("stage");
const articleEl = document.getElementById("article");
const resetTiltBtn = document.getElementById("resetTilt");

document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Minimal markdown (safe subset) ----------
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inlineMd(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function markdownToHtml(md) {
  const lines = (md || "").split("\n");
  let html = "";
  let inList = false;

  const flushList = () => {
    if (inList) { html += "</ul>"; inList = false; }
  };

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") { flushList(); continue; }

    if (line.startsWith("## ")) {
      flushList();
      html += `<h3>${inlineMd(escapeHtml(line.slice(3)))}</h3>`;
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inlineMd(escapeHtml(line.slice(2)))}</li>`;
      continue;
    }

    flushList();
    html += `<p>${inlineMd(escapeHtml(line))}</p>`;
  }

  flushList();
  return html;
}

// ---------- Routing ----------
function readHash() {
  const raw = location.hash.replace("#", "");
  const params = new URLSearchParams(raw);
  return {
    s: params.get("s") || "home",
    post: params.get("post")
  };
}

function setHash(section, postId = null) {
  const params = new URLSearchParams();
  params.set("s", section);
  if (postId) params.set("post", postId);
  location.hash = params.toString();
}

function showSection(id) {
  const normalized = sections.includes(id) ? id : "home";

  sections.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("hidden", s !== normalized);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.style.borderColor =
      btn.dataset.section === normalized ? "rgba(106,169,255,.65)" : "rgba(36,42,61,.8)";
  });
}

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => setHash(btn.dataset.section));
});
document.querySelectorAll("[data-jump]").forEach((btn) => {
  btn.addEventListener("click", () => setHash(btn.dataset.jump));
});

// ---------- Data ----------
async function loadPosts() {
  statusEl.textContent = "Loading posts…";
  statusEl.classList.remove("hidden");

  try {
    const res = await fetch("posts.json", { cache: "no-store" });
    if (!res.ok) throw new Error("posts.json not found");
    const data = await res.json();

    postsData = (Array.isArray(data) ? data : []).map((p) => ({
      id: String(p.id),
      title: String(p.title || ""),
      subtitle: String(p.subtitle || ""),
      thumbnail: String(p.thumbnail || ""),
      date: String(p.date || ""),
      tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
      tldr: Array.isArray(p.tldr) ? p.tldr.map(String) : [],
      markdown: String(p.markdown || "")
    }));

    renderTagOptions();
    renderTiles();
    statusEl.classList.add("hidden");
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Could not load posts.json (use Live Server).";
    statusEl.classList.remove("hidden");
  }
}

function uniqueTags(data) {
  return Array.from(new Set(data.flatMap((p) => p.tags))).sort();
}

function renderTagOptions() {
  tagSelect.innerHTML = `<option value="all">All tags</option>`;
  uniqueTags(postsData).forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    tagSelect.appendChild(opt);
  });
}

function matchesFilters(post) {
  const q = (searchInput.value || "").trim().toLowerCase();
  const tag = tagSelect.value;

  const hay = [post.title, post.subtitle, post.tags.join(" "), post.markdown].join(" ").toLowerCase();
  const inText = q === "" ? true : hay.includes(q);
  const inTag = tag === "all" ? true : post.tags.includes(tag);
  return inText && inTag;
}

searchInput.addEventListener("input", renderTiles);
tagSelect.addEventListener("change", renderTiles);

// ---------- Curved Z distribution (center-forward like reference) ----------
function colsForViewport() {
  if (window.innerWidth < 820) return 2;
  if (window.innerWidth < 1200) return 3;
  return 4;
}

function zForIndex(i) {
  const cols = colsForViewport();
  const row = Math.floor(i / cols);
  const col = i % cols;

  // Center columns come forward strongly (curved wall)
  const center = (cols - 1) / 2;
  const d = Math.abs(col - center);        // 0.. ~1.5
  const colBoost = (1 - Math.min(1, d / (cols / 2))) * 70; // 0..70

  // Slight row wave (keeps it organic but not “moving”)
  const rowWave = Math.cos(row * 0.85) * 10;

  // Base push so everything is forward
  const base = 18;

  return Math.round(base + colBoost + rowWave);
}

// ---------- Tiles ----------
function tileCard(post, index) {
  const div = document.createElement("div");
  div.className = "tile";

  const bg = post.thumbnail
    ? `url("${post.thumbnail}")`
    : `linear-gradient(135deg, rgba(106,169,255,.25), rgba(139,255,204,.18))`;

  div.style.setProperty("--bgimg", bg);
  div.style.setProperty("--z", `${zForIndex(index)}px`);

  const pills = post.tags.slice(0, 2).map((t) => `<span class="pill">${escapeHtml(t)}</span>`).join("");

  div.innerHTML = `
    <div class="tile-inner">
      <div class="tile-pills">${pills}</div>
      <h3 class="tile-title">${escapeHtml(post.title)}</h3>
      <p class="tile-sub">${escapeHtml(post.subtitle)}</p>
    </div>
  `;

  div.addEventListener("click", () => setHash("research", post.id));
  return div;
}

function renderTiles() {
  tilesEl.innerHTML = "";
  articleEl.classList.add("hidden");
  currentPost = null;

  const filtered = postsData
    .filter(matchesFilters)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (filtered.length === 0) {
    statusEl.textContent = "No posts match your filters.";
    statusEl.classList.remove("hidden");
    return;
  }

  statusEl.classList.add("hidden");
  filtered.forEach((p, idx) => tilesEl.appendChild(tileCard(p, idx)));
}

// ---------- Inline article ----------
function openInline(post) {
  currentPost = post;

  const hero = post.thumbnail
    ? `<div class="hero"><div style="background-image:url('${post.thumbnail}')"></div></div>`
    : "";

  const tldr = (post.tldr || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");

  articleEl.innerHTML = `
    ${hero}
    <h2>${escapeHtml(post.title)}</h2>
    <p class="muted">${escapeHtml(post.subtitle || "")}</p>
    <div class="card" style="margin-top:12px;">
      <strong>TL;DR</strong>
      <ul>${tldr}</ul>
    </div>
    <div style="margin-top:12px;">
      ${markdownToHtml(post.markdown)}
    </div>
    <div class="row" style="margin-top:16px;">
      <button class="btn" id="backBtn">← Back to wall</button>
      <button class="btn primary" id="copyBtn">Copy link</button>
    </div>
  `;

  articleEl.classList.remove("hidden");

  document.getElementById("backBtn").addEventListener("click", () => setHash("research"));

  document.getElementById("copyBtn").addEventListener("click", async () => {
    const link = `${location.origin}${location.pathname}#s=research&post=${encodeURIComponent(post.id)}`;
    try {
      await navigator.clipboard.writeText(link);
      const b = document.getElementById("copyBtn");
      b.textContent = "Copied!";
      setTimeout(() => (b.textContent = "Copy link"), 1200);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  });

  articleEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Tilt interaction (mouse only) ----------
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setTilt(rxDeg, ryDeg) {
  tilesEl.style.setProperty("--rx", `${rxDeg}deg`);
  tilesEl.style.setProperty("--ry", `${ryDeg}deg`);
}

function initTilt() {
  if (!stageEl) return;

  const onMove = (e) => {
    const rect = stageEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;   // 0..1
    const y = (e.clientY - rect.top) / rect.height;   // 0..1

    // stronger, “reference-like”
    const ry = (x - 0.5) * 34;        // -17..17
    const rx = (0.5 - y) * 18 + 16;   // base tilt
    setTilt(clamp(rx, 10, 22), clamp(ry, -22, 22));
  };

  stageEl.addEventListener("mousemove", onMove, { passive:true });
  stageEl.addEventListener("mouseleave", () => setTilt(16, -18), { passive:true });

  resetTiltBtn?.addEventListener("click", () => setTilt(16, -18));

  // default
  setTilt(16, -18);
}

// ---------- Apply route ----------
function applyRoute() {
  const { s, post } = readHash();
  showSection(s);

  if (s === "research" && post && postsData.length) {
    const found = postsData.find((p) => p.id === post);
    if (found) openInline(found);
  } else if (s === "research") {
    renderTiles();
  }
}

window.addEventListener("hashchange", applyRoute);
window.addEventListener("resize", () => {
  if (readHash().s === "research") renderTiles();
});

(async function init(){
  await loadPosts();
  if (!location.hash) setHash("home");
  initTilt();
  applyRoute();
})();
