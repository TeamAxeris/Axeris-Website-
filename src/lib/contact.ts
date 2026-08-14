const demoSubject = encodeURIComponent("Axeris demo request");
const demoBody = encodeURIComponent(
  "Hi Axeris team,\n\nI'd like to request a demo of the Axeris Plan Sponsor Console.\n\nName:\nOrganization:\nRole:\nPreferred meeting times:\n\nThank you,",
);
const CONTACT_EMAIL = "info@axeris.com";

export const DEMO_REQUEST_URL =
  `mailto:${CONTACT_EMAIL}?subject=${demoSubject}&body=${demoBody}`;

export const CONTACT_URL = `mailto:${CONTACT_EMAIL}?subject=Axeris`;
