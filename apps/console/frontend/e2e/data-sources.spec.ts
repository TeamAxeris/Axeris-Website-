/**
 * Journey 3 — Data Sources & ML Engine
 */

import { test, expect, Page } from "@playwright/test";
import { injectAuthScript, waitForDataLoad } from "./helpers";

async function gotoDataSources(page: Page) {
  await page.goto("/data-sources");
  await waitForDataLoad(page);
  await expect(
    page.locator("h1", { hasText: "Data Sources & ML Architecture" })
  ).toBeVisible({ timeout: 15_000 });
}

async function clickTab(page: Page, tabLabel: string) {
  await page.getByRole("button", { name: new RegExp(tabLabel, "i") }).click();
}

test.describe("Data Sources & ML Engine", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(injectAuthScript());
  });

  // 1 + 2: All four tabs render correct content
  test("all four tabs render correct content", async ({ page }) => {
    await gotoDataSources(page);

    // Validation Databases (default)
    await clickTab(page, "Validation Databases");
    await expect(page.getByText("Truveta").first()).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Table" }).first()
    ).toBeVisible();

    // Live Public APIs
    await clickTab(page, "Live Public APIs");
    await expect(page.getByText("Try a live API call")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "API" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Owner" })).toBeVisible();
    // openFDA appears as a table cell (not a hidden option)
    await expect(
      page.getByRole("cell", { name: /openFDA/i }).first()
    ).toBeVisible();

    // Batch-Synced Datasets
    await clickTab(page, "Batch-Synced Datasets");
    await expect(page.getByRole("columnheader", { name: "Source" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Frequency" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Use" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: /LEIE|SAM|CMS|DailyMed/i }).first()
    ).toBeVisible();

    // ML Architecture
    await clickTab(page, "ML Architecture");
    await expect(page.getByText("Live ML Engine Status")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retrain All Models" })
    ).toBeVisible();
  });

  // 3: Live API demo widget — openFDA Drug Label query for "metformin"
  test("live API demo widget runs openFDA Drug Label query for metformin", async ({ page }) => {
    await gotoDataSources(page);
    await clickTab(page, "Live Public APIs");

    const apiSelect = page.locator("select").first();
    await expect(apiSelect).toBeVisible();
    await apiSelect.selectOption("openfda_label");

    const queryInput = page.locator("input.font-mono").first();
    await expect(queryInput).toBeVisible();
    await queryInput.fill("metformin");

    await page.getByRole("button", { name: /Call Live API/i }).click();

    // Pre block appears with JSON response
    await expect(page.locator("pre").first()).toBeVisible({ timeout: 30_000 });

    // URL line above the JSON
    await expect(
      page.locator("div.font-mono", { hasText: /GET.*openfda/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  // 4: ML Architecture — trained models with metrics
  test("ML Architecture tab shows trained models with metrics", async ({ page }) => {
    await gotoDataSources(page);
    await clickTab(page, "ML Architecture");

    const retrainBtn = page.getByRole("button", { name: "Retrain All Models" });
    await expect(retrainBtn).toBeVisible();

    // Trigger retrain if not yet trained
    if (await page.getByText(/Models not yet trained/i).count() > 0) {
      await retrainBtn.click();
      await expect(
        page.getByText(/\d+ models trained/i)
      ).toBeVisible({ timeout: 30_000 });
    }

    await expect(
      page.getByText(/\d+ models trained/i)
    ).toBeVisible({ timeout: 30_000 });

    // REAL badges on model cards
    const realBadges = page.locator("span", { hasText: "REAL" });
    expect(await realBadges.count()).toBeGreaterThanOrEqual(4);

    await expect(page.getByText("Metrics").first()).toBeVisible();
    await expect(page.getByText("Feature Importance (top)").first()).toBeVisible();
    await expect(page.getByText(/Training corpus/i)).toBeVisible();
    await expect(page.getByText(/Explainability/i)).toBeVisible();
  });

  // 5: Retrain All Models → status transitions (retraining state appears)
  test("retrain all models updates status", async ({ page }) => {
    test.setTimeout(120_000); // backend retrain can take 60-90s on Render cold start
    await gotoDataSources(page);
    await clickTab(page, "ML Architecture");

    const retrainBtn = page.getByRole("button", { name: "Retrain All Models" });
    await expect(retrainBtn).toBeVisible();
    await retrainBtn.click();

    // The frontend immediately sets retraining=true (optimistic UI update).
    // Verify the retraining state is shown — this is the observable demo behavior.
    await expect(
      page.getByText(/Retraining models|\d+ models trained/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Poll by reloading until the backend completes training (up to 90s total).
    // The Render.com cold-start + sklearn training can take 60–90s.
    const deadline = Date.now() + 90_000;
    let trained = false;
    while (Date.now() < deadline) {
      const trainedText = page.getByText(/\d+ models trained/i);
      if (await trainedText.count() > 0) {
        trained = true;
        break;
      }
      // Reload the page and re-navigate to ML tab to get fresh status
      await page.reload();
      await waitForDataLoad(page);
      await clickTab(page, "ML Architecture");
      await page.waitForTimeout(3_000);
    }

    // Assert training completed
    expect(trained, "ML models should reach trained state within 90s").toBe(true);
    await expect(
      page.getByText(/\d+ models trained/i).first()
    ).toBeVisible();

    // REAL badges on model cards
    expect(
      await page.locator("span", { hasText: "REAL" }).count()
    ).toBeGreaterThanOrEqual(4);
  });

  // Tab count badges are non-zero
  test("tab count badges show non-zero numbers", async ({ page }) => {
    await gotoDataSources(page);

    const tabButtons = page.getByRole("button").filter({ hasText: /\(\d+\)/ });
    const count = await tabButtons.count();
    expect(count).toBe(4);

    for (let i = 0; i < count; i++) {
      const text = await tabButtons.nth(i).innerText();
      const match = text.match(/\((\d+)\)/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1], 10)).toBeGreaterThan(0);
    }
  });
});
