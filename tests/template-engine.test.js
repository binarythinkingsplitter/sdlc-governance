import { test, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  create_template_engine,
  BUILTIN_HELPERS,
  create_document_builder,
  create_document_entity_store,
  export_documents_from_store,
  generate_code_snippet,
  DocumentEntityTypes
} from '../src/index.js';

const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp_export_dir = path.join(package_root, 'tests', 'tmp_template_exports');

function clean_tmp() {
  if (fs.existsSync(tmp_export_dir)) {
    fs.rmSync(tmp_export_dir, { recursive: true, force: true });
  }
}

beforeEach(clean_tmp);
afterAll(clean_tmp);

test('template-engine: interpolates variables with dot notation and array indexing', () => {
  const engine = create_template_engine();
  const template = 'hello {{user.name}}, your role is {{user.roles.0}}!';
  const result = engine.render(template, {
    user: {
      name: 'autonomous swe',
      roles: ['developer', 'architect']
    }
  });

  assert.equal(result, 'hello autonomous swe, your role is developer!');
});

test('template-engine: evaluates conditionals with if, else, and unless blocks', () => {
  const engine = create_template_engine();
  const template = '{{#if is_admin}}admin access{{else}}standard user{{/if}} | {{#unless is_admin}}restricted{{else}}unrestricted{{/unless}}';

  const res_admin = engine.render(template, { is_admin: true });
  assert.equal(res_admin, 'admin access | unrestricted');

  const res_user = engine.render(template, { is_admin: false });
  assert.equal(res_user, 'standard user | restricted');
});

test('template-engine: iterates collections with each loops and loop metadata', () => {
  const engine = create_template_engine();
  const template = '{{#each items}}[{{@number}}/{{@index}}: {{this}}{{#if @first}} (first){{/if}}{{#if @last}} (last){{/if}}]{{/each}}';

  const result = engine.render(template, { items: ['red', 'green', 'refactor'] });
  assert.equal(result, '[1/0: red (first)][2/1: green][3/2: refactor (last)]');
});

test('template-engine: executes built-in helpers and pipeline filters', () => {
  const engine = create_template_engine();
  const template = '{{title | uppercase}} | {{slug | snake_case}} | {{num | pad_start 3 "0"}} | {{join tags ", "}}';

  const result = engine.render(template, {
    title: 'macro statechart',
    slug: 'macro-statechart-engine',
    num: 7,
    tags: ['tdd', 'immutability', 'sdlc']
  });

  assert.equal(result, 'MACRO STATECHART | macro_statechart_engine | 007 | tdd, immutability, sdlc');
});

test('template-engine: supports custom helper and partial registration', () => {
  const engine = create_template_engine();
  engine.register_helper('embrace', (val) => `<< ${val} >>`);
  engine.register_partial('footer', '\n---\nauthored by {{author}}');

  const template = '{{embrace title}}{{> footer}}';
  const result = engine.render(template, { title: 'sdlc harness', author: 'deepmind' });

  assert.equal(result, '<< sdlc harness >>\n---\nauthored by deepmind');
});

test('template-engine: loads canonical document templates from templates directory', () => {
  const engine = create_template_engine();
  const prd_entity = {
    id: 'prd-01',
    slug: 'dual_engine',
    title: 'coupled dual engine harness',
    status: 'approved',
    author: 'systems architect',
    date: '2026-11-03',
    system_component: '@sdlc/dual-engine-harness',
    executive_summary: {
      vision: 'macro-micro separation',
      problem: 'agent drift',
      strategic_context: 'sdlc development',
      primary_objectives: ['provable phase transitions']
    },
    target_audience: [
      { id: 'swe', role: 'software engineer', description: 'developer', responsibilities: ['write code'] }
    ],
    functional_requirements: [
      { id: 'fr-01', title: 'state machine', priority: 'must_have', status: 'approved', description: 'xstate engine' }
    ],
    non_functional_requirements: {
      performance: 'p95 < 50ms',
      immutability: 'zero reduction in test assertions',
      sovereignty: 'zero daemons',
      style: 'strictly lowercase british english'
    },
    scope_boundaries: {
      in_scope: ['core harness'],
      out_of_scope: ['legacy services']
    }
  };

  const rendered_doc = engine.render_document('prd', prd_entity);
  assert.ok(rendered_doc.includes('# coupled dual engine harness'));
  assert.ok(rendered_doc.includes('**document id:** `prd-01`'));
  assert.ok(rendered_doc.includes('### vision\nmacro-micro separation'));
  assert.ok(rendered_doc.includes('### fr-01: state machine'));
});

test('template-engine: drives code snippet generation for test suites and factory functions', () => {
  const engine = create_template_engine();

  // 1. generate test suite from user story
  const story_entity = {
    id: 'story-01',
    slug: 'macro_statechart',
    title: 'macro statechart lifecycle enforcement',
    linked_prd_id: 'prd-01',
    status: 'approved',
    acceptance_criteria: [
      {
        id: 'ac-01',
        scenario: 'reject invalid transition',
        given: ['harness in phase 00'],
        when: ['phase 03 transition requested'],
        then: ['invariant violation error is thrown'],
        and: ['state remains in phase 00']
      }
    ]
  };

  const test_code = engine.generate_code('test_suite', story_entity);
  assert.ok(test_code.includes("test.describe('macro_statechart: acceptance criteria verification'"));
  assert.ok(test_code.includes("test('ac-01: reject invalid transition'"));
  assert.ok(test_code.includes('// - harness in phase 00'));
  assert.ok(test_code.includes('// - invariant violation error is thrown'));

  // 2. generate factory function from interface
  const interface_entity = {
    slug: 'task_dag_runner',
    component: 'task_dag_runner',
    version: '0.1.0',
    description: 'deterministic task dependency resolver',
    methods: [
      {
        name: 'sort_nodes',
        description: 'sorts task nodes in topological order',
        parameters: [{ name: 'dag' }]
      }
    ]
  };

  const factory_code = engine.generate_code('factory_function', interface_entity);
  assert.ok(factory_code.includes('export function create_task_dag_runner(options = {})'));
  assert.ok(factory_code.includes('sort_nodes(dag)'));
  assert.ok(factory_code.includes('section: version number\n * version: 0.1.0'));
});

test('document-builder: supports use_template directly on builder instance', () => {
  const builder = create_document_builder('generic', 'custom-doc');
  const rendered = builder.use_template('hello {{title | uppercase}}', { title: 'document builder' });

  assert.equal(rendered, 'hello DOCUMENT BUILDER');
});

test('document-store: exports documents to filesystem using templates', () => {
  const store = create_document_entity_store({ store_root: path.join(tmp_export_dir, 'store') });

  store.save_entity(DocumentEntityTypes.PRD, {
    id: 'prd-01',
    slug: 'test_feature',
    title: 'test feature prd',
    status: 'approved',
    functional_requirements: [
      { id: 'fr-01', title: 'core req', priority: 'must_have', status: 'approved', description: 'desc' }
    ]
  });

  store.save_entity(DocumentEntityTypes.USER_STORY, {
    id: 'story-01',
    slug: 'test_story',
    title: 'test feature story',
    linked_prd_id: 'prd-01',
    epic: 'epic test',
    acceptance_criteria: [
      { id: 'ac-01', scenario: 'test scenario', given: ['given test'], when: ['when test'], then: ['then test'], and: [] }
    ]
  });

  const export_receipt = store.export_documents({ target_dir: path.join(tmp_export_dir, 'docs') });
  assert.ok(export_receipt.exported_count >= 2);
  assert.ok(export_receipt.files.some((f) => f.includes('01-product')));
  assert.ok(export_receipt.files.some((f) => f.includes('05-work-breakdown')));

  // verify file content on disk
  const prd_file = export_receipt.files.find((f) => f.includes('prd-01'));
  const prd_content = fs.readFileSync(prd_file, 'utf-8');
  assert.ok(prd_content.includes('# test feature prd'));
  assert.ok(prd_content.includes('**document id:** `prd-01`'));
});

test('document-store: generates code snippet file from stored entity', () => {
  const store = create_document_entity_store({ store_root: path.join(tmp_export_dir, 'store') });

  store.save_entity(DocumentEntityTypes.USER_STORY, {
    id: 'story-02',
    slug: 'api_rate_limiter',
    title: 'api rate limiter',
    linked_prd_id: 'prd-02',
    status: 'approved',
    acceptance_criteria: [
      { id: 'ac-01', scenario: 'throttle on limit', given: ['100 requests'], when: ['101st received'], then: ['return 429'], and: [] }
    ]
  });

  const target_code_file = path.join(tmp_export_dir, 'generated_tests', 'rate-limiter.test.js');
  const result = store.generate_code_snippet('user_story', 'story-02', 'test_suite', {
    target_file: target_code_file
  });

  assert.equal(result.path, target_code_file);
  assert.ok(fs.existsSync(target_code_file));
  const saved_code = fs.readFileSync(target_code_file, 'utf-8');
  assert.ok(saved_code.includes("test.describe('api_rate_limiter: acceptance criteria verification'"));
  assert.ok(saved_code.includes('throttle on limit'));
});

test('template-engine: switches between handlebars and builtin adapters seamlessly', () => {
  const engine = create_template_engine({ adapter: 'handlebars' });
  assert.equal(engine.get_adapter().name, 'handlebars');

  const template = 'hello {{user | uppercase}}, count is {{count | pad_start 3 "0"}}!';
  const data = { user: 'developer', count: 5 };

  const hb_output = engine.render(template, data);
  assert.equal(hb_output, 'hello DEVELOPER, count is 005!');

  // switch to builtin adapter
  engine.set_adapter('builtin');
  assert.equal(engine.get_adapter().name, 'builtin');

  const builtin_output = engine.render(template, data);
  assert.equal(builtin_output, 'hello DEVELOPER, count is 005!');

  // verify equivalence
  assert.equal(hb_output, builtin_output);
});
