// Demo order store. Orders live in this browser's localStorage; on the Railway
// server the same interface (create / list / update) becomes API calls.
const ordersKey = "buyduck:orders";
const maxOrders = 500;

// Suggestions for the city field until the Nova Poshta directory API is connected.
export const npDemoCities = [
  "Київ", "Харків", "Одеса", "Дніпро", "Львів", "Запоріжжя", "Вінниця", "Полтава",
  "Чернігів", "Черкаси", "Житомир", "Суми", "Хмельницький", "Чернівці", "Рівне",
  "Івано-Франківськ", "Тернопіль", "Луцьк", "Ужгород", "Кропивницький", "Миколаїв",
  "Біла Церква", "Кривий Ріг",
];
export const deliveryTypes = ["branch", "locker"];
export const paymentMethods = ["cod", "card"];
export const confirmChannels = ["viber", "telegram"];
export const orderStatuses = [
  "new",
  "confirmed",
  "awaitingPayment",
  "shipped",
  "received",
  "cancelled",
  "returned",
];

const clean = (value, max) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// Accepts +380XXXXXXXXX, 380XXXXXXXXX or 0XXXXXXXXX with any spacing.
export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (/^380\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+38${digits}`;
  return null;
}
// Nova Poshta waybill numbers (ТТН) are 14 digits.
export const isWaybill = (value) => /^\d{14}$/.test(String(value ?? ""));
export const trackingUrl = (waybill) =>
  `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(waybill)}`;

export function validateOrder(input = {}) {
  const lastName = clean(input.lastName, 50);
  const firstName = clean(input.firstName, 50);
  const phone = normalizePhone(input.phone);
  const city = clean(input.city, 80);
  const point = String(input.point ?? "").replace(/\D/g, "").slice(0, 6);
  const items = Array.isArray(input.items)
    ? input.items.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.size === "string" &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          Number.isFinite(item.price),
      )
    : [];
  if (!items.length) return { error: "orderEmpty" };
  if (lastName.length < 2) return { error: "lastNameRequired", field: "lastName" };
  if (firstName.length < 2) return { error: "firstNameRequired", field: "firstName" };
  if (!phone) return { error: "phoneInvalid", field: "phone" };
  if (city.length < 2) return { error: "cityRequired", field: "city" };
  if (!deliveryTypes.includes(input.deliveryType))
    return { error: "deliveryTypeRequired", field: "deliveryType" };
  if (!point) return { error: "pointRequired", field: "point" };
  if (!paymentMethods.includes(input.payment))
    return { error: "paymentRequired", field: "payment" };
  if (!confirmChannels.includes(input.confirm))
    return { error: "confirmRequired", field: "confirm" };
  return {
    ok: true,
    order: {
      items: items.map(({ id, size, quantity, price }) => ({ id, size, quantity, price })),
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      customer: { lastName, firstName, phone },
      delivery: { city, type: input.deliveryType, point },
      payment: input.payment,
      confirm: input.confirm,
      comment: clean(input.comment, 500),
      accountId: typeof input.accountId === "string" ? input.accountId : null,
    },
  };
}

export function createOrderStore({
  storage = globalThis.localStorage,
  now = () => Date.now(),
} = {}) {
  const read = () => {
    try {
      const value = JSON.parse(storage.getItem(ordersKey));
      return Array.isArray(value) ? value.filter((order) => order?.number) : [];
    } catch {
      return [];
    }
  };
  const write = (orders) => {
    try {
      storage.setItem(ordersKey, JSON.stringify(orders.slice(0, maxOrders)));
      return true;
    } catch {
      return false;
    }
  };
  const nextNumber = (orders) => {
    const max = orders.reduce(
      (top, order) => Math.max(top, Number(String(order.number).replace(/\D/g, "")) || 0),
      1000,
    );
    return `BD-${max + 1}`;
  };
  return {
    create(input) {
      const result = validateOrder(input);
      if (!result.ok) return result;
      const orders = read();
      const time = now();
      const order = {
        ...result.order,
        number: nextNumber(orders),
        status: "new",
        waybill: "",
        createdAt: time,
        updatedAt: time,
      };
      if (!write([order, ...orders])) return { error: "storageFull" };
      return { ok: true, order };
    },
    list: () => read().sort((a, b) => b.createdAt - a.createdAt),
    get: (number) => read().find((order) => order.number === number) || null,
    forAccount: (accountId) =>
      read()
        .filter((order) => accountId && order.accountId === accountId)
        .sort((a, b) => b.createdAt - a.createdAt),
    update(number, { status, waybill } = {}) {
      const orders = read();
      const order = orders.find((item) => item.number === number);
      if (!order) return { error: "orderMissing" };
      if (status !== undefined) {
        if (!orderStatuses.includes(status)) return { error: "statusInvalid" };
        order.status = status;
      }
      if (waybill !== undefined) {
        const value = String(waybill).replace(/\s/g, "");
        if (value && !isWaybill(value)) return { error: "waybillInvalid" };
        order.waybill = value;
        if (value && ["new", "confirmed", "awaitingPayment"].includes(order.status))
          order.status = "shipped";
      }
      order.updatedAt = now();
      if (!write(orders)) return { error: "storageFull" };
      return { ok: true, order };
    },
  };
}
