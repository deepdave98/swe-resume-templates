#!/usr/bin/env python3
"""Compile same-company roles, including page breaks, on Letter and A4."""

from collections import Counter
import re
import shutil
import sys
import unittest

import check_layout
import check_pdf_text


class RoleLayoutTests(unittest.TestCase):
    setUp = check_layout.EntryLayoutTests.setUp
    tearDown = check_layout.EntryLayoutTests.tearDown
    compile = check_layout.EntryLayoutTests.compile
    assert_inside_margins = check_layout.EntryLayoutTests.assert_inside_margins

    def log(self):
        return (self.root / f"fixture {self.count}" / "resume.log").read_text(
            encoding="utf-8", errors="replace"
        )

    def assert_in_order(self, text, *parts):
        text = " ".join(check_pdf_text.words(text))
        previous = -1
        for part in parts:
            position = text.find(part)
            self.assertGreater(position, previous, (part, text))
            previous = position

    def test_role_chain_keeps_each_dates_and_bullets(self):
        for paper in ("letterpaper", "a4paper"):
            with self.subTest(paper=paper):
                text, tree = self.compile(r"""
\jobentry[Recent scope]{Senior engineer}{Northstar}{Toronto}{2023 -- Present}
\begin{jobduties}\item Release ownership.\end{jobduties}
\roleentry{Software engineer}{2021 -- 2023}
\typeout{ROLE-SPACE:\the\jobdutiesvspace}
\begin{jobduties}\item Queue retries.\end{jobduties}
\roleentry[First scope]{Junior engineer}{2019 -- 2021}
\typeout{SUMMARY-SPACE:\the\jobdutiesvspace}
\begin{jobduties}\item Input checks.\end{jobduties}
\typeout{ENTRY-COUNT:\arabic{resumeentry}}
""", paper)
                self.assertEqual(len(check_pdf_text.split_pages(text)), 1)
                self.assertEqual(text.count("Northstar"), 1)
                self.assertEqual(text.count("Toronto"), 1)
                self.assert_in_order(text, "Northstar", "Senior engineer", "Recent scope", "Release ownership.", "Software engineer", "2021", "Queue retries.", "Junior engineer", "2019", "First scope", "Input checks.")
                self.assertIn("ROLE-SPACE:3.0pt", self.log())
                self.assertIn("SUMMARY-SPACE:5.0pt", self.log())
                self.assertIn("ENTRY-COUNT:3", self.log())
                self.assertNotIn("Placeholder reminder", self.log())
                self.assert_inside_margins(tree)

    def test_long_roles_dates_and_optional_fields(self):
        cases = (
            ("Senior engineer for Developer Infrastructure and Release Engineering", "September 2021 -- December 2023; January 2025 -- Present"),
            ("Engineer for Distributed Systems and Application Reliability Infrastructure", ""),
            ("Engineer", "January 2022 -- Present"),
        )
        for paper in ("letterpaper", "a4paper"):
            for role, dates in cases:
                with self.subTest(paper=paper, role=role, dates=dates):
                    body = r"\jobentry{Current role}{Northstar}{}{2025}" + "\n"
                    body += r"\roleentry{" + role + "}{" + dates + "}\n"
                    body += r"\begin{jobduties}\item Previous contribution.\end{jobduties}"
                    text, tree = self.compile(body, paper)
                    expected = "Northstar 2025 Current role " + role + " " + dates.replace("--", "–") + " • Previous contribution."
                    self.assertEqual(Counter(check_pdf_text.words(text)), Counter(check_pdf_text.words(expected)))
                    self.assertEqual(len(check_pdf_text.split_pages(text)), 1)
                    self.assert_inside_margins(tree)

    def test_explicit_break_repeats_context_even_after_page_number_reset(self):
        for paper in ("letterpaper", "a4paper"):
            for location in ("Toronto", ""):
                with self.subTest(paper=paper, location=location):
                    body = r"\jobentry{Current role}{Northstar}{" + location + r"}{2023 -- Present}" + "\n"
                    body += r"""
\begin{jobduties}\item Recent work.\end{jobduties}
\newpage\setcounter{page}{1}
\roleentry{Previous role}{2020 -- 2023}
\begin{jobduties}\item Earlier work.\end{jobduties}
\roleentry{First role}{2019 -- 2020}
\begin{jobduties}\item Initial work.\end{jobduties}
"""
                    text, tree = self.compile(body, paper)
                    pages = check_pdf_text.split_pages(text)
                    self.assertEqual(len(pages), 2)
                    self.assertEqual(pages[0].count("Northstar"), 1)
                    self.assertEqual(pages[1].count("Northstar"), 1)
                    self.assertEqual(pages[1].count("Toronto"), 1 if location else 0)
                    self.assert_in_order(pages[1], "Northstar", "2020", "Previous role", "Earlier work.", "First role", "2019", "Initial work.")
                    if not location:
                        self.assertNotIn("Northstar –", pages[1])
                    self.assert_inside_margins(tree)

    def test_automatic_break_moves_role_and_repeats_employer(self):
        for paper, space in (("letterpaper", "8.8in"), ("a4paper", "9.5in")):
            with self.subTest(paper=paper):
                body = r"""
\jobentry{Current role}{Northstar}{Toronto}{2023 -- Present}
\begin{jobduties}\item Recent work.\end{jobduties}
"""
                body += r"\vspace*{" + space + "}\n"
                body += r"""
\roleentry[Earlier responsibilities]{Previous role}{2020 -- 2023}
\begin{jobduties}\item Earlier work.\end{jobduties}
"""
                text, tree = self.compile(body, paper)
                pages = check_pdf_text.split_pages(text)
                self.assertEqual(len(pages), 2)
                self.assertNotIn("Previous role", pages[0])
                self.assert_in_order(pages[1], "Northstar", "Previous role", "Earlier responsibilities", "Earlier work.")
                self.assert_inside_margins(tree)

    def test_new_job_resets_employer_and_location(self):
        body = r"""
\jobentry{Recent role}{First company}{Toronto}{2024 -- Present}
\begin{jobduties}\item Recent work.\end{jobduties}
\jobentry{Other role}{Second company}{Ottawa}{2022 -- 2024}
\begin{jobduties}\item Other work.\end{jobduties}
\newpage
\roleentry{Earlier role}{2020 -- 2022}
\begin{jobduties}\item Earlier work.\end{jobduties}
"""
        text, tree = self.compile(body, "letterpaper")
        page = check_pdf_text.split_pages(text)[1]
        self.assertIn("Second company", page)
        self.assertIn("Ottawa", page)
        self.assertNotIn("First company", page)
        self.assertNotIn("Toronto", page)
        self.assert_inside_margins(tree)

    def test_long_summary_is_reserved_before_deciding_employer_context(self):
        body = r"""
\jobentry{Current role}{Northstar}{Toronto}{2023 -- Present}
\begin{jobduties}\item Recent work.\end{jobduties}
\vspace*{8.0in}
\roleentry[Line one\\Line two\\Line three\\Line four\\Line five\\Line six]{Previous role: Engineer for Distributed Systems and Application Reliability Infrastructure, Developer Tooling, Release Engineering, Production Operations, Service Ownership, Performance Testing, and Data Processing Platform Modernization}{2020 -- 2023}
\begin{jobduties}\item Earlier work.\end{jobduties}
"""
        text, tree = self.compile(body, "letterpaper")
        pages = check_pdf_text.split_pages(text)
        self.assertEqual(len(pages), 2)
        self.assertNotIn("Previous role", pages[0])
        self.assert_in_order(pages[1], "Northstar", "Previous role", "Line one", "Line six", "Earlier work.")
        self.assert_inside_margins(tree)

    def test_previous_bullets_may_span_pages_without_losing_employer_context(self):
        body = r"\jobentry{Current role}{Northstar}{Toronto}{2023 -- Present}" + "\n"
        body += r"\begin{jobduties}" + "\n"
        body += "\n".join(r"\item Recent responsibility " + str(index) + "." for index in range(50))
        body += "\n" + r"\end{jobduties}" + "\n"
        body += r"""
\roleentry{Previous role}{2020 -- 2023}
\begin{jobduties}\item Earlier work.\end{jobduties}
"""
        text, tree = self.compile(body, "letterpaper")
        pages = check_pdf_text.split_pages(text)
        self.assertEqual(len(pages), 2)
        self.assertIn("Recent responsibility 49.", pages[1])
        self.assert_in_order(pages[1], "Northstar", "Previous role", "Earlier work.")
        self.assertEqual(text.count("Northstar"), 2)
        self.assert_inside_margins(tree)

    def test_repeated_long_employer_reserves_summary_and_first_bullet(self):
        body = r"""
\jobentry{Current role}{Northstar Regional Transportation Software and Infrastructure Cooperative Research and Development Systems Engineering}{San Francisco Bay Area, California}{2023 -- Present}
\begin{jobduties}\item Recent work.\end{jobduties}
\newpage
Continuation of current work.\par\vspace*{8.0in}
\roleentry[Line one\\Line two\\Line three\\Line four\\Line five\\Line six]{Previous role: Engineer for Distributed Systems and Application Reliability Infrastructure, Developer Tooling, Release Engineering, Production Operations, Service Ownership, Performance Testing, Data Processing Platform Modernization, Cross-Region Rollouts, Storage Reliability, Service Migration Planning, Release Verification, Internal Platform Adoption, On-Call Runbooks, Developer Support, Capacity Reviews, and Observability Tooling}{2020 -- 2023}
\begin{jobduties}\item Earlier work.\end{jobduties}
"""
        text, tree = self.compile(body, "letterpaper")
        pages = check_pdf_text.split_pages(text)
        self.assertEqual(len(pages), 3)
        self.assertNotIn("Previous role", pages[1])
        self.assert_in_order(pages[2], "Northstar", "Previous role", "Line one", "Line six", "Earlier work.")
        words = tree.findall(".//{*}page")[2].findall(".//{*}word")
        title_top = next(float(word.attrib["yMin"]) for word in words if word.text == "Previous")
        summary_top = next(float(word.attrib["yMin"]) for word in words if word.text == "Line")
        title_lines = {round(float(word.attrib["yMin"]), 1) for word in words if title_top <= float(word.attrib["yMin"]) < summary_top}
        self.assertGreaterEqual(len(title_lines), 3)
        self.assert_inside_margins(tree)

    def test_placeholder_reminders_cover_each_role_without_echoing_values(self):
        body = r"""
\jobentry{Engineer}{Northstar}{Toronto}{2024 -- Present}
\roleentry[{[PrivateSummary]}]{[PrivateRole]}{[PrivateDates]}
\begin{jobduties}\item Addressed [PrivateBullet].\end{jobduties}
"""
        self.compile(body, "letterpaper")
        log = self.log()
        for field in ("summary", "role", "dates", "bullets"):
            self.assertIn("Placeholder reminder in entry 2 " + field, log)
        self.assertEqual(log.count("Placeholder reminder"), 4)
        self.assertNotIn("Private", log)

    def test_missing_employer_warns_but_preserves_content(self):
        text, tree = self.compile(r"""
\roleentry{Engineer}{2020 -- 2022}
\begin{jobduties}\item Actual work.\end{jobduties}
""", "letterpaper")
        self.assertIn("Role entry has no employer", self.log())
        self.assert_in_order(text, "Engineer", "2020", "Actual work.")
        self.assert_inside_margins(tree)

    def test_documented_examples_compile_together(self):
        guide = (check_layout.ROOT / "docs" / "multiple-roles.md").read_text(encoding="utf-8")
        examples = re.findall(r"```latex\n(.*?)\n```", guide, flags=re.DOTALL)
        self.assertEqual(len(examples), 2)
        text, tree = self.compile("\n".join(examples), "letterpaper")
        self.assertEqual(text.count("[Company]"), 1)
        self.assertIn("[Most recent title]", text)
        self.assertIn("[Earlier title]", text)
        self.assertIn("[Title]", text)
        self.assertNotIn("Role entry has no employer", self.log())
        self.assert_inside_margins(tree)


def main():
    missing = [name for name in ("xelatex", "pdftotext") if shutil.which(name) is None]
    if missing:
        print("FAIL: missing " + ", ".join(missing) + ". Install XeLaTeX and Poppler and add them to PATH.", file=sys.stderr)
        return 1
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RoleLayoutTests)
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
