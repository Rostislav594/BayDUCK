import { imageUrl, productById } from "./data.js";
import { catalogStore, createProductsAdmin } from "./admin-products.js";
import { dictionaries } from "./i18n.js";
import { clearEvents, periodDays, readEvents, summarize } from "./analytics.js";
import { createOrderStore, orderStatuses, trackingUrl } from "./orders.js";

const orderStore = createOrderStore();

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
const state = { language: readLanguage(), period: "week", orderFilter: "all" };
const t = (key) => dictionaries[state.language][key] || key;
const locale = () => ({ uk: "uk-UA", ru: "ru-UA" })[state.language];
const money = (value) =>
  new Intl.NumberFormat(
    locale(),
    { style: "currency", currency: "UAH", maximumFractionDigits: 0 },
  ).format(value);
const paths = {
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  down: '<path d="M12 3v13m-5-5 5 5 5-5M4 21h16"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  arrow: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bag: '<path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
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
const productsAdmin = createProductsAdmin({ t, escape, money, icon, toast, render, state });
function route() {
  // #products, #products/new, #products/edit/<id>, #products/olx/<id>
  const [path = ""] = location.hash.slice(1).split("?");
  const [page = "", sub = "", id = ""] = path.split("/");
  return {
    page: ["products", "orders", "activity", "olx"].includes(page) ? page : "products",
    sub,
    id: decodeURIComponent(id),
  };
}
function header(page) {
  const tabs = [
    ["products", "box", t("adminProducts")],
    ["orders", "bag", t("adminOrders")],
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

function olxView() {
  const actions = [
    ["link", "olxConnect"],
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
    ["statOlxClicks", number(data.olxClicks)],
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

const statusText = (status) => t(`status${status[0].toUpperCase()}${status.slice(1)}`);
const orderTime = (time) =>
  new Intl.DateTimeFormat(locale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);

function orderAdminCard(order) {
  const items = order.items
    .map((item) => {
      const p = productById(item.id);
      return `<li>${p ? `<img src="${imageUrl(p.image)}" alt="" width="48" height="48" loading="lazy"/>` : ""}<span><strong>${escape(p ? p.name : item.id)}</strong><small>${t("sizeLabel")}: ${escape(item.size)} · ${number(item.quantity)} ${t("qtyShort")}</small></span><span class="admin-num">${money(item.price * item.quantity)}</span></li>`;
    })
    .join("");
  const phone = order.customer.phone;
  const contacts = `<a class="admin-pill ${order.confirm === "viber" ? "admin-pill--dark" : ""}" href="viber://chat?number=${encodeURIComponent(phone)}">${t("writeViber")}</a><a class="admin-pill ${order.confirm === "telegram" ? "admin-pill--dark" : ""}" href="https://t.me/${encodeURIComponent(phone)}" target="_blank" rel="noopener noreferrer">${t("writeTelegram")}</a>`;
  const statuses = orderStatuses
    .map(
      (status) =>
        `<option value="${status}" ${order.status === status ? "selected" : ""}>${statusText(status)}</option>`,
    )
    .join("");
  const reminder = ["new", "confirmed"].includes(order.status)
    ? `<p class="admin-hint order-reminder">${t("olxReminder")}</p>`
    : "";
  const tracking = order.waybill
    ? `<a href="${trackingUrl(order.waybill)}" target="_blank" rel="noopener noreferrer">${t("trackParcel")}${icon("external")}</a>`
    : "";
  return `<article class="order-admin status-${order.status}"><header><div><h2>${escape(order.number)}</h2><p>${orderTime(order.createdAt)} · ${t(order.accountId ? "orderRegistered" : "orderGuest")}</p></div><label class="admin-control order-status-control">${t("orderStatusLabel")}<select data-order-status="${escape(order.number)}">${statuses}</select></label></header>${reminder}<div class="order-admin-grid"><section><h3>${t("adminColProduct")}</h3><ul class="order-admin-items">${items}</ul><p class="order-admin-total"><span>${t("total")}</span><strong>${money(order.total)}</strong></p></section><section><h3>${t("orderCustomer")}</h3><p><strong>${escape(`${order.customer.lastName} ${order.customer.firstName}`)}</strong><br/><a href="tel:${escape(phone)}">${escape(phone)}</a></p><p class="order-admin-contacts">${contacts}</p><dl><dt>${t("orderConfirmVia")}</dt><dd>${order.confirm === "telegram" ? "Telegram" : "Viber"}</dd><dt>${t("orderDelivery")}</dt><dd>${escape(order.delivery.city)}, ${t(order.delivery.type === "locker" ? "deliveryLocker" : "deliveryBranch")} №${escape(order.delivery.point)}</dd><dt>${t("paymentTitle")}</dt><dd>${t(order.payment === "card" ? "paymentCard" : "paymentCod")}</dd>${order.comment ? `<dt>${t("orderComment")}</dt><dd>${escape(order.comment)}</dd>` : ""}</dl></section></div><form class="order-waybill" data-waybill="${escape(order.number)}"><label class="admin-control">${t("waybillLabel")}<input name="waybill" inputmode="numeric" maxlength="20" placeholder="${escape(t("waybillPlaceholder"))}" value="${escape(order.waybill || "")}"/></label><button type="submit" class="admin-pill">${t("saveWaybill")}</button>${tracking}</form></article>`;
}

function ordersView() {
  const all = orderStore.list();
  const counts = Object.fromEntries(
    orderStatuses.map((status) => [status, all.filter((order) => order.status === status).length]),
  );
  const filters = [["all", t("ordersFilterAll"), all.length], ...orderStatuses.map((status) => [status, statusText(status), counts[status]])]
    .filter(([value, , total]) => value === "all" || total > 0 || value === state.orderFilter)
    .map(
      ([value, label, total]) =>
        `<button type="button" class="admin-pill ${state.orderFilter === value ? "admin-pill--dark" : ""}" data-order-filter="${value}" aria-pressed="${state.orderFilter === value}">${escape(label)} <span class="admin-count">${number(total)}</span></button>`,
    )
    .join("");
  const visible =
    state.orderFilter === "all" ? all : all.filter((order) => order.status === state.orderFilter);
  const head = `<div class="admin-card-head"><div><h1 id="orders-title">${t("adminOrders")} <span class="admin-count">${number(all.length)}</span></h1><p>${t("ordersAdminCopy")}</p></div></div>`;
  if (!all.length)
    return `<section class="admin-card" aria-labelledby="orders-title">${head}<div class="activity-empty">${icon("box")}<h2>${t("ordersEmpty")}</h2><p>${t("ordersEmptyCopy")}</p><a class="admin-pill admin-pill--dark" href="index.html" target="_blank" rel="noopener">${t("activityOpenStore")}${icon("external")}</a></div></section>`;
  return `<section class="admin-card" aria-labelledby="orders-title">${head}<div class="activity-periods" role="group" aria-label="${escape(t("orderStatusLabel"))}">${filters}</div><div class="order-admin-list">${visible.map(orderAdminCard).join("")}</div></section>`;
}

function render() {
  const r = route();
  document.documentElement.lang = state.language;
  document.title = t("adminPageTitle");
  const view =
    r.page === "olx"
      ? olxView()
      : r.page === "activity"
        ? activityView()
        : r.page === "orders"
          ? ordersView()
          : productsAdmin.view(r.sub, r.id);
  $("#admin").innerHTML = `${header(r.page)}<main id="admin-main" class="admin-main" tabindex="-1">${view}</main>`;
}
document.addEventListener("click", (event) => {
  if (productsAdmin.handleClick(event)) return;
  const filter = event.target.closest("[data-order-filter]");
  if (filter && (filter.dataset.orderFilter === "all" || orderStatuses.includes(filter.dataset.orderFilter))) {
    state.orderFilter = filter.dataset.orderFilter;
    render();
    document.querySelector(`[data-order-filter="${state.orderFilter}"]`)?.focus();
  }
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
});
document.addEventListener("change", (event) => {
  if (productsAdmin.handleChange(event)) return;
  const statusSelect = event.target.closest("[data-order-status]");
  if (statusSelect) {
    const result = orderStore.update(statusSelect.dataset.orderStatus, { status: statusSelect.value });
    toast(result.ok ? t("orderUpdated") : t(`err${result.error[0].toUpperCase()}${result.error.slice(1)}`));
    render();
    document.querySelector(`[data-order-status="${statusSelect.dataset.orderStatus}"]`)?.focus();
    return;
  }
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
  if (event.key === "buyduck:orders" && route().page === "orders") render();
  // A sale in the store tab marks items sold; refresh the list but never wipe an open form.
  if (event.key === "buyduck:catalog") {
    catalogStore.load();
    if (route().page === "products" && !route().sub) render();
  }
});
document.addEventListener("submit", (event) => {
  if (productsAdmin.handleSubmit(event)) return;
  const form = event.target.closest("[data-waybill]");
  if (!form) return;
  event.preventDefault();
  const number = form.dataset.waybill;
  const result = orderStore.update(number, { waybill: form.elements.waybill.value });
  toast(result.ok ? t("orderUpdated") : t(`err${result.error[0].toUpperCase()}${result.error.slice(1)}`));
  if (!result.ok) return form.elements.waybill.focus();
  render();
  document.querySelector(`[data-waybill="${number}"] input`)?.focus();
});
window.addEventListener("hashchange", () => {
  render();
  $("#admin-main").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
});
render();
