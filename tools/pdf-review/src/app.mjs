import { getDocument, PDFWorker, AnnotationMode, PasswordResponses } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { reviewDocument, displayDestination } from './review.mjs';

const assets = __PDF_ASSETS__;
class EmbeddedBinaryDataFactory {
  async fetch({ kind, filename }) {
    const encoded = Object.hasOwn(assets, kind) && Object.hasOwn(assets[kind], filename) && assets[kind][filename];
    if (!encoded) throw new Error('A required built-in PDF resource is unavailable.');
    return Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  }
}

const byId = id => document.getElementById(id);
const ui = Object.fromEntries(['pdf-file', 'drop-zone', 'clear-file', 'status', 'error', 'review', 'filename', 'summary', 'pages', 'copy-all', 'all-text', 'password-form', 'password', 'cancel-password'].map(id => [id, byId(id)]));
let generation = 0;
let current;
let submitPassword;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 20;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function dispose(state) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallback);
    state.worker?.destroy();
    state.port?.terminate();
    if (state.workerUrl) URL.revokeObjectURL(state.workerUrl);
  };
  const fallback = setTimeout(finish, 5000);
  // Let the browser finish starting its worker before terminating it. Firefox
  // can crash a tab if termination races startup and PDF data transfer.
  void Promise.resolve(state.ready).catch(() => {}).then(() => state.loading?.destroy()).catch(() => {}).finally(finish);
}

function clearReview(message = '') {
  generation += 1;
  const old = current;
  current = null;
  submitPassword = null;
  if (old) {
    clearTimeout(old.timer);
    old.controller.abort();
    old.render?.cancel();
    // An explicit PDFWorker port is owned by this app, not by PDF.js.
    dispose(old);
  }
  for (const canvas of ui.pages.querySelectorAll('canvas')) canvas.width = canvas.height = 0;
  ui.pages.replaceChildren();
  ui['all-text'].value = '';
  ui['pdf-file'].value = '';
  ui.password.value = '';
  ui['password-form'].hidden = true;
  ui.review.hidden = true;
  ui.filename.textContent = '';
  ui.summary.textContent = '';
  ui.error.textContent = '';
  ui.error.hidden = true;
  ui.status.textContent = message;
  ui['copy-all'].disabled = true;
}

function fail(message) {
  clearReview();
  ui.error.textContent = message;
  ui.error.hidden = false;
}

function armTimeout(state) {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    if (current === state) fail('This PDF took too long to process. Try a smaller export or review it in your PDF reader.');
  }, 90_000);
}

async function copyText(textarea) {
  const token = generation;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(textarea.value);
    if (generation === token) ui.status.textContent = 'Text copied. Check the spacing before pasting.';
  } catch {
    if (generation !== token) return;
    textarea.closest('details')?.setAttribute('open', '');
    textarea.focus();
    textarea.select();
    ui.status.textContent = 'Text selected. Press Ctrl+C or Command+C to copy.';
  }
}

function showPage(record) {
  const card = element('section', 'page-card');
  const heading = element('div', 'page-heading');
  heading.append(element('h3', '', `Page ${record.number}`));
  const badge = element('span', 'badge', 'Checking preview…');
  heading.append(badge);
  const layout = element('div', 'page-layout');
  const preview = element('div', 'page-preview');
  const canvas = element('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Rendered PDF page ${record.number}. Extracted text follows.`);
  preview.append(canvas);
  const content = element('div', 'page-content');
  const toolbar = element('div', 'text-toolbar');
  const label = element('label', '', 'Extracted text');
  label.htmlFor = `page-text-${record.number}`;
  const copy = element('button', 'button button--small', 'Copy page text');
  copy.type = 'button';
  copy.disabled = !record.hasText;
  const textarea = element('textarea', 'page-text');
  textarea.id = label.htmlFor;
  textarea.readOnly = true;
  textarea.spellcheck = false;
  textarea.rows = 14;
  textarea.value = record.text;
  copy.addEventListener('click', () => void copyText(textarea));
  toolbar.append(label, copy);
  content.append(toolbar, textarea);
  for (const warning of record.warnings) content.append(element('p', 'notice notice--warning', warning.message));
  const links = element('section', 'page-links');
  links.append(element('h4', '', 'Actual link destinations'));
  if (!record.links.length && record.linksStatus === 'ok') links.append(element('p', 'field-hint', 'No link annotations found. Printed URLs may still appear in the text.'));
  else {
    links.append(element('p', 'field-hint', 'Shown as text, never opened or checked online. Compare these with the labels on the page.'));
    const list = element('ul', 'link-list');
    for (const link of record.links) {
      const item = element('li');
      const type = link.type === 'external' ? link.destination.startsWith('mailto:') ? 'Email' : link.destination.startsWith('tel:') ? 'Phone' : 'External link' : link.type;
      item.append(element('span', 'link-type', type), element('code', 'link-destination', displayDestination(link.destination)));
      if (link.resolvedDestination && link.resolvedDestination !== link.destination) {
        item.append(element('p', 'field-hint', 'PDF reader resolves this to:'), element('code', 'link-destination', displayDestination(link.resolvedDestination)));
      }
      if (link.reason) item.append(element('p', 'field-hint', link.reason));
      list.append(item);
    }
    links.append(list);
  }
  content.append(links);
  layout.append(preview, content);
  card.append(heading, layout);
  ui.pages.append(card);
  return { canvas, badge, preview };
}

// This is a conservative visual hint, not proof that a PDF has no content.
function appearsBlank(context, width, height) {
  const { data } = context.getImageData(0, 0, width, height);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return false;
  }
  return true;
}

async function openFile(file) {
  clearReview();
  if (!file) return;
  if (!file.size) return fail('This file is empty. Choose a finished PDF.');
  if (file.size > MAX_BYTES) return fail('Choose a PDF under 20 MB. Larger files can use too much browser memory.');
  const token = generation;
  const state = { controller: new AbortController() };
  current = state;
  armTimeout(state);
  ui.review.hidden = false;
  ui.filename.textContent = file.name;
  ui.status.textContent = 'Opening your PDF locally…';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (token !== generation) return;
    if (!new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-')) {
      return fail('This does not look like a PDF. Export your resume as a PDF, then try again.');
    }
    state.workerUrl = URL.createObjectURL(new Blob([__WORKER_SOURCE__], { type: 'text/javascript' }));
    state.port = new Worker(state.workerUrl);
    state.ready = new Promise((resolve, reject) => {
      state.port.addEventListener('message', event => {
        if (event.data?.resumeReviewWorkerReady) resolve();
      });
      state.port.addEventListener('error', () => reject(new Error('Worker unavailable')), { once: true });
    });
    state.port.addEventListener('error', event => {
      event.preventDefault();
      if (token === generation) fail('The PDF worker could not start. Try opening the downloaded page in a current browser.');
    });
    await state.ready;
    if (token !== generation) return;
    state.worker = PDFWorker.create({ port: state.port });
    state.loading = getDocument({
      data: bytes,
      worker: state.worker,
      BinaryDataFactory: EmbeddedBinaryDataFactory,
      useWorkerFetch: false,
      useWasm: true,
      cMapPacked: true,
      enableXfa: false,
      stopAtErrors: true,
      maxImageSize: 16_000_000,
      canvasMaxAreaInBytes: 16_000_000,
      verbosity: 0,
    });
    state.loading.onPassword = (updatePassword, reason) => {
      if (token !== generation) return;
      clearTimeout(state.timer);
      ui['password-form'].hidden = false;
      ui.status.textContent = reason === PasswordResponses.INCORRECT_PASSWORD ? 'That password did not open the PDF. Try again or cancel.' : 'Enter the PDF password. It stays on this device.';
      submitPassword = value => {
        if (token !== generation) return;
        ui['password-form'].hidden = true;
        ui.password.value = '';
        armTimeout(state);
        updatePassword(value);
      };
      ui.password.focus();
    };
    const pdf = await state.loading.promise;
    if (token !== generation) return;
    if (pdf.numPages > MAX_PAGES) return fail('This PDF has more than 20 pages. Choose just the resume pages to review.');
    ui.status.textContent = 'Reading text and link destinations…';
    const result = await reviewDocument(pdf, { signal: state.controller.signal });
    if (token !== generation) return;
    ui['all-text'].value = result.text;
    ui['copy-all'].disabled = !result.text.trim();
    let blank = 0;
    let noText = 0;
    let failed = 0;
    for (const record of result.pages) {
      if (token !== generation) return;
      const display = showPage(record);
      if (record.textStatus === 'empty') noText += 1;
      ui.status.textContent = `Rendering page ${record.number} of ${result.pageCount}…`;
      try {
        const page = await pdf.getPage(record.number);
        if (token !== generation) return;
        const size = page.getViewport({ scale: 1 });
        if (![size.width, size.height].every(value => Number.isFinite(value) && value > 0 && value <= 14400)) throw new Error('Unsupported page size');
        const scale = Math.min(1.5, 1200 / size.width, 2000 / size.height, Math.sqrt(900_000 / (size.width * size.height)));
        const viewport = page.getViewport({ scale });
        display.canvas.width = Math.ceil(viewport.width);
        display.canvas.height = Math.ceil(viewport.height);
        const context = display.canvas.getContext('2d', { willReadFrequently: true });
        const rendering = page.render({ canvasContext: context, viewport, background: '#ffffff', annotationMode: AnnotationMode.ENABLE });
        state.render = rendering;
        try { await rendering.promise; }
        finally { if (state.render === rendering) state.render = null; }
        if (token !== generation) return;
        const empty = appearsBlank(context, display.canvas.width, display.canvas.height);
        if (empty) blank += 1;
        display.badge.textContent = record.textStatus === 'error' ? 'Text extraction needs manual review' : record.textStatus === 'limited' ? 'Text review is incomplete' : empty ? 'Appears blank — inspect this page' : record.hasText ? 'Text extracted' : 'No extractable text — may be a scan';
        if (empty || !record.hasText) display.badge.classList.add('badge--warning');
        page.cleanup();
      } catch {
        if (token !== generation) return;
        failed += 1;
        display.canvas.width = display.canvas.height = 0;
        display.canvas.remove();
        display.preview.append(element('p', 'notice notice--warning', 'Preview unavailable. This page was not checked for blankness. Open it in your PDF reader.'));
        display.badge.textContent = 'Preview needs manual review';
        display.badge.classList.add('badge--warning');
      }
    }
    if (token !== generation) return;
    const count = result.pageCount;
    ui.summary.textContent = `${count} ${count === 1 ? 'page' : 'pages'} · ${result.pages.reduce((sum, page) => sum + page.links.length, 0)} link annotations · ${noText} without extracted text · ${blank} appear blank${failed ? ` · ${failed} previews unavailable` : ''}`;
    for (const warning of result.warnings) ui.pages.prepend(element('p', 'notice notice--warning', warning.message));
    clearTimeout(state.timer);
    ui.status.textContent = 'Review ready.';
  } catch {
    if (token === generation) fail('This PDF could not be read. It may be damaged, unsupported, or blocked by this browser. Try a fresh PDF export or a current browser.');
  }
}

ui['pdf-file'].addEventListener('change', event => void openFile(event.target.files[0]));
ui['clear-file'].addEventListener('click', () => { clearReview('Review cleared.'); ui['pdf-file'].focus(); });
ui['copy-all'].addEventListener('click', () => void copyText(ui['all-text']));
ui['password-form'].addEventListener('submit', event => {
  event.preventDefault();
  const value = ui.password.value;
  ui.password.value = '';
  submitPassword?.(value);
});
ui['cancel-password'].addEventListener('click', () => clearReview('Review cancelled.'));
for (const type of ['dragover', 'drop']) {
  window.addEventListener(type, event => event.preventDefault());
}
ui['drop-zone'].addEventListener('dragover', () => ui['drop-zone'].classList.add('is-dragging'));
ui['drop-zone'].addEventListener('dragleave', () => ui['drop-zone'].classList.remove('is-dragging'));
ui['drop-zone'].addEventListener('drop', event => {
  ui['drop-zone'].classList.remove('is-dragging');
  if (event.dataTransfer.files.length !== 1) return fail('Choose one PDF at a time.');
  void openFile(event.dataTransfer.files[0]);
});
window.addEventListener('pagehide', () => clearReview());
const notices = element('details', 'privacy-details');
notices.append(element('summary', '', 'PDF engine and licenses'), element('pre', 'license-text', __THIRD_PARTY_LICENSES__));
document.querySelector('footer').before(notices);
clearReview();
