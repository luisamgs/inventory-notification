const C = window.BK_CONFIG;
const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
const $ = (s) => document.querySelector(s);

const PROVIDER_EMOJI = { Terra: "🥬", Vicenzo: "🧀", Meat: "🥩", "Kitchen & cleaning": "🧽" };
const CATEGORY_EMOJI = {
  Dairy: "🥛", Vegan: "🌱", Vegetables: "🥕", "Dry pantry": "🌾", Waffles: "🧇",
  "Granola & bread": "🥣", "Kitchen & cleaning": "🧽",
};
const TYPES = [
  ["waffles", "🧇", "Waffles"], ["flammkuchen", "🥘", "Flammkuchen"],
  ["breakfast", "🍳", "Breakfast"], ["lunch_dinner", "🍽️", "Lunch/Dinner"],
];
const TYPE_LABEL = Object.fromEntries(TYPES.map(([k, e, l]) => [k, `${e} ${l}`]));

let items = [];
const byId = new Map();
const state = { tab: "ingredient", provider: null, category: null, type: null, q: "" };
const pending = new Map(); // item id -> timer of an unsaved count

// ---------- helpers ----------
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => String(Number(v));
const isLow = (it) => Number(it.current_qty) < Number(it.min_qty);
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function parseHalf(raw) {
  const v = Number(String(raw).trim().replace(",", "."));
  if (String(raw).trim() === "" || !Number.isFinite(v) || v < 0) return null;
  return Math.round(v * 2) / 2;
}

const dtf = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit",
  hour: "numeric", minute: "2-digit", hour12: true,
});
function fmtWhen(ts) {
  const p = Object.fromEntries(dtf.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day}/${p.month} ${p.hour.padStart(2, "0")}:${p.minute}${(p.dayPeriod || "").toLowerCase()}`;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2500);
}

function show(view) {
  for (const v of ["login", "name", "main", "settings"]) $(`#view-${v}`).hidden = v !== view;
  window.scrollTo(0, 0);
}

// ---------- boot / auth ----------
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return show("login");
  if (!store.get("bk_name")) return show("name");
  await loadItems();
  renderMain();
  show("main");
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#login-error");
  err.hidden = true;
  const { error } = await sb.auth.signInWithPassword({ email: C.TEAM_EMAIL, password: $("#login-password").value });
  if (error) { err.textContent = "Wrong password, try again."; err.hidden = false; return; }
  $("#login-password").value = "";
  boot();
});

$("#name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = $("#name-input").value.trim();
  if (!n) return;
  store.set("bk_name", n);
  boot();
});

sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") show("login"); });

async function loadItems() {
  const { data, error } = await sb.from("items").select("*").order("sort_order");
  if (error) { toast("Could not load items. Check your connection."); return; }
  for (const it of data) {
    if (pending.has(it.id)) continue; // keep the unsaved local value
    byId.set(it.id, it);
  }
  items = data.map((it) => byId.get(it.id));
}

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || $("#view-main").hidden) return;
  if (document.activeElement?.classList.contains("qty")) return;
  await loadItems();
  renderMain();
});

// ---------- main list ----------
for (const b of document.querySelectorAll(".tab")) {
  b.addEventListener("click", () => {
    state.tab = b.dataset.tab;
    state.provider = state.category = state.type = null;
    renderMain();
  });
}
$("#search").addEventListener("input", (e) => { state.q = e.target.value; renderList(); });

function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

function renderChips() {
  const chip = (kind, value, label) =>
    `<button class="chip${state[kind] === value ? " on" : ""}" data-kind="${kind}" data-value="${esc(value)}">${esc(label)}</button>`;
  let html = "";
  if (state.tab === "ingredient") {
    const ing = items.filter((i) => i.list === "ingredient");
    html += uniq(ing.map((i) => i.provider)).map((p) => chip("provider", p, `${PROVIDER_EMOJI[p] ?? ""} ${p}`)).join("");
    html += `<span class="chip-sep"></span>`;
    html += uniq(ing.map((i) => i.category)).map((c) => chip("category", c, `${CATEGORY_EMOJI[c] ?? ""} ${c}`)).join("");
  } else {
    html += TYPES.map(([k, e, l]) => chip("type", k, `${e} ${l}`)).join("");
  }
  $("#chips").innerHTML = html;
}

$("#chips").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  const { kind, value } = b.dataset;
  state[kind] = state[kind] === value ? null : value;
  renderChips(); renderList();
});

function visibleItems() {
  const q = norm(state.q.trim());
  return items.filter((i) =>
    i.list === state.tab &&
    (!state.provider || i.provider === state.provider) &&
    (!state.category || i.category === state.category) &&
    (!state.type || i.type === state.type) &&
    (!q || norm(i.name).includes(q)));
}

function groupLabel(i) {
  if (i.list === "production") return TYPE_LABEL[i.type] ?? "";
  return i.category && i.category !== i.provider ? `${i.provider} · ${i.category}` : i.provider;
}

function cardHtml(i) {
  const meta = i.last_counted_at
    ? `last counted: ${fmtWhen(i.last_counted_at)} · ${esc(i.last_counted_by)}` : "not counted yet";
  return `<div class="card${isLow(i) ? " low" : ""}" data-id="${i.id}">
    <div class="row1">
      <div class="name">${esc(i.name)}</div>
      ${isLow(i) ? `<span class="low-tag">LOW</span>` : ""}
      <button class="min">min ${num(i.min_qty)}</button>
    </div>
    <div class="row2">
      <button class="step" data-d="-0.5" aria-label="Minus">−</button>
      <input class="qty" inputmode="decimal" enterkeyhint="done" value="${num(i.current_qty)}" aria-label="Count">
      <button class="step" data-d="0.5" aria-label="Plus">+</button>
      <button class="unit${i.unit ? "" : " empty"}">${i.unit ? esc(i.unit) : "+ unit"}</button>
      <span class="saved">✓ saved</span>
    </div>
    <div class="meta">${meta}</div>
  </div>`;
}

function renderList() {
  const vis = visibleItems();
  let html = "", last = null;
  for (const i of vis) {
    const g = groupLabel(i);
    if (g !== last) { html += `<div class="group">${esc(g)}</div>`; last = g; }
    html += cardHtml(i);
  }
  $("#list").innerHTML = html || `<div class="empty-state">No items match.</div>`;
}

function renderBadges() {
  for (const b of document.querySelectorAll(".tab")) {
    b.classList.toggle("active", b.dataset.tab === state.tab);
    const n = items.filter((i) => i.list === b.dataset.tab && isLow(i)).length;
    const badge = b.querySelector(".badge");
    badge.hidden = !n; badge.textContent = n;
  }
}

function renderMain() { renderBadges(); renderChips(); renderList(); }

function refreshCard(id) {
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (!card) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = cardHtml(byId.get(id));
  const fresh = tmp.firstElementChild;
  // keep the input element (and focus) if the user is typing in it
  const input = card.querySelector(".qty");
  if (document.activeElement === input) fresh.querySelector(".qty").replaceWith(input);
  card.replaceWith(fresh);
  renderBadges();
  return fresh;
}

function flashSaved(id, ok) {
  const s = document.querySelector(`.card[data-id="${id}"] .saved`);
  if (!s) return;
  s.textContent = ok ? "✓ saved" : "not saved";
  s.classList.toggle("fail", !ok);
  s.classList.add("show");
  setTimeout(() => s.classList.remove("show"), ok ? 1500 : 4000);
}

function setLocalQty(id, qty, delay) {
  const it = byId.get(id);
  it.current_qty = qty;
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card && document.activeElement !== card.querySelector(".qty")) card.querySelector(".qty").value = num(qty);
  clearTimeout(pending.get(id));
  pending.set(id, setTimeout(() => saveCount(id), delay));
}

async function saveCount(id) {
  pending.delete(id);
  const it = byId.get(id);
  const { data, error } = await sb.rpc("set_count", { p_item: id, p_qty: it.current_qty, p_by: store.get("bk_name") || "?" });
  if (error) {
    const { data: fresh } = await sb.from("items").select("*").eq("id", id).single();
    if (fresh) Object.assign(it, fresh);
    refreshCard(id);
    flashSaved(id, false);
    if (error.code === "PGRST301" || /JWT|auth/i.test(error.message)) show("login");
    return;
  }
  if (pending.has(id)) return; // a newer change is queued; it will refresh the card
  Object.assign(it, data);
  refreshCard(id);
  flashSaved(id, true);
}

$("#list").addEventListener("click", async (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = card.dataset.id, it = byId.get(id);
  if (e.target.closest(".step")) {
    const d = Number(e.target.closest(".step").dataset.d);
    setLocalQty(id, Math.max(0, Number(it.current_qty) + d), 700);
  } else if (e.target.closest(".min")) {
    const v = prompt(`Minimum for ${it.name}`, num(it.min_qty));
    if (v === null) return;
    const q = parseHalf(v);
    if (q === null) return toast("Please enter a number like 2 or 1.5");
    await updateItem(id, { min_qty: q });
  } else if (e.target.closest(".unit")) {
    const v = prompt(`Unit for ${it.name} (e.g. Box, Jars, Blocks)`, it.unit ?? "");
    if (v === null) return;
    await updateItem(id, { unit: v.trim() || null });
  }
});

$("#list").addEventListener("change", (e) => {
  if (!e.target.classList.contains("qty")) return;
  const id = e.target.closest(".card").dataset.id;
  const q = parseHalf(e.target.value);
  if (q === null) { e.target.value = num(byId.get(id).current_qty); return toast("Please enter a number like 3 or 2.5"); }
  e.target.value = num(q);
  if (q !== Number(byId.get(id).current_qty)) setLocalQty(id, q, 0);
});
$("#list").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("qty")) e.target.blur();
});
$("#list").addEventListener("focusin", (e) => { if (e.target.classList.contains("qty")) e.target.select(); });

async function updateItem(id, patch) {
  const { data, error } = await sb.from("items").update(patch).eq("id", id).select().single();
  if (error) { toast("Not saved, please try again."); return false; }
  Object.assign(byId.get(id), data);
  if (!$("#view-main").hidden) { refreshCard(id); flashSaved(id, true); }
  return true;
}

// ---------- settings ----------
$("#open-settings").addEventListener("click", () => {
  $("#me-name").textContent = store.get("bk_name") || "";
  $("#settings-search").value = "";
  renderSettings();
  show("settings");
});
$("#close-settings").addEventListener("click", () => { renderMain(); show("main"); });
$("#change-name").addEventListener("click", () => {
  const n = prompt("Your first name", store.get("bk_name") || "");
  if (n && n.trim()) { store.set("bk_name", n.trim()); $("#me-name").textContent = n.trim(); }
});
$("#logout").addEventListener("click", () => sb.auth.signOut());
$("#settings-search").addEventListener("input", renderSettings);

function renderSettings() {
  const q = norm($("#settings-search").value.trim());
  let html = "", last = null;
  for (const i of items) {
    if (q && !norm(i.name).includes(q)) continue;
    const g = `${i.list === "ingredient" ? "Ingredients" : "Production"} · ${groupLabel(i)}`;
    if (g !== last) {
      html += `<div class="group">${esc(g)}</div><div class="set-row set-head"><span></span><span>Min</span><span>Unit</span></div>`;
      last = g;
    }
    html += `<div class="set-row" data-id="${i.id}">
      <div class="name">${esc(i.name)}</div>
      <input data-f="min_qty" inputmode="decimal" value="${num(i.min_qty)}" aria-label="Minimum">
      <input data-f="unit" value="${esc(i.unit ?? "")}" placeholder="unit" aria-label="Unit">
    </div>`;
  }
  $("#settings-list").innerHTML = html || `<div class="empty-state">No items match.</div>`;
}

$("#settings-list").addEventListener("change", async (e) => {
  const input = e.target, f = input.dataset.f;
  if (!f) return;
  const id = input.closest(".set-row").dataset.id, it = byId.get(id);
  let v;
  if (f === "min_qty") {
    v = parseHalf(input.value);
    if (v === null) { input.value = num(it.min_qty); return toast("Please enter a number like 2 or 1.5"); }
    input.value = num(v);
  } else v = input.value.trim() || null;
  if (await updateItem(id, { [f]: v })) {
    input.classList.add("ok");
    setTimeout(() => input.classList.remove("ok"), 1200);
  }
});

boot();
