/**
 * Shared test helpers for Axeris E2E tests.
 */
import { Page } from "@playwright/test";

/**
 * Injects a valid axeris_auth session into localStorage and clears any stored
 * mode so TPA is always the default.  Must be called via page.addInitScript()
 * BEFORE page.goto() so it runs before the React app boots.
 */
export function injectAuthScript() {
  return () => {
    // Auth — any non-empty user object satisfies AuthContext
    const mockUser = {
      name: "Demo Reviewer",
      email: "demo@axeris.com",
      role: "Senior Clinical Reviewer",
      avatar: "D",
    };
    localStorage.setItem("axeris_auth", JSON.stringify(mockUser));
    // Always start in TPA mode unless a test overrides this
    localStorage.setItem("axeris-mode", "TPA");
  };
}

/**
 * Wait for the page's initial data fetch to complete.
 * Pages render "Loading…" while fetching; we wait for that text to disappear.
 */
export async function waitForDataLoad(page: Page, timeout = 25_000) {
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading…"),
    { timeout }
  );
}
