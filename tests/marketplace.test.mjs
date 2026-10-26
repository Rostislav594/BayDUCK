import test from "node:test";
import assert from "node:assert/strict";
import { products } from "../src/data.js";
import { buildShafaListing, defaultShafaSection } from "../src/marketplace.js";

test("Shafa listing is built in Ukrainian with the chosen size and condition", () => {
  const listing = buildShafaListing({
    id: "court",
    size: "40",
    section: "men",
    condition: "excellent",
  });
  assert.equal(listing.title, "Кросівки BuyDUCK Studio Court Essential, розмір 40");
  assert.equal(listing.category, "Чоловікам → Взуття → Кросівки");
  assert.equal(listing.size, "40");
  assert.equal(listing.condition, "Відмінний");
  assert.equal(listing.color, "Білий");
  assert.equal(listing.price, "3290");
  assert.match(listing.description, /Розмір: 40 \(EU\)\./);
  assert.match(listing.description, /Стан: відмінний\./);
});
test("Shafa listing falls back to safe defaults for invalid input", () => {
  const listing = buildShafaListing({
    id: "retro",
    size: "XS",
    section: "kids",
    condition: "broken",
    price: -5,
  });
  assert.equal(listing.size, "40");
  assert.equal(listing.category, "Чоловікам → Взуття → Кросівки");
  assert.equal(listing.condition, "Новий з біркою");
  assert.equal(listing.price, "4190");
  assert.equal(buildShafaListing({ id: "missing" }), null);
});
test("Shafa listing handles one-size accessories, clothing kinds and extra notes", () => {
  const bag = buildShafaListing({ id: "backpack", notes: "  Є чохол  " });
  assert.equal(bag.title, "Рюкзак BuyDUCK Studio City Backpack");
  assert.equal(bag.size, "Універсальний");
  assert.equal(bag.category, "Жінкам → Аксесуари → Рюкзаки");
  assert.ok(bag.description.endsWith("\nЄ чохол"));
  assert.match(buildShafaListing({ id: "hoodie" }).category, /Худі та світшоти$/);
  assert.equal(buildShafaListing({ id: "court", price: 2999 }).price, "2999");
});
test("every product maps to a Shafa listing and a default section", () => {
  for (const p of products) {
    const listing = buildShafaListing({ id: p.id });
    assert.ok(listing.title && listing.description && listing.category, p.id);
    assert.ok(!listing.description.includes("undefined"), p.id);
    assert.ok(["women", "men"].includes(defaultShafaSection(p)));
  }
});
