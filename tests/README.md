# Template Checks

`make test` builds all three templates, runs unit tests, checks the built and published PDFs, compiles the starter ZIPs, and tests placeholder and page-limit warnings. It needs XeLaTeX, `latexmk`, Python 3.9+, and Poppler's `pdftotext` on `PATH`; no pip packages.

The check compares every page with `expected/*.txt` using Poppler's `-layout` reading order. Missing or reordered words, changed punctuation, unmapped characters, and extra or missing pages fail. Whitespace and Unicode ligature differences are ignored. Line-end hyphens are preserved.

This checks one extractor. It does not score a resume or guarantee how an ATS will parse it. Inspect the PDF too; text extraction cannot catch every visual defect.

## Run without make

Build the PDFs first, then run from the repository root:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
python3 tests/check_pdf_text.py
python3 tests/check_pdf_text.py --no-internship output/pdf/no-internship-resume.pdf --new-grad output/pdf/new-grad-resume.pdf --experienced output/pdf/experienced-resume.pdf
python3 scripts/package_templates.py --check
python3 tests/check_starter_builds.py
python3 tests/check_placeholders.py
python3 tests/check_layout.py
python3 tests/check_page_limits.py
```

On Windows, use `py -3` instead of `python3`. Pass `--no-internship`, `--new-grad`, and `--experienced` to the PDF checker for other locations.

## Starter downloads

Run `make downloads` to rebuild all three ZIPs in `downloads/`. Without make, run `python3 scripts/package_templates.py`.

Each archive contains only the chosen template as `resume.tex`, the shared class, compiler config, start guide, and license. Text is UTF-8 with LF line endings. Fixed ZIP metadata keeps builds identical across checkouts.

`make test-downloads` fails if a ZIP is missing, stale, or contains extra files. It does not regenerate downloads, so CI cannot hide an outdated archive by rebuilding it.

`make test-starters` unpacks the checked-in ZIPs into temporary folders and runs `latexmk resume.tex`. No source files are copied in. This tests the bundled compiler config and applies the same PDF checks to what users download. Temporary builds are deleted when the check ends.

## Placeholder warnings

`make test-placeholders` compiles small fixtures with XeLaTeX. Sample names, hidden contact URLs, example entry fields, and bracketed prompts must warn. Completed content, comments, and command options must not. The checks also compare extracted text with reminders enabled and disabled.

The shipped templates intentionally contain placeholders, so their warnings are expected. Reminders do not block compilation or certify that a resume is ready. They inspect the template commands and lists, not arbitrary macros or every word in the document.

## Entry layout

`make test-layout` compiles long employer, university, location, and date fields on Letter and A4, including missing locations and dates. It rejects overfull boxes, missing or duplicated words, overlapping word bounds, and text outside the margins. A page-end fixture checks that a wrapped heading moves with its role.

Wrapped columns can interleave in layout-mode extraction. These stress tests check word completeness and bounds, not semantic reading order. The shipped templates still use exact page snapshots. Inspect rendered pages before accepting layout changes.

## Page-limit warnings

`make test-page-limits` checks one- and two-page budgets, extra pages, changed budgets, and invalid inputs. Fixtures cover a first build, a shortened rebuild, reset page numbers, discarded pages, and content added at the end of a document. It also checks that enabling reminders leaves extracted text unchanged.

The class reads LaTeX's shipped-page counter after the final page. It does not infer length from printed page numbers or a previous build. A missing budget disables the check; invalid values warn without replacing the last valid budget. The shipped starters set budgets of one, one, and two pages.

Resolve LaTeX rerun warnings before checking the final length. When a last-page hook needs another run, the kernel can append a temporary page outside its shipped-page counter. A regression covers a two-page document shortened to one: the temporary page disappears on the next run and the settled count is correct.

## Change a baseline

After an intentional template edit:

1. Run `make preview` and inspect all four pages.
2. Read the extracted text with `pdftotext -layout path/to/resume.pdf -`.
3. Update the affected page in `expected/` with the reviewed text, without the trailing form feed. Keep dates on the same line as the organization, as layout mode emits them.
4. Run `make downloads`, then `make test`. Commit the source, refreshed previews/PDFs, ZIPs, and baseline together.

Do not accept a new baseline just to clear a failure. Check it against the source and rendered page.

## Check your own resume

These snapshots describe the shipped templates. Your edited resume will differ. Read its extracted text instead of treating a snapshot failure as a quality score:

```bash
pdftotext -layout path/to/your-resume.pdf -
```

Check your name, email, dates, headings, bullet order, and any text split across pages. Extraction output and failure diffs can include personal data; redact them before opening an issue.
