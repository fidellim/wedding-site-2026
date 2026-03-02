const weddingConfig = {
  coupleNames: "Hannah & Fidel",
  weddingDateISO: "2026-11-15T16:00:00+04:00",
  venueName: "Saadiyat Beach Club",
  venueAddress: "Saadiyat Island, Abu Dhabi, United Arab Emirates",
  mapQuery: "Saadiyat Beach Club Abu Dhabi",
  mapUrl: "https://maps.app.goo.gl/3Xz3dgFL5ASc7aD7A",
  dressCode: {
    title: "Formal Garden Attire",
    notes:
      "Ladies: long dress or elegant midi. Gentlemen: suit or barong in warm neutral tones.",
    palette: ["#E7D7C9", "#C4A692", "#A8B59B", "#8AA5BA", "#D8B5A8"],
  },
  backend: {
    provider: "supabase",
    supabaseUrl: "https://loycmpzimwgusjyaqxcn.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxveWNtcHppbXdndXNqeWFxeGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjM3MzMsImV4cCI6MjA4ODAzOTczM30.qzAaiJqnArxet7J9Mmwh1FMj7FpOCtNy8Aw2rkfE8Ko",
    tableName: "invites",
    requestTimeoutMs: 4500,
    requireValidCode: true,
  },
};

// Optional local fallback for testing when backend URL is not configured.
const localInviteFallback = {
  fidelfam: { name: "Fidel Family", seats: 4 },
  jileenfam: { name: "Jileen Family", seats: 4 },
  friends1: { name: "Friends Table 1", seats: 2 },
};

const q = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const guestCacheConfig = {
  keyPrefix: "invite_guest_cache_v2_",
  ttlMs: 1000 * 60 * 60 * 12,
};

const gate = q("envelopeGate");
const mainContent = q("mainContent");
const envelopeBtn = q("envelopeBtn");
const privateEventGate = q("privateEventGate");
const privateGateMessage = q("privateGateMessage");
const gateGuestName = q("gateGuestName");
const personalGreeting = q("personalGreeting");
const rsvpGuestPrompt = q("rsvpGuestPrompt");
const guestNameInput = q("guestNameInput");
const attendeeCountInput = q("attendeeCountInput");
const rsvpFeedback = q("rsvpFeedback");
const rsvpForm = q("rsvpForm");
const attendanceInput = q("attendanceInput");
const messageInput = q("messageInput");

let countdownInterval = null;
let invitationOpened = false;
let currentGuest = {
  code: "",
  id: "general",
  name: "Valued Guest",
  seats: 2,
  source: "default",
  isValidCode: false,
};

function normalizeCode(rawCode) {
  return (rawCode || "").trim().toLowerCase();
}

function getGuestCacheKey(code) {
  return `${guestCacheConfig.keyPrefix}${normalizeCode(code)}`;
}

function readGuestCache(code) {
  if (!code) {
    return null;
  }
  try {
    const raw = localStorage.getItem(getGuestCacheKey(code));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.savedAt || !parsed.guest) {
      return null;
    }
    const age = Date.now() - Number(parsed.savedAt);
    if (!Number.isFinite(age) || age > guestCacheConfig.ttlMs) {
      localStorage.removeItem(getGuestCacheKey(code));
      return null;
    }
    return parsed.guest;
  } catch (error) {
    return null;
  }
}

function writeGuestCache(code, guest) {
  if (!code || !guest) {
    return;
  }
  try {
    localStorage.setItem(
      getGuestCacheKey(code),
      JSON.stringify({
        savedAt: Date.now(),
        guest,
      })
    );
  } catch (error) {
    // Ignore storage errors to keep RSVP flow uninterrupted.
  }
}

function isBackendConfigured() {
  const provider = String(weddingConfig.backend.provider || "").toLowerCase();
  if (provider !== "supabase") {
    return false;
  }
  const url = (weddingConfig.backend.supabaseUrl || "").trim();
  const anonKey = (weddingConfig.backend.supabaseAnonKey || "").trim();
  return url.startsWith("https://") && anonKey.length > 20;
}

function getSupabaseBaseUrl() {
  return (weddingConfig.backend.supabaseUrl || "").trim().replace(/\/+$/, "");
}

function getSupabaseHeaders(code) {
  const key = (weddingConfig.backend.supabaseAnonKey || "").trim();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function fetchWithTimeout(url, options = {}) {
  const timer = withTimeout(weddingConfig.backend.requestTimeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: timer.signal,
    });
  } finally {
    timer.clear();
  }
}

function formatEventDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function hydrateStaticContent() {
  const weddingDate = new Date(weddingConfig.weddingDateISO);

  q("weddingDateText").textContent = formatEventDate(weddingDate);
  q("venueName").textContent = weddingConfig.venueName;
  q("venueAddress").textContent = weddingConfig.venueAddress;

  const mapLink = q("mapLink");
  mapLink.href =
    weddingConfig.mapUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      weddingConfig.mapQuery
    )}`;

  q("dressCodeTitle").textContent = weddingConfig.dressCode.title;
  q("dressCodeNotes").textContent = weddingConfig.dressCode.notes;

  const palette = q("dressCodePalette");
  if (!palette.dataset.hydrated) {
    weddingConfig.dressCode.palette.forEach((color) => {
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      palette.appendChild(swatch);
    });
    palette.dataset.hydrated = "true";
  }
}

function applyGuestToUi(guest) {
  gateGuestName.textContent = `For ${guest.name}`;
  personalGreeting.textContent = `We can't wait to celebrate with you, ${guest.name}.`;
  rsvpGuestPrompt.textContent = `Reserved for your invitation: up to ${guest.seats} attendee(s).`;
  guestNameInput.value = guest.name;
  attendeeCountInput.max = String(guest.seats);
  attendeeCountInput.value = guest.seats > 0 ? "1" : "0";
}

function showPrivateGate(message) {
  gate.classList.add("hidden");
  mainContent.classList.add("hidden");
  privateEventGate.classList.remove("hidden");
  document.body.classList.add("private-only");
  privateGateMessage.textContent =
    message || "This invitation is private. Please use your personalized invite link.";
  document.body.classList.remove("intro-active");
}

function showInvitationExperience() {
  privateEventGate.classList.add("hidden");
  mainContent.classList.add("hidden");
  document.body.classList.remove("private-only");
  gate.classList.remove("hidden");
}

function setRsvpFormEnabled(enabled, message = "") {
  const fields = [guestNameInput, attendanceInput, attendeeCountInput, messageInput];
  fields.forEach((el) => {
    el.disabled = !enabled;
  });
  const submitBtn = rsvpForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = !enabled;
  }
  rsvpFeedback.textContent = message;
}

function resolveGuestFromLocalFallback() {
  const code = normalizeCode(params.get("code"));

  if (code && localInviteFallback[code]) {
    return {
      code,
      id: code,
      name: localInviteFallback[code].name,
      seats: localInviteFallback[code].seats,
      source: "local-fallback",
      isValidCode: true,
    };
  }

  return {
    code: "",
    id: "general",
    name: "Valued Guest",
    seats: 2,
    source: "default",
    isValidCode: false,
  };
}

function normalizeLookupGuest(code, record) {
  const seatsRaw =
    record.max_seats ??
    record.maxSeats ??
    record.seats ??
    record.reserved_seats ??
    record.reservedSeats;
  const parsedSeats = Number(seatsRaw);
  const name =
    record.guest_name ||
    record.guestName ||
    record.family_name ||
    record.familyName ||
    record.name ||
    "Guest";

  return {
    code,
    id: String(record.code || code).toLowerCase(),
    name: String(name),
    seats: Number.isFinite(parsedSeats) && parsedSeats > 0 ? parsedSeats : 1,
    source: "supabase",
    isValidCode: true,
    rsvpStatus: String(record.rsvp_status || record.rsvpStatus || ""),
  };
}

async function lookupGuestFromBackend(code) {
  const baseUrl = getSupabaseBaseUrl();
  const url = `${baseUrl}/rest/v1/rpc/lookup_invite`;

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: getSupabaseHeaders(),
    body: JSON.stringify({ p_code: code }),
  });

  if (!response.ok) {
    throw new Error(`Lookup failed (${response.status})`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return normalizeLookupGuest(code, rows[0]);
}

function refreshGuestInBackground(code) {
  lookupGuestFromBackend(code)
    .then((freshGuest) => {
      if (!freshGuest || currentGuest.code !== code) {
        return;
      }
      currentGuest = freshGuest;
      writeGuestCache(code, currentGuest);
      applyGuestToUi(currentGuest);
      setRsvpFormEnabled(true, "");
    })
    .catch(() => {
      // Ignore refresh failures; cached data already rendered.
    });
}

async function loadGuestProfile() {
  const code = normalizeCode(params.get("code"));
  const requireValidCode = Boolean(weddingConfig.backend.requireValidCode);

  if (!isBackendConfigured()) {
    currentGuest = resolveGuestFromLocalFallback();
    applyGuestToUi(currentGuest);

    if (requireValidCode && !currentGuest.isValidCode) {
      setRsvpFormEnabled(false, "Missing invite code. Please use your unique invitation link.");
      return {
        allowed: false,
        reason: "Invited guests only. Please use your personalized invitation link.",
      };
    }
    setRsvpFormEnabled(true, "Backend not configured yet. Running in local fallback mode.");
    return { allowed: true };
  }

  if (!code) {
    currentGuest = {
      code: "",
      id: "missing-code",
      name: "Invited Guest",
      seats: 0,
      source: "missing-code",
      isValidCode: false,
    };
    applyGuestToUi(currentGuest);
    setRsvpFormEnabled(false, "Missing invite code. Please open your personalized invitation link.");
    return {
      allowed: false,
      reason: "Invited guests only. Please use your personalized invitation link.",
    };
  }

  const cachedGuest = readGuestCache(code);
  if (cachedGuest) {
    currentGuest = {
      ...cachedGuest,
      code,
      source: "supabase-cache",
      isValidCode: true,
    };
    applyGuestToUi(currentGuest);
    setRsvpFormEnabled(true, "");
    refreshGuestInBackground(code);
    return { allowed: true };
  }

  setRsvpFormEnabled(false, "Checking your invitation...");

  try {
    const guestFromBackend = await lookupGuestFromBackend(code);
    if (!guestFromBackend) {
      currentGuest = {
        code,
        id: code,
        name: "Invited Guest",
        seats: 0,
        source: "invalid-code",
        isValidCode: false,
      };
      applyGuestToUi(currentGuest);
      setRsvpFormEnabled(false, "This invitation code is invalid. Please contact Hannah or Fidel.");
      return {
        allowed: false,
        reason: "This invitation code is invalid. Invited guests only.",
      };
    }

    currentGuest = guestFromBackend;
    writeGuestCache(code, currentGuest);
    applyGuestToUi(currentGuest);
    setRsvpFormEnabled(true, "");
    return { allowed: true };
  } catch (error) {
    currentGuest = {
      code,
      id: code,
      name: "Invited Guest",
      seats: 0,
      source: "lookup-error",
      isValidCode: false,
    };
    applyGuestToUi(currentGuest);
    setRsvpFormEnabled(
      false,
      "We could not verify your invite right now. Please try again in a moment."
    );
    return {
      allowed: false,
      reason: "We could not verify your invitation right now. Please try again shortly.",
    };
  }
}

function startCountdown() {
  const target = new Date(weddingConfig.weddingDateISO).getTime();
  const daysEl = q("days");
  const hoursEl = q("hours");
  const minutesEl = q("minutes");
  const secondsEl = q("seconds");

  const tick = () => {
    const now = Date.now();
    const delta = target - now;

    if (delta <= 0) {
      daysEl.textContent = "0";
      hoursEl.textContent = "0";
      minutesEl.textContent = "0";
      secondsEl.textContent = "0";
      q("weddingDateText").textContent = "Today is the wedding day.";
      clearInterval(countdownInterval);
      return;
    }

    const totalSeconds = Math.floor(delta / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    daysEl.textContent = String(days);
    hoursEl.textContent = String(hours).padStart(2, "0");
    minutesEl.textContent = String(minutes).padStart(2, "0");
    secondsEl.textContent = String(seconds).padStart(2, "0");
  };

  tick();
  countdownInterval = setInterval(tick, 1000);
}

function renderCalendar() {
  const date = new Date(weddingConfig.weddingDateISO);
  const year = date.getFullYear();
  const month = date.getMonth();
  const weddingDay = date.getDate();

  q("calendarHeader").textContent = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);

  const weekdayWrap = q("calendarWeekdays");
  const dayWrap = q("calendarDays");
  weekdayWrap.innerHTML = "";
  dayWrap.innerHTML = "";

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdays.forEach((day) => {
    const el = document.createElement("div");
    el.textContent = day;
    weekdayWrap.appendChild(el);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i += 1) {
    const empty = document.createElement("div");
    empty.className = "calendar-day is-empty";
    dayWrap.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const el = document.createElement("div");
    el.className = "calendar-day";
    if (day === weddingDay) {
      el.classList.add("is-wedding");
    }
    el.textContent = String(day);
    dayWrap.appendChild(el);
  }
}

async function submitRsvp(event) {
  event.preventDefault();

  const attendance = attendanceInput.value;
  const count = Number(attendeeCountInput.value);
  const message = messageInput.value.trim();
  const name = guestNameInput.value.trim();

  if (!attendance) {
    rsvpFeedback.textContent = "Please select your attendance.";
    return;
  }

  if (!name) {
    rsvpFeedback.textContent = "Please enter your name.";
    return;
  }

  if (!currentGuest.isValidCode && weddingConfig.backend.requireValidCode) {
    rsvpFeedback.textContent = "Invalid or missing invite code.";
    return;
  }

  if (!Number.isFinite(count) || count < 1 || count > currentGuest.seats) {
    rsvpFeedback.textContent = `Attendees should be between 1 and ${currentGuest.seats}.`;
    return;
  }

  setRsvpFormEnabled(false, "Submitting RSVP...");

  try {
    if (isBackendConfigured() && currentGuest.code) {
      const baseUrl = getSupabaseBaseUrl();
      const submitUrl = `${baseUrl}/rest/v1/rpc/submit_invite_rsvp`;

      const response = await fetchWithTimeout(submitUrl, {
        method: "POST",
        headers: {
          ...getSupabaseHeaders(),
        },
        body: JSON.stringify({
          p_code: currentGuest.code,
          p_guest_name: name,
          p_attendance: attendance,
          p_attendees: count,
          p_message: message,
        }),
      });

      if (!response.ok) {
        throw new Error(`RSVP submit failed (${response.status})`);
      }

      const result = await response.json();
      if (result !== true) {
        throw new Error("RSVP submit rejected.");
      }
    } else {
      const local = {
        guestId: currentGuest.id,
        guestName: name,
        attendance,
        attendees: count,
        message,
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem(`rsvp_${currentGuest.id}`, JSON.stringify(local));
    }

    writeGuestCache(currentGuest.code, {
      ...currentGuest,
      name,
      rsvpStatus: attendance,
    });
    rsvpFeedback.textContent = "Thank you. Your RSVP has been recorded.";
  } catch (error) {
    rsvpFeedback.textContent = "Could not submit RSVP right now. Please retry in a moment.";
    setRsvpFormEnabled(true, rsvpFeedback.textContent);
    return;
  }

  setRsvpFormEnabled(true, rsvpFeedback.textContent);
}

function openInvitation() {
  if (invitationOpened) {
    return;
  }
  invitationOpened = true;
  document.body.classList.add("intro-active");
  envelopeBtn.classList.add("open");
  setTimeout(() => {
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");
    gate.innerHTML = "";
    mainContent.classList.remove("hidden");
    document.body.classList.remove("intro-active");
    startCountdown();
  }, 1850);
}

function initRevealTiming() {
  document.querySelectorAll(".reveal").forEach((el, idx) => {
    el.style.animationDelay = `${idx * 90}ms`;
  });
}

async function init() {
  document.body.classList.add("intro-active");
  document.body.classList.remove("private-only");
  gate.classList.add("hidden");
  mainContent.classList.add("hidden");
  privateEventGate.classList.add("hidden");
  hydrateStaticContent();
  renderCalendar();
  initRevealTiming();

  const access = await loadGuestProfile();
  if (!access || !access.allowed) {
    showPrivateGate(access && access.reason ? access.reason : "");
    return;
  }

  showInvitationExperience();
  envelopeBtn.addEventListener("click", openInvitation);
  rsvpForm.addEventListener("submit", submitRsvp);
}

init();
