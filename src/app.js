import { products, productById } from "./data.js";
import { dictionaries } from "./i18n.js";
import { clothingMarkup, animateClothing, cancelClothingAnimations, resetClothingAnimations, syncClothingState } from "./playful-clothes.js";
import {
  filterProducts,
  sanitizeCart,
  cartCount,
  cartTotal,
  addToCart,
} from "./model.js";

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
    return JSON.parse(localStorage.getItem(`bayduck:${key}`)) ?? fallback;
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
  menu: false,
};
const t = (key) => dictionaries[state.language][key] || key;
const money = (value) =>
  new Intl.NumberFormat(
    { uk: "uk-UA", ru: "ru-UA", en: "en-UA" }[state.language],
    { style: "currency", currency: "UAH", maximumFractionDigits: 0 },
  ).format(value);
const photo = (product) => `assets/products/${product.image}`;
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
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  down: '<path d="M12 3v17m-5-5 5 5 5-5"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
const iconButton = (name, action, label, extra = "") =>
  `<button type="button" class="icon-button" data-action="${action}" aria-label="${escape(label)}" ${extra}>${icon(name)}</button>`;

function save(key) {
  try {
    localStorage.setItem(`bayduck:${key}`, JSON.stringify(state[key]));
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
  const [page = "", query = ""] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(query);
  return {
    page: ["catalog", "favorites"].includes(page) ? page : "home",
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
  location.hash = `${current.page === "home" ? "catalog" : current.page}${params.size ? "?" + params.toString() : ""}`;
}
function favoriteButton(id) {
  const active = state.favorites.includes(id);
  return `<button type="button" class="favorite-button ${active ? "is-favorite" : ""}" data-action="favorite" data-id="${id}" aria-pressed="${active}" aria-label="${escape(t(active ? "removeFavorite" : "addFavorite"))}: ${escape(productById(id).name)}">${icon("heart")}</button>`;
}
function productCard(product, index = 0) {
  return `<article class="product-card" style="--order:${index}"><div class="product-visual"><button class="product-open" data-action="product" data-id="${product.id}" aria-label="${escape(product.name)}"><img src="${photo(product)}" alt="${escape(product.name)} — ${escape(t(product.color))}" loading="lazy" width="600" height="600" /></button><span class="product-tag">${t(product.tag === "sale" ? "saleTag" : product.tag)}</span>${favoriteButton(product.id)}<span class="quick-view" aria-hidden="true">${icon("plus")}</span></div><div class="product-meta"><div><p class="product-brand">${product.brand}</p><button class="product-name" data-action="product" data-id="${product.id}">${product.name}</button><p class="product-kind">${t(product.type)} · ${t(product.color)}</p></div><div class="price"><span>${money(product.price)}</span>${product.oldPrice ? `<del>${money(product.oldPrice)}</del>` : ""}</div></div></article>`;
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
  return `<aside class="sidebar" aria-label="${t("menu")}"><a class="rail-brand" href="#home" aria-label="BuyDUCK — ${t("home")}">B<span>•</span></a><div class="rail-links"><a href="#home" class="rail-item ${r.page === "home" ? "active" : ""}" aria-label="${t("home")}">${icon("home")}</a><a href="#catalog" class="rail-item ${r.page === "catalog" ? "active" : ""}" aria-label="${t("catalog")}">${icon("grid")}</a><a href="#favorites" class="rail-item ${r.page === "favorites" ? "active" : ""}" aria-label="${t("favorites")}">${icon("heart")}</a><button class="rail-item" data-action="cart" aria-label="${t("cart")}">${icon("bag")}</button></div><span class="rail-bottom">UA</span></aside><p class="demo-banner" role="note"><span class="demo-badge">${t("demoBadge")}</span><span>${t("demoNotice")}</span></p><div class="announcement"><span>${t("announcement")}</span><span>${t("deliveryTop")} ${icon("arrow")}</span></div><header class="header ${r.page === "home" ? "header--home" : ""}">${r.page === "home" ? "" : `<a href="#home" class="brand" aria-label="BuyDUCK — ${t("home")}"><img src="assets/branding/buyduck-wordmark-mascot-v3.png" alt="BuyDUCK" width="1875" height="839" /></a>`}<nav class="desktop-nav" aria-label="${t("catalog")}"><a href="#catalog?gender=women">${t("women")}</a><a href="#catalog?gender=men">${t("men")}</a><a href="#catalog?category=clothing">${t("clothing")}</a><a href="#catalog?category=accessories">${t("accessories")}</a><a href="#catalog?sale=1">${t("sale")}</a></nav><div class="header-actions"><label class="language-control">${icon("globe")}<select id="language" aria-label="${t("language")}">${[
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
    )}</select></label><a href="#favorites" class="icon-button header-heart" aria-label="${t("favorites")}">${icon("heart")}${state.favorites.length ? `<span class="count-dot">${state.favorites.length}</span>` : ""}</a><button class="cart-trigger" data-action="cart" aria-label="${t("cart")}">${icon("bag")}<span class="cart-label">${t("cart")}</span><span class="cart-count">${cartCount(state.cart)}</span></button><button class="icon-button menu-toggle" data-action="menu" aria-expanded="${state.menu}" aria-label="${t("menu")}">${icon(state.menu ? "close" : "menu")}</button></div></header>${state.menu ? `<nav class="mobile-nav" aria-label="${t("catalog")}"><a href="#catalog">${t("catalog")}</a><a href="#catalog?gender=women">${t("women")}</a><a href="#catalog?gender=men">${t("men")}</a><a href="#catalog?category=clothing">${t("clothing")}</a><a href="#catalog?category=accessories">${t("accessories")}</a><a href="#catalog?sale=1">${t("sale")}</a><a href="#favorites">${t("favorites")}</a></nav>` : ""}`;
}
function floatingCard(product, cls, label) {
  return `<button class="floating-card ${cls}" data-action="product" data-id="${product.id}"><img src="${photo(product)}" alt="${escape(product.name)}" width="400" height="400"/><span><span>${label || product.name}</span>${icon("arrow")}</span></button>`;
}
function home() {
  return `<main id="main" tabindex="-1"><section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><h1 id="hero-title" class="hero-wordmark"><img class="hero-basket" src="assets/branding/shopping-basket-sideways-v3.png" alt="" aria-hidden="true" width="1280" height="1280" /><img class="hero-brand-mark" src="assets/branding/buyduck-wordmark-mascot-v3.png" alt="BuyDUCK" width="1875" height="839" fetchpriority="high" /></h1>${searchForm()}</div>${floatingCard(products[0], "float-one")}${floatingCard(products[3], "float-two")}${floatingCard(products[1], "float-three")}<span class="floating-note note-left">${t("everydayNote").replace("\n", "<br/>")}</span><span class="floating-note note-right">${t("ownWayNote").replace("\n", "<br/>")}</span><div class="hero-bottom">${categoryPills("all", true)}</div>${clothingMarkup(t)}</section><div class="content-wrap"><section class="arrivals" id="arrivals"><div class="section-heading"><div><p class="eyebrow">${t("rotationLabel")} / 01</p><h2>${t("arrivals")}</h2><p>${t("arrivalsSub")}</p></div><a class="text-link" href="#catalog">${t("allProducts")} ${icon("arrow")}</a></div><div class="product-grid">${products.slice(0, 4).map(productCard).join("")}</div></section><section class="editorial"><div class="editorial-copy"><p class="eyebrow">${t("collection")}</p><h2>${t("storyTitle").replace("\n", "<br/>")}</h2><p>${t("storyCopy")}</p><a href="#catalog?category=clothing" class="button dark">${t("storyButton")} ${icon("arrow")}</a><span class="editorial-footnote">${t("storyNote")} ↗</span></div><div class="editorial-image"><img src="assets/products/urban-sneakers.jpg" alt="${escape(t("sneakers"))}" loading="lazy" width="900" height="900"/><span class="image-caption">BuyDUCK<br/><small>${t("outsideLabel")}</small></span><span class="image-number">02 / ${t("cultureLabel")}</span></div></section><section class="category-section"><div class="section-heading"><div><p class="eyebrow">${t("categoriesLabel")} / 02</p><h2>${t("categories")}</h2></div></div><div class="category-grid">${[
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
  document.title = t("pageTitle");
  $(".skip-link").textContent = t("skip");
  $("#app").innerHTML =
    `${header()}${route().page === "home" ? home() : catalog()}${footer()}`;
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
function renderProduct() {
  const p = productById(state.product);
  if (!p) return;
  $("#product-dialog").setAttribute("aria-label", p.name);
  $("#product-dialog").innerHTML =
    `<div class="dialog-header"><span>BuyDUCK / ${t(p.type)}</span>${iconButton("close", "close", t("close"))}</div><div class="product-detail"><div class="detail-image"><img src="${photo(p)}" alt="${escape(p.name)}" width="900" height="900"/>${favoriteButton(p.id)}</div><div class="detail-content"><p class="eyebrow">${p.brand}</p><h2>${p.name}</h2><p class="detail-kind">${t(p.type)} · ${t(p.color)}</p><div class="detail-price">${money(p.price)} ${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div><p>${t("description")}</p><div class="size-heading"><strong>${t("size")}</strong><button class="subtle-button" data-action="size-guide">${t("sizeGuide")}</button></div><div class="sizes" role="group" aria-label="${t("size")}">${p.sizes.map((size) => `<button data-action="size" data-value="${size}" class="size-button ${state.size === size ? "selected" : ""}" aria-pressed="${state.size === size}">${size}</button>`).join("")}</div><p class="size-guide-copy" hidden>${t("sizeGuideCopy")}</p><button class="button dark add-to-cart" data-action="add-cart" ${!state.size ? "disabled" : ""}>${t(state.size ? "addCart" : "chooseSize")} ${icon("bag")}</button><p class="product-note">${t("productNote")}</p></div></div>`;
}
function openProduct(id) {
  state.product = id;
  state.size = null;
  renderProduct();
  showDialog($("#product-dialog"));
}
function renderCart() {
  const dialog = $("#cart-dialog");
  dialog.setAttribute("aria-label", t("cart"));
  let content;
  if (state.cartStep === "success")
    content = `<div class="empty-state success-state">${icon("check")}<h2>${t("successTitle")}</h2><p>${t("successCopy")}</p><button class="button dark" data-action="close">${t("continueShopping")} ${icon("arrow")}</button></div>`;
  else if (state.cartStep === "checkout" && state.cart.length)
    content = `<button class="subtle-button back-button" data-action="cart-back">← ${t("back")}</button><div class="checkout-intro"><h2>${t("checkoutTitle")}</h2><p>${t("checkoutCopy")}</p></div><form id="checkout-form"><label>${t("name")}<input name="name" autocomplete="given-name" required minlength="2" maxlength="80" /></label><label>${t("phone")}<input name="phone" type="tel" autocomplete="tel" inputmode="tel" required minlength="9" maxlength="20" placeholder="+380" /></label><label>${t("city")}<input name="city" autocomplete="address-level2" required minlength="2" maxlength="80" /></label><label>${t("branch")}<input name="branch" required maxlength="120" /></label><div class="cart-total"><span>${t("total")}</span><strong>${money(cartTotal(state.cart))}</strong></div><button class="button dark" type="submit">${t("submitOrder")} ${icon("arrow")}</button></form>`;
  else if (!state.cart.length)
    content = `<div class="empty-state">${icon("bag")}<h2>${t("emptyCart")}</h2><p>${t("emptyCartCopy")}</p><button class="button dark" data-action="shop">${t("backCatalog")} ${icon("arrow")}</button></div>`;
  else
    content = `<div class="cart-items">${state.cart
      .map((item, index) => {
        const p = productById(item.id);
        return `<article class="cart-item"><img src="${photo(p)}" alt="${p.name}" width="110" height="110"/><div class="cart-item-info"><h3>${p.name}</h3><p>${t("sizeLabel")}: ${item.size}</p><strong>${money(p.price)}</strong><div class="quantity"><button data-action="quantity" data-index="${index}" data-delta="-1" aria-label="${t("decrease")}: ${p.name}">${icon("minus")}</button><span>${item.quantity}</span><button data-action="quantity" data-index="${index}" data-delta="1" ${item.quantity >= 99 ? "disabled" : ""} aria-label="${t("increase")}: ${p.name}">${icon("plus")}</button></div></div><button class="remove-item" data-action="remove" data-index="${index}" aria-label="${t("remove")}: ${p.name}">${icon("close")}</button></article>`;
      })
      .join(
        "",
      )}</div><div class="cart-summary"><div class="cart-total"><span>${t("total")}</span><strong>${money(cartTotal(state.cart))}</strong></div><button class="button dark" data-action="checkout">${t("checkout")} ${icon("arrow")}</button><p class="product-note">${t("checkoutCopy")}</p></div>`;
  dialog.innerHTML = `<div class="dialog-header"><h2>${t("cart")} <span class="cart-count">${cartCount(state.cart)}</span></h2>${iconButton("close", "close", t("close"))}</div>${content}`;
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
  if ($("#product-dialog").open) {
    renderProduct();
    $("#product-dialog .favorite-button").focus();
  } else
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
  const button = event.target.closest("[data-action]");
  if (!button) return;
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
  if (action === "size") {
    state.size = button.dataset.value;
    renderProduct();
    $(`.size-button[data-value="${state.size}"]`).focus();
  }
  if (action === "size-guide") {
    const copy = $(".size-guide-copy");
    copy.hidden = !copy.hidden;
    button.setAttribute("aria-expanded", String(!copy.hidden));
  }
  if (action === "add-cart") {
    if (!state.size) return;
    state.cart = addToCart(state.cart, state.product, state.size);
    save("cart");
    render();
    toast(t("added"));
    button.innerHTML = `${t("added")} ${icon("check")}`;
  }
  if (action === "quantity") {
    const index = Number(button.dataset.index);
    const item = state.cart[index];
    if (!item) return;
    item.quantity += Number(button.dataset.delta);
    if (item.quantity <= 0) state.cart.splice(index, 1);
    save("cart");
    render();
    renderCart();
    const controls = [
      ...$("#cart-dialog").querySelectorAll(
        `[data-action="quantity"][data-delta="${button.dataset.delta}"]`,
      ),
    ];
    (
      controls[Math.min(index, controls.length - 1)] ||
      $('#cart-dialog [data-action="close"]')
    ).focus();
  }
  if (action === "remove") {
    state.cart.splice(Number(button.dataset.index), 1);
    save("cart");
    render();
    renderCart();
    $('#cart-dialog [data-action="close"]').focus();
  }
  if (action === "checkout") {
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
});
document.addEventListener("submit", (event) => {
  if (event.target.matches(".search-form")) {
    event.preventDefault();
    const query = new FormData(event.target).get("search").toString().trim();
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
    // Personal details deliberately stay in the form; no request or storage write is made.
    state.cartStep = "success";
    renderCart();
    $('#cart-dialog [data-action="close"]').focus();
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
    if ($("#product-dialog").open) renderProduct();
    if ($("#cart-dialog").open) renderCart();
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
          : dialog.id === "product-dialog"
            ? $(`[data-action="product"][data-id="${state.product}"]`)
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
window.addEventListener("hashchange", () => {
  state.menu = false;
  render();
  if (location.hash === "#arrivals") {
    $("#arrivals")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#main").focus({ preventScroll: true });
});
render();
