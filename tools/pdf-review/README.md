# Private PDF review

Check the file you are about to send. Read its extracted text, compare it with the page, and inspect where its links actually go.

## Use it

1. [Download the reviewer](https://raw.githubusercontent.com/deepdave98/swe-resume-templates/main/downloads/pdf-review.zip).
2. Unzip it. Open `pdf-review.html` in a current Chrome, Edge, Firefox, or Safari browser.
3. Drop in your PDF. Read each page and its text. Use **Copy page text** or **Copy all text** for application forms.

No install, terminal, account, or internet connection is needed after downloading. Keep the HTML file and use it again. It includes the PDF engine, fonts, and decoding resources; it does not load them from a CDN.

One PDF at a time, up to 20 MB and 20 pages. Password-protected files ask for the password locally. **Clear file** discards the review; choosing another file replaces it.

## What to check

- **Extracted text:** look for missing words, odd symbols, and wrong reading order. Text order comes from the PDF, not from a guess about its layout. Ligatures such as `ﬁ` become ordinary letters for copying.
- **Link destinations:** compare the displayed target with the label on the page. Destinations are text only; the tool never follows them or checks whether a website is online. Hidden control characters are shown as escapes. Internal links and unsupported PDF actions are identified separately.
- **Pages without text:** a scan or outlined lettering may look fine but copy nothing. This tool does not run OCR.
- **Pages that appear blank:** this is a preview-based hint, not proof. Very faint content can be missed. A failed preview is never counted as a blank page.

Form fields, incomplete extraction, and truncated results get warnings. Review the original PDF if anything is missing. PDF.js and Poppler can produce different text order; neither predicts how every application form or ATS will parse a file. There is no resume score.

## Privacy

The PDF is read from the browser's file picker into memory. No upload endpoint, analytics, cookies, browser storage, or service worker. No filename, password, text, or link destination is sent anywhere. Links and PDF scripts are not executed.

The page's Content Security Policy blocks network connections, external scripts, form submission, and plugins. The PDF worker runs locally. Closing, reloading, or clearing the page discards this tool's review. This is not a secure memory wipe, and it cannot control browser extensions or your operating system.

Copying text puts it on your system clipboard. Other apps or clipboard history may retain it. If someone hosts this page, their host can receive normal page-request data; it still does not receive your PDF.

## Development

End users need only the download. Maintainers need Node.js 24+:

```bash
cd tools/pdf-review
npm ci --ignore-scripts
npm run build
npm test
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
npm run check
```

`build` writes the self-contained HTML and a reproducible ZIP to `downloads/`. Commit the ZIP, not the generated HTML. `check` rebuilds in memory and fails if the committed ZIP is stale. Browser tests cover both a local file and a website, including offline processing. Tests use public templates and synthetic fixtures, never personal resumes.

Tests run in Chromium, Firefox, and WebKit. Chromium and Firefox use offline emulation. WebKit blocks all HTTP(S) instead because its offline emulation also blocks local blob workers. Every engine checks for zero post-load network requests and no browser storage.

For a local preview, run `node server.mjs` and open `http://127.0.0.1:4178/`. The server serves only the generated page; it has no upload route.

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Interface and copy |
| `src/app.mjs` | File lifecycle, worker, previews, clipboard, and DOM |
| `src/review.mjs` | Bounded text and annotation inspection |
| `build.mjs` | Embedded PDF.js resources, CSP hashes, and ZIP |
| `tests/` | Unit, package, privacy, and browser checks |

PDF.js is pinned in `package-lock.json`. Update it through a dependency PR, rebuild the ZIP, and run all checks. Its license and bundled font/decoder notices are included under **PDF engine and licenses** in the page. The app code uses the repository's MIT license; bundled third-party code retains its own licenses.

## Optional hosting

The same HTML works on a static host. No backend is needed. Do not add analytics or third-party scripts.

For this repository, enable **Settings → Pages → Source: GitHub Actions**, merge the PR, then run **Publish PDF review** from the Actions tab on `main`. The workflow publishes only the generated reviewer, not resume sources or PDFs. Run it again after reviewer updates. Downloaded copies do not update themselves.
