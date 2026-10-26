// Visitor activity log. For now events stay in this browser's localStorage;
// swapping `track` for a request to a server or analytics service is the only
// change needed to collect activity from every visitor.
const storageKey = "buyduck:events";
const maxEvents = 5000;
export const sessionGap = 30 * 60 * 1000;
export const eventTypes = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_start",
  "order",
  "search",
];

const isEvent = (event) =>
  event &&
  typeof event === "object" &&
  eventTypes.includes(event.type) &&
  Number.isFinite(event.at);

export function readEvents(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(storageKey));
    return Array.isArray(value) ? value.filter(isEvent) : [];
  } catch {
    return [];
  }
}
export function track(type, data = {}, storage = globalThis.localStorage) {
  if (!eventTypes.includes(type)) return;
  try {
    const events = readEvents(storage);
    events.push({ ...data, type, at: Date.now() });
    storage.setItem(storageKey, JSON.stringify(events.slice(-maxEvents)));
  } catch {
    // Statistics are optional: a full or blocked storage must not break the store.
  }
}
export function clearEvents(storage = globalThis.localStorage) {
  try {
    storage.removeItem(storageKey);
  } catch {}
}

const dayKey = (time) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const startOfDay = (time) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
// Number of calendar days a period covers; "all" is capped to keep the chart readable.
export const periodDays = { today: 1, week: 7, month: 30, all: 60 };

export function periodStart(period, now = Date.now()) {
  if (period === "all") return -Infinity;
  return startOfDay(now) - ((periodDays[period] || 7) - 1) * 86400000;
}

export function summarize(events, { period = "week", now = Date.now() } = {}) {
  const from = periodStart(period, now);
  const list = events
    .filter((event) => isEvent(event) && event.at >= from && event.at <= now)
    .sort((a, b) => a.at - b.at);
  const count = (type) => list.filter((event) => event.type === type).length;

  // A visit is a run of events with no pause longer than `sessionGap`.
  const visitStarts = [];
  const funnel = { visits: 0, productView: 0, cart: 0, checkout: 0, order: 0 };
  const stageOf = {
    product_view: "productView",
    add_to_cart: "cart",
    checkout_start: "checkout",
    order: "order",
  };
  let reached = new Set();
  let previous = -Infinity;
  for (const event of list) {
    if (event.at - previous > sessionGap) {
      visitStarts.push(event.at);
      reached = new Set();
    }
    previous = event.at;
    const stage = stageOf[event.type];
    if (stage && !reached.has(stage)) {
      reached.add(stage);
      funnel[stage] += 1;
    }
  }
  funnel.visits = visitStarts.length;

  const orders = list.filter((event) => event.type === "order");
  const revenue = orders.reduce(
    (sum, event) => sum + (Number.isFinite(event.total) ? event.total : 0),
    0,
  );

  const firstDay = Number.isFinite(from)
    ? from
    : startOfDay(list[0]?.at ?? now);
  const dayCount = Math.min(
    periodDays.all,
    Math.round((startOfDay(now) - startOfDay(firstDay)) / 86400000) + 1,
  );
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(startOfDay(now));
    date.setDate(date.getDate() - (dayCount - 1 - index));
    return { date: dayKey(date.getTime()), visits: 0 };
  });
  const byDay = new Map(days.map((day) => [day.date, day]));
  for (const start of visitStarts) {
    const day = byDay.get(dayKey(start));
    if (day) day.visits += 1;
  }

  const products = new Map();
  const product = (id) => {
    if (!products.has(id)) products.set(id, { id, views: 0, carts: 0, ordered: 0 });
    return products.get(id);
  };
  for (const event of list) {
    if (event.type === "product_view" && event.id) product(event.id).views += 1;
    if (event.type === "add_to_cart" && event.id) product(event.id).carts += 1;
    if (event.type === "order" && Array.isArray(event.items))
      for (const item of event.items)
        if (item?.id && Number.isInteger(item.quantity))
          product(item.id).ordered += item.quantity;
  }

  const searches = new Map();
  for (const event of list)
    if (event.type === "search" && typeof event.query === "string" && event.query) {
      const query = event.query.toLocaleLowerCase();
      searches.set(query, (searches.get(query) || 0) + 1);
    }

  const visits = visitStarts.length;
  return {
    visits,
    pageViews: count("page_view"),
    productViews: count("product_view"),
    addToCart: count("add_to_cart"),
    checkouts: count("checkout_start"),
    orders: orders.length,
    revenue,
    conversion: visits ? funnel.order / visits : 0,
    funnel,
    days,
    topProducts: [...products.values()]
      .sort((a, b) => b.ordered - a.ordered || b.carts - a.carts || b.views - a.views)
      .slice(0, 8),
    searches: [...searches]
      .map(([query, total]) => ({ query, count: total }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    empty: list.length === 0,
  };
}
