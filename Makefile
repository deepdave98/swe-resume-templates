.PHONY: all no-internship new-grad experienced preview downloads test test-unit test-pdf-text test-downloads test-starters test-placeholders test-layout test-page-limits clean

LATEXMK := latexmk
PYTHON := python3
BUILD_DIR := build
PREVIEW_DIR := preview
OUTPUT_DIR := output/pdf
NO_INTERNSHIP_SOURCE := templates/no-internship-resume.tex
NEW_GRAD_SOURCE := templates/new-grad-resume.tex
EXPERIENCED_SOURCE := templates/experienced-resume.tex
NEW_GRAD_BUILD_DIR := $(BUILD_DIR)/new-grad
NO_INTERNSHIP_BUILD_DIR := $(BUILD_DIR)/no-internship
EXPERIENCED_BUILD_DIR := $(BUILD_DIR)/experienced

all: no-internship new-grad experienced

no-internship:
	@mkdir -p "$(NO_INTERNSHIP_BUILD_DIR)"
	$(LATEXMK) -xelatex -interaction=nonstopmode -halt-on-error -file-line-error -outdir="$(NO_INTERNSHIP_BUILD_DIR)" "$(NO_INTERNSHIP_SOURCE)"

new-grad:
	@mkdir -p "$(NEW_GRAD_BUILD_DIR)"
	$(LATEXMK) -xelatex -interaction=nonstopmode -halt-on-error -file-line-error -outdir="$(NEW_GRAD_BUILD_DIR)" "$(NEW_GRAD_SOURCE)"

experienced:
	@mkdir -p "$(EXPERIENCED_BUILD_DIR)"
	$(LATEXMK) -xelatex -interaction=nonstopmode -halt-on-error -file-line-error -outdir="$(EXPERIENCED_BUILD_DIR)" "$(EXPERIENCED_SOURCE)"

downloads:
	$(PYTHON) scripts/package_templates.py

test: test-unit test-pdf-text test-downloads test-starters test-placeholders test-layout test-page-limits

test-unit:
	$(PYTHON) -m unittest discover -s tests -p 'test_*.py'

test-pdf-text: all
	$(PYTHON) tests/check_pdf_text.py --no-internship "$(NO_INTERNSHIP_BUILD_DIR)/no-internship-resume.pdf" --new-grad "$(NEW_GRAD_BUILD_DIR)/new-grad-resume.pdf" --experienced "$(EXPERIENCED_BUILD_DIR)/experienced-resume.pdf"
	$(PYTHON) tests/check_pdf_text.py --no-internship "$(OUTPUT_DIR)/no-internship-resume.pdf" --new-grad "$(OUTPUT_DIR)/new-grad-resume.pdf" --experienced "$(OUTPUT_DIR)/experienced-resume.pdf"

test-downloads:
	$(PYTHON) scripts/package_templates.py --check

test-starters: test-downloads
	$(PYTHON) tests/check_starter_builds.py

test-placeholders:
	$(PYTHON) tests/check_placeholders.py

test-layout:
	$(PYTHON) tests/check_layout.py

test-page-limits:
	$(PYTHON) tests/check_page_limits.py

preview: all
	@mkdir -p "$(PREVIEW_DIR)" "$(OUTPUT_DIR)"
	cp "$(NO_INTERNSHIP_BUILD_DIR)/no-internship-resume.pdf" "$(OUTPUT_DIR)/no-internship-resume.pdf"
	cp "$(NEW_GRAD_BUILD_DIR)/new-grad-resume.pdf" "$(OUTPUT_DIR)/new-grad-resume.pdf"
	cp "$(EXPERIENCED_BUILD_DIR)/experienced-resume.pdf" "$(OUTPUT_DIR)/experienced-resume.pdf"
	@if command -v pdftoppm >/dev/null 2>&1; then \
		pdftoppm -png -singlefile -f 1 -l 1 -r 180 "$(NO_INTERNSHIP_BUILD_DIR)/no-internship-resume.pdf" "$(PREVIEW_DIR)/no-internship-resume"; \
		pdftoppm -png -singlefile -f 1 -l 1 -r 180 "$(NEW_GRAD_BUILD_DIR)/new-grad-resume.pdf" "$(PREVIEW_DIR)/new-grad-resume"; \
		pdftoppm -png -singlefile -f 1 -l 1 -r 180 "$(EXPERIENCED_BUILD_DIR)/experienced-resume.pdf" "$(PREVIEW_DIR)/experienced-resume-page-1"; \
		pdftoppm -png -singlefile -f 2 -l 2 -r 180 "$(EXPERIENCED_BUILD_DIR)/experienced-resume.pdf" "$(PREVIEW_DIR)/experienced-resume-page-2"; \
	elif command -v magick >/dev/null 2>&1; then \
		magick -density 180 "$(NO_INTERNSHIP_BUILD_DIR)/no-internship-resume.pdf[0]" -background white -alpha remove -strip "$(PREVIEW_DIR)/no-internship-resume.png"; \
		magick -density 180 "$(NEW_GRAD_BUILD_DIR)/new-grad-resume.pdf[0]" -background white -alpha remove -strip "$(PREVIEW_DIR)/new-grad-resume.png"; \
		magick -density 180 "$(EXPERIENCED_BUILD_DIR)/experienced-resume.pdf[0]" -background white -alpha remove -strip "$(PREVIEW_DIR)/experienced-resume-page-1.png"; \
		magick -density 180 "$(EXPERIENCED_BUILD_DIR)/experienced-resume.pdf[1]" -background white -alpha remove -strip "$(PREVIEW_DIR)/experienced-resume-page-2.png"; \
	else \
		echo "Install Poppler or ImageMagick to generate the PNG previews."; \
		exit 1; \
	fi

clean:
	$(LATEXMK) -C -outdir="$(NO_INTERNSHIP_BUILD_DIR)" "$(NO_INTERNSHIP_SOURCE)"
	$(LATEXMK) -C -outdir="$(NEW_GRAD_BUILD_DIR)" "$(NEW_GRAD_SOURCE)"
	$(LATEXMK) -C -outdir="$(EXPERIENCED_BUILD_DIR)" "$(EXPERIENCED_SOURCE)"
