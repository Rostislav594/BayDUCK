import test from "node:test";
import assert from "node:assert/strict";
import { products, productById } from "../src/data.js";
import { dictionaries } from "../src/i18n.js";
import { createCatalogStore, isOlxUrl, olxListing, validateProduct } from "../src/catalog.js";
import { addToCart, filterProducts, newestProducts, relatedProducts, sanitizeCart } from "../src/model.js";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};
const shoe = {
  images: ["data:image/jpeg;base64,AAAA"],
  name: "Air Force 1",
  brand: "Nike",
  type: "sneakers",
  gender: "men",
  color: "white",
  size: "42,5",
  insoleCm: "27,5",
  condition: "used",
  price: "2400",
  oldPrice: "",
  descriptionUk: "Носив один сезон, без дефектів.",
  upper: "Шкіра",
};

test("owner input is validated into a single-item product", () => {
  const { ok, product } = validateProduct(shoe, { takenIds: [] });
  assert.ok(ok);
  assert.equal(product.id, "nike-air-force-1");
  assert.equal(product.size, "42.5");
  assert.equal(product.insoleCm, 27.5);
  assert.equal(product.price, 2400);
  assert.equal(product.image, shoe.images[0]);
  assert.deepEqual(product.details, { upper: "Шкіра" });
  assert.deepEqual(product.description, { uk: "Носив один сезон, без дефектів." });
  assert.equal(product.status, "active");
  assert.equal(validateProduct({ ...shoe, images: [] }).field, "photos");
  assert.equal(validateProduct({ ...shoe, size: "41,3" }).field, "size");
  assert.equal(validateProduct({ ...shoe, insoleCm: "" }).field, "insoleCm");
  assert.equal(validateProduct({ ...shoe, price: "12.50" }).field, "price");
  assert.equal(validateProduct({ ...shoe, oldPrice: "2000" }).field, "oldPrice");
  assert.equal(validateProduct({ ...shoe, descriptionUk: "коротко" }).field, "descriptionUk");
  assert.equal(validateProduct({ ...shoe, olxUrl: "https://example.com/x" }).field, "olxUrl");
  assert.equal(validateProduct({ ...shoe, type: "clothing", size: "42" }).field, "size");
  const bag = validateProduct({ ...shoe, type: "accessories", size: "", insoleCm: "" }).product;
  assert.equal(bag.size, "ONE SIZE");
  assert.equal(bag.insoleCm, undefined);
  assert.equal(validateProduct(shoe, { takenIds: ["nike-air-force-1"] }).product.id, "nike-air-force-1-2");
  assert.ok(isOlxUrl("https://www.olx.ua/d/uk/obyavlenie/krosivki-IDabc.html"));
});

test("the store saves, edits, hides, sells, removes and restores products in the shared list", () => {
  const storage = memoryStorage();
  const store = createCatalogStore({ storage });
  const before = products.length;
  try {
    const created = store.save(shoe).product;
    assert.equal(products.length, before + 1);
    assert.equal(products[0].id, created.id, "new items go first");
    assert.deepEqual(newestProducts(1), [created]);
    // A second browser tab loading the same storage sees the owner's catalog.
    store.reset();
    assert.equal(products.length, before);
    storage.setItem("buyduck:catalog", JSON.stringify([created, ...products]));
    createCatalogStore({ storage }).load();
    assert.equal(productById(created.id).name, "Air Force 1");

    const edited = store.save({ ...shoe, name: "Air Force 1 Low", price: "2200" }, created.id).product;
    assert.equal(edited.id, created.id);
    assert.equal(edited.createdAt, created.createdAt);
    assert.equal(productById(created.id).price, 2200);

    // Editing a shipped item keeps details the form doesn't touch and its date.
    const court = productById("court");
    store.save({ ...shoe, name: court.name, brand: court.brand, upper: "matLeather" }, "court");
    assert.equal(productById("court").details.lining, "matTextile");
    assert.equal(productById("court").createdAt, 0);

    assert.ok(store.setStatus(created.id, "hidden").ok);
    assert.ok(!filterProducts().some((p) => p.id === created.id), "hidden items leave the catalog");
    assert.ok(store.setStatus(created.id, "sold").ok);
    assert.deepEqual(addToCart([], created.id), [], "sold items can't be added");
    assert.deepEqual(sanitizeCart([{ id: created.id, size: "42.5", quantity: 1 }]), [], "sold items drop out of a saved cart");
    assert.ok(filterProducts({ favorites: [created.id] }).some((p) => p.id === created.id), "favorites still show sold items");
    assert.ok(!relatedProducts(productById("court")).some((p) => p.id === created.id));
    assert.equal(store.setStatus(created.id, "lost").error, "statusInvalid");

    // Editing a sold item (the form sends no status) keeps it sold.
    store.save({ ...shoe, price: "2100" }, created.id);
    assert.equal(productById(created.id).status, "sold");
    assert.ok(store.remove(created.id).ok);
    assert.equal(productById(created.id), undefined);
    assert.equal(store.remove("missing").error, "productMissing");
  } finally {
    store.reset();
  }
  assert.equal(products.length, before);
  assert.equal(storage.getItem("buyduck:catalog"), null);
});

test("OLX listing text is Ukrainian and includes size, insole and condition", () => {
  const listing = olxListing(productById("retro"), dictionaries.uk);
  assert.equal(listing.title, "Кросівки BuyDUCK Studio Retro Runner 02, розмір 43 EU");
  assert.match(listing.description, /Розмір: 43 EU\nДовжина устілки: 28 см\nСтан: вживане/);
  assert.equal(listing.category, "Мода і стиль → Чоловіче взуття → Кросівки");
  assert.equal(listing.condition, "Вживане");
  assert.equal(listing.price, 4190);
  const bag = olxListing(productById("backpack"), dictionaries.uk);
  assert.equal(bag.title, "Аксесуари BuyDUCK Studio City Backpack, універсальний");
  assert.doesNotMatch(bag.description, /устілки/);
  assert.equal(olxListing(productById("court"), dictionaries.uk).condition, "Нове");
});

test("one action keeps OLX in sync: publish, edit, sell, take down and relist", () => {
  const calls = [];
  const olx = {
    publish: (p) => (calls.push(["publish", p.id]), { status: "active", advertId: p.olx?.advertId || `ad-${p.id}` }),
    deactivate: (p) => (calls.push(["deactivate", p.id]), { ...p.olx, status: "inactive" }),
  };
  const store = createCatalogStore({ storage: memoryStorage(), olx });
  try {
    const id = store.save({ ...shoe, status: "active" }).product.id;
    assert.deepEqual(productById(id).olx, { status: "active", advertId: `ad-${id}` }, "publishing puts it on OLX");
    store.save({ ...shoe, price: "2300" }, id);
    assert.equal(productById(id).olx.advertId, `ad-${id}`, "an edit updates the same advert");
    store.setStatus(id, "sold");
    assert.equal(productById(id).olx.status, "inactive", "a sale takes the advert down");
    store.setStatus(id, "active");
    assert.equal(productById(id).olx.status, "active", "relisting brings it back");
    store.setStatus(id, "hidden");
    assert.equal(productById(id).olx.status, "inactive");
    store.remove(id);
    assert.deepEqual(calls.map(([action]) => action), ["publish", "publish", "deactivate", "publish", "deactivate", "deactivate"]);
  } finally {
    store.reset();
  }
});

test("the demo OLX adapter is the default and marks adverts as demo", () => {
  const store = createCatalogStore({ storage: memoryStorage() });
  try {
    const product = store.save(shoe).product;
    assert.equal(product.olx.demo, true);
    assert.equal(product.olx.status, "active");
    assert.equal(product.olx.title, "Кросівки Nike Air Force 1, розмір 42,5 EU");
  } finally {
    store.reset();
  }
});
