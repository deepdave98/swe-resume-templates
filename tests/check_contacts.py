#!/usr/bin/env python3
"""Compile contact helpers and check displayed text and actual PDF link targets."""

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import unicodedata

import check_pdf_text
import check_placeholders


ROOT = Path(__file__).resolve().parents[1]
WARNING = "Class resume Warning: Unsupported "


def parse_urls(output):
    """Parse pdfinfo -url output without scraping visible resume text."""
    lines = output.splitlines()
    if not lines or lines[0].split() != ["Page", "Type", "URL"]:
        raise RuntimeError("pdfinfo did not return its URL table.")
    urls = []
    for line in lines[1:]:
        if not line.strip():
            continue
        fields = line.split(maxsplit=2)
        if len(fields) != 3 or not fields[0].isdigit() or fields[1] != "Annotation":
            raise RuntimeError("pdfinfo returned an unexpected URL table row.")
        urls.append(fields[2])
    return urls


def extract_urls(pdf):
    executable = shutil.which("pdfinfo")
    if executable is None:
        raise RuntimeError("Missing pdfinfo. Install Poppler and add it to PATH.")
    try:
        result = subprocess.run(
            [executable, "-url", str(Path(pdf).resolve())],
            capture_output=True,
            encoding="utf-8",
            errors="strict",
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired, UnicodeError) as exc:
        raise RuntimeError("Could not inspect PDF link targets with pdfinfo.") from exc
    if result.returncode != 0:
        raise RuntimeError("pdfinfo failed while inspecting PDF link targets.")
    return parse_urls(result.stdout)


def contact_warnings(log):
    return [line.split(WARNING, 1)[1].strip() for line in log.splitlines() if WARNING in line]


class ContactBuildTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="resume-contacts-")
        self.root = Path(self.temporary.name)
        self.count = 0

    def tearDown(self):
        self.temporary.cleanup()

    def compile(self, body, preamble=""):
        self.count += 1
        project = self.root / f"contact fixture {self.count}"
        project.mkdir()
        shutil.copyfile(ROOT / "resume.cls", project / "resume.cls")
        source = check_placeholders.document(body, preamble)
        (project / "resume.tex").write_text(source, encoding="utf-8")
        result = subprocess.run(
            [shutil.which("xelatex"), "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "resume.tex"],
            cwd=project,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        self.assertEqual(result.returncode, 0, "\n".join(result.stdout.splitlines()[-35:]))
        log = (project / "resume.log").read_text(encoding="utf-8", errors="replace")
        for diagnostic in ("Invalid end-point", "Invalid regular expression", "Unknown special group", "Missing right bracket"):
            self.assertNotIn(diagnostic, log)
        pdf = project / "resume.pdf"
        text = unicodedata.normalize("NFKC", check_pdf_text.extract_text(pdf))
        return text, extract_urls(pdf), log

    def test_default_helpers_preserve_visible_text_and_targets(self):
        before, old_urls, _ = self.compile(r"""
\resumename{Your Name}
\resumecontact{City, Region
\contactsep \resumelink{tel:+15555555555}{+1 (555) 555-5555}
\contactsep \resumelink{mailto:hello@example.com}{hello@example.com}
\contactsep \resumelink{https://www.linkedin.com/in/your-handle}{LinkedIn}
\contactsep \resumelink{https://github.com/your-handle}{GitHub}}
""")
        after, new_urls, log = self.compile(r"""
\resumename{Your Name}
\resumecontact{City, Region
\contactsep \resumephone{+1 (555) 555-5555}
\contactsep \resumeemail{hello@example.com}
\contactsep \resumelink{https://www.linkedin.com/in/your-handle}{LinkedIn}
\contactsep \resumelink{https://github.com/your-handle}{GitHub}}
""")
        self.assertEqual(after, before)
        self.assertEqual(new_urls, old_urls)
        self.assertEqual(contact_warnings(log), [])
        self.assertEqual(check_placeholders.reminders(log), ["resume name.", "contact details."])

    def test_raw_and_escaped_underscores_have_same_display_and_mailto(self):
        raw, raw_urls, raw_log = self.compile(r"\resumecontact{\resumeemail{alex_morgan+jobs@dev-mail.example}}")
        escaped, escaped_urls, escaped_log = self.compile(r"\resumecontact{\resumeemail{alex\_morgan+jobs@dev-mail.example}}")
        self.assertIn("alex_morgan+jobs@dev-mail.example", raw)
        self.assertEqual(raw, escaped)
        self.assertEqual(raw_urls, ["mailto:alex_morgan+jobs@dev-mail.example"])
        self.assertEqual(raw_urls, escaped_urls)
        self.assertEqual(contact_warnings(raw_log) + contact_warnings(escaped_log), [])

    def test_addresses_preserve_case_dots_and_subdomains(self):
        text, urls, log = self.compile(r"""
\resumecontact{\resumeemail{ Alex.Morgan+jobs@Hiring.dev-mail.example }}
\resumecontact{\resumeemail{alex@1.example}}
""")
        self.assertIn("Alex.Morgan+jobs@Hiring.dev-mail.example", text)
        self.assertEqual(urls, ["mailto:Alex.Morgan+jobs@Hiring.dev-mail.example", "mailto:alex@1.example"])
        self.assertEqual(contact_warnings(log), [])

    def test_international_phone_formats_preserve_display_and_normalize_targets(self):
        text, urls, log = self.compile(r"""
\resumecontact{\resumephone{+44 (20) 5555-0123}}
\resumecontact{\resumephone{+91 80 5555 0123}}
\resumecontact{\resumephone{ +49.30.5555.0123 }}
\resumecontact{\resumephone{+1234567}}
\resumecontact{\resumephone{+123456789012345}}
""")
        self.assertIn("+44 (20) 5555-0123", text)
        self.assertIn("+91 80 5555 0123", text)
        self.assertIn("+49.30.5555.0123", text)
        self.assertEqual(urls, ["tel:+442055550123", "tel:+918055550123", "tel:+493055550123", "tel:+1234567", "tel:+123456789012345"])
        self.assertEqual(contact_warnings(log), [])

    def test_unsupported_email_formats_warn_without_links_or_private_values(self):
        text, urls, log = self.compile(r"""
\resumecontact{\resumeemail{private-sentinel}}
\resumecontact{\resumeemail{alex @example.com}}
\resumecontact{\resumeemail{alex@@example.com}}
\resumecontact{\resumeemail{mailto:alex@example.com}}
\resumecontact{\resumeemail{alex@localhost}}
\resumecontact{\resumeemail{alex..morgan@example.com}}
\resumecontact{\resumeemail{.alex@example.com}}
\resumecontact{\resumeemail{alex@example-.com}}
\resumecontact{\resumeemail{alex@-example.com}}
\resumecontact{\resumeemail{}}
""")
        self.assertIn("private-sentinel", text)
        self.assertNotIn("private-sentinel", log)
        self.assertEqual(urls, [])
        self.assertEqual(contact_warnings(log), ["email format; contact is not linked."] * 10)

    def test_unsupported_phone_formats_are_not_guessed(self):
        text, urls, log = self.compile(r"""
\resumecontact{\resumephone{416-555-0123}}
\resumecontact{\resumephone{+1 (416) 555-0123 ext. 4}}
\resumecontact{\resumephone{+1 (416) 555-0123;ext=4}}
\resumecontact{\resumephone{+123456}}
\resumecontact{\resumephone{+1234567890123456}}
\resumecontact{\resumephone{+0123456789}}
\resumecontact{\resumephone{++14165550123}}
\resumecontact{\resumephone{tel:+14165550123}}
\resumecontact{\resumephone{}}
""")
        self.assertIn("416-555-0123", text)
        self.assertIn("ext. 4", text)
        self.assertEqual(urls, [])
        self.assertEqual(contact_warnings(log), ["phone format; contact is not linked."] * 9)

    def test_custom_commands_are_not_expanded(self):
        text, urls, log = self.compile(r"""
\resumecontact{\resumeemail{\privatecommand}}
\resumecontact{\resumephone{\privatecommand}}
""", r"\newcommand{\privatecommand}{\errmessage{Contact value was executed}}")
        self.assertIn("privatecommand", text)
        self.assertNotIn("Contact value was executed", log)
        self.assertEqual(urls, [])
        self.assertEqual(contact_warnings(log), ["email format; contact is not linked.", "phone format; contact is not linked."])

    def test_bracketed_prompts_keep_placeholder_reminders(self):
        _, urls, log = self.compile(r"""
\resumecontact{\resumeemail{[Email]}}
\resumecontact{\resumephone{[Phone]}}
""")
        self.assertEqual(urls, [])
        self.assertEqual(check_placeholders.reminders(log), ["contact details."] * 2)
        self.assertEqual(len(contact_warnings(log)), 2)

    def test_sample_phone_reminders_survive_format_changes(self):
        _, urls, log = self.compile(r"""
\resumecontact{\resumephone{+15555555555}}
\resumecontact{\resumephone{+1.555.555.5555}}
\resumecontact{\resumephone{+1 555 555 5555}}
""")
        self.assertEqual(urls, ["tel:+15555555555"] * 3)
        self.assertEqual(check_placeholders.reminders(log), ["contact details."] * 3)
        self.assertEqual(contact_warnings(log), [])

    def test_custom_links_and_omitted_contacts_still_work(self):
        text, urls, log = self.compile(r"""
\resumecontact{Toronto, ON \contactsep \resumelink{mailto:alex@example.com}{Email}}
\resumecontact{\resumelink{tel:+14165550123;ext=4}{Call my office}}
\resumecontact{Toronto, ON}
""")
        self.assertIn("Call my office", text)
        self.assertEqual(urls, ["mailto:alex@example.com", "tel:+14165550123;ext=4"])
        self.assertEqual(contact_warnings(log), [])


def main():
    missing = [name for name in ("xelatex", "pdftotext", "pdfinfo") if shutil.which(name) is None]
    if missing:
        print("FAIL: missing " + ", ".join(missing) + ". Install XeLaTeX and Poppler and add them to PATH.", file=sys.stderr)
        return 1
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ContactBuildTests)
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
