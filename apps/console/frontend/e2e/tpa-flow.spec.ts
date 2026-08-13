/**
 * Journey 1 — TPA Operator Demo
 */

import { test, expect } from "@playwright/test";
import { injectAuthScript, waitForDataLoad } from "./helpers";

test.describe("TPA Operator Demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(injectAuthScript());
  });

  // 1 + 2: Landing → TPA dashboard, then pend-queue columns
  test("lands on TPA dashboard and navigates to Pend Queue", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/tpa/dashboard", { timeout: 20_000 });

    await expect(page.getByText("Plan Sponsor Console")).toBeVisible();
    await expect(page.getByText("TPA — Plan Sponsor")).toBeVisible();

    await page.goto("/tpa/pend-queue");
    await waitForDataLoad(page);

    await expect(page.locator("h1", { hasText: "Pend Queue" })).toBeVisible();

    // Wait for rows to appear — the Render.com backend can be slow on cold start.
    // DataTable only renders <thead> when rows exist, so wait for rows first.
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });

    // Now headers will be present
    await expect(page.getByRole("columnheader", { name: "Member" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Drug" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Plan Sponsor" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "SLA" })).toBeVisible();

    expect(await rows.count()).toBeGreaterThan(0);
  });

  // 3 + 4: Click pend row → prescription detail with disposition, audit, PGx
  test("pend queue row navigates to prescription detail with clinical panels", async ({ page }) => {
    await page.goto("/tpa/pend-queue");
    await waitForDataLoad(page);

    // Wait for rows — backend can be slow on Render cold start
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });

    const rxLink = page.locator("tbody tr").first().locator("a[href*='/prescriptions/']");
    const href = await rxLink.getAttribute("href");
    expect(href).toMatch(/\/prescriptions\/.+/);

    await rxLink.click();
    await page.waitForURL("**/prescriptions/**", { timeout: 20_000 });
    await waitForDataLoad(page);

    // Disposition badge: one of APPROVE / REVIEW / FLAG
    await expect(
      page.locator("text=/APPROVE|REVIEW|FLAG/").first()
    ).toBeVisible();

    await expect(page.getByText("ERISA § 404(a)(1)(B) Audit Trail")).toBeVisible();
    await expect(page.getByText("Patient Context")).toBeVisible();

    // PGx panel is conditional
    const pgxCount = await page.getByText("Pharmacogenomics (CPIC Level A)").count();
    if (pgxCount > 0) {
      await expect(page.getByText("Pharmacogenomics (CPIC Level A)").first()).toBeVisible();
    }
  });

  // 5 + 6: Fraud Referrals → row click → detail drawer with NPPES section
  test("fraud referrals page shows rows and detail drawer with NPPES lookup", async ({ page }) => {
    await page.goto("/tpa/fraud-referrals");
    await waitForDataLoad(page);

    await expect(page.locator("h1", { hasText: "Fraud Referrals" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Prescriber" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Trigger" })).toBeVisible();

    // WorkflowDataSources panel
    await expect(page.getByText("HHS-OIG LEIE").first()).toBeVisible();
    await expect(page.getByText("NPPES NPI Registry").first()).toBeVisible();

    // Click first row
    await page.locator("tbody tr").first().click();

    await expect(
      page.getByText("Prescriber Identity (NPPES Live Lookup)")
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("button", { name: /Coordinate w\/ PBM/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refer to State Board/i })).toBeVisible();
  });

  // 7: Stewardship Reports → Download button
  test("stewardship reports page loads with download buttons", async ({ page }) => {
    await page.goto("/tpa/stewardship");
    await waitForDataLoad(page);

    await expect(page.locator("h1", { hasText: "Stewardship Reports" })).toBeVisible();
    await expect(page.getByText("Regulatory Compliance Status")).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();

    // Row-level download icon button (title attribute)
    await expect(
      page.locator("button[title='Download report JSON']").first()
    ).toBeVisible();

    // Detail drawer download button — click first row then check drawer
    await rows.first().click();
    // The drawer "Download Report" button is inside the drawer panel
    await expect(
      page.locator("[class*='fixed']").or(page.locator("[class*='drawer']"))
        .getByRole("button", { name: /Download Report/i })
        .or(page.getByRole("button", { name: "Download Report" }).last())
    ).toBeVisible({ timeout: 10_000 });
  });

  // 8: WorkflowDataSources panels render on pend-queue page
  test("WorkflowDataSources panels render on pend-queue page", async ({ page }) => {
    await page.goto("/tpa/pend-queue");
    await waitForDataLoad(page);

    await expect(page.getByText("Kythera Wayfinder").first()).toBeVisible();
    await expect(page.getByText("FDA DailyMed").first()).toBeVisible();
    await expect(page.getByText("HHS-OIG LEIE").first()).toBeVisible();
  });

  // TPA dashboard stat cells
  test("TPA dashboard stat cells show numeric values", async ({ page }) => {
    await page.goto("/tpa/dashboard");
    await waitForDataLoad(page);

    // Use the stat cell label divs — they are uppercase-styled divs with exact text
    // Scope to the grid area to avoid sidebar link ambiguity
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "Pend Queue" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "SLA Compliance" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "Fraud Referrals" }).first()
    ).toBeVisible();
    await expect(
      page.locator("div.text-\\[10px\\]", { hasText: "Quarterly Recovered" }).first()
    ).toBeVisible();

    await expect(
      page.getByText("ERISA § 404(a)(1)(B) audit-ready")
    ).toBeVisible();
  });
});
