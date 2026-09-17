import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { encryptedFixture, filePayload, pdfFixture } from "./fixtures.mjs";

const artifactURL = new URL("../../../downloads/pdf-review.html", import.meta.url).href;
const resumePath = (name) => fileURLToPath(new URL(`../../../output/pdf/${name}.pdf`, import.meta.url));

async function openReview(page, context, location = "/") {
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const webkit = context.browser().browserType().name() === "webkit";
  if (location.startsWith("file:") && !webkit) await context.setOffline(true);
  await page.goto(location);
  await expect(page.locator("#pdf-file")).toBeAttached();
  // The initial HTML request is expected. Everything after that must be local,
  // including the PDF worker, fonts, CMaps, and image decoders.
  context.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  // Playwright's WebKit offline emulation also blocks local blob workers.
  // Block HTTP(S) instead, and still assert that the app never attempts one.
  // Chromium and Firefox also exercise the browser's full offline emulation.
  if (webkit) await context.route(/^https?:\/\//, (route) => route.abort());
  else await context.setOffline(true);
  return { errors, requests };
}

async function reviewFile(page, payload) {
  await page.locator("#pdf-file").setInputFiles(payload);
  await page.waitForFunction(() => document.getElementById("status").textContent === "Review ready." || !document.getElementById("error").hidden, null, { timeout: 30_000 });
  expect(await page.locator("#status").textContent(), await page.locator("#error").textContent()).toBe("Review ready.");
  await expect(page.locator("#error")).toBeHidden();
  await expect(page.locator("#review")).toBeVisible();
}

async function assertPrivate(context, page, observations) {
  expect(observations.requests).toEqual([]);
  expect(observations.errors).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  const storage = await page.evaluate(async () => {
    const values = {};
    for (const kind of ["localStorage", "sessionStorage"]) {
      try { values[kind] = window[kind].length; } catch { values[kind] = 0; }
    }
    try { values.databases = (await indexedDB.databases()).length; } catch { values.databases = 0; }
    return values;
  });
  expect(storage).toEqual({ localStorage: 0, sessionStorage: 0, databases: 0 });
}

for (const [label, location] of [["downloaded file", artifactURL], ["hosted page", "/"]]) {
  test(`${label}: reviews the one-page starter without network access`, async ({ page, context }) => {
    const observations = await openReview(page, context, location);
    await reviewFile(page, resumePath("new-grad-resume"));
    await expect(page.locator(".page-card")).toHaveCount(1);
    await expect(page.locator("#all-text")).toHaveValue(/Education/i);
    await expect(page.locator("#all-text")).toHaveValue(/Experience/i);
    await expect(page.locator("#pages")).toContainText("mailto:");
    await expect(page.locator("#pages canvas")).toHaveCount(1);
    expect(await page.locator("#pages canvas").evaluate((canvas) => canvas.width > 0 && canvas.height > 0)).toBe(true);
    await assertPrivate(context, page, observations);
  });
}

test("reviews both pages of the experienced starter", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await reviewFile(page, resumePath("experienced-resume"));
  await expect(page.locator(".page-card")).toHaveCount(2);
  const pages = await page.locator(".page-card textarea").evaluateAll((fields) => fields.map((field) => field.value));
  expect(pages).toHaveLength(2);
  for (const text of pages) expect(text.trim().length).toBeGreaterThan(100);
  await assertPrivate(context, page, observations);
});

test("distinguishes blank pages from image and vector pages without text", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await reviewFile(page, filePayload(pdfFixture([
    { text: "Readable resume text" },
    {},
    { image: true },
    { content: "0 0 0 rg 72 600 180 70 re f" },
  ])));
  await expect(page.locator(".page-card")).toHaveCount(4);
  const cards = page.locator(".page-card");
  await expect(cards.nth(1)).toContainText(/blank/i);
  for (const index of [2, 3]) {
    await expect(cards.nth(index)).toContainText(/no (extractable )?text/i);
    await expect(cards.nth(index).locator(".notice")).not.toContainText(/appears blank/i);
  }
  await expect(cards.nth(0).locator("textarea")).toHaveValue(/Readable resume text/);
  await assertPrivate(context, page, observations);
});

test("embedded CMaps extract Japanese text without a network request", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await reviewFile(page, filePayload(pdfFixture([{ cjk: true }])));
  await expect(page.locator("#all-text")).toHaveValue("日本語");
  await assertPrivate(context, page, observations);
});

test("embedded WebAssembly renders a JPEG2000 image without network access", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await reviewFile(page, filePayload(pdfFixture([{ jpeg2000: true }])));
  await expect(page.locator("#pages canvas")).toHaveCount(1);
  await expect(page.locator(".page-card .badge")).toContainText("No extractable text");
  await expect(page.locator("#summary")).toContainText("0 appear blank");
  const hasDarkPixels = await page.locator("#pages canvas").evaluate((canvas) => {
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 !== 3 && value < 50);
  });
  expect(hasDarkPixels).toBe(true);
  await assertPrivate(context, page, observations);
});

test("shows actual destinations without making PDF links executable", async ({ page, context }) => {
  const observations = await openReview(page, context);
  const links = [
    { label: "github.com/expected", url: "https://actual-destination.example/profile?from=resume#work" },
    { label: "Email", url: "mailto:person@example.test" },
    { label: "Phone", url: "tel:+15555550123" },
    { label: "Unsafe", url: "javascript:globalThis.pdfInjected=true" },
    { label: "Local file", url: "file:///private/should-not-open" },
    { label: "Page one", internal: true },
  ];
  await reviewFile(page, filePayload(pdfFixture([{ text: "Link destination checks", links }])));
  for (const link of links.filter((item) => item.url)) {
    await expect(page.locator("#pages")).toContainText(link.url);
  }
  await expect(page.locator("#pages")).toContainText(/internal|page destination/i);
  await expect(page.locator("#pages a[href]")).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.pdfInjected)).toBeUndefined();
  await assertPrivate(context, page, observations);
});

test("renders PDF strings and filenames as text, never markup", async ({ page, context }) => {
  const observations = await openReview(page, context);
  const injection = '<img src="https://example.invalid/leak" onerror="globalThis.pdfInjected=true">';
  await reviewFile(page, filePayload(pdfFixture([{ text: injection }], { title: injection }), "<svg onload=alert(1)>.pdf"));
  await expect(page.locator("#all-text")).toHaveValue(injection);
  await expect(page.locator("#filename")).toHaveText("<svg onload=alert(1)>.pdf");
  await expect(page.locator("#review img, #filename svg")).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.pdfInjected)).toBeUndefined();
  await assertPrivate(context, page, observations);
});

test("warns about form values that page-text extraction may omit", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await reviewFile(page, filePayload(pdfFixture([{ text: "Form resume", formValue: "Stored form value" }])));
  await expect(page.locator("#review")).toContainText(/form/i);
  await expect(page.locator("#review input, #review form")).toHaveCount(0);
  await assertPrivate(context, page, observations);
});

test("password retry and cancellation stay local and recover", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await page.locator("#pdf-file").setInputFiles(filePayload(encryptedFixture()));
  await expect(page.locator("#password-form")).toBeVisible();
  await page.locator("#password").fill("incorrect");
  await page.locator("#password-form button[type=submit]").click();
  await expect(page.locator("#password-form")).toBeVisible();
  await page.locator("#password").fill("review-test");
  await page.locator("#password-form button[type=submit]").click();
  await expect(page.locator("#status")).toHaveText("Review ready.");
  await expect(page.locator("#all-text")).toHaveValue(/Protected resume fixture/);
  await expect(page.locator("#password")).toHaveValue("");
  await page.locator("#pdf-file").setInputFiles(filePayload(encryptedFixture(), "locked-again.pdf"));
  await expect(page.locator("#password-form")).toBeVisible();
  await page.locator("#cancel-password").click();
  await expect(page.locator("#password-form")).toBeHidden();
  await expect(page.locator("#review")).toBeHidden();
  await reviewFile(page, filePayload(pdfFixture([{ text: "Recovered after password cancellation" }])));
  await assertPrivate(context, page, observations);
});

test("rejects malformed, empty, oversized, and excessive-page inputs and recovers", async ({ page, context }) => {
  const observations = await openReview(page, context);
  for (const [name, buffer] of [
    ["not-a-pdf.pdf", Buffer.from("This is plain text, not a PDF.")],
    ["broken.pdf", Buffer.from("%PDF-1.7\nnot a valid document")],
    ["empty.pdf", Buffer.alloc(0)],
    ["oversized.pdf", Buffer.alloc(20 * 1024 * 1024 + 1)],
    ["too-many-pages.pdf", pdfFixture(Array.from({ length: 21 }, () => ({})))],
  ]) {
    await page.locator("#pdf-file").setInputFiles(filePayload(buffer, name));
    await expect(page.locator("#error"), name).toBeVisible();
    await expect(page.locator("#error"), name).not.toHaveText("");
    await expect(page.locator("#review"), name).toBeHidden();
  }
  await reviewFile(page, filePayload(pdfFixture([{ text: "A valid PDF after failures" }])));
  await assertPrivate(context, page, observations);
});

test("clears all extracted data and can select the same file again", async ({ page, context }) => {
  const observations = await openReview(page, context);
  const payload = filePayload(pdfFixture([{ text: "Data that must be discarded" }]));
  await reviewFile(page, payload);
  await page.locator("#clear-file").click();
  await expect(page.locator("#review")).toBeHidden();
  await expect(page.locator("#pages")).toBeEmpty();
  await expect(page.locator("#all-text")).toHaveValue("");
  await expect(page.locator("#filename")).toHaveText("");
  await expect(page.locator("#pdf-file")).toHaveValue("");
  await reviewFile(page, payload);
  await assertPrivate(context, page, observations);
});

test("accepts a dropped PDF based on its contents, not its filename", async ({ page, context }) => {
  const observations = await openReview(page, context);
  const bytes = [...pdfFixture([{ text: "PDF dropped without a PDF extension" }])];
  await page.locator("#drop-zone").evaluate((zone, data) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data)], "resume-export", { type: "application/octet-stream" }));
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, bytes);
  await expect(page.locator("#status")).toHaveText("Review ready.");
  await expect(page.locator("#all-text")).toHaveValue("PDF dropped without a PDF extension");
  await assertPrivate(context, page, observations);
});

test("an unsupported page size is not reported as blank", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await reviewFile(page, filePayload(pdfFixture([{ text: "Oversized page", mediaBox: "0 0 20000 20000" }])));
  await expect(page.locator(".page-card")).toContainText(/preview unavailable|manual review/i);
  await expect(page.locator("#summary")).toContainText("0 appear blank");
  await expect(page.locator("#pages canvas")).toHaveCount(0);
  await assertPrivate(context, page, observations);
});

test("clearing during processing cannot restore the discarded review", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await page.locator("#pdf-file").setInputFiles(filePayload(pdfFixture(Array.from({ length: 20 }, () => ({ text: "Clear this unfinished review" })))));
  await page.locator("#clear-file").click();
  await expect(page.locator("#status")).toHaveText("Review cleared.");
  await expect(page.locator("#review")).toBeHidden();
  await expect(page.locator("#pages")).toBeEmpty();
  await reviewFile(page, filePayload(pdfFixture([{ text: "Fresh review after cancellation" }])));
  await expect(page.locator("#all-text")).toHaveValue("Fresh review after cancellation");
  await expect(page.locator(".page-card")).toHaveCount(1);
  await assertPrivate(context, page, observations);
});

test("a replacement file cannot receive stale results from the previous review", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await page.locator("#pdf-file").setInputFiles(filePayload(pdfFixture(Array.from({ length: 20 }, () => ({ text: "Old document content" }))), "old.pdf"));
  await page.locator("#pdf-file").setInputFiles(filePayload(pdfFixture([{ text: "Only the replacement belongs here" }]), "replacement.pdf"));
  await expect(page.locator("#status")).toHaveText("Review ready.");
  await expect(page.locator("#filename")).toHaveText("replacement.pdf");
  await expect(page.locator(".page-card")).toHaveCount(1);
  await expect(page.locator("#all-text")).toHaveValue("Only the replacement belongs here");
  await expect(page.locator("#review")).not.toContainText("Old document content");
  await assertPrivate(context, page, observations);
});

test("clipboard failure still leaves all text available for manual copying", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { throw new DOMException("Permission denied", "NotAllowedError"); } },
    });
    document.execCommand = () => false;
  });
  await reviewFile(page, filePayload(pdfFixture([{ text: "Copy this text manually" }])));
  await page.locator(".all-text-panel summary").click();
  await page.locator("#copy-all").click();
  await expect(page.locator("#all-text")).toBeVisible();
  await expect(page.locator("#all-text")).toHaveValue("Copy this text manually");
  await expect(page.locator("#status")).toContainText(/select|copy|clipboard/i);
  await assertPrivate(context, page, observations);
});

test("copy buttons send only extracted text to the clipboard", async ({ page, context }) => {
  const observations = await openReview(page, context);
  await page.evaluate(() => {
    globalThis.copiedValues = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => globalThis.copiedValues.push(value) },
    });
  });
  await reviewFile(page, filePayload(pdfFixture([{ text: "First page content" }, { text: "Second page content" }])));
  await page.locator(".page-card").first().getByRole("button", { name: "Copy page text" }).click();
  await page.locator(".all-text-panel summary").click();
  await page.locator("#copy-all").click();
  expect(await page.evaluate(() => globalThis.copiedValues)).toEqual([
    "First page content", "First page content\n\nSecond page content",
  ]);
  await assertPrivate(context, page, observations);
});

test("remains usable at a narrow viewport", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const observations = await openReview(page, context);
  await reviewFile(page, filePayload(pdfFixture([{ text: "Small-screen resume review", links: [{ url: `https://example.test/${"long-path-".repeat(35)}` }] }])));
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(fits).toBe(true);
  await expect(page.locator("#clear-file")).toBeVisible();
  await expect(page.locator(".page-card textarea")).toBeVisible();
  await assertPrivate(context, page, observations);
});
