/**
 * =========================================================================
 * test: document-builder.test.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test suite for code-driven template-backed document builder
 * verbose: verifies fluent document creation, unbroken section chaining,
 * template layouts (prd, adr, threat_model), markdown rendering, and safe filesystem persistence.
 * 
 * section: example
 * node --test packages/sdlc/packages/dual-engine-harness/tests/document-builder.test.js
 * =========================================================================
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  create_document_builder,
  chunk_markdown_sections,
  prd,
  adr,
  threat_model,
  test_report,
  release,
  retrospective,
  doc
} from '../src/DocumentBuilder.js';

const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('document-builder: supports exact user fluent chaining pattern', () => {
  // exact pattern requested by user:
  // prd.create("helloworld").title("helloworld").description("helloworld").section.create("helloworld").heading("helloworld").contents("hellworld")
  const built = prd.create('helloworld')
    .title('helloworld')
    .description('helloworld')
    .section.create('helloworld')
    .heading('helloworld')
    .contents('hellworld');

  const rendered = built.render();
  assert.ok(rendered.includes('# helloworld'));
  assert.ok(rendered.includes('helloworld'));
  assert.ok(rendered.includes('hellworld'));
  assert.ok(rendered.includes('## 1. helloworld'));
});

test('document-builder: supports unbroken multi-section chaining', () => {
  const rendered = prd.create('feature_x')
    .title('feature x specifications')
    .description('core product specifications for feature x')
    .section.create('problem')
    .heading('problem statement')
    .contents('users currently lack automation.')
    .section.create('scope')
    .heading('scope & boundaries')
    .contents('includes cli and rest api.')
    .section.create('criteria')
    .heading('acceptance criteria')
    .contents('given valid input when executed then succeed.')
    .render();

  assert.ok(rendered.includes('# feature x specifications'));
  assert.ok(rendered.includes('## 1. problem statement'));
  assert.ok(rendered.includes('users currently lack automation.'));
  assert.ok(rendered.includes('## 2. scope & boundaries'));
  assert.ok(rendered.includes('includes cli and rest api.'));
  assert.ok(rendered.includes('## 3. acceptance criteria'));
});

test('document-builder: renders tables, code blocks, and bullet lists', () => {
  const rendered = doc.create('technical_spec')
    .title('technical architecture specification')
    .section.create('data')
    .heading('schema definition')
    .table(['field', 'type', 'description'], [
      ['id', 'string', 'unique identifier'],
      ['count', 'number', 'total occurrences']
    ])
    .code('javascript', 'const answer = 42;')
    .list(['first requirement', 'second requirement'])
    .render();

  assert.ok(rendered.includes('| field | type | description |'));
  assert.ok(rendered.includes('| id | string | unique identifier |'));
  assert.ok(rendered.includes('```javascript\nconst answer = 42;\n```'));
  assert.ok(rendered.includes('- first requirement'));
  assert.ok(rendered.includes('- second requirement'));
});

test('document-builder: adr template renders context decision consequences', () => {
  const rendered = adr.create('adr_099')
    .title('adr-099: pure piumarta document builder')
    .status('accepted')
    .section.create('context')
    .heading('context & problem statement')
    .contents('we need functional document synthesis.')
    .section.create('decision')
    .heading('architectural decision')
    .contents('we use fluent functional builders.')
    .section.create('consequences')
    .heading('consequences & trade-offs')
    .contents('clean code and standard formats.')
    .render();

  assert.ok(rendered.includes('# adr-099: pure piumarta document builder'));
  assert.ok(rendered.includes('**status:** accepted'));
  assert.ok(rendered.includes('## 1. context & problem statement'));
  assert.ok(rendered.includes('## 2. architectural decision'));
  assert.ok(rendered.includes('## 3. consequences & trade-offs'));
});

test('document-builder: saves document to disk and enforces workspace boundaries', () => {
  const tmp_dir = path.join(package_root, 'tests', 'tmp_docs');
  const target_file = path.join(tmp_dir, 'prd-sample.md');

  const builder = prd.create('sample')
    .title('sample prd')
    .description('sample description')
    .section.create('sec1')
    .heading('first section')
    .contents('sample content');

  const res = builder.save(target_file);
  assert.equal(res.saved, true);
  assert.ok(fs.existsSync(target_file));

  const content = fs.readFileSync(target_file, 'utf-8');
  assert.ok(content.includes('# sample prd'));

  // cleanup
  fs.unlinkSync(target_file);
  fs.rmdirSync(tmp_dir);

  // verify path traversal rejection
  assert.throws(() => {
    builder.save('/etc/forbidden_document.md');
  }, /security_violation/);
});

test('document-builder: chunks rendered markdown by ## section headings with preserved metadata', () => {
  const rendered = prd.create('rag_spec')
    .title('hybrid rag specification')
    .document_id('prd-10')
    .status('approved')
    .description('hybrid dense and bm25 retrieval')
    .section.create('indexing')
    .heading('indexing pipeline')
    .contents('parses json entities and markdown sections.')
    .section.create('fusion')
    .heading('reciprocal rank fusion')
    .contents('combines cosine similarity with bm25 lexical scores.')
    .render();

  const chunks = chunk_markdown_sections(rendered, {
    doc_id: 'prd-10',
    phase: '01-product',
    linked_prd_id: 'prd-10'
  });

  assert.ok(Array.isArray(chunks));
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.some((c) => c.section_heading.includes('indexing pipeline') && c.text.includes('parses json entities')));
  assert.ok(chunks.some((c) => c.section_heading.includes('reciprocal rank fusion') && c.text.includes('cosine similarity')));
  for (let i = 0; i < chunks.length; i += 1) {
    assert.equal(chunks[i].metadata.doc_id, 'prd-10');
    assert.equal(chunks[i].metadata.phase, '01-product');
  }
});
