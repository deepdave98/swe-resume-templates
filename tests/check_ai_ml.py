#!/usr/bin/env python3
"""Compile the AI/ML starters and the documented student/research adaptations."""

from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import check_application_versions
import check_contacts
import check_pdf_text
import check_placeholders


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ("ai-engineer", "ml-engineer")
CONTACTS = [
    "tel:+15555555555", "mailto:hello@example.com",
    "https://www.linkedin.com/in/your-handle", "https://github.com/your-handle",
]


class RoleTemplateTests(unittest.TestCase):
    def compile(self, source, paper):
        with tempfile.TemporaryDirectory(prefix="resume-ai-ml-") as temporary:
            project = Path(temporary) / "project with spaces"
            project.mkdir()
            shutil.copyfile(ROOT / "resume.cls", project / "resume.cls")
            (project / "resume.tex").write_text(source, encoding="utf-8")
            result = subprocess.run(
                [shutil.which("latexmk"), "-xelatex", "-interaction=nonstopmode",
                 "-halt-on-error", "-file-line-error", "resume.tex"],
                cwd=project, capture_output=True, encoding="utf-8", errors="replace", timeout=180,
            )
            self.assertEqual(result.returncode, 0, "\n".join(result.stdout.splitlines()[-40:]))
            log = (project / "resume.log").read_text(encoding="utf-8")
            self.assertNotIn("Overfull ", log)
            self.assertNotIn("Page limit exceeded", log)
            pdf = project / "resume.pdf"
            text = check_pdf_text.extract_text(pdf)
            self.assertEqual(len(check_pdf_text.split_pages(text)), 1)
            # This full-document check accounts for the class's large name font;
            # the entry-only layout fixture assumes body-size text throughout.
            check_application_versions.check_bounds(pdf, paper)
            self.assertEqual(check_contacts.extract_urls(pdf), CONTACTS)
            return text, log

    def source(self, template, paper):
        source = (ROOT / "templates" / f"{template}-resume.tex").read_text(encoding="utf-8")
        self.assertEqual(source.count(r"\documentclass{resume}"), 1)
        return source.replace(r"\documentclass{resume}", "\\documentclass[" + paper + "]{resume}")

    def test_starters_on_letter_and_a4(self):
        for template in TEMPLATES:
            for paper in ("letterpaper", "a4paper"):
                with self.subTest(template=template, paper=paper):
                    text, log = self.compile(self.source(template, paper), paper)
                    for location in ("resume name.", "contact details.", "entry 1 bullets.", "skills bullets."):
                        self.assertIn(location, check_placeholders.reminders(log))
                    sections = [text.index(title) for title in ("Experience", "Projects", "Skills", "Education")]
                    self.assertEqual(sections, sorted(sections))
                    self.assertNotIn("Research", text)
                    self.assertNotIn("Publications", text)

    def test_education_and_projects_can_move_first(self):
        for template in TEMPLATES:
            for paper in ("letterpaper", "a4paper"):
                with self.subTest(template=template, paper=paper):
                    source = self.source(template, paper)
                    header, rest = source.split(r"\section{Experience}", 1)
                    experience, rest = rest.split(r"\section{Projects}", 1)
                    projects, rest = rest.split(r"\section{Skills}", 1)
                    skills, rest = rest.split(r"\section{Education}", 1)
                    education, end = rest.split(r"\end{document}", 1)
                    reordered = (header + r"\section{Education}" + education
                                 + r"\section{Projects}" + projects
                                 + r"\section{Experience}" + experience
                                 + r"\section{Skills}" + skills + r"\end{document}" + end)
                    text, _ = self.compile(reordered, paper)
                    sections = [text.index(title) for title in ("Education", "Projects", "Experience", "Skills")]
                    self.assertEqual(sections, sorted(sections))

    def test_documented_research_block_replaces_project(self):
        guide = (ROOT / "docs/ai-ml-resumes.md").read_text(encoding="utf-8")
        blocks = re.findall(r"```latex\n(.*?)\n```", guide, re.S)
        self.assertEqual(len(blocks), 1)
        for paper in ("letterpaper", "a4paper"):
            with self.subTest(paper=paper):
                source = self.source("ml-engineer", paper)
                before, rest = source.split(r"\section{Projects}", 1)
                _, after = rest.split(r"\section{Skills}", 1)
                text, log = self.compile(before + blocks[0] + "\n" + r"\section{Skills}" + after, paper)
                self.assertIn("Research", text)
                self.assertIn("[Actual research role]", text)
                self.assertNotIn("Projects", text)
                self.assertTrue(check_placeholders.reminders(log))


def main():
    missing = [name for name in ("latexmk", "xelatex", "pdftotext", "pdfinfo") if shutil.which(name) is None]
    if missing:
        print("FAIL: missing " + ", ".join(missing) + ". Install XeLaTeX, latexmk, and Poppler.", file=sys.stderr)
        return 1
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RoleTemplateTests)
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
