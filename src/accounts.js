// Demo customer accounts for the clickable prototype. Everything stays in this
// browser: accounts in localStorage, the session in localStorage ("remember me")
// or sessionStorage. When the Railway server arrives, the store's methods are
// the swap point for API calls; the UI only uses the async methods below.
const accountsKey = "buyduck:accounts";
const sessionKey = "buyduck:session";
export const minPasswordLength = 8;
export const maxFailedAttempts = 5;
export const lockoutMs = 60 * 1000;
const pbkdf2Iterations = 120000;
const fallbackIterations = 4000;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();
export const isValidEmail = (value) =>
  value.length <= 120 && emailPattern.test(value);
export const isStrongPassword = (value) =>
  typeof value === "string" &&
  value.length >= minPasswordLength &&
  value.length <= 128 &&
  /\p{L}/u.test(value) &&
  /\d/.test(value);
const clean = (value, max) => String(value ?? "").trim().slice(0, max);

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (value) => Uint8Array.from(value.match(/../g) || [], (h) => parseInt(h, 16));

// Plain-http LAN previews have no crypto.subtle, so a small SHA-256 keeps
// passwords hashed there too. It is only a fallback for the demo.
export function sha256(bytes) {
  const k = Uint32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(length);
  data.set(bytes);
  data[bytes.length] = 0x80;
  new DataView(data.buffer).setUint32(length - 4, bytes.length * 8);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < length; offset += 64) {
    const view = new DataView(data.buffer, offset, 64);
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + k[i] + w[i];
      const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
      [hh, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
    }
    [a, b, c, d, e, f, g, hh].forEach((value, i) => (h[i] = (h[i] + value) >>> 0));
  }
  const out = new Uint8Array(32);
  h.forEach((value, i) => new DataView(out.buffer).setUint32(i * 4, value));
  return out;
}

async function derive(password, salt, algo, crypto) {
  const secret = new TextEncoder().encode(password);
  if (algo === "pbkdf2-sha256") {
    const key = await crypto.subtle.importKey("raw", secret, "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: pbkdf2Iterations },
      key,
      256,
    );
    return hex(new Uint8Array(bits));
  }
  let digest = sha256(new Uint8Array([...salt, ...secret]));
  for (let i = 1; i < fallbackIterations; i++) digest = sha256(new Uint8Array([...digest, ...salt, ...secret]));
  return hex(digest);
}
async function hashPassword(password, crypto) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const algo = crypto.subtle ? "pbkdf2-sha256" : "sha256-iter";
  return { algo, salt: hex(salt), hash: await derive(password, salt, algo, crypto) };
}
async function checkPassword(password, record, crypto) {
  if (!record || (record.algo === "pbkdf2-sha256" && !crypto.subtle)) return false;
  const actual = await derive(password, fromHex(record.salt), record.algo, crypto);
  // Compare every character so timing does not reveal the matching prefix.
  let diff = actual.length ^ record.hash.length;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ record.hash.charCodeAt(i);
  return diff === 0;
}

const publicAccount = ({ password, failed, ...account }) =>
  structuredClone({ ...account, orders: account.orders || [] });

export function createAccountStore({
  storage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
  crypto = globalThis.crypto,
  now = Date.now,
} = {}) {
  const read = () => {
    try {
      const value = JSON.parse(storage.getItem(accountsKey));
      return Array.isArray(value) ? value.filter((a) => a && typeof a.email === "string" && a.password) : [];
    } catch {
      return [];
    }
  };
  const write = (accounts) => {
    try {
      storage.setItem(accountsKey, JSON.stringify(accounts));
      return true;
    } catch {
      return false;
    }
  };
  const readSession = () => {
    for (const store of [sessionStorage, storage]) {
      try {
        const value = JSON.parse(store?.getItem(sessionKey));
        if (value && typeof value.id === "string") return value.id;
      } catch {}
    }
    return null;
  };
  const startSession = (id, remember) => {
    endSession();
    try {
      (remember ? storage : sessionStorage).setItem(sessionKey, JSON.stringify({ id, at: now() }));
    } catch {}
  };
  const endSession = () => {
    for (const store of [sessionStorage, storage]) {
      try {
        store?.removeItem(sessionKey);
      } catch {}
    }
  };
  const update = (id, change) => {
    const accounts = read();
    const account = accounts.find((a) => a.id === id);
    if (!account) return { error: "accountMissing" };
    change(account);
    if (!write(accounts)) return { error: "storageFull" };
    return { ok: true, account: publicAccount(account) };
  };

  return {
    current() {
      const id = readSession();
      const account = id && read().find((a) => a.id === id);
      return account ? publicAccount(account) : null;
    },
    async register({ email, password, name, remember = true }) {
      const address = normalizeEmail(email);
      const displayName = clean(name, 80);
      if (displayName.length < 2) return { error: "nameRequired" };
      if (!isValidEmail(address)) return { error: "invalidEmail" };
      if (!isStrongPassword(password)) return { error: "weakPassword" };
      const accounts = read();
      if (accounts.some((a) => a.email === address)) return { error: "emailTaken" };
      const id = hex(crypto.getRandomValues(new Uint8Array(8)));
      const account = {
        id, email: address, name: displayName, phone: "", city: "", branch: "",
        createdAt: now(), orders: [], password: await hashPassword(password, crypto),
      };
      if (!write([...accounts, account])) return { error: "storageFull" };
      startSession(id, remember);
      return { ok: true, account: publicAccount(account) };
    },
    async signIn({ email, password, remember = true }) {
      const address = normalizeEmail(email);
      const accounts = read();
      const account = accounts.find((a) => a.email === address);
      // The same message for an unknown email and a wrong password.
      if (!account) return { error: "wrongCredentials" };
      if (account.failed?.until > now()) return { error: "tooManyAttempts" };
      if (!(await checkPassword(String(password ?? ""), account.password, crypto))) {
        const count = (account.failed?.until > 0 ? 0 : account.failed?.count || 0) + 1;
        account.failed = count >= maxFailedAttempts ? { count: 0, until: now() + lockoutMs } : { count, until: 0 };
        write(accounts);
        return { error: account.failed.until ? "tooManyAttempts" : "wrongCredentials" };
      }
      delete account.failed;
      write(accounts);
      startSession(account.id, remember);
      return { ok: true, account: publicAccount(account) };
    },
    signOut: endSession,
    updateProfile(id, { name, phone, city, branch }) {
      const displayName = clean(name, 80);
      if (displayName.length < 2) return { error: "nameRequired" };
      return update(id, (account) => {
        Object.assign(account, {
          name: displayName,
          phone: clean(phone, 20),
          city: clean(city, 80),
          branch: clean(branch, 120),
        });
      });
    },
    async changePassword(id, current, next) {
      const account = read().find((a) => a.id === id);
      if (!account) return { error: "accountMissing" };
      if (!(await checkPassword(String(current ?? ""), account.password, crypto))) return { error: "wrongPassword" };
      if (!isStrongPassword(next)) return { error: "weakPassword" };
      const password = await hashPassword(next, crypto);
      return update(id, (a) => (a.password = password));
    },
    addOrder(id, { items, total, delivery }) {
      const order = {
        number: `BD-${String(now()).slice(-6)}${Math.floor(Math.random() * 10)}`,
        createdAt: now(),
        items: items.map(({ id: productId, size, quantity, price }) => ({ id: productId, size, quantity, price })),
        total,
        delivery: { city: clean(delivery?.city, 80), branch: clean(delivery?.branch, 120) },
        status: "demo",
      };
      const result = update(id, (account) => {
        account.orders = [order, ...(account.orders || [])].slice(0, 50);
      });
      return result.ok ? { ...result, order } : result;
    },
    async deleteAccount(id, password) {
      const accounts = read();
      const account = accounts.find((a) => a.id === id);
      if (!account) return { error: "accountMissing" };
      if (!(await checkPassword(String(password ?? ""), account.password, crypto))) return { error: "wrongPassword" };
      if (!write(accounts.filter((a) => a.id !== id))) return { error: "storageFull" };
      endSession();
      return { ok: true };
    },
  };
}
