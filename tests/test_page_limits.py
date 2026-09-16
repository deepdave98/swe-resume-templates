"""Tests for the page-budget checker; no TeX or Poppler required."""

from contextlib import redirect_stderr
from io import StringIO
import unittest
from unittest.mock import patch

import check_page_limits as checker


class PageLimitCheckerTests(unittest.TestCase):
    def test_starters_declare_expected_budgets(self):
        for name, pages in (("no-internship", 1), ("new-grad", 1), ("experienced-one-page", 1), ("experienced", 2)):
            with self.subTest(starter=name):
                source = (checker.ROOT / "templates" / f"{name}-resume.tex").read_text(encoding="utf-8")
                preamble = source.split(r"\begin{document}", 1)[0]
                self.assertIn("\\resumepagelimit{" + str(pages) + "}", preamble)

    def test_extracts_only_page_budget_warnings(self):
        log = "\n".join([
            "Class resume Warning: Placeholder reminder in contact details.",
            checker.INVALID,
            checker.EXCEEDED + " 3 pages; limit 2.",
            "(resume) Font size and spacing have not changed.",
        ])
        self.assertEqual(checker.page_warnings(log), [checker.INVALID, checker.EXCEEDED + " 3 pages; limit 2."])

    def test_missing_tools_return_actionable_failure(self):
        output = StringIO()
        with patch.object(checker.shutil, "which", return_value=None), redirect_stderr(output):
            self.assertEqual(checker.main(), 1)
        self.assertIn("xelatex, pdftotext", output.getvalue())
        self.assertIn("Install XeLaTeX and Poppler", output.getvalue())

    def test_failed_integration_tests_return_failure(self):
        with patch.object(checker.shutil, "which", return_value="tool"):
            with patch.object(checker.unittest, "TextTestRunner") as runner:
                runner.return_value.run.return_value.wasSuccessful.return_value = False
                self.assertEqual(checker.main(), 1)

    def test_successful_integration_tests_return_success(self):
        with patch.object(checker.shutil, "which", return_value="tool"):
            with patch.object(checker.unittest, "TextTestRunner") as runner:
                runner.return_value.run.return_value.wasSuccessful.return_value = True
                self.assertEqual(checker.main(), 0)


if __name__ == "__main__":
    unittest.main()
