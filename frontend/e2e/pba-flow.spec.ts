/**
 * Journey 2 — PBA Operator Demo
 */

import { test, expect, Page } from "@playwright/test";
import { injectAuthScript, waitForDataLoad } from "./helpers";

async function switchToPBA(page: Page) {
  const modeButton = page.getByRole("button", { name: /TPA — Plan Sponsor/i });
  await expect(modeButton).toBeVisible({ timeout: 10_000 });
  await modeButton.click();
  await page.getByRole("button", { name: /PBA — Pharmacy Benefit Administrator/i }).click();
  await page.waitForURL("**/pba/dashboard", { timeout: 20_000 });
}

test.describe("PBA Operator Demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(injectAuthScript());
    await page.goto("/tpa/dashboard");
    await waitForDataLoad(page);
  });

  // 1 + 2: Switch to PBA, verify dashboard latency stats
  test("switches to PBA mode and shows dashboard with latency stats", async ({ page }) => {
    await switchToPBA(page);
    await waitForDataLoad(page);

    await expect(page.getByText("PBA Adjudication Console")).toBeVisible();

    // Latency banner column header divs — exact text matches for the 4 labels
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "p95" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "p99" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "avg" }).first()
    ).toBeVisible();

    // "ms" unit spans (rendered next to each latency number)
    await expect(
      page.locator("span.text-\\[10px\\]", { hasText: "ms" }).first()
    ).toBeVisible();

    // Stat cell labels
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "Rejects · 1h" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "Callback Queue" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "Live Tx (today)" }).first()
    ).toBeVisible();

    // Live badge
    await expect(page.getByText("LIVE").first()).toBeVisible();
  });

  // 3: Live Transactions — auto-refresh + B1/B2/B3 tx codes + reject codes
  test("live transactions shows auto-refresh, B1/B2/B3 tx codes and reject codes", async ({ page }) => {
    await page.goto("/pba/live-transactions");
    await waitForDataLoad(page);

    await expect(
      page.locator("h1", { hasText: "Live NCPDP D.0 Transaction Stream" })
    ).toBeVisible();

    // LIVE indicator (the span with class animate-pulse parent text)
    await expect(page.getByText("LIVE").first()).toBeVisible();

    // Auto-refresh toggle
    const autoBtn = page.getByRole("button", { name: /Auto-refresh/i });
    await expect(autoBtn).toBeVisible();
    await expect(autoBtn).toContainText("ON");
    await autoBtn.click();
    await expect(autoBtn).toContainText("OFF");
    await autoBtn.click();
    await expect(autoBtn).toContainText("ON");

    // Column headers
    await expect(page.getByRole("columnheader", { name: "Tx" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Reject Code" })).toBeVisible();

    // At least one row
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(await page.locator("tbody tr").count()).toBeGreaterThan(0);

    // B1/B2/B3 codes — scoped to table body code elements
    await expect(
      page.locator("tbody code").filter({ hasText: /^B[123]$/ }).first()
    ).toBeVisible();

    // Stat row labels — use the uppercase label divs to avoid strict mode on "PAID" badge
    await expect(
      page.locator("div.text-\\[12px\\].uppercase", { hasText: "Paid" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[12px\\].uppercase", { hasText: "Soft Edit" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[12px\\].uppercase", { hasText: "Reject" }).first()
    ).toBeVisible();
  });

  // 4: Click transaction row → NCPDP field detail in drawer
  test("live transaction row opens drawer with NCPDP field detail", async ({ page }) => {
    await page.goto("/pba/live-transactions");
    await waitForDataLoad(page);

    await page.locator("tbody tr").first().click();

    await expect(
      page.getByText("NCPDP D.0 Transaction")
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("NCPDP Field Detail")).toBeVisible();
    const preBlock = page.locator("pre").first();
    await expect(preBlock).toBeVisible();
    expect((await preBlock.innerText()).length).toBeGreaterThan(10);

    await expect(page.getByText("Drug").first()).toBeVisible();
  });

  // 5 + 6: Callbacks → row → 3 outreach methods → send → receipt
  test("pharmacist callbacks drawer shows 3 outreach methods and sends message", async ({ page }) => {
    await page.goto("/pba/callbacks");
    await waitForDataLoad(page);

    await expect(
      page.locator("h1", { hasText: "Pharmacist Callback Queue" })
    ).toBeVisible();
    await expect(page.getByText("Total Callbacks")).toBeVisible();
    await expect(page.getByText("High Priority")).toBeVisible();

    await page.locator("tbody tr").first().click();

    await expect(page.getByText("Callback Context")).toBeVisible({ timeout: 10_000 });

    // 3 outreach method radio labels
    await expect(page.getByText("Secure portal message")).toBeVisible();
    await expect(page.getByText("NCPDP-formatted fax")).toBeVisible();
    await expect(page.getByText("Escalate to pharmacy network manager")).toBeVisible();

    // NCPDP 526-FQ label — use the specific div (not the textarea which also contains it)
    await expect(
      page.locator("div.font-mono", { hasText: /NCPDP 526-FQ:/ }).first()
    ).toBeVisible();

    // Select secure_portal
    await page.getByText("Secure portal message").click();

    const sendBtn = page.getByRole("button", { name: /Send via/i });
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    await expect(page.getByText("Message Delivered")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Receipt ID:/i)).toBeVisible();
    await expect(page.getByText(/Delivered to:/i)).toBeVisible();
    await expect(page.getByText(/Expected response:/i)).toBeVisible();
  });

  // 7: NCPDP Rejects — filter by reject code, table updates
  test("NCPDP rejects filter by code updates the table", async ({ page }) => {
    await page.goto("/pba/ncpdp-rejects");
    await waitForDataLoad(page);

    await expect(
      page.locator("h1", { hasText: "Pre-Dispense Stops" })
    ).toBeVisible();

    const codeCards = page.locator("button code");
    await expect(codeCards.first()).toBeVisible();
    expect(await codeCards.count()).toBeGreaterThan(0);

    // Verify initial "All" state
    await expect(page.locator("text=/Filter:.*All/i")).toBeVisible();

    const firstCode = (await codeCards.first().innerText()).trim();

    // Click first code card
    await codeCards.first().click();
    await expect(
      page.locator(`text=/Filter: ${firstCode}/i`)
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator("tbody tr").first()).toBeVisible();

    // Clear filter
    await page.getByRole("link", { name: "Clear" })
      .or(page.getByRole("button", { name: "Clear" }))
      .click();
    await expect(page.locator("text=/Filter:.*All/i")).toBeVisible({ timeout: 10_000 });
  });

  // PBA dashboard operations links
  test("PBA dashboard operations links are all visible", async ({ page }) => {
    await page.goto("/pba/dashboard");
    await waitForDataLoad(page);

    await expect(page.getByText("Pre-Dispense Stops")).toBeVisible();
    // "Pharmacist Callbacks" exists in both table and quick links — use the link
    await expect(
      page.getByRole("link", { name: /Pharmacist Callbacks/i }).first()
    ).toBeVisible();
    await expect(page.getByText("Member Safety").first()).toBeVisible();
    await expect(page.getByText("Pharmacy Network").first()).toBeVisible();
    await expect(page.getByText("Formulary").first()).toBeVisible();

    await expect(
      page.getByText("PBA Real-Time NCPDP D.0 Flow (Spec v8 Part 10)")
    ).toBeVisible();
  });
});
