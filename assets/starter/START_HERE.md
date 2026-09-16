# Start Here

Edit `resume.tex`. Styling lives in `resume.cls`.

1. Replace the name, contacts, links, education, and credentials with your own.
2. Replace each example and `[placeholder]` with work you can explain. Delete sections you do not need.
3. Compile and check the log for placeholders and extra pages. Replace flagged text or delete unused entries, then recompile.
4. Inspect every page, then download the PDF. Warnings do not catch every unfinished example.

Using the no-internship starter? Keep course projects labeled as projects and describe your own part of team work. Delete **Other Experience** if you have no work, volunteering, or club responsibility to include.

Using an experienced starter? Keep relevant roles in reverse chronological order. The one-page version starts with two roles, skills, and a degree; use your actual history. Add projects or certifications only when they contribute evidence your jobs do not cover.

## Contacts

Edit the values in `\resumeemail{alex_morgan+jobs@example.com}` and `\resumephone{+1 (416) 555-0123}` once. They supply both the visible text and the link. Use a literal email and include `+` with your phone's country code. Phone spaces, parentheses, hyphens, and periods stay visible but are removed from the `tel:` link.

Unsupported formats warn and print without a link. Use `\resumelink{destination}{label}` for other formats or labels; check both values. To remove a contact, delete its preceding `\contactsep` too. Click the links in your downloaded PDF before sending.

## Overleaf

Use [New Project > Upload Project](https://www.overleaf.com/learn/latex/Kb/Uploading_a_project) and upload the ZIP. Set the compiler to **XeLaTeX** and the main document to `resume.tex`. Click **Recompile**.

Open **View logs** beside **Recompile** to see warnings (**Logs and output files** in the older editor). The checks run inside LaTeX; nothing else to install. They look for sample contacts, known example fields, and `[prompts]` in the template's header, entries, and lists. Literal square brackets may be flagged; unmarked examples and text inside custom commands may be missed.

## Page Budget

`\resumepagelimit{1}` near the top of `resume.tex` warns if the current build exceeds one page; the two-page experienced starter uses `2`. Cut less relevant content first. Change the number if the extra page is intentional, or remove the line to disable the reminder. It never changes the font, spacing, or PDF.

If LaTeX asks you to rerun, recompile before checking length. Its temporary rerun pages are not counted by this reminder.

## Local

With XeLaTeX, `latexmk`, and LaTeX 2020-10-01 or newer installed, run this inside the extracted folder:

```bash
latexmk resume.tex
```

The included `latexmkrc` selects XeLaTeX. Your output is `resume.pdf`.

For literal text, escape LaTeX characters: `\&`, `\%`, `\$`, `\#`, and `\_`.

## Fit your content

Long organizations and locations wrap beside the dates. Keep dates short; use `{}` for a location you do not need. For links, show a short label instead of a long URL. Unbroken text can still overflow.

For earlier roles at the same company and location, add `\roleentry{Earlier title}{That role's dates}` after the first entry's bullets, then give it a separate `jobduties` list. Each role needs its own dates. The employer repeats when a role starts on another page. Use `\jobentry` for a different employer, location, or section. [Copy-paste example](https://github.com/deepdave98/swe-resume-templates/blob/main/docs/multiple-roles.md).

Use `\documentclass[a4paper]{resume}` for A4 or `\documentclass[letterpaper]{resume}` for US Letter. Recompile and inspect all pages after changing paper size.

[Bullet examples](https://github.com/deepdave98/swe-resume-templates/blob/main/examples/engineering-bullets.md) · [Section order](https://github.com/deepdave98/swe-resume-templates/blob/main/docs/section-order.md)
