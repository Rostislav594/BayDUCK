import test from "node:test";
import assert from "node:assert/strict";
import {
  clearEvents,
  readEvents,
  sessionGap,
  summarize,
  track,
} from "../src/analytics.js";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};
const now = new Date(2026, 9, 26, 15, 0).getTime();
const minutes = (count) => count * 60 * 1000;
const at = (offset, event) => ({ ...event, at: now - offset });

test("track stores only known events and ignores storage failures", () => {
  const storage = memoryStorage();
  track("product_view", { id: "court" }, storage);
  track("not_an_event", {}, storage);
  const [event] = readEvents(storage);
  assert.equal(readEvents(storage).length, 1);
  assert.equal(event.type, "product_view");
  assert.equal(event.id, "court");
  assert.ok(Number.isFinite(event.at));
  const broken = {
    getItem: () => "{oops",
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.doesNotThrow(() => track("page_view", {}, broken));
  assert.deepEqual(readEvents(broken), []);
  clearEvents(storage);
  assert.deepEqual(readEvents(storage), []);
});

test("visits split on a long pause and the funnel counts each visit once", () => {
  const events = [
    // Visit 1: browses, adds twice, orders.
    at(minutes(120), { type: "page_view" }),
    at(minutes(118), { type: "product_view", id: "court" }),
    at(minutes(117), { type: "add_to_cart", id: "court" }),
    at(minutes(116), { type: "add_to_cart", id: "court" }),
    at(minutes(115), { type: "checkout_start", total: 6580 }),
    at(minutes(114), {
      type: "order",
      total: 6580,
      items: [{ id: "court", quantity: 2 }],
    }),
    // Visit 2 starts after a pause longer than the session gap.
    at(minutes(114) - sessionGap - minutes(1), { type: "page_view" }),
    at(minutes(80), { type: "product_view", id: "retro" }),
    at(minutes(79), { type: "search", query: "Кросівки" }),
    at(minutes(78), { type: "search", query: "кросівки" }),
  ];
  const data = summarize(events, { period: "today", now });
  assert.equal(data.visits, 2);
  assert.equal(data.pageViews, 2);
  assert.equal(data.productViews, 2);
  assert.equal(data.addToCart, 2);
  assert.equal(data.orders, 1);
  assert.equal(data.revenue, 6580);
  assert.deepEqual(data.funnel, {
    visits: 2,
    productView: 2,
    cart: 1,
    checkout: 1,
    order: 1,
  });
  assert.equal(data.conversion, 0.5);
  assert.deepEqual(data.topProducts[0], {
    id: "court",
    views: 1,
    carts: 2,
    ordered: 2,
  });
  assert.deepEqual(data.searches, [{ query: "кросівки", count: 2 }]);
  assert.equal(data.days.length, 1);
  assert.equal(data.days[0].visits, 2);
});

test("periods filter events and build one bucket per day", () => {
  const day = 86400000;
  const events = [
    at(0, { type: "page_view" }),
    at(3 * day, { type: "page_view" }),
    at(20 * day, { type: "page_view" }),
  ];
  const week = summarize(events, { period: "week", now });
  assert.equal(week.days.length, 7);
  assert.equal(week.visits, 2);
  assert.equal(week.days.at(-1).visits, 1);
  assert.equal(week.days.at(-4).visits, 1);
  assert.equal(summarize(events, { period: "month", now }).visits, 3);
  const all = summarize(events, { period: "all", now });
  assert.equal(all.days.length, 21);
  assert.equal(all.visits, 3);
  const empty = summarize([], { period: "week", now });
  assert.equal(empty.empty, true);
  assert.equal(empty.conversion, 0);
  assert.equal(empty.days.length, 7);
});
