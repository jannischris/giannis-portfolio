// Robust SPA + Research Wall + Inline Article
// Fixes: null addEventListener crashes on GitHub Pages

const sections = ["home", "research", "about", "contact"];
let postsData = [];
let currentPost = null;

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function on(el, evt, fn, opts) {
  if (!el) return;
  el.addEventListener(evt, fn, opts);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inlineMd(text) {
  return String(text || "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function markdownToHtml(md) {
  const lines = String(md || "").split("\n");
  let html = "";
  let inList = false;

  const flushList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  for (let raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      html += `<h3>${inlineMd(escapeHtml(line.slice(3)))}</h3>`;
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMd(escapeHtml(line.slice(2)))}</li>`;
      continue;
    }

    flushList();
    html += `<p>${inlineMd(escapeHtml(line))}</p>`;
  }

  flushList();
  return html;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// ---------- Routing ----------
function readHash() {
  const raw = location.hash.replace("#", "");
  const params = new URLSearchParams(raw);
  return { s: params.get("s") || "home", post: params.get("post") };
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
    if (!el) return;
    el.classList.toggle("hidden", s !== normalized);
  });

  $$(".nav-btn").forEach((btn) => {
    const active = btn.dataset.section === normalized;
    btn.style.borderColor = active ? "rgba(106,169,255,.65)" : "rgba(36,42,61,.8)";
  });
}

// ---------- Elements (safe lookup) ----------
const statusEl = document.getElementById("status");
const tilesEl = document.getElementById("posts");      // grid container
const articleEl = document.getElementById("article");  // inline article container

const searchInput = document.getElementById("searchInput");
const tagSelect = document.getElementById("tagSelect");
const stageEl = document.getElementById("stage");
const resetTiltBtn = document.getElementById("resetTilt");

// Footer year (optional)
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---------- Navigation bindings (safe) ----------
$$(".nav-btn").forEach((btn) => {
  on(btn, "click", () => setHash(btn.dataset.section));
});

$$("[data-jump]").forEach((btn) => {
  on(btn, "click", () => setHash(btn.dataset.jump));
});

// ---------- Data ----------
async function loadPosts() {
  if (statusEl) {
    statusEl.textContent = "Loading posts…";
    statusEl.classList.remove("hidden");
  }

  try {
    const res = await fetch("./posts.json", { cache: "no-store" });
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

    if (statusEl) statusEl.classList.add("hidden");
  } catch (e) {
    console.error(e);
    if (statusEl) {
      statusEl.textContent = "Could not load posts.json. Check it exists in the repo root.";
      statusEl.classList.remove("hidden");
    }
  }
}

function uniqueTags(data) {
  return Array.from(new Set(data.flatMap((p) => p.tags))).sort();
}

function renderTagOptions() {
  if (!tagSelect) return;

  tagSelect.innerHTML = `<option value="all">All tags</option>`;
  uniqueTags(postsData).forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    tagSelect.appendChild(opt);
  });
}

function matchesFilters(post) {
  const q = (searchInput?.value || "").trim().toLowerCase();
  const tag = tagSelect?.value || "all";

  const hay = [post.title, post.subtitle, post.tags.join(" "), post.markdown].join(" ").toLowerCase();
  const inText = q === "" ? true : hay.includes(q);
  const inTag = tag === "all" ? true : post.tags.includes(tag);
  return inText && inTag;
}

on(searchInput, "input", () => renderTiles());
on(tagSelect, "change", () => renderTiles());

// ---------- Curved Z distribution ----------
function colsForViewport() {
  if (window.innerWidth < 820) return 2;
  if (window.innerWidth < 1200) return 3;
  return 4;
}

function zForIndex(i) {
  const cols = colsForViewport();
  const row = Math.floor(i / cols);
  const col = i % cols;

  const center = (cols - 1) / 2;
  const d = Math.abs(col - center);
  const colBoost = (1 - Math.min(1, d / (cols / 2))) * 70;
  const rowWave = Math.cos(row * 0.85) * 10;
  const base = 18;

  return Math.round(base + colBoost + rowWave);
}

// ---------- Tiles rendering ----------
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

  on(div, "click", () => setHash("research", post.id));
  return div;
}

function renderTiles() {
  if (!tilesEl) return;

  // hide article when browsing
  if (articleEl) articleEl.classList.add("hidden");
  currentPost = null;

  tilesEl.innerHTML = "";

  const filtered = postsData
    .filter(matchesFilters)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (filtered.length === 0) {
    if (statusEl) {
      statusEl.textContent = "No posts match your filters.";
      statusEl.classList.remove("hidden");
    }
    return;
  }

  if (statusEl) statusEl.classList.add("hidden");
  filtered.forEach((p, idx) => tilesEl.appendChild(tileCard(p, idx)));
}

// ---------- Inline article ----------
function openInline(post) {
  if (!articleEl) return;

  currentPost = post;

  const hero = post.thumbnail
    ? `<div class="hero"><div style="background-image:url('${post.thumbnail}')"></div></div>`
    : "";

  const tldr = (post.tldr || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("");

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
      <button class="btn" id="backBtn" type="button">← Back to wall</button>
      <button class="btn primary" id="copyBtn" type="button">Copy link</button>
    </div>
  `;

  articleEl.classList.remove("hidden");

  const backBtn = document.getElementById("backBtn");
  const copyBtn = document.getElementById("copyBtn");

  on(backBtn, "click", () => setHash("research"));

  on(copyBtn, "click", async () => {
    const link = `${location.origin}${location.pathname}#s=research&post=${encodeURIComponent(post.id)}`;
    try {
      await navigator.clipboard.writeText(link);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy link"), 1200);
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

// ---------- Tilt (mouse only, safe) ----------
function setTilt(rxDeg, ryDeg) {
  if (!tilesEl) return;
  tilesEl.style.setProperty("--rx", `${rxDeg}deg`);
  tilesEl.style.setProperty("--ry", `${ryDeg}deg`);
}

function initTilt() {
  if (!stageEl) return;

  const onMove = (e) => {
    const rect = stageEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const ry = (x - 0.5) * 34;
    const rx = (0.5 - y) * 18 + 16;
    setTilt(clamp(rx, 10, 22), clamp(ry, -22, 22));
  };

  on(stageEl, "mousemove", onMove, { passive: true });
  on(stageEl, "mouseleave", () => setTilt(16, -18), { passive: true });
  on(resetTiltBtn, "click", () => setTilt(16, -18));

  setTilt(16, -18);
}

// ---------- Route apply ----------
function applyRoute() {
  const { s, post } = readHash();
  showSection(s);

  if (s === "research") {
    if (post && postsData.length) {
      const found = postsData.find((p) => p.id === post);
      if (found) openInline(found);
      else renderTiles();
    } else {
      renderTiles();
    }
  }
}

on(window, "hashchange", applyRoute);
on(window, "resize", () => {
  if (readHash().s === "research") renderTiles();
});

// ---------- Init ----------
(async function init() {
  await loadPosts();

  if (!location.hash) setHash("home");

  initTilt();
  applyRoute();
})();