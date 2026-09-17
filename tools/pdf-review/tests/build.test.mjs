import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';

// Resolve from this file explicitly, not from the caller's working directory.
const output = new URL('../../../downloads/pdf-review.html', import.meta.url);
const page = await readFile(output, 'utf8');

test('the downloadable ZIP contains exactly the self-contained page', async () => {
  const zip = unzipSync(await readFile(new URL('../../../downloads/pdf-review.zip', import.meta.url)));
  assert.deepEqual(Object.keys(zip), ['pdf-review.html']);
  assert.equal(new TextDecoder().decode(zip['pdf-review.html']), page);
});

test('CSP hashes match the exact inline script and stylesheet', () => {
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const styles = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  assert.equal(scripts.length, 1);
  assert.equal(styles.length, 1);
  for (const [, content] of [...scripts, ...styles]) {
    const hash = createHash('sha256').update(content).digest('base64');
    assert.ok(page.includes(`'sha256-${hash}'`));
  }
  assert.ok(!page.includes('<!-- APP_SCRIPT -->'));
  assert.ok(!page.includes('<!-- APP_CSP -->'));
});

test('policy blocks connections, external code, plugins, and form submission', () => {
  const policy = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  for (const directive of ["default-src 'none'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", 'worker-src blob:']) assert.ok(policy.includes(directive));
  assert.ok(!policy.includes("'unsafe-eval'"));
  assert.ok(!policy.includes("'unsafe-inline'"));
  assert.ok(!policy.includes('https:'));
  assert.ok(!/<script[^>]+src=|<link[^>]+rel="stylesheet"|<iframe|<object/i.test(page));
});

test('app and third-party licenses travel inside the offline download', () => {
  for (const phrase of ['Copyright (c) 2026 deepdave98', 'Apache License', 'LICENSE_FOXIT', 'LICENSE_LIBERATION', 'LICENSE_OPENJPEG', 'LICENSE_JBIG2']) assert.ok(page.includes(phrase));
});
