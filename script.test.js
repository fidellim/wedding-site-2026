import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("./public-backend.js", () => ({
  publicBackend: { url: "https://example.test", key: "test-publishable-key-for-invitation" },
}));

const cacheKey = "invite_guest_cache_v3_test-code";
const ttlMs = 2 * 60 * 60 * 1000;
const invalidMessage = "This invitation code is invalid. Invited guests only.";
const verificationMessage = "We could not verify your invitation right now.";
const currentRecord = { code: "TEST-CODE", guest_name: "Currently Invited", max_seats: 3 };
const response = rows => ({ ok: true, json: async () => rows });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
  localStorage.clear();
  window.history.replaceState({}, "", "/?code=TEST-CODE");
  const html = readFileSync(resolve("index.html"), "utf8");
  document.body.innerHTML = new DOMParser().parseFromString(html, "text/html").body.innerHTML;
  document.body.className = "";
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  vi.stubGlobal("fetch", vi.fn(async () => response([])));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function seedGuest(ageMs = 0) {
  const cached = {
    validatedAt: Date.now() - ageMs,
    guest: { code: "test-code", id: "test-code", name: "Previously Invited", email: "", seats: 2, isValidCode: true },
  };
  localStorage.setItem(cacheKey, JSON.stringify(cached));
  return cached;
}

function deferLookup() {
  let finish;
  fetch.mockImplementation((url, options) => {
    if (!url.endsWith("/lookup_invite")) return Promise.resolve(response([]));
    return new Promise((resolveLookup, rejectLookup) => {
      finish = resolveLookup;
      options.signal.addEventListener("abort", () => rejectLookup(new Error("Lookup timed out")));
    });
  });
  return rows => finish(response(rows));
}

async function settle(check) {
  await vi.advanceTimersByTimeAsync(0);
  check();
}

function expectClosed(message) {
  expect(document.getElementById("privateEventGate")).not.toHaveClass("hidden");
  expect(document.getElementById("privateGateMessage")).toHaveTextContent(message);
  expect(document.getElementById("envelopeGateContainer")).toHaveClass("hidden");
  expect(document.getElementById("mainContent")).toHaveClass("hidden");
}

function expectAdmitted() {
  expect(document.getElementById("envelopeGateContainer")).not.toHaveClass("hidden");
  expect(document.getElementById("privateEventGate")).toHaveClass("hidden");
}

it("rejects an invalid code and displays the private-event gate", async () => {
  await import("./script.js");
  await settle(() => expectClosed(invalidMessage));
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/rpc/lookup_invite"), expect.objectContaining({ body: JSON.stringify({ p_code: "test-code" }) }));
  expect(localStorage.getItem(cacheKey)).toBeNull();
});

it("admits a valid code and caches the successful server validation", async () => {
  fetch.mockImplementation(async url => response(url.endsWith("/lookup_invite") ? [currentRecord] : []));
  await import("./script.js");
  await settle(expectAdmitted);
  expect(document.getElementById("gateGuestName")).toHaveTextContent("For Currently Invited");
  expect(JSON.parse(localStorage.getItem(cacheKey))).toMatchObject({ validatedAt: Date.now(), guest: { code: "test-code", name: "Currently Invited", isValidCode: true } });
});

it("admits a recent cached guest immediately while revalidating in the background", async () => {
  const cached = seedGuest(60 * 60 * 1000);
  const complete = deferLookup();
  await import("./script.js");
  await settle(expectAdmitted);
  expect(document.getElementById("gateGuestName")).toHaveTextContent("For Previously Invited");
  expect(JSON.parse(localStorage.getItem(cacheKey))).toEqual(cached);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/rpc/lookup_invite"), expect.anything());
  complete([]);
  await settle(() => expectClosed(invalidMessage));
  expect(localStorage.getItem(cacheKey)).toBeNull();
});

it("refreshes details and the two-hour deadline only after successful background validation", async () => {
  const cached = seedGuest(ttlMs - 1000);
  const complete = deferLookup();
  await import("./script.js");
  await settle(expectAdmitted);
  await vi.advanceTimersByTimeAsync(500);
  expect(JSON.parse(localStorage.getItem(cacheKey))).toEqual(cached);
  complete([currentRecord]);
  await settle(() => expect(document.getElementById("gateGuestName")).toHaveTextContent("For Currently Invited"));
  expect(JSON.parse(localStorage.getItem(cacheKey)).validatedAt).toBe(Date.now());
  await vi.advanceTimersByTimeAsync(1000);
  expectAdmitted();
});

it("keeps the private-event gate closed to invitation content when rejection arrives during envelope opening", async () => {
  seedGuest();
  const complete = deferLookup();
  await import("./script.js");
  await settle(expectAdmitted);
  document.getElementById("envelopeBtn").click();
  complete([]);
  await settle(() => expectClosed(invalidMessage));
  await vi.advanceTimersByTimeAsync(2500);
  expectClosed(invalidMessage);
});

it("preserves recent cached access after a network failure without extending its expiry", async () => {
  const cached = seedGuest(ttlMs - 1000);
  fetch.mockRejectedValue(new Error("Network unavailable"));
  await import("./script.js");
  await settle(expectAdmitted);
  await vi.advanceTimersByTimeAsync(999);
  expectAdmitted();
  expect(JSON.parse(localStorage.getItem(cacheKey))).toEqual(cached);
  await vi.advanceTimersByTimeAsync(1);
  expectClosed(verificationMessage);
  expect(localStorage.getItem(cacheKey)).toBeNull();
});

it("treats HTTP failures as verification failures rather than invalid codes", async () => {
  const cached = seedGuest();
  fetch.mockResolvedValue({ ok: false, status: 503 });
  await import("./script.js");
  await settle(expectAdmitted);
  await vi.advanceTimersByTimeAsync(1);
  expect(JSON.parse(localStorage.getItem(cacheKey))).toEqual(cached);
  expectAdmitted();
});

it("treats malformed lookup responses as verification failures without clearing a recent cache", async () => {
  const cached = seedGuest();
  fetch.mockResolvedValue(response({ error: "Unexpected payload" }));
  await import("./script.js");
  await settle(expectAdmitted);
  await vi.advanceTimersByTimeAsync(1);
  expect(JSON.parse(localStorage.getItem(cacheKey))).toEqual(cached);
});

it("retains the original cache deadline when background validation times out", async () => {
  const cached = seedGuest(ttlMs - 10000);
  deferLookup();
  await import("./script.js");
  await settle(expectAdmitted);
  await vi.advanceTimersByTimeAsync(4500);
  expectAdmitted();
  expect(JSON.parse(localStorage.getItem(cacheKey))).toEqual(cached);
  await vi.advanceTimersByTimeAsync(5500);
  expectClosed(verificationMessage);
});

it.each([ttlMs, ttlMs + 1])("requires live verification for a cache aged %i ms", async ageMs => {
  seedGuest(ageMs);
  const complete = deferLookup();
  await import("./script.js");
  expect(document.getElementById("envelopeGateContainer")).toHaveClass("hidden");
  expect(document.getElementById("loadingGate")).not.toHaveClass("hidden");
  expect(localStorage.getItem(cacheKey)).toBeNull();
  complete([currentRecord]);
  await settle(expectAdmitted);
  expect(JSON.parse(localStorage.getItem(cacheKey)).validatedAt).toBe(Date.now());
});

it("keeps an expired cached guest closed when verification fails", async () => {
  seedGuest(ttlMs);
  fetch.mockRejectedValue(new Error("Network unavailable"));
  await import("./script.js");
  await settle(() => expectClosed(verificationMessage));
  expect(localStorage.getItem(cacheKey)).toBeNull();
});

it("rejects an expired cached guest when the live lookup returns invalid", async () => {
  seedGuest(ttlMs);
  await import("./script.js");
  await settle(() => expectClosed(invalidMessage));
});

it("closes recent cached access at its deadline even while verification is pending", async () => {
  seedGuest(ttlMs - 1000);
  const complete = deferLookup();
  await import("./script.js");
  await settle(expectAdmitted);
  await vi.advanceTimersByTimeAsync(1000);
  expectClosed(verificationMessage);
  complete([currentRecord]);
  await settle(expectAdmitted);
});

it.each(["broken-json", JSON.stringify({ validatedAt: "today" }), JSON.stringify({ validatedAt: 0, guest: {} })])("ignores malformed caches: %s", async value => {
  localStorage.setItem(cacheKey, value);
  await import("./script.js");
  await settle(() => expectClosed(invalidMessage));
});

it("does not reuse a cache belonging to another code", async () => {
  const cached = seedGuest();
  cached.guest.code = "other-code";
  localStorage.setItem(cacheKey, JSON.stringify(cached));
  await import("./script.js");
  await settle(() => expectClosed(invalidMessage));
});

it("ignores future-dated caches", async () => {
  seedGuest(-1000);
  await import("./script.js");
  await settle(() => expectClosed(invalidMessage));
});

it("does not trust the previous cache format with non-validation timestamps", async () => {
  localStorage.setItem("invite_guest_cache_v2_test-code", JSON.stringify({ savedAt: Date.now(), guest: seedGuest().guest }));
  localStorage.removeItem(cacheKey);
  await import("./script.js");
  await settle(() => expectClosed(invalidMessage));
});

it("can admit a valid guest even when browser storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  fetch.mockImplementation(async url => response(url.endsWith("/lookup_invite") ? [currentRecord] : []));
  await import("./script.js");
  await settle(expectAdmitted);
});

it("shows the private-event gate without a code and makes no request", async () => {
  window.history.replaceState({}, "", "/");
  await import("./script.js");
  await settle(() => expectClosed("Please use your personalized invitation link."));
  expect(fetch).not.toHaveBeenCalled();
});
