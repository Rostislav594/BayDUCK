import test from "node:test";
import assert from "node:assert/strict";
import { conditions, products, productById, productImages } from "../src/data.js";
import { dictionaries } from "../src/i18n.js";
import { relatedProducts } from "../src/model.js";

test("each pair of shoes has one EU size and its own insole length", () => {
  const court = productById("court");
  assert.equal(court.size, "42");
  assert.equal(court.insoleCm, 27.5);
  for (const p of products.filter((item) => item.type === "sneakers"))
    assert.ok(p.insoleCm > Number(p.size) * 0.6, `${p.id}: insole roughly matches the EU size`);
});

test("every item carries one of the two condition labels in all languages", () => {
  assert.deepEqual(conditions, ["used", "newTag"]);
  for (const lang of ["uk", "ru", "en"]) {
    assert.ok(dictionaries[lang].condUsed);
    assert.ok(dictionaries[lang].condNewTag);
  }
  assert.equal(dictionaries.uk.condUsed, "Вживане");
  assert.equal(dictionaries.uk.condNewTag, "Нові з біркою");
  assert.ok(products.some((p) => p.condition === "used"));
});

test("related products prefer the same type and never include the product itself", () => {
  const related = relatedProducts(productById("court"));
  assert.equal(related.length, 4);
  assert.ok(related.every((p) => p.id !== "court" && p.type === "sneakers"));
  const forBag = relatedProducts(productById("backpack"), 3);
  assert.equal(forBag.length, 3);
  assert.ok(!forBag.some((p) => p.id === "backpack"));
});

test("every product has page content in all three languages", () => {
  const uk = dictionaries.uk;
  for (const p of products) {
    assert.match(p.article, /^BD-[A-Z]{2}-\d{2}$/, p.id);
    for (const lang of ["uk", "ru", "en"])
      assert.ok(p.description?.[lang]?.length > 20, `${p.id} ${lang} description`);
    assert.ok(productImages(p).length >= 1);
    for (const [label, value] of Object.entries(p.details)) {
      const key = `detail${label[0].toUpperCase()}${label.slice(1)}`;
      assert.ok(uk[key], `label ${key}`);
      assert.ok(uk[value] || /^[\d\s×.,]+$/.test(value), `${p.id} value ${value}`);
    }
  }
});

test("the guide tells which foot length suits this pair's insole", async () => {
  const { footRange } = await import("../src/model.js");
  assert.deepEqual(footRange(27.5), { from: 26.5, to: 27 });
  assert.deepEqual(footRange(24.5), { from: 23.5, to: 24 });
});

test("the home showcase has 3–4 photos of existing items", async () => {
  const { productById, showcaseIds } = await import("../src/data.js");
  assert.ok(showcaseIds.length >= 3 && showcaseIds.length <= 4);
  assert.equal(new Set(showcaseIds).size, showcaseIds.length);
  for (const id of showcaseIds) assert.ok(productById(id)?.image, id);
});
