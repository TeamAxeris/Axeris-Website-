const demoSubject = encodeURIComponent("Axeris demo request");
const demoBody = encodeURIComponent(
  "Hi Axeris team,\n\nI'd like to request a demo of the Axeris Plan Sponsor Console.\n\nName:\nOrganization:\nRole:\nPreferred meeting times:\n\nThank you,",
);
const CONTACT_EMAIL = "info@axeris.com";
const GMAIL_COMPOSE_URL =
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT_EMAIL)}`;

export const DEMO_REQUEST_URL =
  `${GMAIL_COMPOSE_URL}&su=${demoSubject}&body=${demoBody}`;

export const CONTACT_URL = `${GMAIL_COMPOSE_URL}&su=${encodeURIComponent("Axeris")}`;
