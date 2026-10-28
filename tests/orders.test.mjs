import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrderStore,
  isWaybill,
  normalizePhone,
  trackingUrl,
  validateOrder,
} from "../src/orders.js";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
};
const valid = {
  items: [{ id: "court", size: "40", quantity: 2, price: 3290 }],
  lastName: "  Шевченко ",
  firstName: "Тарас",
  phone: "067 123 45 67",
  city: "Київ",
  deliveryType: "branch",
  point: "№ 25",
  payment: "cod",
  confirm: "viber",
  comment: "Після 18:00",
};

test("phones are normalized to +380 and waybills must have 14 digits", () => {
  assert.equal(normalizePhone("+38 (067) 123-45-67"), "+380671234567");
  assert.equal(normalizePhone("0671234567"), "+380671234567");
  assert.equal(normalizePhone("380671234567"), "+380671234567");
  assert.equal(normalizePhone("12345"), null);
  assert.ok(isWaybill("20450000000000"));
  assert.ok(!isWaybill("2045"));
  assert.match(trackingUrl("20450000000000"), /cargo_number=20450000000000$/);
});

test("order validation cleans input and reports the first missing field", () => {
  const { ok, order } = validateOrder(valid);
  assert.ok(ok);
  assert.deepEqual(order.customer, {
    lastName: "Шевченко",
    firstName: "Тарас",
    phone: "+380671234567",
  });
  assert.deepEqual(order.delivery, { city: "Київ", type: "branch", point: "25" });
  assert.equal(order.total, 6580);
  assert.equal(order.accountId, null);
  assert.deepEqual(validateOrder({ ...valid, items: [] }), { error: "orderEmpty" });
  assert.equal(validateOrder({ ...valid, lastName: "" }).field, "lastName");
  assert.equal(validateOrder({ ...valid, phone: "123" }).field, "phone");
  assert.equal(validateOrder({ ...valid, deliveryType: "courier" }).field, "deliveryType");
  assert.equal(validateOrder({ ...valid, point: "abc" }).field, "point");
  assert.equal(validateOrder({ ...valid, payment: "crypto" }).field, "payment");
  assert.equal(validateOrder({ ...valid, confirm: "sms" }).field, "confirm");
});

test("store numbers orders, lists newest first and links them to accounts", () => {
  let time = 1000;
  const store = createOrderStore({ storage: memoryStorage(), now: () => time });
  const first = store.create(valid).order;
  time = 2000;
  const second = store.create({ ...valid, accountId: "acc-1" }).order;
  assert.equal(first.number, "BD-1001");
  assert.equal(second.number, "BD-1002");
  assert.equal(first.status, "new");
  assert.deepEqual(store.list().map((order) => order.number), ["BD-1002", "BD-1001"]);
  assert.deepEqual(store.forAccount("acc-1").map((order) => order.number), ["BD-1002"]);
  assert.deepEqual(store.forAccount(null), []);
  assert.equal(store.create({ ...valid, firstName: "" }).error, "firstNameRequired");
});

test("status and waybill updates are validated; a waybill marks the order shipped", () => {
  const store = createOrderStore({ storage: memoryStorage() });
  const { number } = store.create(valid).order;
  assert.equal(store.update(number, { status: "confirmed" }).order.status, "confirmed");
  assert.equal(store.update(number, { status: "lost" }).error, "statusInvalid");
  assert.equal(store.update(number, { waybill: "123" }).error, "waybillInvalid");
  const shipped = store.update(number, { waybill: "2045 0000 0000 00" }).order;
  assert.equal(shipped.waybill, "20450000000000");
  assert.equal(shipped.status, "shipped");
  assert.equal(store.update(number, { status: "received" }).order.status, "received");
  assert.equal(store.update("BD-9", {}).error, "orderMissing");
});
