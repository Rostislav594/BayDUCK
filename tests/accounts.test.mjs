import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createAccountStore, isStrongPassword, lockoutMs, maxFailedAttempts, normalizeEmail, sha256 } from "../src/accounts.js";

const memoryStorage = () => {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};
const setup = (crypto = webcrypto) => {
  const storage = memoryStorage(), sessionStorage = memoryStorage();
  let time = Date.UTC(2026, 9, 27, 10);
  const clock = { advance: (ms) => (time += ms) };
  const store = createAccountStore({ storage, sessionStorage, crypto, now: () => time });
  return { store, storage, sessionStorage, clock };
};
const user = { name: "Olena", email: " Olena@Example.COM ", password: "duck2026pass" };

test("SHA-256 fallback matches the standard test vector", () => {
  const digest = Buffer.from(sha256(new TextEncoder().encode("abc"))).toString("hex");
  assert.equal(digest, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("registration validates input, normalizes email and never stores the password", async () => {
  const { store, storage } = setup();
  assert.equal((await store.register({ ...user, name: "O" })).error, "nameRequired");
  assert.equal((await store.register({ ...user, email: "olena@" })).error, "invalidEmail");
  for (const weak of ["short1", "onlyletters", "12345678"]) {
    assert.equal(isStrongPassword(weak), false);
    assert.equal((await store.register({ ...user, password: weak })).error, "weakPassword");
  }
  const result = await store.register(user);
  assert.ok(result.ok);
  assert.equal(result.account.email, "olena@example.com");
  assert.equal(result.account.password, undefined);
  assert.equal(store.current().email, "olena@example.com");
  const saved = storage.data.get("buyduck:accounts");
  assert.ok(!saved.includes(user.password), "password is hashed");
  assert.match(saved, /pbkdf2-sha256/);
  assert.equal((await store.register({ ...user, email: "OLENA@example.com" })).error, "emailTaken");
});

test("sign-in checks the password, gives one message for unknown email, and signs out", async () => {
  const { store } = setup();
  await store.register(user);
  store.signOut();
  assert.equal(store.current(), null);
  assert.equal((await store.signIn({ email: "nobody@example.com", password: user.password })).error, "wrongCredentials");
  assert.equal((await store.signIn({ email: user.email, password: "wrong-pass1" })).error, "wrongCredentials");
  const result = await store.signIn({ email: normalizeEmail(user.email), password: user.password });
  assert.ok(result.ok);
  assert.equal(store.current().name, "Olena");
});

test("too many failed attempts lock sign-in for a minute", async () => {
  const { store, clock } = setup();
  await store.register(user);
  store.signOut();
  for (let i = 1; i < maxFailedAttempts; i++)
    assert.equal((await store.signIn({ email: user.email, password: "bad-pass" + i })).error, "wrongCredentials");
  assert.equal((await store.signIn({ email: user.email, password: "bad-pass9" })).error, "tooManyAttempts");
  assert.equal((await store.signIn({ email: user.email, password: user.password })).error, "tooManyAttempts");
  clock.advance(lockoutMs + 1);
  assert.ok((await store.signIn({ email: user.email, password: user.password })).ok);
});

test("remember me chooses persistent or tab-only session", async () => {
  const { store, storage, sessionStorage } = setup();
  await store.register({ ...user, remember: false });
  assert.ok(sessionStorage.data.has("buyduck:session"));
  assert.ok(!storage.data.has("buyduck:session"));
  await store.signIn({ email: user.email, password: user.password, remember: true });
  assert.ok(storage.data.has("buyduck:session"));
  assert.ok(!sessionStorage.data.has("buyduck:session"));
});

test("profile, password change, order history and account deletion", async () => {
  const { store } = setup();
  const { account } = await store.register(user);
  assert.equal(store.updateProfile(account.id, { name: "" }).error, "nameRequired");
  const profile = store.updateProfile(account.id, { name: " Olena K ", phone: "+380501112233", city: "Kyiv", branch: "12" });
  assert.deepEqual([profile.account.name, profile.account.city, profile.account.branch], ["Olena K", "Kyiv", "12"]);

  assert.equal((await store.changePassword(account.id, "wrong-pass1", "newduck2027")).error, "wrongPassword");
  assert.equal((await store.changePassword(account.id, user.password, "weak")).error, "weakPassword");
  assert.ok((await store.changePassword(account.id, user.password, "newduck2027")).ok);
  store.signOut();
  assert.equal((await store.signIn({ email: user.email, password: user.password })).error, "wrongCredentials");
  assert.ok((await store.signIn({ email: user.email, password: "newduck2027" })).ok);

  const first = store.addOrder(account.id, { items: [{ id: "court", size: "40", quantity: 2, price: 3290 }], total: 6580, delivery: { city: "Kyiv", branch: "12" } });
  const second = store.addOrder(account.id, { items: [{ id: "red", size: "41", quantity: 1, price: 3690 }], total: 3690, delivery: { city: "Lviv", branch: "3" } });
  assert.match(first.order.number, /^BD-\d{7}$/);
  assert.deepEqual(store.current().orders.map((o) => o.total), [3690, 6580], "newest first");

  assert.equal((await store.deleteAccount(account.id, "wrong-pass1")).error, "wrongPassword");
  assert.ok((await store.deleteAccount(account.id, "newduck2027")).ok);
  assert.equal(store.current(), null);
  assert.equal((await store.signIn({ email: user.email, password: "newduck2027" })).error, "wrongCredentials");
});

test("plain-http previews without crypto.subtle still hash passwords", async () => {
  const { store, storage } = setup({ getRandomValues: (array) => webcrypto.getRandomValues(array) });
  await store.register(user);
  store.signOut();
  assert.match(storage.data.get("buyduck:accounts"), /sha256-iter/);
  assert.ok(!storage.data.get("buyduck:accounts").includes(user.password));
  assert.ok((await store.signIn({ email: user.email, password: user.password })).ok);
  assert.equal((await store.signIn({ email: user.email, password: "wrong-pass1" })).error, "wrongCredentials");
});

test("broken or foreign storage data does not break the store", () => {
  const { store, storage } = setup();
  storage.setItem("buyduck:accounts", "{not json");
  storage.setItem("buyduck:session", JSON.stringify({ id: "missing" }));
  assert.equal(store.current(), null);
});
