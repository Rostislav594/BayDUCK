import { products, productById } from "./data.js";
import { dictionaries } from "./i18n.js";
import {
  buildShafaListing,
  defaultShafaSection,
  shafaConditions,
  shafaSections,
} from "./marketplace.js";
import { clearEvents, periodDays, readEvents, summarize } from "./analytics.js";

// Admin placeholder: reads the demo catalog, saves nothing except the shared language choice.
// The admin is Ukrainian/Russian only; an English choice from the store falls back to Ukrainian.
const adminLanguages = { uk: "UA", ru: "RU" };
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function readLanguage() {
  try {
    const raw =
      localStorage.getItem("buyduck:language") ??
      localStorage.getItem("bayduck:language");
    const value = JSON.parse(raw);
    return Object.hasOwn(adminLanguages, value) ? value : "uk";
  } catch {
    return "uk";
  }
}
const state = { language: readLanguage(), shafa: null, period: "week" };
const t = (key) => dictionaries[state.language][key] || key;
const locale = () => ({ uk: "uk-UA", ru: "ru-UA" })[state.language];
const money = (value) =>
  new Intl.NumberFormat(
    locale(),
    { style: "currency", currency: "UAH", maximumFractionDigits: 0 },
  ).format(value);
const paths = {
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  down: '<path d="M12 3v13m-5-5 5 5 5-5M4 21h16"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  arrow: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

let toastTimeout;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $("#toast").classList.remove("visible"), 2500);
}
function route() {
  const [page = "", query = ""] = location.hash.slice(1).split("?");
  return {
    page: ["products", "activity", "shafa", "olx"].includes(page)
      ? page
      : "products",
    product: new URLSearchParams(query).get("product"),
  };
}
function shafaDefaults(id) {
  const product = productById(id) || products[0];
  return {
    id: product.id,
    size: product.sizes[0],
    section: defaultShafaSection(product),
    condition: "newTag",
    price: product.price,
    notes: "",
  };
}

function header(page) {
  const tabs = [
    ["products", "box", t("adminProducts")],
    ["shafa", "tag", "Shafa"],
    ["olx", "link", "OLX"],
    ["activity", "chart", t("adminActivity")],
  ];
  return `<header class="admin-header"><span class="admin-logo">Admin</span><p class="admin-stub" role="note">${t("adminStub")}</p><div class="admin-header-actions"><label class="language-control">${icon("globe")}<select id="language" aria-label="${escape(t("language"))}">${Object.entries(adminLanguages)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${state.language === value ? "selected" : ""}>${label}</option>`,
    )
    .join("")}</select></label><a class="admin-store-link" href="index.html">${icon("arrow")}${t("adminToStore")}</a></div></header><nav class="admin-tabs" aria-label="${escape(t("adminSections"))}">${tabs
    .map(
      ([key, glyph, label]) =>
        `<a href="#${key}" class="admin-tab ${page === key ? "active" : ""}" ${page === key ? 'aria-current="page"' : ""}>${icon(glyph)}${label}</a>`,
    )
    .join("")}</nav>`;
}

function productsView() {
  const rows = products
    .map(
      (p) =>
        `<tr><td><div class="admin-product"><img src="assets/products/${p.image}" alt="" width="56" height="56" loading="lazy"/><span><strong>${escape(p.name)}</strong><small>${escape(p.brand)} · ${t(p.color)}</small></span></div></td><td>${t(p.type)} · ${p.gender === "unisex" ? t("adminUnisex") : t(p.gender)}</td><td class="admin-num">${money(p.price)}</td><td class="admin-sizes">${p.sizes.join(", ")}</td><td><a class="admin-pill" href="#shafa?product=${p.id}">${icon("tag")}${t("adminPrepareShafa")}</a></td></tr>`,
    )
    .join("");
  return `<section class="admin-card" aria-labelledby="products-title"><div class="admin-card-head"><div><h1 id="products-title">${t("adminProducts")} <span class="admin-count">${products.length}</span></h1><p>${t("adminProductsCopy")}</p></div><button type="button" class="admin-pill" disabled aria-describedby="add-soon">${t("adminAddProduct")}<span id="add-soon" class="admin-soon">${t("adminSoon")}</span></button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th scope="col">${t("adminColProduct")}</th><th scope="col">${t("adminColCategory")}</th><th scope="col" class="admin-num">${t("adminColPrice")}</th><th scope="col">${t("adminColSizes")}</th><th scope="col"><span class="visually-hidden">${t("adminColActions")}</span></th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function outputField(key, label, value, multiline = false) {
  const id = `shafa-${key}`;
  const field = multiline
    ? `<textarea id="${id}" readonly rows="${value.split("\n").length + 1}">${escape(value)}</textarea>`
    : `<input id="${id}" type="text" readonly value="${escape(value)}"/>`;
  const counter =
    key === "title" || key === "description"
      ? `<small class="admin-chars">${value.length} ${t("adminChars")}</small>`
      : "";
  return `<div class="shafa-field"><div class="shafa-field-head"><label for="${id}">${label}</label>${counter}<button type="button" class="admin-copy" data-copy="${id}" aria-label="${escape(`${t("adminCopy")}: ${label}`)}">${icon("copy")}<span>${t("adminCopy")}</span></button></div>${field}</div>`;
}

function shafaView() {
  const s = state.shafa;
  const product = productById(s.id);
  const listing = buildShafaListing(s);
  const select = (name, label, options) =>
    `<label class="admin-control">${label}<select name="${name}">${options
      .map(
        ([value, text]) =>
          `<option value="${escape(value)}" ${String(s[name]) === String(value) ? "selected" : ""}>${escape(text)}</option>`,
      )
      .join("")}</select></label>`;
  const form = `<form id="shafa-form" class="shafa-form" aria-labelledby="shafa-settings">${select(
    "id",
    t("adminColProduct"),
    products.map((p) => [p.id, `${p.name} — ${t(p.type)}`]),
  )}${select(
    "size",
    t("sizeLabel"),
    product.sizes.map((size) => [size, size]),
  )}${select(
    "section",
    t("shafaSection"),
    shafaSections.map((value) => [value, t(value)]),
  )}${select(
    "condition",
    t("shafaCondition"),
    shafaConditions.map((value) => [
      value,
      t(`condition${value[0].toUpperCase()}${value.slice(1)}`),
    ]),
  )}<label class="admin-control">${t("shafaPrice")}<input name="price" type="number" inputmode="numeric" min="1" step="1" value="${escape(s.price)}"/></label><label class="admin-control admin-control--wide">${t("shafaNotes")}<textarea name="notes" rows="3" maxlength="500" placeholder="${escape(t("shafaNotesPlaceholder"))}">${escape(s.notes)}</textarea></label></form>`;
  const fields = [
    outputField("title", t("shafaFieldTitle"), listing.title),
    outputField("description", t("shafaFieldDescription"), listing.description, true),
    outputField("category", t("shafaFieldCategory"), listing.category),
    outputField("brand", t("shafaFieldBrand"), listing.brand),
    outputField("size", t("sizeLabel"), listing.size),
    outputField("condition", t("shafaCondition"), listing.condition),
    outputField("color", t("shafaFieldColor"), listing.color),
    outputField("price", t("adminColPrice"), listing.price),
  ].join("");
  return `<section class="admin-card" aria-labelledby="shafa-heading"><div class="admin-card-head"><div><h1 id="shafa-heading">${t("shafaTitle")}</h1><p>${t("shafaCopy")}</p></div><a class="admin-pill admin-pill--dark" href="https://shafa.ua/" target="_blank" rel="noopener noreferrer">${t("shafaOpen")}${icon("external")}</a></div><div class="shafa-layout"><div class="shafa-settings"><h2 id="shafa-settings">${t("shafaSettings")}</h2>${form}<div class="shafa-photo"><img src="${listing.photo}" alt="${escape(product.name)}" width="320" height="320"/><a class="admin-pill" href="${listing.photo}" download>${icon("down")}${t("shafaDownloadPhoto")}</a></div></div><div class="shafa-result" aria-live="polite"><h2>${t("shafaResult")}</h2>${fields}<p class="admin-hint">${t("shafaVerifyNote")}</p></div></div></section>`;
}

function olxView() {
  const actions = [
    ["link", "olxConnect"],
    ["down", "olxImport"],
    ["external", "olxPublish"],
  ]
    .map(
      ([glyph, key]) =>
        `<button type="button" class="admin-pill" disabled>${icon(glyph)}${t(key)}</button>`,
    )
    .join("");
  return `<section class="admin-card admin-stub-card" aria-labelledby="olx-title"><div class="admin-stub-icon">${icon("clock")}</div><h1 id="olx-title">${t("olxStubTitle")}</h1><p class="admin-status">${t("olxStubStatus")}</p><p>${t("olxStubCopy")}</p><div class="admin-stub-actions">${actions}</div><p class="admin-soon">${t("adminSoon")}</p></section>`;
}

const number = (value) => new Intl.NumberFormat(locale()).format(value);
const percent = (value) =>
  new Intl.NumberFormat(locale(), {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
const shortDate = (key) =>
  new Intl.DateTimeFormat(locale(), { day: "numeric", month: "short" }).format(
    new Date(`${key}T12:00:00`),
  );

function visitsChart(days) {
  const max = Math.max(1, ...days.map((day) => day.visits));
  // Label only some days on long periods so captions never collide.
  const every = days.length > 14 ? Math.ceil(days.length / 8) : 1;
  const bars = days
    .map((day, index) => {
      const label = `${shortDate(day.date)}: ${number(day.visits)}`;
      const quiet = index % every && index !== days.length - 1;
      return `<div class="activity-bar" tabindex="0" role="img" aria-label="${escape(label)}" data-tip="${escape(label)}" style="--h:${(day.visits / max) * 100}%"><span></span><small aria-hidden="true" ${quiet ? 'class="is-quiet"' : ""}>${escape(shortDate(day.date))}</small></div>`;
    })
    .join("");
  const rows = days
    .map(
      (day) =>
        `<tr><td>${escape(shortDate(day.date))}</td><td class="admin-num">${number(day.visits)}</td></tr>`,
    )
    .join("");
  return `<div class="activity-chart"><span class="activity-axis" aria-hidden="true">${number(max)}</span><div class="activity-bars" style="--bars:${days.length}">${bars}</div></div><details class="activity-table"><summary>${t("activityShowTable")}</summary><table class="admin-table"><thead><tr><th scope="col">${t("activityDate")}</th><th scope="col" class="admin-num">${t("statVisits")}</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

function activityView() {
  const data = summarize(readEvents(), { period: state.period });
  const periods = [
    ["today", "periodToday"],
    ["week", "periodWeek"],
    ["month", "periodMonth"],
    ["all", "periodAll"],
  ]
    .map(
      ([value, key]) =>
        `<button type="button" class="admin-pill ${state.period === value ? "admin-pill--dark" : ""}" data-period="${value}" aria-pressed="${state.period === value}">${t(key)}</button>`,
    )
    .join("");
  const head = `<div class="admin-card-head"><div><h1 id="activity-title">${t("activityTitle")}</h1><p>${t("activityLocalNote")}</p></div><button type="button" class="admin-pill" data-action="clear-activity">${icon("trash")}${t("activityClear")}</button></div><div class="activity-periods" role="group" aria-label="${escape(t("activityPeriod"))}">${periods}</div>`;
  if (data.empty)
    return `<section class="admin-card" aria-labelledby="activity-title">${head}<div class="activity-empty">${icon("chart")}<h2>${t("activityEmpty")}</h2><p>${t("activityEmptyCopy")}</p><a class="admin-pill admin-pill--dark" href="index.html" target="_blank" rel="noopener">${t("activityOpenStore")}${icon("external")}</a></div></section>`;
  const stats = [
    ["statVisits", number(data.visits)],
    ["statPageViews", number(data.pageViews)],
    ["statProductViews", number(data.productViews)],
    ["statAddToCart", number(data.addToCart)],
    ["statCheckouts", number(data.checkouts)],
    ["statOrders", number(data.orders)],
    ["statRevenue", money(data.revenue)],
    ["statConversion", percent(data.conversion)],
  ]
    .map(
      ([key, value]) =>
        `<div class="activity-stat"><span>${t(key)}</span><strong>${value}</strong></div>`,
    )
    .join("");
  const steps = [
    ["statVisits", data.funnel.visits],
    ["statProductViews", data.funnel.productView],
    ["statAddToCart", data.funnel.cart],
    ["statCheckouts", data.funnel.checkout],
    ["statOrders", data.funnel.order],
  ]
    .map(([key, value]) => {
      const share = data.funnel.visits ? value / data.funnel.visits : 0;
      return `<li><div class="activity-step-head"><span>${t(key)}</span><strong>${number(value)}</strong><small>${percent(share)} ${t("activityOfVisits")}</small></div><span class="activity-meter" aria-hidden="true"><span style="--w:${share * 100}%"></span></span></li>`;
    })
    .join("");
  const productRows = data.topProducts
    .map((row) => {
      const p = productById(row.id);
      return `<tr><td>${escape(p ? p.name : row.id)}</td><td class="admin-num">${number(row.views)}</td><td class="admin-num">${number(row.carts)}</td><td class="admin-num">${number(row.ordered)}</td></tr>`;
    })
    .join("");
  const searchRows = data.searches
    .map(
      (row) =>
        `<tr><td>${escape(row.query)}</td><td class="admin-num">${number(row.count)}</td></tr>`,
    )
    .join("");
  const productsTable = productRows
    ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th scope="col">${t("adminColProduct")}</th><th scope="col" class="admin-num">${t("activityViews")}</th><th scope="col" class="admin-num">${t("activityCarts")}</th><th scope="col" class="admin-num">${t("activityOrdered")}</th></tr></thead><tbody>${productRows}</tbody></table></div>`
    : `<p>${t("activityNoProducts")}</p>`;
  const searchesTable = searchRows
    ? `<table class="admin-table"><thead><tr><th scope="col">${t("activityQuery")}</th><th scope="col" class="admin-num">${t("activityTimes")}</th></tr></thead><tbody>${searchRows}</tbody></table>`
    : `<p>${t("activityNoSearches")}</p>`;
  return `<section class="admin-card" aria-labelledby="activity-title">${head}<div class="activity-stats">${stats}</div><p class="admin-hint">${t("activityOrdersDemo")}</p><div class="activity-grid"><section class="activity-panel"><h2>${t("activityVisitsByDay")}</h2>${visitsChart(data.days)}</section><section class="activity-panel"><h2>${t("activityFunnel")}</h2><p>${t("activityFunnelCopy")}</p><ol class="activity-funnel">${steps}</ol></section><section class="activity-panel"><h2>${t("activityTopProducts")}</h2>${productsTable}</section><section class="activity-panel"><h2>${t("activitySearches")}</h2>${searchesTable}</section></div></section>`;
}

function render() {
  const r = route();
  if (r.page === "shafa" && (!state.shafa || (r.product && r.product !== state.shafa.id)))
    state.shafa = shafaDefaults(r.product || state.shafa?.id);
  document.documentElement.lang = state.language;
  document.title = t("adminPageTitle");
  const view =
    r.page === "shafa"
      ? shafaView()
      : r.page === "olx"
        ? olxView()
        : r.page === "activity"
          ? activityView()
          : productsView();
  $("#admin").innerHTML = `${header(r.page)}<main id="admin-main" class="admin-main" tabindex="-1">${view}</main>`;
}
function rerenderKeepingFocus() {
  const active = document.activeElement;
  const name = active?.name;
  const start = active?.selectionStart;
  render();
  if (!name) return;
  const next = document.querySelector(`#shafa-form [name="${name}"]`);
  next?.focus();
  if (next && typeof start === "number" && "setSelectionRange" in next)
    try {
      next.setSelectionRange(start, start);
    } catch {}
}

async function copy(id) {
  const field = document.getElementById(id);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement))
    return;
  try {
    await navigator.clipboard.writeText(field.value);
    toast(t("adminCopied"));
  } catch {
    // Clipboard API can be blocked (embedded views, http on a LAN address).
    field.focus();
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {}
    toast(t(copied ? "adminCopied" : "adminCopyFailed"));
  }
}

document.addEventListener("click", (event) => {
  const period = event.target.closest("[data-period]");
  if (period && Object.hasOwn(periodDays, period.dataset.period)) {
    state.period = period.dataset.period;
    render();
    document.querySelector(`[data-period="${state.period}"]`)?.focus();
  }
  if (event.target.closest('[data-action="clear-activity"]')) {
    if (!confirm(t("activityClearConfirm"))) return;
    clearEvents();
    render();
    toast(t("activityCleared"));
  }
  const button = event.target.closest("[data-copy]");
  if (button) copy(button.dataset.copy);
});
document.addEventListener("input", (event) => {
  const form = event.target.closest("#shafa-form");
  if (!form || !state.shafa) return;
  const { name, value } = event.target;
  if (name === "id") {
    state.shafa = shafaDefaults(value);
    history.replaceState(null, "", `#shafa?product=${value}`);
  } else if (name === "price") {
    const price = Number(value);
    state.shafa.price = Number.isInteger(price) && price > 0 ? price : "";
  } else if (name in state.shafa) state.shafa[name] = value;
  rerenderKeepingFocus();
});
document.addEventListener("change", (event) => {
  if (event.target.id !== "language" || !Object.hasOwn(adminLanguages, event.target.value))
    return;
  state.language = event.target.value;
  try {
    localStorage.setItem("buyduck:language", JSON.stringify(state.language));
  } catch {}
  render();
  $("#language").focus();
});
// The store tab writes events to the same localStorage; refresh the open dashboard live.
window.addEventListener("storage", (event) => {
  if (event.key === "buyduck:events" && route().page === "activity") render();
});
window.addEventListener("hashchange", () => {
  render();
  $("#admin-main").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
});
render();
