// Internal owner tool, not storefront UI. Open http://127.0.0.1:5173/?edit-layout#home
// on the local dev server, drag the hero product cards,
// adjust tilt and size, then save: the layout goes to artifacts/hero-layout.json
// for the developer to turn into CSS. Its texts are Russian on purpose and stay
// out of the store dictionaries.
const draftKey = "buyduck:layout-draft";
const itemSelector = ".hero .floating-card";
let draft = loadDraft();
let selected = null;
let drag = null;

function loadDraft() {
  try {
    const value = JSON.parse(localStorage.getItem(draftKey));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}
function storeDraft() {
  try {
    localStorage.setItem(draftKey, JSON.stringify(draft));
  } catch {}
}
const hero = () => document.querySelector(".hero");
const itemKey = (item) => [...item.classList].find((c) => c.startsWith("float-"));
const itemName = (item) => item.querySelector("img")?.alt || itemKey(item);
const visibleItems = () => [...document.querySelectorAll(itemSelector)].filter((item) => item.getClientRects().length);

// Current geometry in hero pixels, measured around the centre so the tilt and
// any CSS translate do not matter.
function measure(item) {
  const h = hero().getBoundingClientRect();
  const r = item.getBoundingClientRect();
  const style = getComputedStyle(item);
  return {
    left: Math.round(r.left + r.width / 2 - h.left - item.offsetWidth / 2),
    top: Math.round(r.top + r.height / 2 - h.top - item.offsetHeight / 2),
    width: Math.round(item.offsetWidth),
    rotate: Math.round(parseFloat(style.rotate) || 0),
  };
}
function place(item, value) {
  Object.assign(item.style, {
    left: `${value.left}px`,
    top: `${value.top}px`,
    right: "auto",
    bottom: "auto",
    translate: "none",
    width: `${value.width}px`,
    rotate: `${value.rotate}deg`,
    ...(value.height ? { height: `${value.height}px` } : {}),
  });
}
function applyDraft() {
  for (const item of visibleItems()) {
    const value = draft[itemKey(item)];
    if (value) place(item, value);
    item.classList.toggle("is-layout-selected", itemKey(item) === selected);
  }
  syncPanel();
}
function edit(item, change) {
  const key = itemKey(item);
  const current = draft[key] || measure(item);
  const next = { ...current, ...change };
  draft[key] = next;
  place(item, next);
  storeDraft();
  syncPanel();
}
function select(item) {
  selected = item ? itemKey(item) : null;
  applyDraft();
}
const selectedItem = () => visibleItems().find((item) => itemKey(item) === selected);

const panel = document.createElement("aside");
panel.className = "layout-panel";
panel.setAttribute("aria-label", "Редактор раскладки первого экрана");
panel.innerHTML = `<header><strong>Раскладка первого экрана</strong><button type="button" data-layout="collapse" aria-expanded="true">Свернуть</button></header><div class="layout-body"><p class="layout-hint">Саму панель можно перетащить за заголовок. Перетаскивайте мышкой карточки товаров и мультяшную одежду. Выбранный элемент можно двигать стрелками (Shift — шаг 10px), наклон и размер — ползунками. Одежда в этом режиме не улетает в корзину.</p><p class="layout-selected">Элемент не выбран</p><label>Наклон <output data-out="rotate">—</output><input type="range" min="-45" max="45" step="1" data-input="rotate" disabled /></label><label>Ширина <output data-out="width">—</output><input type="range" min="30" max="320" step="1" data-input="width" disabled /></label><div class="layout-actions"><button type="button" data-layout="save" class="is-primary">Сохранить</button><button type="button" data-layout="copy">Скопировать JSON</button><button type="button" data-layout="reset-item" disabled>Вернуть элемент</button><button type="button" data-layout="reset">Сбросить всё</button></div><p class="layout-status" role="status" aria-live="polite"></p></div>`;

function syncPanel() {
  const item = selectedItem();
  const value = item && (draft[selected] || measure(item));
  panel.querySelector(".layout-selected").textContent = item ? `${itemName(item)} (${selected})` : "Элемент не выбран";
  for (const name of ["rotate", "width"]) {
    const input = panel.querySelector(`[data-input="${name}"]`);
    input.disabled = !item;
    if (item) input.value = value[name];
    panel.querySelector(`[data-out="${name}"]`).textContent = item ? `${value[name]}${name === "rotate" ? "°" : "px"}` : "—";
  }
  panel.querySelector('[data-layout="reset-item"]').disabled = !item || !draft[selected];
}
function status(message) {
  panel.querySelector(".layout-status").textContent = message;
}
function snapshot() {
  const h = hero().getBoundingClientRect();
  const describe = (item) => {
    const value = draft[itemKey(item)] || measure(item);
    return {
      id: itemKey(item),
      product: item.dataset.id,
      moved: Boolean(draft[itemKey(item)]),
      ...value,
      height: value.height || item.offsetHeight,
      // Centre as a share of the hero, handy for responsive CSS.
      centerX: +((value.left + item.offsetWidth / 2) / h.width).toFixed(4),
      centerY: +((value.top + item.offsetHeight / 2) / h.height).toFixed(4),
      right: Math.round(h.width - value.left - item.offsetWidth),
      bottom: Math.round(h.height - value.top - item.offsetHeight),
    };
  };
  const items = visibleItems();
  return {
    savedAt: new Date().toISOString(),
    viewport: { width: innerWidth, height: innerHeight },
    hero: { width: Math.round(h.width), height: Math.round(h.height) },
    cards: items.map(describe),
  };
}

// The panel moves by its header so it never hides an item underneath.
panel.querySelector("header").addEventListener("pointerdown", (event) => {
  if (event.target.closest("button") || event.button !== 0) return;
  const r = panel.getBoundingClientRect();
  const offset = { x: event.clientX - r.left, y: event.clientY - r.top };
  const header = event.currentTarget;
  header.setPointerCapture(event.pointerId);
  const move = (e) =>
    Object.assign(panel.style, {
      left: `${Math.max(0, Math.min(innerWidth - r.width, e.clientX - offset.x))}px`,
      top: `${Math.max(0, Math.min(innerHeight - 40, e.clientY - offset.y))}px`,
      right: "auto",
      bottom: "auto",
    });
  header.addEventListener("pointermove", move);
  header.addEventListener("pointerup", () => header.removeEventListener("pointermove", move), { once: true });
});
document.addEventListener("pointerdown", (event) => {
  const item = event.target.closest(itemSelector);
  if (!item || event.button !== 0) return;
  event.preventDefault();
  select(item);
  const start = draft[itemKey(item)] || measure(item);
  drag = { item, x: event.clientX, y: event.clientY, left: start.left, top: start.top, moved: false };
  item.setPointerCapture(event.pointerId);
});
document.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  if (drag.moved) edit(drag.item, { left: Math.round(drag.left + dx), top: Math.round(drag.top + dy) });
});
document.addEventListener("pointerup", () => {
  if (drag?.moved) status("Позиция изменена — не забудьте сохранить");
  drag = null;
});
// In edit mode a click selects the item instead of opening a product
// (keyboard activation also arrives as a click).
window.addEventListener(
  "click",
  (event) => {
    const item = event.target.closest(itemSelector);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    select(item);
  },
  true,
);
document.addEventListener("keydown", (event) => {
  const item = selectedItem();
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!item || !moves[event.key] || event.target.closest("input, select, textarea")) return;
  event.preventDefault();
  const step = event.shiftKey ? 10 : 1;
  const value = draft[selected] || measure(item);
  edit(item, { left: value.left + moves[event.key][0] * step, top: value.top + moves[event.key][1] * step });
});
panel.addEventListener("input", (event) => {
  const name = event.target.dataset.input;
  const item = selectedItem();
  if (name && item) edit(item, { [name]: Number(event.target.value) });
});
panel.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-layout]")?.dataset.layout;
  if (action === "collapse") {
    const collapsed = panel.classList.toggle("is-collapsed");
    event.target.textContent = collapsed ? "Развернуть" : "Свернуть";
    event.target.setAttribute("aria-expanded", String(!collapsed));
  }
  if (action === "save") {
    try {
      const response = await fetch("/__layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot(), null, 2),
      });
      if (!response.ok) throw new Error(response.status);
      status(`Сохранено ${new Date().toLocaleTimeString("ru-RU")} в artifacts/hero-layout.json`);
    } catch {
      status("Сервер не принял сохранение. Нажмите «Скопировать JSON» и пришлите текст в чат.");
    }
  }
  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot(), null, 2));
      status("JSON скопирован");
    } catch {
      status("Браузер не дал скопировать");
    }
  }
  if (action === "reset-item" && selected) {
    delete draft[selected];
    storeDraft();
    selectedItem()?.removeAttribute("style");
    applyDraft();
    status("Элемент возвращён на место из CSS");
  }
  if (action === "reset") {
    draft = {};
    storeDraft();
    visibleItems().forEach((item) => item.removeAttribute("style"));
    applyDraft();
    status("Все элементы возвращены на места из CSS");
  }
});

const style = document.createElement("style");
style.textContent = `
.layout-edit .hero .floating-card { cursor: grab; touch-action: none; transition: none; animation: none; user-select: none; }
.layout-edit .hero .floating-card:active { cursor: grabbing; }
.layout-edit .hero .floating-card:hover { transform: none; }
.layout-edit .hero .floating-card img { pointer-events: none; }
.layout-edit .hero .is-layout-selected { outline: 3px solid #5433eb; outline-offset: 3px; z-index: 5; }
.layout-panel { position: fixed; right: 16px; bottom: 16px; z-index: 1000; width: 310px; max-width: calc(100vw - 32px); background: #fff; color: #161616; border-radius: 20px; box-shadow: 0 12px 40px #0000002e; font: 13px/1.45 system-ui, sans-serif; }
.layout-panel header { cursor: move; touch-action: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-bottom: 1px solid #ebebeb; }
.layout-panel.is-collapsed .layout-body { display: none; }
.layout-panel.is-collapsed header { border-bottom: 0; }
.layout-body { padding: 12px 16px 14px; display: grid; gap: 10px; }
.layout-hint, .layout-status { color: #787574; font-size: 12px; margin: 0; }
.layout-selected { margin: 0; font-weight: 600; }
.layout-panel label { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; }
.layout-panel input[type=range] { grid-column: 1 / -1; accent-color: #5433eb; }
.layout-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.layout-panel button { border: 1px solid #ebebeb; background: #fff; border-radius: 9999px; padding: 7px 12px; font: inherit; cursor: pointer; }
.layout-panel button:disabled { opacity: .5; cursor: default; }
.layout-panel button.is-primary { background: #161616; border-color: #161616; color: #fff; }
`;
document.head.append(style);
document.documentElement.classList.add("layout-edit");
document.body.append(panel);
// The store re-renders #app on language, favourites and navigation; reapply after it.
new MutationObserver(() => applyDraft()).observe(document.querySelector("#app"), { childList: true });

// Without a draft in this browser, continue from the last layout saved on disk.
async function start() {
  if (!draft) {
    draft = {};
    try {
      const saved = await fetch("/__layout").then((r) => (r.ok ? r.json() : null));
      for (const item of saved?.cards || []) {
        const id = item.id || item.card;
        if (item.moved && id)
          draft[id] = { left: item.left, top: item.top, width: item.width, rotate: item.rotate };
      }
      if (Object.keys(draft).length) status("Загружена последняя сохранённая раскладка");
    } catch {}
    storeDraft();
  }
  applyDraft();
}
start();
