import test from "node:test";
import assert from "node:assert/strict";
import { products, productById, productImages } from "../src/data.js";
import { dictionaries } from "../src/i18n.js";
import { relatedProducts, sizeChart, suggestShoeSize } from "../src/model.js";

test("shoe size chart gives insole length for every listed size", () => {
  const chart = sizeChart(productById("court"));
  assert.equal(chart.kind, "shoes");
  assert.equal(chart.rows.length, productById("court").sizes.length);
  assert.deepEqual(chart.rows[0], { size: "36", cm: 23 });
  assert.deepEqual(chart.rows.at(-1), { size: "45", cm: 29 });
  for (let i = 1; i < chart.rows.length; i++)
    assert.ok(chart.rows[i].cm > chart.rows[i - 1].cm, "insole grows with size");
});

test("clothing gets body measurements and one-size items get no chart", () => {
  const chart = sizeChart(productById("hoodie"));
  assert.equal(chart.kind, "clothing");
  assert.deepEqual(chart.rows[0], { size: "XS", chest: "82–86", waist: "66–70" });
  assert.equal(sizeChart(productById("backpack")), null);
  assert.equal(sizeChart(undefined), null);
});

test("foot length suggests the smallest size with about half a centimetre to spare", () => {
  const court = productById("court");
  assert.equal(suggestShoeSize(court, 25), "40");
  assert.equal(suggestShoeSize(court, 24.6), "40");
  assert.equal(suggestShoeSize(court, 22), "36");
  assert.equal(suggestShoeSize(court, 30), null);
  assert.equal(suggestShoeSize(court, 0), null);
  assert.equal(suggestShoeSize(productById("hoodie"), 25), null);
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
    assert.ok([null, "true", "small", "large"].includes(p.fit), p.id);
    assert.ok(productImages(p).length >= 1);
    for (const [label, value] of Object.entries(p.details)) {
      const key = `detail${label[0].toUpperCase()}${label.slice(1)}`;
      assert.ok(uk[key], `label ${key}`);
      assert.ok(uk[value] || /^[\d\s×.,]+$/.test(value), `${p.id} value ${value}`);
    }
  }
});
