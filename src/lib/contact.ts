const demoSubject = encodeURIComponent("Axeris demo request");
const demoBody = encodeURIComponent(
  "Hi Axeris team,\n\nI'd like to request a demo of the Axeris Plan Sponsor Console.\n\nName:\nOrganization:\nRole:\nPreferred meeting times:\n\nThank you,",
);

export const DEMO_REQUEST_URL =
  `https://mail.google.com/mail/?view=cm&fs=1&to=CONTACT@AXERIS-HEALTH.COM&su=${demoSubject}&body=${demoBody}`;
