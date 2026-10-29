import { imageUrl, isAvailable, products, productById, productImages } from "./data.js";
import { dictionaries } from "./i18n.js";
import { clothingMarkup, animateClothing, cancelClothingAnimations, resetClothingAnimations, syncClothingState } from "./playful-clothes.js";
import {
  filterProducts,
  sanitizeCart,
  cartCount,
  cartTotal,
  addToCart,
  footRange,
  inCart,
  newestProducts,
  relatedProducts,
} from "./model.js";
import { track } from "./analytics.js";
import { createAccountStore } from "./accounts.js";
import { createOrderStore, npDemoCities, trackingUrl } from "./orders.js";
import { createCatalogStore, shippedIds } from "./catalog.js";

const accounts = createAccountStore();
const orders = createOrderStore();
// The owner's catalog from the admin replaces the demo products before anything reads them.
const catalogStore = createCatalogStore();
catalogStore.load();

const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function readSaved(key, fallback) {
  try {
    // Fall back to the pre-rename prefix so saved carts and favorites survive.
    const raw =
      localStorage.getItem(`buyduck:${key}`) ??
      localStorage.getItem(`bayduck:${key}`);
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}
const savedLanguage = readSaved("language", "uk");
const savedFavorites = readSaved("favorites", []);
const state = {
  language: Object.hasOwn(dictionaries, savedLanguage) ? savedLanguage : "uk",
  favorites: Array.isArray(savedFavorites)
    ? [...new Set(savedFavorites.filter((id) => productById(id)))]
    : [],
  cart: sanitizeCart(readSaved("cart", [])),
  product: null,
  size: null,
  cartStep: "cart",
  // Nova Poshta checkout on the site, or OLX Safe Deal on the OLX listing.
  buyMethod: "np",
  // Unsent checkout fields, kept in memory only so switching methods keeps them.
  checkoutDraft: {},
  menu: false,
  account: accounts.current(),
  authView: "signin",
  // Where to continue after signing in from the checkout ("checkout") or elsewhere.
  authReturn: null,
  lastOrder: null,
};
const t = (key) => dictionaries[state.language][key] || key;
const money = (value) =>
  new Intl.NumberFormat(
    { uk: "uk-UA", ru: "ru-UA", en: "en-UA" }[state.language],
    { style: "currency", currency: "UAH", maximumFractionDigits: 0 },
  ).format(value);
const photo = (product) => imageUrl(product.image);
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bag: '<path d="M5 7h14l2 14H3L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  shoe: '<path d="M3 14c2-1 3-5 3-8l5 2 1 5 8 3 1 4H3v-6Z"/><path d="M4 17h16m-8-5 3-2m0 4 3-2"/>',
  shirt: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c-2 3-6 3-8 0Z"/>',
  cap: '<path d="M4 14v-3a8 8 0 0 1 16 0v3H4Zm0 0-2 4h16c3 0 4-2 2-4M12 3v11"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  down: '<path d="M12 3v17m-5-5 5 5 5-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
const iconButton = (name, action, label, extra = "") =>
  `<button type="button" class="icon-button" data-action="${action}" aria-label="${escape(label)}" ${extra}>${icon(name)}</button>`;

function save(key) {
  try {
    localStorage.setItem(`buyduck:${key}`, JSON.stringify(state[key]));
  } catch {
    toast(t("storageNotice"));
  }
}
let toastTimeout;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(
    () => $("#toast").classList.remove("visible"),
    3000,
  );
}
function route() {
  const [path = "", query = ""] = location.hash.slice(1).split("?");
  const [page, productId = ""] = path.split("/");
  const params = new URLSearchParams(query);
  return {
    page: ["catalog", "favorites", "account", "product"].includes(page) ? page : "home",
    productId: page === "product" ? decodeURIComponent(productId) : null,
    category: ["sneakers", "clothing", "accessories"].includes(
      params.get("category"),
    )
      ? params.get("category")
      : "all",
    gender: ["women", "men"].includes(params.get("gender"))
      ? params.get("gender")
      : "all",
    query: params.get("q") || "",
    sale: params.get("sale") === "1",
    sort: ["price-asc", "price-desc"].includes(params.get("sort"))
      ? params.get("sort")
      : "featured",
  };
}
function navigateFilters(changes) {
  const current = { ...route(), ...changes };
  const params = new URLSearchParams();
  if (current.category !== "all") params.set("category", current.category);
  if (current.gender !== "all") params.set("gender", current.gender);
  if (current.query) params.set("q", current.query);
  if (current.sale) params.set("sale", "1");
  if (current.sort !== "featured") params.set("sort", current.sort);
  location.hash = `${current.page === "favorites" ? "favorites" : "catalog"}${params.size ? "?" + params.toString() : ""}`;
}
function favoriteButton(id) {
  const active = state.favorites.includes(id);
  return `<button type="button" class="favorite-button ${active ? "is-favorite" : ""}" data-action="favorite" data-id="${id}" aria-pressed="${active}" aria-label="${escape(t(active ? "removeFavorite" : "addFavorite"))}: ${escape(productById(id).name)}">${icon("heart")}</button>`;
}
// "42 EU" for shoes, "M" for clothing, "One size" for accessories.
const sizeText = (product) =>
  product.size === "ONE SIZE"
    ? t("oneSize")
    : product.type === "sneakers"
      ? `${state.language === "en" ? product.size : product.size.replace(".", ",")} EU`
      : product.size;
const insoleText = (product) =>
  product.insoleCm
    ? `${new Intl.NumberFormat({ uk: "uk-UA", ru: "ru-UA", en: "en-GB" }[state.language]).format(product.insoleCm)} ${t("cmShort")}`
    : "";
const conditionBadge = (product, extra = "") =>
  product.status === "sold"
    ? `<span class="condition-badge condition-sold ${extra}">${t("soldBadge")}</span>`
    : `<span class="condition-badge condition-${product.condition} ${extra}">${t(product.condition === "newTag" ? "condNewTag" : "condUsed")}</span>`;
const footRulerIcon = `<svg class="foot-ruler" viewBox="0 0 26 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.4 18.5C2.2 14.6 4.6 12 8.2 12c3.6 0 5.8 2.4 5.6 6.4-.2 3.6-2.2 6-2.5 9.6-.3 3.2.9 5.4.7 8.6-.2 3.4-2 5.4-4.1 5.4-2.3 0-3.9-1.8-3.9-5 0-3.6-.5-6.2-1-10.2-.3-2.8-.5-5.4-.6-8.3Z"/><g fill="currentColor" stroke="none"><circle cx="12.3" cy="7.5" r="1.75"/><circle cx="8.65" cy="6.2" r="1.25"/><circle cx="5.75" cy="7" r="1.1"/><circle cx="3.5" cy="8.7" r=".95"/><circle cx="2.2" cy="10.9" r=".8"/></g><rect x="18" y="2.5" width="5.5" height="39" rx="1.6"/><path d="M18 8h2.4M18 13h3.4M18 18h2.4M18 23h3.4M18 28h2.4M18 33h3.4M18 38h2.4"/></svg>`;
// Decorative drawings for the size and condition boxes, same style as the foot guide.
const sizeTagIcon = `<svg class="fact-drawing" viewBox="0 0 26 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 13.5c-2.6-3.2-4.4-7.7-1.8-9.6 2.4-1.7 5.6 1 4.4 4.6"/><path d="M7.5 15.5 13 10.5l5.5 5v24a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2Z"/><circle cx="13" cy="15.6" r="1.4"/><path d="M10.3 23h5.4M10.3 27.5h5.4M10.3 32h3.6"/></svg>`;
// Closed box for new items with tags, open box for pre-owned ones.
const closedBoxIcon = `<svg class="fact-drawing is-wide" viewBox="0 18 30 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 24h22v5H2zM2 24l3.5-4H27l-3 4M24 29l3-4v-5"/><path d="M3 29h20v11.2H3zM23 29l3-3.4v10.4l-3 4.2"/><path d="M8 34.6h10"/></svg>`;
const shoeBoxIcon = `<svg class="fact-drawing" viewBox="0 0 30 44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 24 9 9.2l19 1.4L26 24"/><path d="M8.6 12.2l18.9 1.4"/><path d="M3 28h20v12.2H3zM3 28l4-4h19l-3 4M23 28l3-4v11.6l-3 4.6"/><path d="M8.2 26.6c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0"/><path d="M8 34.2h10"/></svg>`;
// Drawing that opens a short note under its box (size label, condition).
const factTip = (key, label, drawing, text) =>
  `<button type="button" class="fact-info-button" data-action="fact-tip" aria-expanded="false" aria-controls="tip-${key}" aria-label="${escape(label)}" title="${escape(label)}">${drawing}</button><span class="fact-tip" id="tip-${key}" role="note" hidden>${escape(text)}</span>`;
function closeFactTips(except = null) {
  for (const button of document.querySelectorAll('[data-action="fact-tip"][aria-expanded="true"]')) {
    if (button === except) continue;
    button.setAttribute("aria-expanded", "false");
    document.getElementById(button.getAttribute("aria-controls")).hidden = true;
  }
}
function toggleFactTip(button) {
  const tip = document.getElementById(button.getAttribute("aria-controls"));
  const open = tip.hidden;
  closeFactTips(button);
  tip.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (!open) return;
  // Keep the note on screen: shift it left when the box sits near the right edge.
  tip.style.left = "0px";
  const box = tip.parentElement.getBoundingClientRect();
  const overflow = box.left + tip.offsetWidth - (document.documentElement.clientWidth - 16);
  if (overflow > 0) tip.style.left = `${-overflow}px`;
}
const cmNumber = (value) =>
  new Intl.NumberFormat({ uk: "uk-UA", ru: "ru-UA", en: "en-GB" }[state.language], { maximumFractionDigits: 1 }).format(value);
function productCard(product, index = 0) {
  return `<article class="product-card" style="--order:${index}"><div class="product-visual"><a class="product-open" href="#product/${product.id}" aria-label="${escape(product.name)}"><img src="${photo(product)}" alt="${escape(product.name)} — ${escape(t(product.color))}" loading="lazy" width="600" height="600" /></a>${conditionBadge(product, "product-tag")}${favoriteButton(product.id)}<span class="quick-view" aria-hidden="true">${icon("plus")}</span></div><div class="product-meta"><div><p class="product-brand">${product.brand}</p><a class="product-name" href="#product/${product.id}">${product.name}</a><p class="product-kind">${t(product.type)} · ${t(product.color)}</p><p class="product-size">${t("sizeLabel")} <strong>${escape(sizeText(product))}</strong>${product.insoleCm ? ` · ${t("insoleShort")} ${insoleText(product)}` : ""}</p></div><div class="price"><span>${money(product.price)}</span>${product.oldPrice ? `<del>${money(product.oldPrice)}</del>` : ""}</div></div></article>`;
}
function searchForm(value = "", compact = false) {
  return `<form class="search-form ${compact ? "compact-search" : ""}" role="search">${icon("search")}<input type="search" name="search" value="${escape(value)}" placeholder="${escape(t("searchPlaceholder"))}" aria-label="${escape(t("search"))}" maxlength="100"/><button type="submit" aria-label="${escape(t("search"))}">${icon("arrow")}</button></form>`;
}
function categoryPills(current = "all", home = false) {
  return `<div class="category-pills" aria-label="${escape(t("catalog"))}">${[
    ["all", "grid"],
    ["sneakers", "shoe"],
    ["clothing", "shirt"],
    ["accessories", "cap"],
  ]
    .map(([key, glyph]) =>
      home
        ? `<a class="category-pill" href="#catalog${key === "all" ? "" : "?category=" + key}">${icon(glyph)}${t(key)}${key === "all" ? icon("arrow") : ""}</a>`
        : `<button class="category-pill ${current === key ? "selected" : ""}" data-action="category" data-value="${key}" aria-pressed="${current === key}">${icon(glyph)}${t(key)}</button>`,
    )
    .join("")}</div>`;
}
function header() {
  const r = route();
  return `<aside class="sidebar" aria-label="${t("menu")}"><a class="rail-brand" href="#home" aria-label="BuyDUCK — ${t("home")}">B<span>•</span></a><div class="rail-links"><a href="#home" class="rail-item ${r.page === "home" ? "active" : ""}" aria-label="${t("home")}">${icon("home")}</a><a href="#catalog" class="rail-item ${r.page === "catalog" ? "active" : ""}" aria-label="${t("catalog")}">${icon("grid")}</a><a href="#favorites" class="rail-item ${r.page === "favorites" ? "active" : ""}" aria-label="${t("favorites")}">${icon("heart")}</a>${accountLink("rail-item", r.page === "account")}<button class="rail-item" data-action="cart" aria-label="${t("cart")}">${icon("bag")}</button></div><span class="rail-bottom">UA</span></aside><p class="demo-banner" role="note"><span class="demo-badge">${t("demoBadge")}</span><span>${t("demoNotice")}</span></p><div class="announcement"><span>${t("announcement")}</span><span>${t("deliveryTop")} ${icon("arrow")}</span></div><header class="header ${r.page === "home" ? "header--home" : ""}">${r.page === "home" ? "" : `<a href="#home" class="brand" aria-label="BuyDUCK — ${t("home")}"><img src="assets/branding/buyduck-wordmark-mascot-v3.png" alt="BuyDUCK" width="1875" height="839" /></a>`}<nav class="desktop-nav" aria-label="${t("catalog")}"><a href="#catalog?gender=women">${t("women")}</a><a href="#catalog?gender=men">${t("men")}</a><a href="#catalog?category=clothing">${t("clothing")}</a><a href="#catalog?category=accessories">${t("accessories")}</a><a href="#catalog?sale=1">${t("sale")}</a></nav><div class="header-actions"><label class="language-control">${icon("globe")}<select id="language" aria-label="${t("language")}">${[
    ["uk", "UA"],
    ["ru", "RU"],
    ["en", "EN"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${state.language === value ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></label><a href="#favorites" class="icon-button header-heart" aria-label="${t("favorites")}">${icon("heart")}${state.favorites.length ? `<span class="count-dot">${state.favorites.length}</span>` : ""}</a>${accountLink("icon-button header-account", r.page === "account")}<button class="cart-trigger" data-action="cart" aria-label="${t("cart")}">${icon("bag")}<span class="cart-label">${t("cart")}</span><span class="cart-count">${cartCount(state.cart)}</span></button><button class="icon-button menu-toggle" data-action="menu" aria-expanded="${state.menu}" aria-label="${t("menu")}">${icon(state.menu ? "close" : "menu")}</button></div></header>${state.menu ? `<nav class="mobile-nav" aria-label="${t("catalog")}"><a href="#catalog">${t("catalog")}</a><a href="#catalog?gender=women">${t("women")}</a><a href="#catalog?gender=men">${t("men")}</a><a href="#catalog?category=clothing">${t("clothing")}</a><a href="#catalog?category=accessories">${t("accessories")}</a><a href="#catalog?sale=1">${t("sale")}</a><a href="#favorites">${t("favorites")}</a>${state.account ? `<a href="#account">${t("account")}</a>` : `<button type="button" data-action="auth">${t("signIn")}</button>`}</nav>` : ""}`;
}
// Signed-in customers go to their account page; guests open the sign-in dialog.
function accountLink(cls, active) {
  return state.account
    ? `<a href="#account" class="${cls} ${active ? "active" : ""} is-signed-in" aria-label="${escape(t("account"))}: ${escape(state.account.name)}">${icon("user")}</a>`
    : `<button type="button" class="${cls}" data-action="auth" aria-label="${escape(t("signIn"))}">${icon("user")}</button>`;
}
function floatingCard(product, cls, label) {
  if (!product) return "";
  return `<button class="floating-card ${cls}" data-action="product" data-id="${product.id}"><img src="${photo(product)}" alt="${escape(product.name)}" width="400" height="400"/><span><span>${label || product.name}</span>${icon("arrow")}</span></button>`;
}
// Hero cards pick available items by position, wrapping around a short catalog.
const heroProduct = (n) => {
  const list = products.filter(isAvailable);
  return list.length ? list[n % list.length] : null;
};
function home() {
  return `<main id="main" tabindex="-1"><section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><h1 id="hero-title" class="hero-wordmark"><img class="hero-basket" src="assets/branding/shopping-basket-sideways-v3.png" alt="" aria-hidden="true" width="1280" height="1280" /><img class="hero-brand-mark" src="assets/branding/buyduck-wordmark-mascot-v3.png" alt="BuyDUCK" width="1875" height="839" fetchpriority="high" /></h1>${searchForm()}</div>${floatingCard(heroProduct(0), "float-one")}${floatingCard(heroProduct(3), "float-two")}${floatingCard(heroProduct(1), "float-three")}${floatingCard(heroProduct(2), "float-four")}${floatingCard(heroProduct(4), "float-five")}${floatingCard(heroProduct(3), "float-six")}${floatingCard(heroProduct(0), "float-seven")}<span class="floating-note note-left">${t("everydayNote").replace("\n", "<br/>")}</span><span class="floating-note note-right">${t("ownWayNote").replace("\n", "<br/>")}</span><div class="hero-bottom">${categoryPills("all", true)}</div>${clothingMarkup(t)}</section><div class="content-wrap"><section class="arrivals" id="arrivals"><div class="section-heading"><div><p class="eyebrow">${t("rotationLabel")} / 01</p><h2>${t("arrivals")}</h2><p>${t("arrivalsSub")}</p></div><a class="text-link" href="#catalog">${t("allProducts")} ${icon("arrow")}</a></div><div class="product-grid">${newestProducts(4).map(productCard).join("")}</div></section><section class="editorial"><div class="editorial-copy"><p class="eyebrow">${t("collection")}</p><h2>${t("storyTitle").replace("\n", "<br/>")}</h2><p>${t("storyCopy")}</p><a href="#catalog?category=clothing" class="button dark">${t("storyButton")} ${icon("arrow")}</a><span class="editorial-footnote">${t("storyNote")} ↗</span></div><div class="editorial-image"><img src="assets/products/urban-sneakers.jpg" alt="${escape(t("sneakers"))}" loading="lazy" width="900" height="900"/><span class="image-caption">BuyDUCK<br/><small>${t("outsideLabel")}</small></span><span class="image-number">02 / ${t("cultureLabel")}</span></div></section><section class="category-section"><div class="section-heading"><div><p class="eyebrow">${t("categoriesLabel")} / 02</p><h2>${t("categories")}</h2></div></div><div class="category-grid">${[
    ["sneakers", "white-sneakers.jpg", "shoesTitle", "categoryShoes"],
    ["clothing", "hoodie.jpg", "clothingTitle", "categoryClothing"],
    ["accessories", "backpack.jpg", "accessoriesTitle", "categoryAccessories"],
  ]
    .map(
      ([type, image, title, description]) =>
        `<a href="#catalog?category=${type}" class="category-card"><img src="assets/products/${image}" alt="${t(type)}" loading="lazy" width="600" height="600"/><div><span><strong>${t(title)}</strong><small>${t(description)}</small></span><span class="circle-arrow">${icon("arrow")}</span></div></a>`,
    )
    .join("")}</div></section><section class="benefits">${[
    ["spark", "benefit1", "benefit1Copy"],
    ["pin", "benefit2", "benefit2Copy"],
    ["shoe", "benefit3", "benefit3Copy"],
  ]
    .map(
      ([glyph, title, copy]) =>
        `<div>${icon(glyph)}<span><h3>${t(title)}</h3><p>${t(copy)}</p></span></div>`,
    )
    .join("")}</section></div></main>`;
}
function catalog() {
  const r = route();
  const visible = filterProducts({
    ...r,
    favorites: r.page === "favorites" ? state.favorites : null,
  });
  const title =
    r.page === "favorites"
      ? t("favoritesTitle")
      : r.query
        ? t("searchResults")
        : r.sale
          ? t("sale")
          : r.gender !== "all"
            ? t(r.gender)
            : r.category !== "all"
              ? t(r.category)
              : t("catalogTitle");
  return `<main id="main" class="catalog-page content-wrap" tabindex="-1"><div class="breadcrumbs"><a href="#home">${t("home")}</a>${icon("chevron")}<span>${title}</span></div><div class="catalog-intro"><div><p class="eyebrow">${t("rotationLabel")}</p><h1>${title}</h1><p>${r.query ? `“${escape(r.query)}”` : t("catalogCopy")}</p></div>${searchForm(r.query, true)}</div><div class="catalog-toolbar">${categoryPills(r.category)}<label class="sort-control"><span class="sr-only">${t("sort")}</span><select id="sort">${["featured", "priceAsc", "priceDesc"].map((key, i) => `<option value="${["featured", "price-asc", "price-desc"][i]}" ${r.sort === ["featured", "price-asc", "price-desc"][i] ? "selected" : ""}>${t(key)}</option>`).join("")}</select></label></div><div class="result-info"><span>${visible.length} ${t({ one: "countOne", few: "countFew" }[new Intl.PluralRules(state.language).select(visible.length)] || "count")}</span>${r.query || r.sale || r.gender !== "all" || r.category !== "all" ? `<button class="subtle-button" data-action="reset">${t("reset")} ${icon("close")}</button>` : ""}</div>${visible.length ? `<div class="product-grid">${visible.map(productCard).join("")}</div>` : `<div class="empty-state">${icon(r.page === "favorites" ? "heart" : "search")}<h2>${t("emptyTitle")}</h2><p>${t(r.page === "favorites" ? "emptyFavorites" : "emptyCopy")}</p><a href="#catalog" class="button dark">${t("backCatalog")} ${icon("arrow")}</a></div>`}</main>`;
}
const field = (name, label, attrs = "", value = "") =>
  `<label class="form-field">${label}<input name="${name}" value="${escape(value)}" ${attrs} /></label>`;
const passwordField = (name, label, autocomplete, hint = "") =>
  `<label class="form-field">${label}<span class="password-input"><input name="${name}" type="password" autocomplete="${autocomplete}" required maxlength="128" ${hint ? `aria-describedby="${name}-hint"` : ""} /><button type="button" class="password-toggle" data-action="toggle-password" aria-pressed="false" aria-label="${escape(t("showPassword"))}">${icon("eye")}</button></span>${hint ? `<small id="${name}-hint">${hint}</small>` : ""}</label>`;
const formError = () => `<p class="form-error" role="alert" hidden></p>`;
const shortDate = (time) =>
  new Intl.DateTimeFormat({ uk: "uk-UA", ru: "ru-UA", en: "en-GB" }[state.language], { day: "numeric", month: "long", year: "numeric" }).format(time);

const statusLabel = (order) =>
  order.status === "demo"
    ? t("orderDemoStatus")
    : t(`status${order.status[0].toUpperCase()}${order.status.slice(1)}`);
const deliveryLabel = (delivery) =>
  delivery.point
    ? `${delivery.city}, ${t(delivery.type === "locker" ? "deliveryLocker" : "deliveryBranch")} №${delivery.point}`
    : [delivery.city, delivery.branch].filter(Boolean).join(", ");
function accountOrders(a) {
  const current = orders.forAccount(a.id);
  const numbers = new Set(current.map((order) => order.number));
  return [...current, ...a.orders.filter((order) => !numbers.has(order.number))];
}
function orderCard(order) {
  const rows = order.items
    .map((item) => {
      const p = productById(item.id);
      return `<li>${p ? `<img src="${photo(p)}" alt="" width="56" height="56" loading="lazy"/>` : ""}<span><strong>${escape(p ? p.name : item.id)}</strong><small>${t("sizeLabel")}: ${escape(item.size)} · ${item.quantity} ${t("qtyShort")}</small></span><span>${money(item.price * item.quantity)}</span></li>`;
    })
    .join("");
  return `<article class="order-card"><header><div><h3>${t("orderNumber")} ${escape(order.number)}</h3><p>${shortDate(order.createdAt)}</p></div><span class="order-status">${escape(statusLabel(order))}</span></header><ul>${rows}</ul><footer><span>${t("orderDelivery")}: ${escape(deliveryLabel(order.delivery))}${order.waybill ? `<br/>${t("waybillLabel")} ${escape(order.waybill)} · <a href="${trackingUrl(order.waybill)}" target="_blank" rel="noopener noreferrer">${t("trackParcel")}</a>` : ""}</span><strong>${money(order.total)}</strong></footer></article>`;
}
function account() {
  const a = state.account;
  const crumbs = `<div class="breadcrumbs"><a href="#home">${t("home")}</a>${icon("chevron")}<span>${t("account")}</span></div>`;
  if (!a)
    return `<main id="main" class="account-page content-wrap" tabindex="-1">${crumbs}<div class="empty-state account-empty">${icon("user")}<h1>${t("accountSignedOutTitle")}</h1><p>${t("accountSignedOutCopy")}</p><div class="account-empty-actions"><button type="button" class="button dark" data-action="auth">${t("signIn")} ${icon("arrow")}</button><button type="button" class="button outline" data-action="auth" data-view="signup">${t("signUp")}</button></div></div></main>`;
  const history = accountOrders(a);
  const ordersList = history.length
    ? `<div class="order-list">${history.map(orderCard).join("")}</div>`
    : `<div class="empty-state account-orders-empty">${icon("bag")}<h3>${t("noOrders")}</h3><p>${t("noOrdersCopy")}</p><a href="#catalog" class="button dark">${t("backCatalog")} ${icon("arrow")}</a></div>`;
  return `<main id="main" class="account-page content-wrap" tabindex="-1">${crumbs}<div class="account-intro"><div><p class="eyebrow">${t("account")}</p><h1>${t("accountHello")}, ${escape(a.name)}</h1><p>${escape(a.email)} · ${t("memberSince")} ${shortDate(a.createdAt)}</p></div><button type="button" class="button outline" data-action="sign-out">${t("signOut")}</button></div><p class="account-demo-note">${t("authDemoNote")}</p><div class="account-grid"><section class="account-card account-orders" aria-labelledby="orders-title"><h2 id="orders-title">${t("ordersTitle")}</h2>${ordersList}</section><div class="account-side"><section class="account-card" aria-labelledby="profile-title"><h2 id="profile-title">${t("profileTitle")}</h2><p>${t("profileCopy")}</p><form id="profile-form" class="account-form" novalidate>${field("name", t("name"), 'autocomplete="name" required minlength="2" maxlength="80"', a.name)}${field("phone", t("phone"), 'type="tel" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="+380"', a.phone)}${field("city", t("city"), 'autocomplete="address-level2" maxlength="80"', a.city)}${field("branch", t("branch"), 'maxlength="120"', a.branch)}${formError()}<button class="button dark" type="submit">${t("saveChanges")}</button></form></section><section class="account-card" aria-labelledby="security-title"><h2 id="security-title">${t("securityTitle")}</h2><form id="password-form" class="account-form" novalidate><input type="email" name="username" autocomplete="username" value="${escape(a.email)}" hidden />${passwordField("current", t("currentPassword"), "current-password")}${passwordField("next", t("newPassword"), "new-password", t("passwordHint"))}${formError()}<button class="button dark" type="submit">${t("changePassword")}</button></form><details class="account-danger"><summary>${t("deleteAccount")}</summary><form id="delete-form" class="account-form" novalidate><p>${t("deleteAccountCopy")}</p><input type="email" name="username" autocomplete="username" value="${escape(a.email)}" hidden />${passwordField("password", t("password"), "current-password")}${formError()}<button class="button danger" type="submit">${t("deleteConfirm")}</button></form></details></section></div></div></main>`;
}
function footer() {
  return `<footer class="footer"><div class="footer-top"><div class="footer-brand"><a href="#home">BuyDUCK</a><p>${t("footerCopy")}</p></div><div><h3>${t("help")}</h3><button data-action="info" data-topic="delivery">${t("delivery")}</button><button data-action="info" data-topic="returns">${t("returns")}</button><button data-action="info" data-topic="about">${t("about")}</button></div><a href="#catalog" class="footer-cta">${t("explore")}${icon("arrow")}</a></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} BuyDUCK. ${t("rights")}</span><p>${t("prototype")}</p><span>${t("footerMotto")} ↗</span></div></footer>`;
}
let renderedPage;
function render() {
  const page = route().page;
  if (renderedPage !== page) resetClothingAnimations();
  else cancelClothingAnimations();
  renderedPage = page;
  document.documentElement.lang = state.language;
  const product = page === "product" ? productById(route().productId) : null;
  document.title = product ? `${product.name} — BuyDUCK` : t("pageTitle");
  $(".skip-link").textContent = t("skip");
  $("#app").innerHTML =
    `${header()}${page === "home" ? home() : page === "account" ? account() : page === "product" ? productPage() : catalog()}${footer()}`;
  syncClothingState();
}
function showDialog(dialog) {
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("modal-open");
}
function closeDialog(dialog) {
  dialog.close();
  if (!document.querySelector("dialog[open]"))
    document.body.classList.remove("modal-open");
}
const capital = (value) => value[0].toUpperCase() + value.slice(1);
const breadcrumbs = (items) =>
  `<nav class="breadcrumbs" aria-label="${escape(t("catalog"))}">${items.join(icon("chevron"))}</nav>`;
// Product page at #product/<id>; hero cards and other buttons with data-action="product" lead here.
function openProduct(id) {
  if (productById(id)) location.hash = `product/${id}`;
}
function enterRoute() {
  const r = route();
  if (r.page !== "product" || r.productId === state.product) return;
  state.product = r.productId;
  state.photo = 0;
  if (productById(r.productId)) track("product_view", { id: r.productId });
}
function renderKeepingScroll() {
  const scroll = window.scrollY;
  render();
  window.scrollTo(0, scroll);
}
function productPage() {
  const p = productById(route().productId);
  if (!p)
    return `<main id="main" class="product-page content-wrap" tabindex="-1">${breadcrumbs([`<a href="#home">${t("home")}</a>`, `<span>${t("productNotFound")}</span>`])}<div class="empty-state">${icon("search")}<h1>${t("productNotFound")}</h1><p>${t("productNotFoundCopy")}</p><a href="#catalog" class="button dark">${t("backCatalog")} ${icon("arrow")}</a></div></main>`;
  const images = productImages(p);
  const index = Math.min(state.photo || 0, images.length - 1);
  const description = p.description?.[state.language] || p.description?.uk || t("description");
  const thumbs =
    images.length > 1
      ? `<div class="gallery-thumbs">${images
          .map(
            (image, i) =>
              `<button type="button" class="gallery-thumb ${i === index ? "selected" : ""}" data-action="photo" data-index="${i}" aria-pressed="${i === index}" aria-label="${escape(t("photoOf").replace("{n}", i + 1).replace("{total}", images.length))}"><img src="${imageUrl(image)}" alt="" width="120" height="120" loading="lazy"/></button>`,
          )
          .join("")}</div>`
      : "";
  const specs = [
    ...Object.entries(p.details || {}).map(([label, value]) => [t(`detail${capital(label)}`), t(value)]),
    [t("articleLabel"), p.article],
  ]
    .map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`)
    .join("");
  const added = inCart(state.cart, p.id);
  const available = isAvailable(p);
  const guide = `<button type="button" class="foot-guide-button" data-action="foot-guide" aria-label="${escape(t("footGuideTitle"))}" title="${escape(t("footGuideTitle"))}">${footRulerIcon}</button>`;
  const facts = [
    [t("sizeLabel"), escape(sizeText(p)), factTip("size", t("factInfoSize"), sizeTagIcon, t(p.size === "ONE SIZE" ? "tipSizeOne" : p.type === "sneakers" ? "tipSizeShoes" : "tipSizeItem"))],
    ...(p.insoleCm ? [[t("insoleLength"), insoleText(p), guide]] : []),
    [t("conditionLabel"), conditionBadge(p), factTip("condition", t("factInfoCondition"), p.condition === "newTag" ? closedBoxIcon : shoeBoxIcon, t(`tip${p.condition === "newTag" ? "New" : "Used"}${p.type === "sneakers" ? "Shoes" : "Item"}`))],
  ]
    .map(([label, value, drawing]) => `<div><dt>${label}</dt><dd><span class="fact-value">${value}</span>${drawing}</dd></div>`)
    .join("");
  return `<main id="main" class="product-page content-wrap" tabindex="-1">${breadcrumbs([
    `<a href="#home">${t("home")}</a>`,
    `<a href="#catalog">${t("catalog")}</a>`,
    `<a href="#catalog?category=${p.type}">${t(p.type)}</a>`,
    `<span aria-current="page">${escape(p.name)}</span>`,
  ])}<div class="product-layout"><section class="product-gallery" aria-label="${escape(p.name)}"><div class="gallery-main"><img src="${imageUrl(images[index])}" alt="${escape(p.name)} — ${escape(t(p.color))}" width="900" height="900" fetchpriority="high"/>${conditionBadge(p, "product-tag")}${favoriteButton(p.id)}</div>${thumbs}</section><div class="product-info"><p class="eyebrow">${escape(p.brand)}</p><div class="product-title-row"><h1>${escape(p.name)}</h1><button type="button" class="icon-button share-button" data-action="share" data-id="${p.id}" aria-label="${escape(t("share"))}" title="${escape(t("share"))}">${icon("share")}</button></div><p class="detail-kind">${t(p.type)} · ${t(p.color)} · ${t("articleLabel")} ${escape(p.article)}</p><div class="detail-price">${money(p.price)} ${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div><p class="product-lead">${escape(description)}</p><dl class="item-facts" style="--facts:${p.insoleCm ? 3 : 2}">${facts}</dl>${available ? `${added ? `<button class="button dark add-to-cart" data-action="cart">${t("inCart")} · ${t("goToCart")} ${icon("bag")}</button>` : `<button class="button dark add-to-cart" data-action="add-cart" data-id="${p.id}">${t("addCart")} ${icon("bag")}</button>`}<button type="button" class="button outline olx-buy" data-action="olx" data-id="${p.id}">${t("buyOlx")} ${icon("arrow")}</button><p class="product-note olx-note">${t("buyOlxNote")}</p>` : `<p class="sold-note" role="status">${t(p.status === "sold" ? "soldNote" : "hiddenNote")}</p><a href="#catalog?category=${p.type}" class="button dark add-to-cart">${t("backCatalog")} ${icon("arrow")}</a>`}<ul class="product-perks"><li>${icon("truck")}${t("perkDelivery")}</li><li>${icon("card")}${t("perkPayment")}</li><li>${icon("shield")}${t("perkOlx")}</li></ul><p class="product-note">${t("productNote")}</p></div></div><section class="product-specs" aria-labelledby="specs-title"><h2 id="specs-title">${t("specsTitle")}</h2><dl>${specs}</dl></section><section class="related-products" aria-labelledby="related-title"><h2 id="related-title">${t("relatedTitle")}</h2><div class="product-grid">${relatedProducts(p).map(productCard).join("")}</div></section></main>`;
}
function openFootGuide() {
  const p = productById(state.product);
  if (!p?.insoleCm) return;
  const range = footRange(p.insoleCm);
  const steps = ["footStep1", "footStep2", "footStep3", "footStep4"]
    .map((key, i) => `<li><span class="foot-step-number" aria-hidden="true">${i + 1}</span><span>${t(key)}</span></li>`)
    .join("");
  const tips = ["footTipEvening", "footTipBoth", "footTipSpare"].map((key) => `<li>${icon("check")}${t(key)}</li>`).join("");
  const dialog = $("#info-dialog");
  dialog.setAttribute("aria-label", t("footGuideTitle"));
  dialog.innerHTML = `<div class="dialog-header"><h2>${t("footGuideTitle")}</h2>${iconButton("close", "close", t("close"))}</div><div class="foot-guide"><div class="foot-guide-hero">${footRulerIcon}<div><p class="eyebrow">${t("footGuideThisPair")} · ${escape(p.name)}</p><strong>${t("footGuideInsole").replace("{cm}", cmNumber(p.insoleCm))}</strong><span>${t("footGuideFits").replace("{from}", cmNumber(range.from)).replace("{to}", cmNumber(range.to))}</span></div></div><ol class="foot-steps">${steps}</ol><ul class="foot-tips">${tips}</ul></div>`;
  showDialog(dialog);
  dialog.querySelector(".icon-button").focus();
}
async function shareProduct(id) {
  const p = productById(id);
  if (!p) return;
  // Share pages in /p/ carry the link preview (photo, name, price) for messengers.
  const base = location.href.split("#")[0];
  const url = shippedIds.has(id) && !/^data:/.test(p.image)
    ? new URL(`p/${id}.html`, base).href
    : `${base}#product/${id}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${p.name} — BuyDUCK`, url });
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t("linkCopied"));
  } catch {
    const field = document.createElement("input");
    field.value = url;
    document.body.append(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {}
    field.remove();
    toast(t(copied ? "linkCopied" : "linkCopyFailed"));
  }
}
const choice = (name, value, label, copy, checked) =>
  `<label class="choice"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} /><span><strong>${label}</strong>${copy ? `<small>${copy}</small>` : ""}</span></label>`;
function buyMethodSwitch() {
  return `<div class="buy-method" role="group" aria-label="${escape(t("buyMethod"))}"><p>${t("buyMethod")}</p>${[
    ["np", "methodNp", "methodNpCopy"],
    ["olx", "methodOlx", "methodOlxCopy"],
  ]
    .map(
      ([value, label, copy]) =>
        `<button type="button" class="buy-method-option ${state.buyMethod === value ? "selected" : ""}" data-action="buy-method" data-value="${value}" aria-pressed="${state.buyMethod === value}"><strong>${t(label)}</strong><small>${t(copy)}</small></button>`,
    )
    .join("")}</div>`;
}
function olxCheckout() {
  const rows = state.cart
    .map((item) => {
      const p = productById(item.id);
      return `<li class="olx-item"><img src="${photo(p)}" alt="" width="56" height="56" loading="lazy"/><span><strong>${escape(p.name)}</strong><small>${t("sizeLabel")}: ${escape(sizeText(p))} · ${t(p.condition === "newTag" ? "condNewTag" : "condUsed")}</small></span><button type="button" class="button outline" data-action="olx" data-id="${p.id}">${t("buyOnOlx")} ${icon("arrow")}</button></li>`;
    })
    .join("");
  return `<div class="olx-checkout"><p>${t("olxListCopy")}</p><ul class="olx-list">${rows}</ul><p class="product-note">${t("buyOlxNote")}</p></div>`;
}
function npCheckoutForm(a) {
  const d = state.checkoutDraft;
  const saved = String(a?.branch || "");
  const type = d.deliveryType || (/поштомат|почтомат|locker/i.test(saved) ? "locker" : "branch");
  const value = (key, fallback = "") => escape(d[key] ?? fallback);
  const input = (name, label, attrs, fallback) =>
    `<label class="form-field">${label}<input name="${name}" ${attrs} value="${value(name, fallback)}" /></label>`;
  return `<form id="checkout-form" class="checkout-form" novalidate><fieldset class="checkout-section"><legend>${t("recipientTitle")}</legend><div class="form-row">${input("lastName", t("lastName"), 'autocomplete="family-name" required minlength="2" maxlength="50"')}${input("firstName", t("firstName"), 'autocomplete="given-name" required minlength="2" maxlength="50"', a?.name)}</div>${input("phone", t("phone"), 'type="tel" autocomplete="tel" inputmode="tel" required maxlength="20" placeholder="+380"', a?.phone)}</fieldset><fieldset class="checkout-section"><legend>${t("deliveryTitle")}</legend>${input("city", t("city"), 'list="np-cities" autocomplete="address-level2" required minlength="2" maxlength="80"', a?.city)}<datalist id="np-cities">${npDemoCities.map((city) => `<option value="${escape(city)}"></option>`).join("")}</datalist><div class="choice-row">${choice("deliveryType", "branch", t("deliveryBranch"), "", type === "branch")}${choice("deliveryType", "locker", t("deliveryLocker"), "", type === "locker")}</div><label class="form-field"><span class="point-label">${t(type === "locker" ? "pointLocker" : "pointBranch")}</span><input name="point" inputmode="numeric" required maxlength="6" value="${value("point", saved.match(/\d+/)?.[0] || "")}" /></label><p class="checkout-note">${t("deliveryCostNote")}</p></fieldset><fieldset class="checkout-section"><legend>${t("paymentTitle")}</legend>${choice("payment", "cod", t("paymentCod"), t("paymentCodCopy"), (d.payment || "cod") === "cod")}${choice("payment", "card", t("paymentCard"), t("paymentCardCopy"), d.payment === "card")}</fieldset><fieldset class="checkout-section"><legend>${t("confirmTitle")}</legend><div class="choice-row">${choice("confirm", "viber", "Viber", "", (d.confirm || "viber") === "viber")}${choice("confirm", "telegram", "Telegram", "", d.confirm === "telegram")}</div></fieldset><label class="form-field">${t("commentLabel")}<textarea name="comment" rows="2" maxlength="500" placeholder="${escape(t("commentPlaceholder"))}">${value("comment")}</textarea></label>${a ? `<label class="check-field"><input type="checkbox" name="saveProfile" checked />${t("saveToProfile")}</label>` : `<p class="checkout-note">${t("guestDataNote")}</p>`}${formError()}<div class="cart-total"><span>${t("total")}</span><strong>${money(cartTotal(state.cart))}</strong></div><button class="button dark" type="submit">${t("submitOrder")} ${icon("arrow")}</button></form>`;
}
function successContent() {
  const order = state.lastOrder;
  const done = `<button class="button dark" data-action="close">${t("continueShopping")} ${icon("arrow")}</button>`;
  if (!order)
    return `<div class="empty-state success-state">${icon("check")}<h2>${t("successTitle")}</h2><p>${t("successCopy")}</p>${done}</div>`;
  const confirm = t("orderConfirmCopy")
    .replace("{channel}", order.confirm === "telegram" ? "Telegram" : "Viber")
    .replace("{phone}", order.customer.phone);
  return `<div class="empty-state success-state">${icon("check")}<h2>${t("successTitle")}</h2><p><strong>${t("orderNumber")} ${escape(order.number)}</strong></p><p>${escape(confirm)}</p>${order.payment === "card" ? `<p>${t("orderCardCopy")}</p>` : ""}${order.accountId ? `<p>${t("orderAccountCopy")}</p><a href="#account" class="button outline" data-action="close">${t("ordersTitle")} ${icon("arrow")}</a>` : ""}<p class="product-note">${t("successCopy")}</p>${done}</div>`;
}
function openOlx(id) {
  const p = productById(id);
  if (!p) return;
  track("olx_click", { id });
  if (p.olxUrl) window.open(p.olxUrl, "_blank", "noopener");
  else info("olxDemo");
}
function renderCart() {
  const dialog = $("#cart-dialog");
  dialog.setAttribute("aria-label", t("cart"));
  let content;
  const a = state.account;
  if (state.cartStep === "success")
    content = successContent();
  else if (state.cartStep === "checkout" && state.cart.length) {
    const who = a
      ? `<p class="checkout-account">${icon("user")}<span>${t("checkoutSignedIn")} <strong>${escape(a.email)}</strong></span></p>`
      : `<div class="quick-buy"><strong>${t("quickBuyTitle")}</strong><p><button type="button" class="text-button" data-action="auth" data-return="checkout">${t("signIn")}</button>, ${t("quickBuyCopy")}</p></div>`;
    content = `<button class="subtle-button back-button" data-action="cart-back">← ${t("back")}</button><div class="checkout-intro"><h2>${t("checkoutTitle")}</h2><p>${t("checkoutCopy")}</p>${state.buyMethod === "np" ? who : ""}</div>${buyMethodSwitch()}${state.buyMethod === "olx" ? olxCheckout() : npCheckoutForm(a)}`;
  }
  else if (!state.cart.length)
    content = `<div class="empty-state">${icon("bag")}<h2>${t("emptyCart")}</h2><p>${t("emptyCartCopy")}</p><button class="button dark" data-action="shop">${t("backCatalog")} ${icon("arrow")}</button></div>`;
  else
    content = `<div class="cart-items">${state.cart
      .map((item, index) => {
        const p = productById(item.id);
        return `<article class="cart-item"><img src="${photo(p)}" alt="${p.name}" width="110" height="110"/><div class="cart-item-info"><h3>${p.name}</h3><p>${t("sizeLabel")}: ${escape(sizeText(p))}${p.insoleCm ? ` · ${t("insoleLength")} ${insoleText(p)}` : ""}</p>${conditionBadge(p)}<strong>${money(p.price)}</strong></div><button class="remove-item" data-action="remove" data-index="${index}" aria-label="${t("remove")}: ${p.name}">${icon("close")}</button></article>`;
      })
      .join(
        "",
      )}</div><div class="cart-summary"><div class="cart-total"><span>${t("total")}</span><strong>${money(cartTotal(state.cart))}</strong></div><button class="button dark" data-action="checkout">${t("checkout")} ${icon("arrow")}</button><p class="product-note">${t("checkoutCopy")}</p></div>`;
  dialog.innerHTML = `<div class="dialog-header"><h2>${t("cart")} <span class="cart-count">${cartCount(state.cart)}</span></h2>${iconButton("close", "close", t("close"))}</div>${content}`;
}
function renderAuth() {
  const dialog = $("#auth-dialog");
  const view = state.authView;
  const title = t({ signin: "signInTitle", signup: "signUpTitle", forgot: "forgotTitle" }[view]);
  dialog.setAttribute("aria-label", title);
  const remember = `<label class="check-field"><input type="checkbox" name="remember" checked />${t("rememberMe")}</label>`;
  const email = field("email", t("email"), 'type="email" autocomplete="email" inputmode="email" required maxlength="120"');
  let body;
  if (view === "signup")
    body = `<form id="signup-form" class="account-form" novalidate>${field("name", t("name"), 'autocomplete="name" required minlength="2" maxlength="80"')}${email}${passwordField("password", t("password"), "new-password", t("passwordHint"))}${remember}${formError()}<button class="button dark" type="submit">${t("signUp")} ${icon("arrow")}</button></form><p class="auth-switch">${t("haveAccount")} <button type="button" class="text-button" data-action="auth-view" data-view="signin">${t("signIn")}</button></p>`;
  else if (view === "forgot")
    body = `<form id="forgot-form" class="account-form" novalidate><p>${t("forgotCopy")}</p>${email}<p class="form-success" role="status" hidden>${t("forgotSent")}</p>${formError()}<button class="button dark" type="submit">${t("sendResetLink")}</button></form><p class="auth-switch"><button type="button" class="text-button" data-action="auth-view" data-view="signin">← ${t("backToSignIn")}</button></p>`;
  else
    body = `<form id="signin-form" class="account-form" novalidate>${email}${passwordField("password", t("password"), "current-password")}<div class="auth-row">${remember}<button type="button" class="text-button" data-action="auth-view" data-view="forgot">${t("forgotPassword")}</button></div>${formError()}<button class="button dark" type="submit">${t("signIn")} ${icon("arrow")}</button></form><p class="auth-switch">${t("noAccount")} <button type="button" class="text-button" data-action="auth-view" data-view="signup">${t("signUp")}</button></p>`;
  dialog.innerHTML = `<div class="dialog-header"><h2>${title}</h2>${iconButton("close", "close", t("close"))}</div><div class="auth-body">${body}<p class="auth-note">${t("authDemoNote")}</p></div>`;
}
function openAuth(view = "signin", returnTo = null) {
  state.authView = view;
  state.authReturn = returnTo;
  renderAuth();
  showDialog($("#auth-dialog"));
  $("#auth-dialog input:not([type=checkbox])")?.focus();
}
function showFormError(form, key) {
  const error = form.querySelector(".form-error");
  error.textContent = t("err" + key[0].toUpperCase() + key.slice(1));
  error.hidden = false;
  form.querySelector("input:not([type=hidden]):not([type=checkbox])")?.focus();
}
// Hashing a password takes a moment; block double submits meanwhile.
async function busy(form, task) {
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  form.setAttribute("aria-busy", "true");
  try {
    return await task();
  } finally {
    button.disabled = false;
    form.removeAttribute("aria-busy");
  }
}
function signedIn(result, message) {
  state.account = result.account;
  closeDialog($("#auth-dialog"));
  render();
  toast(t(message));
  if (state.authReturn === "checkout" && state.cart.length) {
    state.cartStep = "checkout";
    renderCart();
    $("#checkout-form input").focus();
  } else if (route().page === "account") $("#main").focus();
}
function refreshAccount(message) {
  state.account = accounts.current();
  const scroll = window.scrollY;
  render();
  window.scrollTo(0, scroll);
  if (message) toast(t(message));
}
function openCart() {
  state.cartStep = "cart";
  renderCart();
  showDialog($("#cart-dialog"));
}
function updateFavorite(id) {
  if (!productById(id)) return;
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter((value) => value !== id)
    : [...state.favorites, id];
  save("favorites");
  const scroll = window.scrollY;
  render();
  window.scrollTo(0, scroll);
  $(`[data-action="favorite"][data-id="${id}"]`)?.focus({
    preventScroll: true,
  });
}
function info(topic) {
  $("#info-dialog").setAttribute("aria-label", t(topic));
  $("#info-dialog").innerHTML =
    `<div class="dialog-header"><h2>${t(topic)}</h2>${iconButton("close", "close", t("close"))}</div><p>${t(topic + "Copy")}</p><button class="button dark" data-action="close">${t("close")}</button>`;
  showDialog($("#info-dialog"));
}

document.addEventListener("click", (event) => {
  // A click anywhere else closes an open size/condition note.
  if (!event.target.closest('.fact-tip, [data-action="fact-tip"]')) closeFactTips();
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "fact-tip") return toggleFactTip(button);
  const action = button.dataset.action;
  if (action === "play-clothing") animateClothing(button);
  if (action === "product") openProduct(button.dataset.id);
  if (action === "favorite") updateFavorite(button.dataset.id);
  if (action === "cart") openCart();
  if (action === "close") closeDialog(button.closest("dialog"));
  if (action === "menu") {
    state.menu = !state.menu;
    render();
    $(".menu-toggle").focus();
  }
  if (action === "category")
    navigateFilters({ category: button.dataset.value });
  if (action === "reset") {
    location.hash = route().page === "favorites" ? "favorites" : "catalog";
  }
  if (action === "photo") {
    state.photo = Number(button.dataset.index) || 0;
    renderKeepingScroll();
    $(`[data-action="photo"][data-index="${state.photo}"]`)?.focus();
  }
  if (action === "share") shareProduct(button.dataset.id);
  if (action === "foot-guide") openFootGuide();
  if (action === "add-cart") {
    const id = button.dataset.id || state.product;
    if (inCart(state.cart, id)) return toast(t("inCart"));
    state.cart = addToCart(state.cart, id);
    save("cart");
    track("add_to_cart", { id, size: productById(id)?.size });
    renderKeepingScroll();
    toast(t("added"));
    $(`.product-page [data-action="cart"]`)?.focus();
  }
  if (action === "remove") {
    state.cart.splice(Number(button.dataset.index), 1);
    save("cart");
    render();
    renderCart();
    $('#cart-dialog [data-action="close"]').focus();
  }
  if (action === "checkout") {
    track("checkout_start", { total: cartTotal(state.cart) });
    state.cartStep = "checkout";
    renderCart();
    $("#checkout-form input").focus();
  }
  if (action === "cart-back") {
    state.cartStep = "cart";
    renderCart();
    $('#cart-dialog [data-action="close"]').focus();
  }
  if (action === "shop") {
    closeDialog($("#cart-dialog"));
    location.hash = "catalog";
  }
  if (action === "info") info(button.dataset.topic);
  if (action === "olx") openOlx(button.dataset.id);
  if (action === "buy-method" && ["np", "olx"].includes(button.dataset.value)) {
    state.buyMethod = button.dataset.value;
    renderCart();
    $(`[data-action="buy-method"][data-value="${state.buyMethod}"]`)?.focus();
  }
  if (action === "auth") {
    state.menu = false;
    openAuth(button.dataset.view || "signin", button.dataset.return || null);
  }
  if (action === "auth-view") {
    state.authView = button.dataset.view;
    renderAuth();
    $("#auth-dialog input:not([type=checkbox])")?.focus();
  }
  if (action === "toggle-password") {
    const input = button.previousElementSibling;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", t(show ? "hidePassword" : "showPassword"));
  }
  if (action === "sign-out") {
    accounts.signOut();
    state.account = null;
    render();
    toast(t("signedOut"));
    $("#main").focus();
  }
});
document.addEventListener("input", (event) => {
  const form = event.target.closest?.("#checkout-form");
  if (!form) return;
  state.checkoutDraft = Object.fromEntries(new FormData(form));
  if (event.target.name === "deliveryType")
    form.querySelector(".point-label").textContent = t(
      event.target.value === "locker" ? "pointLocker" : "pointBranch",
    );
});
document.addEventListener("submit", (event) => {
  if (event.target.matches(".search-form")) {
    event.preventDefault();
    const query = new FormData(event.target).get("search").toString().trim();
    if (query) track("search", { query });
    navigateFilters({
      page: "catalog",
      query,
      category: "all",
      gender: "all",
      sale: false,
    });
  }
  if (event.target.id === "checkout-form") {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    // Guests get no profile: their delivery details are stored only inside the order,
    // because the seller needs them to ship the parcel.
    const result = orders.create({
      ...data,
      items: state.cart.map((item) => ({ ...item, price: productById(item.id).price })),
      accountId: state.account?.id ?? null,
    });
    if (!result.ok) {
      showFormError(form, result.error);
      const target = result.field && form.elements[result.field];
      (target instanceof RadioNodeList ? target[0] : target)?.focus();
      return;
    }
    const order = result.order;
    track("order", {
      total: order.total,
      items: order.items.map(({ id, quantity }) => ({ id, quantity })),
    });
    if (state.account && data.saveProfile)
      accounts.updateProfile(state.account.id, {
        name: state.account.name,
        phone: order.customer.phone,
        city: order.delivery.city,
        branch: deliveryLabel({ ...order.delivery, city: "" }).replace(/^, /, ""),
      });
    state.account = accounts.current();
    state.lastOrder = order;
    for (const item of order.items) catalogStore.setStatus(item.id, "sold");
    state.cart = [];
    save("cart");
    state.checkoutDraft = {};
    render();
    state.cartStep = "success";
    renderCart();
    $('#cart-dialog [data-action="close"]').focus();
  }
  const form = event.target;
  const data = () => Object.fromEntries(new FormData(form));
  if (form.id === "signin-form") {
    event.preventDefault();
    busy(form, async () => {
      const { email, password, remember } = data();
      const result = await accounts.signIn({ email, password, remember: Boolean(remember) });
      if (result.ok) signedIn(result, "signedIn");
      else showFormError(form, result.error);
    });
  }
  if (form.id === "signup-form") {
    event.preventDefault();
    busy(form, async () => {
      const { name, email, password, remember } = data();
      const result = await accounts.register({ name, email, password, remember: Boolean(remember) });
      if (result.ok) signedIn(result, "signedUp");
      else showFormError(form, result.error);
    });
  }
  if (form.id === "forgot-form") {
    event.preventDefault();
    if (!form.email.checkValidity() || !form.email.value.trim()) return showFormError(form, "invalidEmail");
    // No email service yet: the same neutral message for any address.
    form.querySelector(".form-error").hidden = true;
    form.querySelector(".form-success").hidden = false;
  }
  if (form.id === "profile-form") {
    event.preventDefault();
    const result = accounts.updateProfile(state.account.id, data());
    if (result.ok) {
      refreshAccount("profileSaved");
      $("#profile-form button[type=submit]").focus();
    } else showFormError(form, result.error);
  }
  if (form.id === "password-form") {
    event.preventDefault();
    busy(form, async () => {
      const { current, next } = data();
      const result = await accounts.changePassword(state.account.id, current, next);
      if (result.ok) {
        form.reset();
        form.querySelector(".form-error").hidden = true;
        toast(t("passwordChanged"));
      } else showFormError(form, result.error);
    });
  }
  if (form.id === "delete-form") {
    event.preventDefault();
    busy(form, async () => {
      const result = await accounts.deleteAccount(state.account.id, data().password);
      if (result.ok) {
        state.account = null;
        location.hash = "home";
        render();
        toast(t("accountDeleted"));
      } else showFormError(form, result.error);
    });
  }
});
document.addEventListener("change", (event) => {
  if (
    event.target.id === "language" &&
    Object.hasOwn(dictionaries, event.target.value)
  ) {
    state.language = event.target.value;
    save("language");
    render();
    if ($("#cart-dialog").open) renderCart();
    if ($("#auth-dialog").open) renderAuth();
    $("#language").focus();
  }
  if (event.target.id === "sort") navigateFilters({ sort: event.target.value });
});
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]"))
      document.body.classList.remove("modal-open");
    if (document.activeElement === document.body) {
      const target =
        dialog.id === "cart-dialog"
          ? $(".cart-trigger")
          : dialog.id === "auth-dialog"
            ? $("#cart-dialog").open
              ? $("#cart-dialog [data-action=close]")
              : $(".header-account") || $("#main")
          : $("#main");
      target?.focus({ preventScroll: true });
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        closeDialog(dialog);
    }
  });
}
window.addEventListener("storage", (event) => {
  if (event.key === "buyduck:catalog") {
    catalogStore.load();
    state.cart = sanitizeCart(state.cart);
    render();
  }
  if (event.key === "buyduck:session" || event.key === "buyduck:accounts") {
    const before = state.account?.id;
    state.account = accounts.current();
    if (before !== state.account?.id || route().page === "account") render();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const open = document.querySelector('[data-action="fact-tip"][aria-expanded="true"]');
  if (!open) return;
  closeFactTips();
  open.focus();
});
window.addEventListener("hashchange", () => {
  state.menu = false;
  enterRoute();
  render();
  track("page_view", { page: route().page });
  if (location.hash === "#arrivals") {
    $("#arrivals")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#main").focus({ preventScroll: true });
});
enterRoute();
render();
track("page_view", { page: route().page });
// Owner-only layout editor for the hero cards: http://127.0.0.1:5173/?edit-layout#home
if (new URLSearchParams(location.search).has("edit-layout")) import("./layout-editor.js");
