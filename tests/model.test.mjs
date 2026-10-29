import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { conditions, products } from "../src/data.js";
import { dictionaries } from "../src/i18n.js";
import {
  filterProducts,
  sanitizeCart,
  cartTotal,
  cartCount,
  addToCart,
  inCart,
} from "../src/model.js";

test("an item is added once with its own size, without mutating the input", () => {
  const original = [];
  const cart = addToCart(original, "court");
  assert.deepEqual(cart, [{ id: "court", size: "42", quantity: 1 }]);
  assert.deepEqual(original, []);
  assert.ok(inCart(cart, "court"));
  // Each product is a single pair: adding it again changes nothing.
  assert.equal(addToCart(cart, "court"), cart);
});
test("different items are separate lines and totals use product prices", () => {
  const cart = addToCart(addToCart([], "court"), "retro");
  assert.equal(cart.length, 2);
  assert.equal(cartCount(cart), 2);
  assert.equal(cartTotal(cart), 3290 + 4190);
});
test("unknown products cannot be added", () => {
  assert.deepEqual(addToCart([], "not-a-product"), []);
});
test("saved cart keeps one line per item and drops entries with a wrong size", () => {
  assert.deepEqual(sanitizeCart({}), []);
  assert.deepEqual(
    sanitizeCart([
      null,
      false,
      { id: "missing", size: "40", quantity: 1 },
      { id: "court", size: "40", quantity: 1 },
      { id: "court", size: "42", quantity: 3 },
      { id: "court", size: "42", quantity: 1 },
      { id: "hoodie", size: "L" },
    ]),
    [
      { id: "court", size: "42", quantity: 1 },
      { id: "hoodie", size: "L", quantity: 1 },
    ],
  );
});
test("search also finds items by size", () => {
  assert.deepEqual(filterProducts({ query: "43" }).map((p) => p.id), ["retro"]);
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
test("each catalog image exists locally and each item has one size, a condition and a price", () => {
  for (const p of products) {
    assert.ok(
      existsSync(new URL(`../assets/products/${p.image}`, import.meta.url)),
    );
    assert.ok(Number.isInteger(p.price) && p.price > 0);
    assert.ok(typeof p.size === "string" && p.size.length > 0, p.id);
    assert.ok(conditions.includes(p.condition), p.id);
    if (p.type === "sneakers") {
      assert.match(p.size, /^\d{2}(\.5)?$/, `${p.id} EU size`);
      assert.ok(p.insoleCm >= 20 && p.insoleCm <= 33, `${p.id} insole cm`);
    } else assert.equal(p.insoleCm, undefined, `${p.id} has no insole`);
  }
});
