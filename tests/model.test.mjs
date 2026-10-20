import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { products } from "../src/data.js";
import { dictionaries } from "../src/i18n.js";
import {
  filterProducts,
  sanitizeCart,
  cartTotal,
  cartCount,
  addToCart,
} from "../src/model.js";

test("adding the same product and size merges quantity without mutating the input", () => {
  const original = [{ id: "court", size: "40", quantity: 1 }];
  assert.deepEqual(addToCart(original, "court", "40"), [
    { id: "court", size: "40", quantity: 2 },
  ]);
  assert.equal(original[0].quantity, 1);
});
test("different sizes remain separate cart lines and totals use product prices", () => {
  const cart = addToCart(addToCart([], "court", "40"), "court", "41");
  assert.equal(cart.length, 2);
  assert.equal(cartCount(cart), 2);
  assert.equal(cartTotal(cart), 6580);
});
test("unknown products and unsupported sizes cannot be added", () => {
  assert.deepEqual(addToCart([], "not-a-product", "40"), []);
  assert.deepEqual(addToCart([], "court", "XS"), []);
});
test("saved cart rejects malformed, missing and invalid entries", () => {
  assert.deepEqual(sanitizeCart({}), []);
  assert.deepEqual(
    sanitizeCart([
      null,
      false,
      { id: "court", size: "40", quantity: -1 },
      { id: "missing", size: "40", quantity: 1 },
      { id: "court", size: "bad", quantity: 1 },
      { id: "court", size: "40", quantity: 1.5 },
      { id: "court", size: "40", quantity: 2 },
    ]),
    [{ id: "court", size: "40", quantity: 2 }],
  );
});
test("restoring duplicate cart entries merges them and caps quantity", () => {
  assert.deepEqual(
    sanitizeCart([
      { id: "court", size: "40", quantity: 80 },
      { id: "court", size: "40", quantity: 80 },
    ]),
    [{ id: "court", size: "40", quantity: 99 }],
  );
});
test("sale filter contains only discounted products", () => {
  const result = filterProducts({ sale: true });
  assert.equal(result.length, 2);
  assert.ok(result.every((p) => p.oldPrice > p.price));
});
test("gender filter includes unisex and excludes opposite gender", () => {
  assert.ok(
    filterProducts({ gender: "women" }).some((p) => p.gender === "unisex"),
  );
  assert.ok(
    filterProducts({ gender: "women" }).every((p) => p.gender !== "men"),
  );
});
test("search, category and wishlist filters compose and handle empty wishlist", () => {
  assert.deepEqual(
    filterProducts({
      query: "COURT",
      category: "sneakers",
      favorites: ["court"],
    }).map((p) => p.id),
    ["court"],
  );
  assert.deepEqual(filterProducts({ favorites: [] }), []);
  assert.deepEqual(filterProducts({ query: "unfindable-query" }), []);
});
test("price sorting is numeric and does not mutate source product order", () => {
  const ids = products.map((p) => p.id);
  const sorted = filterProducts({ sort: "price-asc" });
  assert.ok(sorted.every((p, i) => !i || sorted[i - 1].price <= p.price));
  assert.deepEqual(
    products.map((p) => p.id),
    ids,
  );
});
test("category search supports all storefront languages without rewriting single-letter queries", () => {
  assert.equal(filterProducts({ query: "кросівки" }).length, 5);
  assert.equal(filterProducts({ query: "кроссовки" }).length, 5);
  assert.equal(filterProducts({ query: "одяг" }).length, 2);
  assert.ok(
    filterProducts({ query: "a" }).some((p) => p.type === "accessories"),
  );
});
test("three translations have matching keys and nonempty values", () => {
  const keys = Object.keys(dictionaries.uk).sort();
  for (const lang of ["uk", "ru", "en"]) {
    assert.deepEqual(Object.keys(dictionaries[lang]).sort(), keys);
    assert.ok(
      Object.values(dictionaries[lang]).every(
        (value) => typeof value === "string" && value.length > 0,
      ),
    );
  }
});
test("each catalog image exists locally and each product has valid sizes and price", () => {
  for (const p of products) {
    assert.ok(
      existsSync(new URL(`../assets/products/${p.image}`, import.meta.url)),
    );
    assert.ok(Number.isInteger(p.price) && p.price > 0);
    assert.ok(p.sizes.length > 0);
  }
});
