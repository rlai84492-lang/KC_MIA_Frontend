// Campaign configuration taken from "Karwa Chauth Chatbot Flow Script v6".
// This is frontend configuration (labels, order, colours), not data: screens may import it.
// The step codes and button ids are also listed in src/services/dashboardContract.js for the backend.

// toggleLabel / emoji / color / pill are display-only (path toggles, pills, charts).
export const PATHS = [
  { id: "celebrating", label: "I'm celebrating", shortLabel: "Celebrating", toggleLabel: "I’m celebrating", emoji: "💛", color: "#C83474", pill: "p-rose" },
  { id: "shopping", label: "I'm shopping for her", shortLabel: "Shopping for her", toggleLabel: "Shopping for her", emoji: "🎁", color: "#B7800F", pill: "p-warn" },
  { id: "sparkle", label: "Here for the sparkle", shortLabel: "Sparkle", toggleLabel: "Here for the sparkle", emoji: "✨", color: "#2F6FD0", pill: "p-info" }
];

export const PATH_BY_ID = Object.fromEntries(PATHS.map((p) => [p.id, p]));

// Step 1A / 2A carousel, in carousel order. Mia Sutra is not shown on the sparkle path.
export const CATEGORIES = ["Pendants", "Mia Sutra", "Pendant & Chain", "Necklaces", "Earrings", "Rings", "Bracelets & Bangles"];
export const CATEGORY_EXCLUDED_ON = { sparkle: ["Mia Sutra"] };

// The backend's code for each category (KarvaChauthConstants CAT_*). The Conversations Category filter sends the code.
export const CATEGORY_CODES = {
  "Pendants": "PENDANTS",
  "Mia Sutra": "MIA_SUTRA",
  "Pendant & Chain": "PENDANT_CHAIN",
  "Necklaces": "NECKLACES",
  "Earrings": "EARRINGS",
  "Rings": "RINGS",
  "Bracelets & Bangles": "BRACELETS_BANGLES"
};


// Step 1A-Budget / 2A-Budget list message rows.
export const BUDGETS = ["Less than 20,000", "20,000 - 50,000", "Above 50,000"];

// Path-specific bot flow steps, in flow order. `code` is the step id from the flow script.
// `tone` is display-only (pill colour).
export const PATH_STEPS = {
  celebrating: [
    { code: "0", label: "Opener", tone: "p-mute" },
    { code: "1", label: "Choose My Gift", tone: "p-mute" },
    { code: "1A", label: "Category", tone: "p-violet" },
    // No 1A-Budget on this path (flow script v7): 1A goes straight to 1B.
    { code: "1B", label: "Carousel", tone: "p-info" },
    { code: "1C", label: "Added to List", tone: "p-info" },
    { code: "1D", label: "Adding More", tone: "p-info" },
    { code: "1G", label: "Ishara Created", tone: "p-rose" },
    { code: "1H", label: "Ishara Sent", tone: "p-rose" },
    { code: "1I", label: "Reminder Offer", tone: "p-violet" },
    { code: "1I-nudge", label: "Reminder Nudge", tone: "p-violet" },
    { code: "1J", label: "His Details", tone: "p-violet" },
    { code: "1K", label: "Consent", tone: "p-good" }
  ],
  shopping: [
    { code: "0", label: "Opener", tone: "p-mute" },
    { code: "2", label: "Find Her a Gift", tone: "p-mute" },
    { code: "2A", label: "Category", tone: "p-violet" },
    { code: "2A-Budget", label: "Budget", tone: "p-violet" },
    { code: "2B", label: "Carousel", tone: "p-info" },
    { code: "2C", label: "Buy / Visit", tone: "p-warn" },
    { code: "2E", label: "Her Details Ask", tone: "p-violet" },
    { code: "2F", label: "Her Details", tone: "p-violet" },
    { code: "2G", label: "Consent", tone: "p-good" }
  ],
  sparkle: [
    { code: "0", label: "Opener", tone: "p-mute" },
    { code: "1-Sparkle", label: "Show Me", tone: "p-mute" },
    { code: "1A", label: "Category", tone: "p-violet" },
    { code: "1A-Budget", label: "Budget", tone: "p-violet" },
    { code: "1B", label: "Carousel", tone: "p-info" },
    { code: "1C", label: "Added to List", tone: "p-info" },
    { code: "1D", label: "Adding More", tone: "p-info" },
    { code: "1I", label: "Keep Me Posted", tone: "p-good" }
  ]
};

// Steps reachable from every path.
export const SHARED_STEPS = [
  { code: "C2", label: "Store Visit Booked", tone: "p-good" },
  { code: "E1", label: "Closed", tone: "p-mute" }
];

export function stepDef(path, code) {
  return (PATH_STEPS[path] || []).find((s) => s.code === code) || SHARED_STEPS.find((s) => s.code === code) || null;
}

// Our own ids for every reply button / list row in the flow script. The backend should set these
// ids on the outgoing interactive messages so a reply can be mapped back to its step.
export const BUTTONS = {
  IM_CELEBRATING: { label: "I'm celebrating", step: "0" },
  SHOPPING_FOR_HER: { label: "I'm shopping for her", step: "0" },
  HERE_FOR_SPARKLE: { label: "Here for the sparkle", step: "0" },
  CHOOSE_MY_GIFT: { label: "Choose my gift", step: "1" },
  SHOW_ME: { label: "Show me", step: "1-Sparkle" },
  FIND_HER_A_GIFT: { label: "Find her a gift", step: "2" },
  VISIT_NEARBY_STORE: { label: "Visit nearby store", step: "any" },
  VISIT_STORE: { label: "Visit Store", step: "any" },
  ADD_TO_LIST: { label: "Add to my list", step: "1B" },
  SEE_MORE: { label: "See more", step: "1B" },
  ANOTHER_CATEGORY: { label: "Another category", step: "1B / 1C" },
  ADD_MORE: { label: "Add more", step: "1C" },
  SEND_MY_ISHARA: { label: "Send my Ishara", step: "1C" },
  SEND_TO_HUSBAND: { label: "Send to Husband", step: "1G" },
  MAYBE_LATER: { label: "Maybe later", step: "1H" },
  ADD_HIS_DETAILS: { label: "Add his details", step: "1I" },
  KEEP_ME_POSTED: { label: "Yes, keep me posted", step: "1I" },
  NO_THANKS: { label: "No thanks", step: "1I / 2E" },
  YES_GO_AHEAD: { label: "Yes, go ahead", step: "1I-nudge" },
  ILL_REMIND_HIM: { label: "I'll remind him", step: "1I-nudge" },
  CONSENT_YES: { label: "Yes, that's fine", step: "1K / 2G" },
  CONSENT_NO: { label: "No, don't message", step: "1K / 2G" },
  BUY_THIS_FOR_HER: { label: "Buy this for her", step: "2B" },
  BUY_ONLINE: { label: "Buy Online", step: "2C" },
  ADD_HER_DETAILS: { label: "Add her details", step: "2E" },
  OPEN_BOOKING_FORM: { label: "Open booking form", step: "C2" },
  BROWSE_AGAIN: { label: "Browse again", step: "IDLE" },
  NEW_CATEGORY: { label: "New category", step: "IDLE" }
};

// Step C2 WhatsApp Flow options.
export const VISIT_DAYS = ["Today", "Tomorrow", "Sat"];
export const VISIT_SLOTS = ["12:30 pm", "4:00 pm", "6:30 pm"];

// Referral leads: who is referred on each path and which key date is asked for.
export const REFERRAL_TYPES = {
  celebrating: { relationship: "Husband", flowStep: "1J", keyDateType: "Anniversary" },
  shopping: { relationship: "Wife", flowStep: "2F", keyDateType: "Birthday" }
};

// Audience segments (Audiences page). The backend only returns `id` + counts / members;
// names and copy live here. "journey" segments are exclusive by `priority` (1 wins);
// "done" segments can overlap.
export const AUDIENCE_SEGMENTS = [
  { id: "hint-sent-no-visit", group: "journey", priority: 1, name: "Hint sent, no visit yet", paths: ["celebrating"], stage: "Ishara Sent",
    definition: "Sent her Ishara to her husband, but no store visit booked and no purchase recorded.",
    nextStep: "Re-share the Ishara (Step 1G) · optional visit (C2)", useFor: ["WhatsApp nudge", "Husband remarketing", "Store follow-up"] },
  { id: "list-started-no-hint", group: "journey", priority: 2, name: "List started, hint not sent", paths: ["celebrating"], stage: "Added to List",
    definition: "Added at least one piece to her list, but hasn’t created or sent her Ishara.",
    nextStep: "Resume her list (Step 1C)", useFor: ["WhatsApp nudge", "Retargeting audience", "Abandoned-list follow-up"] },
  { id: "browsing-no-purchase", group: "journey", priority: 3, name: "Browsing for her, no purchase", paths: ["shopping"], stage: "Carousel",
    definition: "Browsed or picked a piece for her, but hasn’t bought online or booked a visit.",
    nextStep: "Back to the piece he viewed (Step 2B)", useFor: ["WhatsApp nudge", "Retargeting audience", "Store callback"] },
  { id: "shortlisted-no-visit", group: "journey", priority: 3, name: "Shortlisted for herself, no visit", paths: ["sparkle"], stage: "Added to List",
    definition: "Added a piece to her own list, but hasn’t booked a visit or bought it.",
    nextStep: "Book a visit (C2) · keep browsing (1D)", useFor: ["WhatsApp nudge", "New-arrivals list", "Store follow-up"] },
  { id: "store-visit-booked", group: "done", name: "Store visit booked", paths: ["celebrating", "shopping", "sparkle"], stage: "Visit booked",
    definition: "Confirmed a boutique appointment in the WhatsApp Flow, on any path.",
    nextStep: "Day-before reminder · store welcome", useFor: ["Appointment reminders", "Store staff list", "Post-visit feedback"] },
  { id: "clicked-buy-online", group: "done", name: "Clicked Buy Online", paths: ["shopping"], stage: "Buy / Visit",
    definition: "Tapped Buy Online on a piece for her and went to the product page.",
    nextStep: "Order check · care & styling tips", useFor: ["Purchase check", "Cross-sell (matching pieces)", "Birthday reminder"] },
  { id: "referred-consent-given", group: "done", name: "Referred contacts, consent given", paths: ["celebrating", "shopping"], stage: "Consent",
    definition: "Husbands and wives whose details were shared with a “yes” to future messages.",
    nextStep: "Occasion reminder near the key date", useFor: ["Anniversary & birthday reminders", "Gifting ideas", "Referral programme"] },
  { id: "opted-in-new-arrivals", group: "done", name: "Opted in for new arrivals", paths: ["sparkle"], stage: "Keep Me Posted",
    definition: "“Here for the sparkle” customers who said yes to hearing about new pieces and offers.",
    nextStep: "New-collection drop", useFor: ["Launch announcements", "Festive offers", "Lookalike seed"] }
];
