// Deterministic mock data that mirrors what the backend will receive from Karix, following
// "Karwa Chauth Chatbot Flow Script v6". Used ONLY by src/services/mockDashboardProvider.js —
// screens must never import this file.
//
// It produces two raw collections, just like the backend will store them:
//   messages – one campaign (opener) message per recipient, with sent / delivered / read / failed times
//              (from Karix message status webhooks)
//   events   – every customer reply, normalized (from Karix inbound message webhooks)
// Sessions, referrals and store visits are NOT stored here: the provider derives them from events,
// the same way the backend should.
//
// Times are relative to `now` (page load). Some sends and replies are scheduled up to a few hours
// in the future; the provider hides anything later than the current time, so the mock dashboard
// keeps changing while it is open.

import { BUTTONS, BUDGETS, CATEGORIES, CATEGORY_EXCLUDED_ON, VISIT_DAYS, VISIT_SLOTS } from "./campaignConfig";
import { shiftIstDate, toIstDate } from "../utils/istDates";

const FEMALE_NAMES = ["Ananya", "Priya", "Neha", "Kavya", "Ritika", "Sneha", "Pooja", "Aditi", "Meera", "Isha", "Shruti", "Divya", "Tanvi", "Riya", "Nidhi", "Simran", "Aarohi", "Naina"];
const MALE_NAMES = ["Rohit", "Arjun", "Vikram", "Karan", "Amit", "Rahul", "Nikhil", "Sandeep", "Varun", "Manish", "Siddharth", "Aditya"];
const LAST_NAMES = ["Sharma", "Kapoor", "Mehta", "Iyer", "Malhotra", "Gupta", "Reddy", "Joshi", "Nair", "Bansal", "Singh", "Chopra", "Desai", "Rao"];

const PRODUCTS = {
  Pendants: ["Heart Halo Pendant", "Crescent Moon Pendant"],
  "Mia Sutra": ["Mia Sutra Twin Drop", "Mia Sutra Classic"],
  "Pendant & Chain": ["Everyday Chain Set", "Starlit Pendant Set"],
  Necklaces: ["Diamond Drop Necklace", "Mia Lariat Necklace"],
  Earrings: ["Petal Stud Earrings", "Halo Drop Earrings"],
  Rings: ["Solitaire Ring", "Twin Leaf Ring"],
  "Bracelets & Bangles": ["Starlight Bracelet", "Gold Flex Bangle"]
};

const STORES = [
  "Mia, Phoenix Marketcity – Kurla",
  "Mia, R City – Ghatkopar",
  "Mia, Inorbit – Malad",
  "Mia, Select Citywalk – Saket",
  "Mia, Orion Mall – Bengaluru"
];
const PIN_CODES = ["400070", "400086", "400064", "110017", "560055"];
const FAILURE_REASONS = ["Not a WhatsApp number", "Marketing message limit", "Undeliverable"];

const MIN = 60000;
const HOUR = 60 * MIN;

function seeded(seed) {
  let x = seed >>> 0;
  return function rand() {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const between = (rand, a, b) => a + rand() * (b - a);

// Relative weight of sends per day (index 29 = today): ramps up towards the festival,
// with three broadcast waves.
function dayWeight(i) {
  const ramp = 0.35 + 0.65 * Math.pow(i / 29, 1.6);
  return ramp * (i === 8 || i === 18 || i === 27 ? 2.4 : 1);
}

function istMidnight(ymd) {
  return Date.parse(`${ymd}T00:00:00+05:30`);
}

function phoneFor(rand) {
  const lead = pick(rand, ["98", "99", "97", "96", "90", "88", "87", "70"]);
  return `+91${lead}${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`;
}

function isoDate(rand, fromYear, toYear) {
  const y = Math.floor(between(rand, fromYear, toYear + 1));
  const m = 1 + Math.floor(rand() * 12);
  const d = 1 + Math.floor(rand() * 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function createMockDashboardData({ now = Date.now(), recipients = 4200, seed = 20261001 } = {}) {
  const rand = seeded(seed);
  const today = toIstDate(new Date(now));
  const messages = [];
  const events = [];
  let sessionSeq = 0;
  let visitSeq = 0;

  // Spread recipients across the last 30 IST days.
  const weights = Array.from({ length: 30 }, (_, i) => dayWeight(i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const perDay = weights.map((w) => Math.round((w / totalWeight) * recipients));

  let n = 0;
  perDay.forEach((count, i) => {
    const daysAgo = 29 - i;
    const dayStart = istMidnight(shiftIstDate(today, -daysAgo));
    for (let k = 0; k < count; k += 1) {
      n += 1;
      // Past days: sends between 10:00 and 20:00 IST. Today: from 8 h ago to 3 h ahead.
      const sentAt = daysAgo === 0
        ? now + between(rand, -8, 3) * HOUR
        : dayStart + between(rand, 10, 20) * HOUR;
      addRecipient(n, Math.round(sentAt), i);
    }
  });

  function addRecipient(index, sentAt, dayIndex) {
    const male = rand() < 0.3;
    const firstName = male ? pick(rand, MALE_NAMES) : pick(rand, FEMALE_NAMES);
    const lastName = pick(rand, LAST_NAMES);
    const userId = `USR-${String(index).padStart(5, "0")}`;
    const customer = { name: `${firstName} ${lastName}`, firstName, lastName, phone: phoneFor(rand) };
    const messageId = `MSG-${String(index).padStart(6, "0")}`;

    const delivered = rand() < 0.945;
    const deliveredAt = delivered ? sentAt + Math.round(between(rand, 3, 90) * 1000) : null;
    const failedAt = delivered ? null : sentAt + Math.round(between(rand, 5, 60) * 1000);
    const tapChance = 0.12 + dayIndex * 0.0018;
    const taps = delivered && rand() < tapChance;
    const reads = delivered && (taps || rand() < 0.66);
    const readAt = reads ? deliveredAt + Math.round(between(rand, 0.5, 300) * MIN * (rand() < 0.7 ? 0.1 : 1)) : null;

    messages.push({
      messageId,
      userId,
      customer,
      sentAt: new Date(sentAt).toISOString(),
      deliveredAt: deliveredAt && new Date(deliveredAt).toISOString(),
      readAt: readAt && new Date(readAt).toISOString(),
      failedAt: failedAt && new Date(failedAt).toISOString(),
      failureReason: delivered ? null : pick(rand, FAILURE_REASONS)
    });

    if (!taps) return;

    sessionSeq += 1;
    const path = male ? "shopping" : rand() < 0.64 ? "celebrating" : "sparkle";
    runSession({
      sessionId: `SES-${String(sessionSeq).padStart(5, "0")}`,
      userId,
      messageId,
      customer,
      path,
      startAt: readAt + Math.round(between(rand, 0.2, 25) * MIN)
    });
  }

  function runSession({ sessionId, userId, messageId, path, startAt }) {
    let t = startAt;
    let seq = 0;
    let at = "0";
    let lastCategory = null;
    const list = [];

    const advance = () => {
      // Usually a quick reply; sometimes the customer comes back hours later.
      t += rand() < 0.07 ? Math.round(between(rand, 1, 18) * HOUR) : Math.round(between(rand, 0.3, 4) * MIN);
    };

    function emit(eventType, { buttonId = null, to = null, metadata = {} } = {}) {
      seq += 1;
      events.push({
        eventId: `EVT-${sessionId.slice(4)}-${String(seq).padStart(2, "0")}`,
        sessionId,
        userId,
        messageId,
        timestamp: new Date(t).toISOString(),
        eventType,
        path,
        atStep: at,
        flowStep: to,
        buttonId,
        buttonLabel: buttonId ? BUTTONS[buttonId].label : null,
        metadata
      });
      if (to) at = to;
      advance();
    }

    const click = (buttonId, to, metadata) => emit("BUTTON_CLICK", { buttonId, to, metadata });
    const codes = path === "shopping"
      ? { cat: "2A", budget: "2A-Budget", carousel: "2B" }
      : { cat: "1A", budget: "1A-Budget", carousel: "1B" };

    // Step C2: open the WhatsApp Flow, maybe confirm a booking. Returns true when booked.
    function storeVisit(viaButton, reserved) {
      if (viaButton) click(viaButton, null);
      emit("STORE_VISIT_FORM_OPENED", { buttonId: "OPEN_BOOKING_FORM" });
      if (rand() > 0.66) return false;
      visitSeq += 1;
      const store = pick(rand, STORES);
      emit("STORE_VISIT_BOOKED", {
        to: "C2",
        metadata: {
          visitId: `VIS-${String(visitSeq).padStart(5, "0")}`,
          ref: `MIA-${4800 + visitSeq * 7}`,
          pinCode: PIN_CODES[STORES.indexOf(store)],
          store,
          day: pick(rand, VISIT_DAYS),
          slot: rand() < 0.41 ? "4:00 pm" : pick(rand, VISIT_SLOTS),
          reserved: reserved && reserved.length ? reserved : ["Wishlist"]
        }
      });
      return true;
    }

    // Steps 1A / 2A → budget → carousel. Returns false if the customer stopped.
    // Flow script v7: "I'm celebrating" has no budget step (1A → 1B, full category).
    function discovery() {
      if (rand() > 0.88) return false;
      const options = CATEGORIES.filter((c) => !(CATEGORY_EXCLUDED_ON[path] || []).includes(c));
      lastCategory = pick(rand, options);
      if (path === "celebrating") {
        // Draws the same random values in the same order as before v7, so the rest of the sample stays unchanged.
        emit("CATEGORY_SELECTED", { to: null, metadata: { category: lastCategory } });
        const categoryEvent = events[events.length - 1];
        if (rand() > 0.92) return false;
        rand(); // was the budget pick
        advance(); // was the reply time of the budget pick
        categoryEvent.flowStep = codes.carousel; // 1A → 1B
        at = codes.carousel;
        if (rand() < 0.2) click("SEE_MORE", null);
        return true;
      }
      emit("CATEGORY_SELECTED", { to: codes.budget, metadata: { category: lastCategory } });
      if (rand() > 0.92) return false;
      const budget = BUDGETS[Math.min(BUDGETS.length - 1, Math.floor(Math.pow(rand(), 1.8) * BUDGETS.length))];
      emit("BUDGET_SELECTED", { to: codes.carousel, metadata: { budget } });
      if (rand() < 0.2) click("SEE_MORE", null);
      return true;
    }

    const product = () => pick(rand, PRODUCTS[lastCategory]);

    // Wishlist steps 1C / 1D (wife & sparkle). Returns false if the customer stopped.
    function wishlist() {
      const roll = rand();
      if (roll < 0.05) return storeVisit("VISIT_STORE", []) && "booked";
      if (roll > 0.66) return false;
      list.push(product());
      click("ADD_TO_LIST", "1C", { product: list[list.length - 1], listCount: list.length });
      while (rand() < 0.35 && list.length < 4) {
        click("ADD_MORE", "1D");
        list.push(product());
        click("ADD_TO_LIST", "1C", { product: list[list.length - 1], listCount: list.length });
      }
      return true;
    }

    // Steps 1J / 2F typed details, then 1K / 2G consent.
    function captureDetails() {
      if (rand() > 0.86) return;
      const wife = path === "celebrating";
      emit("DETAILS_CAPTURED", {
        to: wife ? "1K" : "2G",
        metadata: {
          referredName: `${wife ? pick(rand, MALE_NAMES) : pick(rand, FEMALE_NAMES)} ${pick(rand, LAST_NAMES)}`,
          referredPhone: phoneFor(rand),
          relationship: wife ? "Husband" : "Wife",
          keyDateType: wife ? "Anniversary" : "Birthday",
          keyDate: wife ? isoDate(rand, 2002, 2022) : isoDate(rand, 1982, 2000)
        }
      });
      if (rand() < 0.08) return; // left without answering consent
      click(rand() < (wife ? 0.74 : 0.71) ? "CONSENT_YES" : "CONSENT_NO", "E1");
    }

    // ── Wife: I'm celebrating ──
    function wifeJourney() {
      click("IM_CELEBRATING", "1");
      if (rand() < 0.06) { if (storeVisit("VISIT_NEARBY_STORE", [])) wifeReminder(); return; }
      if (rand() > 0.8) return;
      click("CHOOSE_MY_GIFT", "1A");
      if (!discovery()) return;
      const w = wishlist();
      if (w === "booked") { wifeReminder(); return; }
      if (!w) return;
      if (rand() > 0.72) return;
      click("SEND_MY_ISHARA", "1G", { pieces: [...list] });
      if (rand() < 0.05) { if (storeVisit("VISIT_NEARBY_STORE", list)) wifeReminder(); return; }
      if (rand() > 0.8) return;
      emit("HINT_SENT", { buttonId: "SEND_TO_HUSBAND", to: "1H", metadata: { pieces: [...list] } });
      const roll = rand();
      if (roll < 0.22) { if (storeVisit("VISIT_STORE", list)) wifeReminder(); return; }
      if (roll < 0.8) { click("MAYBE_LATER", "1I"); wifeReminder(true); }
    }

    function wifeReminder(alreadyAt1I = false) {
      if (!alreadyAt1I) at = "1I";
      const roll = rand();
      if (roll < 0.72) { click("ADD_HIS_DETAILS", "1J"); captureDetails(); return; }
      if (roll > 0.88) return;
      click("NO_THANKS", "1I-nudge");
      if (rand() < 0.5) { click("YES_GO_AHEAD", "1J"); captureDetails(); return; }
      if (rand() < 0.8) click("ILL_REMIND_HIM", "E1");
    }

    // ── Sparkle: Here for the sparkle ──
    function sparkleJourney() {
      click("HERE_FOR_SPARKLE", "1-Sparkle");
      if (rand() < 0.05) { if (storeVisit("VISIT_NEARBY_STORE", [])) sparkleKeepPosted(); return; }
      if (rand() > 0.76) return;
      click("SHOW_ME", "1A");
      if (!discovery()) return;
      const w = wishlist();
      if (w === "booked") { sparkleKeepPosted(); return; }
      if (!w) return;
      if (rand() > 0.34) return;
      if (storeVisit("VISIT_STORE", list)) sparkleKeepPosted();
    }

    function sparkleKeepPosted() {
      at = "1I";
      const roll = rand();
      if (roll < 0.55) click("KEEP_ME_POSTED", "E1");
      else if (roll < 0.9) click("NO_THANKS", "E1");
    }

    // ── Husband: I'm shopping for her ──
    function husbandJourney() {
      click("SHOPPING_FOR_HER", "2");
      if (rand() < 0.06) { if (storeVisit("VISIT_NEARBY_STORE", [])) husbandDetails(); return; }
      if (rand() > 0.82) return;
      click("FIND_HER_A_GIFT", "2A");
      if (!discovery()) return;
      const roll = rand();
      if (roll < 0.05) { if (storeVisit("VISIT_NEARBY_STORE", [])) husbandDetails(); return; }
      if (roll > 0.55) return;
      const piece = product();
      click("BUY_THIS_FOR_HER", "2C", { product: piece });
      const choice = rand();
      if (choice < 0.6) { click("BUY_ONLINE", "2E", { product: piece }); husbandDetails(true); return; }
      if (choice < 0.9 && storeVisit("VISIT_STORE", [piece])) husbandDetails();
    }

    function husbandDetails(alreadyAt2E = false) {
      if (!alreadyAt2E) at = "2E";
      const roll = rand();
      if (roll < 0.52) { click("ADD_HER_DETAILS", "2F"); captureDetails(); return; }
      if (roll < 0.9) click("NO_THANKS", "E1");
    }

    if (path === "celebrating") wifeJourney();
    else if (path === "shopping") husbandJourney();
    else sparkleJourney();
  }

  return {
    generatedAt: new Date(now).toISOString(),
    source: "mock",
    messages,
    events
  };
}
