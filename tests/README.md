# Template Checks

`make test` builds all four templates, runs unit tests, checks PDFs, headings, grouped roles, and contact links, compiles the starter ZIPs, tests placeholder and page-limit warnings, and exercises the personal PDF checker. It needs XeLaTeX, `latexmk`, Python 3.9+, and Poppler's `pdftotext` and `pdfinfo` on `PATH`; no pip packages.

The check compares every page with `expected/*.txt` using Poppler's `-layout` reading order. Missing or reordered words, changed punctuation, unmapped characters, and extra or missing pages fail. Whitespace and Unicode ligature differences are ignored. Line-end hyphens are preserved.

This checks one extractor. It does not score a resume or guarantee how an ATS will parse it. Inspect the PDF too; text extraction cannot catch every visual defect.

## Run without make

Build the PDFs first, then run from the repository root:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
python3 tests/check_pdf_text.py
python3 tests/check_pdf_text.py --no-internship output/pdf/no-internship-resume.pdf --new-grad output/pdf/new-grad-resume.pdf --experienced-one-page output/pdf/experienced-one-page-resume.pdf --experienced output/pdf/experienced-resume.pdf
python3 scripts/check_resume.py output/pdf/no-internship-resume.pdf --max-pages 1
python3 scripts/check_resume.py output/pdf/new-grad-resume.pdf --max-pages 1
python3 scripts/check_resume.py output/pdf/experienced-one-page-resume.pdf --max-pages 1
python3 scripts/check_resume.py output/pdf/experienced-resume.pdf --max-pages 2
python3 scripts/package_templates.py --check
python3 tests/check_starter_builds.py
python3 tests/check_placeholders.py
python3 tests/check_layout.py
python3 tests/check_roles.py
python3 tests/check_page_limits.py
python3 tests/check_contacts.py
```

On Windows, use `py -3` instead of `python3`. Pass `--no-internship`, `--new-grad`, `--experienced-one-page`, and `--experienced` to the PDF checker for other locations.

## Starter downloads

Run `make downloads` to rebuild all four ZIPs in `downloads/`. Without make, run `python3 scripts/package_templates.py`.

Each archive contains only the chosen template as `resume.tex`, the shared class, compiler config, start guide, and license. Text is UTF-8 with LF line endings. Fixed ZIP metadata keeps builds identical across checkouts.

`make test-downloads` fails if a ZIP is missing, stale, or contains extra files. It does not regenerate downloads, so CI cannot hide an outdated archive by rebuilding it.

`make test-starters` unpacks the checked-in ZIPs into temporary folders and runs `latexmk resume.tex`. No source files are copied in. This tests the bundled compiler config and applies the same PDF checks to what users download. Temporary builds are deleted when the check ends.

## Placeholder warnings

`make test-placeholders` compiles small fixtures with XeLaTeX. Sample names, hidden contact URLs, example entry fields, and bracketed prompts must warn. Completed content, comments, and command options must not. The checks also compare extracted text with reminders enabled and disabled.

The shipped templates intentionally contain placeholders, so their warnings are expected. Reminders do not block compilation or certify that a resume is ready. They inspect the template commands and lists, not arbitrary macros or every word in the document.

## Entry layout

`make test-layout` compiles long employer, university, location, and date fields on Letter and A4, including missing locations and dates. It rejects overfull boxes, missing or duplicated words, overlapping word bounds, and text outside the margins. A page-end fixture checks that a wrapped heading moves with its role.

Wrapped columns can interleave in layout-mode extraction. These stress tests check word completeness and bounds, not semantic reading order. The shipped templates still use exact page snapshots. Inspect rendered pages before accepting layout changes.

## Multiple roles

`make test-roles` compiles same-company role groups on Letter and A4. It checks role-specific dates, bullets, optional summaries, long titles, empty fields, and placeholder warnings. Page-break fixtures verify that the company and location repeat after explicit or automatic breaks, even when page numbers reset. Other checks cover a changed employer and a role with no preceding employer.

Short headings must extract in order; wrapped headings must retain every word. All word bounds must stay inside the margins without overlap. The copy-paste example in `docs/multiple-roles.md` is compiled too.

## Page-limit warnings

`make test-page-limits` checks one- and two-page budgets, extra pages, changed budgets, and invalid inputs. Fixtures cover a first build, a shortened rebuild, reset page numbers, discarded pages, and content added at the end of a document. It also checks that enabling reminders leaves extracted text unchanged.

The class reads LaTeX's shipped-page counter after the final page. It does not infer length from printed page numbers or a previous build. A missing budget disables the check; invalid values warn without replacing the last valid budget. All starters set a one-page budget except the two-page experienced version.

Resolve LaTeX rerun warnings before checking the final length. When a last-page hook needs another run, the kernel can append a temporary page outside its shipped-page counter. A regression covers a two-page document shortened to one: the temporary page disappears on the next run and the settled count is correct.

## Contact links

`make test-contacts` compiles email and phone examples, then checks their visible text with `pdftotext` and actual link destinations with `pdfinfo -url`. Both tools come with Poppler. Tests cover edited values, email punctuation, phone formatting, placeholder reminders, and unsupported inputs. These checks do not verify that an inbox or phone number belongs to you; click your final PDF's links too.

## Change a baseline

After an intentional template edit:

1. Run `make preview` and inspect all five pages.
2. Read the extracted text with `pdftotext -layout path/to/resume.pdf -`.
3. Update the affected page in `expected/` with the reviewed text, without the trailing form feed. Keep dates on the same line as the organization, as layout mode emits them.
4. Run `make downloads`, then `make test`. Commit the source, refreshed previews/PDFs, ZIPs, and baseline together.

Do not accept a new baseline just to clear a failure. Check it against the source and rendered page.

## Check your own resume

The snapshots above describe the shipped templates, not your edited resume. Use the separate checker instead:

```bash
python3 scripts/check_resume.py "path/to/your-resume.pdf" --max-pages 1
```

It requires only Python 3.9+ and Poppler, not TeX or the snapshot files. Omit `--max-pages` for no page limit. For a filename starting with a dash, use `python3 scripts/check_resume.py --max-pages 1 -- -resume.pdf`.

The check fails on unreadable or empty files, Poppler errors or warnings, empty text pages, replacement/private-use/control characters, and a page count above your chosen limit. Whitespace, ligatures, punctuation, and language-specific format characters are allowed. Errors name the page or character code, not the surrounding text. Exit codes: `0` passed these checks, `1` failed a check, `2` invalid command arguments.

It runs locally and does not upload, print, or save extracted text. It cannot detect missing words, wrong reading order, clipping, false claims, or ATS compatibility. A pass is not a resume score. Inspect the PDF and read its text:

```bash
pdftotext -layout "path/to/your-resume.pdf" -
```

Check your name, email, dates, headings, bullet order, and text split across pages. This manual command prints personal data; redact it before opening an issue. Do the same with snapshot failure diffs, which quote template text.

`make test-personal-pdf` runs the checker against all four published PDFs. Unit tests cover blank pages, character handling, corrupt/locked files, timeouts, missing tools, command arguments, standalone use, and private-data suppression. Neither check writes to the input PDF.
