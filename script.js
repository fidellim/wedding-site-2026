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
  rsvpEmail: "fideljileenwedding@example.com",
};

// Optional RSVP code mapping. Add your own invite codes and seat counts.
const inviteRegistry = {
  fidelfam: { name: "Fidel Family", seats: 4 },
  jileenfam: { name: "Jileen Family", seats: 4 },
  friends1: { name: "Friends Table 1", seats: 2 },
};

const q = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);

const gate = q("envelopeGate");
const mainContent = q("mainContent");
const envelopeBtn = q("envelopeBtn");
const gateGuestName = q("gateGuestName");
const personalGreeting = q("personalGreeting");
const rsvpGuestPrompt = q("rsvpGuestPrompt");
const guestNameInput = q("guestNameInput");
const attendeeCountInput = q("attendeeCountInput");
const rsvpFeedback = q("rsvpFeedback");

let countdownInterval = null;
let invitationOpened = false;

function resolveGuest() {
  const code = (params.get("code") || "").trim().toLowerCase();
  const explicitGuest = (params.get("guest") || "").trim();
  const explicitSeats = Number(params.get("seats"));

  if (code && inviteRegistry[code]) {
    return {
      id: code,
      name: inviteRegistry[code].name,
      seats: inviteRegistry[code].seats,
      source: "registry",
    };
  }

  if (explicitGuest) {
    return {
      id: explicitGuest.toLowerCase().replace(/\s+/g, "-"),
      name: explicitGuest,
      seats: Number.isFinite(explicitSeats) && explicitSeats > 0 ? explicitSeats : 2,
      source: "query",
    };
  }

  return {
    id: "general",
    name: "Valued Guest",
    seats: 2,
    source: "default",
  };
}

const guest = resolveGuest();

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
  weddingConfig.dressCode.palette.forEach((color) => {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.backgroundColor = color;
    swatch.title = color;
    palette.appendChild(swatch);
  });

  gateGuestName.textContent = `For ${guest.name}`;
  personalGreeting.textContent = `We can't wait to celebrate with you, ${guest.name}.`;
  rsvpGuestPrompt.textContent = `Reserved for your invitation: up to ${guest.seats} attendee(s).`;
  guestNameInput.value = guest.name;
  attendeeCountInput.max = String(guest.seats);
  attendeeCountInput.value = "1";
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

function submitRsvp(event) {
  event.preventDefault();

  const attendance = q("attendanceInput").value;
  const count = Number(attendeeCountInput.value);
  const message = q("messageInput").value.trim();
  const name = guestNameInput.value.trim();

  if (!attendance) {
    rsvpFeedback.textContent = "Please select your attendance.";
    return;
  }

  if (!name) {
    rsvpFeedback.textContent = "Please enter your name.";
    return;
  }

  if (!Number.isFinite(count) || count < 1 || count > guest.seats) {
    rsvpFeedback.textContent = `Attendees should be between 1 and ${guest.seats}.`;
    return;
  }

  const payload = {
    guestId: guest.id,
    guestName: name,
    attendance,
    attendees: count,
    message,
    submittedAt: new Date().toISOString(),
  };

  localStorage.setItem(`rsvp_${guest.id}`, JSON.stringify(payload));

  const body = [
    `Guest: ${payload.guestName}`,
    `Attendance: ${payload.attendance}`,
    `Number of attendees: ${payload.attendees}`,
    `Message: ${payload.message || "(none)"}`,
    `Invite ID: ${payload.guestId}`,
  ].join("\n");

  const mailtoUrl = `mailto:${encodeURIComponent(
    weddingConfig.rsvpEmail
  )}?subject=${encodeURIComponent(
    `RSVP - ${payload.guestName}`
  )}&body=${encodeURIComponent(body)}`;

  window.location.href = mailtoUrl;
  rsvpFeedback.textContent =
    "RSVP prepared in your email app. Thank you for responding.";
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

function init() {
  document.body.classList.add("intro-active");
  hydrateStaticContent();
  renderCalendar();
  initRevealTiming();

  envelopeBtn.addEventListener("click", openInvitation);
  q("rsvpForm").addEventListener("submit", submitRsvp);
}

init();
