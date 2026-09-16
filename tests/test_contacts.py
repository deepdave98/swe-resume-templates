"""Tests for contact-link checks; no XeLaTeX or Poppler required."""

from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path
import subprocess
import unittest
from unittest.mock import Mock, patch

import check_contacts as checker


class ContactCheckerTests(unittest.TestCase):
    def test_parse_urls_preserves_order_and_duplicates(self):
        self.assertEqual(checker.parse_urls("""Page  Type          URL
   1  Annotation    mailto:alex+jobs@example.com
   1  Annotation    tel:+14165550123
   2  Annotation    mailto:alex+jobs@example.com
"""), ["mailto:alex+jobs@example.com", "tel:+14165550123", "mailto:alex+jobs@example.com"])

    def test_parse_no_links(self):
        self.assertEqual(checker.parse_urls("Page  Type          URL\n\n"), [])

    def test_parse_invalid_header_or_rows_fails(self):
        for output in ("", "Pages: 1", "Page Type URL\n1 Annotation", "Page Type URL\nno Annotation mailto:a@b.com", "Page Type URL\n1 Unknown mailto:a@b.com"):
            with self.subTest(output=output), self.assertRaises(RuntimeError):
                checker.parse_urls(output)

    def test_extract_urls_uses_pdfinfo_and_absolute_argument(self):
        result = Mock(returncode=0, stdout="Page Type URL\n1 Annotation mailto:alex@example.com\n")
        with patch.object(checker.shutil, "which", return_value="/tools/pdfinfo"), patch.object(checker.subprocess, "run", return_value=result) as run:
            self.assertEqual(checker.extract_urls("a folder/resume.pdf"), ["mailto:alex@example.com"])
        self.assertEqual(run.call_args.args[0], ["/tools/pdfinfo", "-url", str(Path("a folder/resume.pdf").resolve())])
        self.assertEqual(run.call_args.kwargs["timeout"], 30)

    def test_extract_urls_missing_tool_is_actionable(self):
        with patch.object(checker.shutil, "which", return_value=None), self.assertRaisesRegex(RuntimeError, "Install Poppler"):
            checker.extract_urls("resume.pdf")

    def test_extract_urls_failure_does_not_echo_process_output(self):
        result = Mock(returncode=1, stdout="private sentinel", stderr="private sentinel")
        with patch.object(checker.shutil, "which", return_value="pdfinfo"), patch.object(checker.subprocess, "run", return_value=result):
            with self.assertRaises(RuntimeError) as raised:
                checker.extract_urls("resume.pdf")
        self.assertNotIn("private sentinel", str(raised.exception))

    def test_extract_urls_tool_errors_are_wrapped(self):
        for failure in (OSError("private sentinel"), subprocess.TimeoutExpired("pdfinfo", 30), UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid")):
            with self.subTest(error=type(failure).__name__), patch.object(checker.shutil, "which", return_value="pdfinfo"), patch.object(checker.subprocess, "run", side_effect=failure):
                with self.assertRaisesRegex(RuntimeError, "Could not inspect PDF link targets"):
                    checker.extract_urls("resume.pdf")

    def test_extract_urls_invalid_output_is_rejected(self):
        result = Mock(returncode=0, stdout="not a URL table")
        with patch.object(checker.shutil, "which", return_value="pdfinfo"), patch.object(checker.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(RuntimeError, "URL table"):
                checker.extract_urls("resume.pdf")

    def test_only_contact_warnings_are_returned(self):
        self.assertEqual(checker.contact_warnings("\n".join([
            "Package hyperref Warning: unrelated",
            "Class resume Warning: Placeholder reminder in contact details.",
            checker.WARNING + "phone format; contact is not linked.",
            "(resume) Check the contact helper instructions.",
        ])), ["phone format; contact is not linked."])

    def test_missing_tools_return_actionable_failure(self):
        output = StringIO()
        with patch.object(checker.shutil, "which", return_value=None), redirect_stderr(output):
            self.assertEqual(checker.main(), 1)
        self.assertIn("xelatex, pdftotext, pdfinfo", output.getvalue())
        self.assertIn("Install XeLaTeX and Poppler", output.getvalue())

    def test_runner_status_becomes_exit_status(self):
        for success, expected in ((True, 0), (False, 1)):
            with self.subTest(success=success), patch.object(checker.shutil, "which", return_value="tool"), patch.object(checker.unittest, "TextTestRunner") as runner:
                runner.return_value.run.return_value.wasSuccessful.return_value = success
                self.assertEqual(checker.main(), expected)


if __name__ == "__main__":
    unittest.main()
