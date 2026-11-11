(function () {
  const $ = (s) => document.querySelector(s);
  const CATS = window.CATEGORIES, DATA = window.PROMPTS;
  const catMeta = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const LEVELS = ["Beginner", "Intermediate", "Advanced"];
  const state = { q: "", cat: "All", level: "All", favOnly: false };

  // storage helpers (may throw in private mode)
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  let favs = new Set(store.get("ph-favs", []));

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    kids.flat().forEach((c) => c != null && n.append(c));
    return n;
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 1600);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = el("textarea", { style: "position:fixed;opacity:0" }); ta.value = text;
      document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    toast("Copied to clipboard");
  }

  function toggleFav(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set("ph-favs", [...favs]);
    render();
  }

  // ---------- filters ----------
  function chip(label, pressed, onClick) {
    return el("button", { class: "chip", type: "button", "aria-pressed": String(pressed), onclick: onClick, text: label });
  }
  function renderFilters() {
    const cats = $("#cats"); cats.replaceChildren(
      chip("All", state.cat === "All", () => { state.cat = "All"; render(); }),
      ...CATS.map((c) => chip(`${c.icon} ${c.id}`, state.cat === c.id, () => { state.cat = c.id; render(); }))
    );
    const lv = $("#levels"); lv.replaceChildren(
      chip("Any level", state.level === "All", () => { state.level = "All"; render(); }),
      ...LEVELS.map((l) => chip(l, state.level === l, () => { state.level = l; render(); }))
    );
  }

  function matches(p) {
    if (state.cat !== "All" && p.cat !== state.cat) return false;
    if (state.level !== "All" && p.level !== state.level) return false;
    if (state.favOnly && !favs.has(p.id)) return false;
    if (state.q) {
      const hay = [p.title, p.summary, p.why, p.prompt, p.weak, p.cat, p.level, ...(p.tips || [])].join(" ").toLowerCase();
      return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  }

  // ---------- cards ----------
  function card(p) {
    const m = catMeta[p.cat];
    const heart = el("button", { class: "heart" + (favs.has(p.id) ? " on" : ""), type: "button", "aria-label": favs.has(p.id) ? "Remove from saved" : "Save", text: favs.has(p.id) ? "♥" : "♡",
      onclick: (e) => { e.stopPropagation(); toggleFav(p.id); } });
    const cp = el("button", { class: "mini", type: "button", text: "Copy prompt", onclick: (e) => { e.stopPropagation(); copy(p.prompt); } });
    const c = el("article", { class: "card", tabindex: "0", role: "button", "aria-label": `Open ${p.title}`, style: `--h:${m.hue}` },
      el("div", { class: "thumb" }, el("span", { class: "cat", text: p.cat }), el("span", { class: "ico", text: m.icon }), el("pre", { text: p.prompt })),
      el("div", { class: "cbody" },
        el("h3", { text: p.title }),
        el("p", { text: p.summary }),
        el("div", { class: "meta" }, el("span", { class: "badge", text: p.level }), el("span", { class: "spacer" }), cp, heart)));
    c.addEventListener("click", () => openModal(p.id));
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(p.id); } });
    return c;
  }

  function render() {
    renderFilters();
    const list = DATA.filter(matches);
    $("#grid").replaceChildren(...list.map(card));
    $("#empty").hidden = list.length > 0;
    $("#count").textContent = `${list.length} of ${DATA.length} techniques`;
  }

  // ---------- modal ----------
  let lastFocus = null;
  function section(title, node) { return [el("h4", { text: title }), node]; }
  function openModal(id, fromHash) {
    const p = DATA.find((x) => x.id === id); if (!p) return;
    lastFocus = document.activeElement;
    const body = $("#mBody");
    body.replaceChildren(
      el("span", { class: "badge", text: `${catMeta[p.cat].icon} ${p.cat} · ${p.level}` }),
      el("h2", { id: "mTitle", text: p.title }),
      el("p", { class: "sub", text: p.summary }),
      section("Why it works", el("div", { text: p.why })),
      section("Instead of this…", el("div", { class: "box weak", text: p.weak })),
      section("Try this", el("div", { class: "box code good", text: p.prompt })),
      el("div", { class: "actions" },
        el("button", { class: "btn", type: "button", text: "Copy prompt", onclick: () => copy(p.prompt) }),
        el("button", { class: "btn sec", type: "button", text: "Copy link", onclick: () => copy(location.origin + location.pathname + "#" + p.id) }),
        el("button", { class: "btn sec", type: "button", id: "mFav", text: favs.has(p.id) ? "♥ Saved" : "♡ Save", onclick: () => { toggleFav(p.id); $("#mFav").textContent = favs.has(p.id) ? "♥ Saved" : "♡ Save"; } })),
      p.result ? section("Sample result", el("div", { class: "box", text: p.result })) : null,
      p.tips && p.tips.length ? section("Tips", el("ul", {}, p.tips.map((t) => el("li", { text: t })))) : null
    );
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
    $("#mClose").focus();
    if (!fromHash) history.replaceState(null, "", "#" + id);
  }
  function closeModal() {
    $("#modal").hidden = true; document.body.style.overflow = "";
    history.replaceState(null, "", location.pathname + location.search);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }

  // ---------- wiring ----------
  $("#q").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  $("#favOnly").addEventListener("change", (e) => { state.favOnly = e.target.checked; render(); });
  $("#mClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
  window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (id) openModal(id, true); });

  $("#themeBtn").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("ph-theme", root.dataset.theme);
  });
  const saved = store.get("ph-theme", null); if (saved) document.documentElement.dataset.theme = saved;

  render();
  if (location.hash.length > 1) openModal(location.hash.slice(1), true);
})();
