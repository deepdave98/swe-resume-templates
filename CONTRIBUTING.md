# Contributing

Issues and pull requests are welcome. Keep changes focused.

## Template and documentation changes

- Keep shared layout and styling in `resume.cls`.
- Keep no-internship, new-grad, and experienced-one-page at one page each. Keep experienced at two pages.
- Keep examples shipped in the resume templates and maintainer-written guides fictional: use placeholder companies, roles, metrics, links, and contact details.
- Run `make` with XeLaTeX.
- Run `make preview` and review every page if the output changes.
- Run `make downloads` after changing template content, styling, the license, or starter instructions.
- Run `make test`; it checks PDF text, ZIP freshness, builds from the actual downloads, and placeholder warnings. See the [test guide](tests/README.md) for dependencies and baseline updates.
- Run `git diff --check`.

Explain why the change matters. Include before-and-after screenshots for layout changes.

## Community resume examples

Submit only a bullet you wrote and have the right to share. Choose either path:

- No Git required: use the [resume example issue form](https://github.com/deepdave98/swe-resume-templates/issues/new?template=resume-example.yml).
- Pull request: copy [`examples/community/TEMPLATE.md`](examples/community/TEMPLATE.md) into `examples/community/accepted/`, complete the content and permissions, and open a draft PR. Leave the review record for the reviewer.

Before submitting:

- Replace employer, client, product, team, and private system names with clear placeholders.
- Keep the rewrite faithful to your contribution, scope, and seniority.
- Explain numbers in safe, non-confidential terms. Never invent a metric or upload private proof.
- Confirm that the original is yours and that your submission may be published under the MIT License.

Approve the final rewrite and byline before publication. Attribution is optional, but selecting Anonymous does not hide your GitHub account or history. The [review checklist](examples/community/REVIEW.md) covers claim checks, approval, and publication. Only accepted examples enter the [index](examples/community/README.md).

Run `python3 scripts/check_community_examples.py` after completing an entry and its index row. The check also runs in CI; it checks the record, not whether a claim is true.
