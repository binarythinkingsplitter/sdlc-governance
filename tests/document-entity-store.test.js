import { test, beforeEach, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DocumentEntityTypes,
  validate_document_entity,
  get_schema_for_type,
  create_filestore_adapter,
  create_document_entity_store,
  migrate_all_documents,
  parse_prd_markdown,
  parse_story_markdown,
  parse_adr_markdown
} from '../src/index.js';

const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp_test_store = path.join(package_root, 'tests', 'tmp_entity_store');

function clean_tmp_dir() {
  if (fs.existsSync(tmp_test_store)) {
    fs.rmSync(tmp_test_store, { recursive: true, force: true });
  }
}

beforeEach(clean_tmp_dir);
afterAll(clean_tmp_dir);

test('document-entity-schema: validates complete prd entity schema', () => {
  const prd_data = {
    id: 'prd-01',
    slug: 'dual_engine_harness',
    title: 'coupled dual-engine autonomous sdlc development harness',
    status: 'approved',
    author: 'autonomous agent',
    date: '2026-11-03',
    system_component: '@sdlc/dual-engine-harness',
    executive_summary: {
      vision: 'unified statechart and workflow execution',
      problem: 'agent drift vs workflow gridlock',
      strategic_context: 'clean modular sdlc development',
      primary_objectives: ['zero host collection violations', 'mathematical phase governance']
    },
    target_audience: [
      {
        id: 'persona-swe',
        role: 'software engineer',
        description: 'executes tdd cycles and adheres to governance',
        responsibilities: ['author tests', 'write code']
      }
    ],
    functional_requirements: [
      {
        id: 'fr-01',
        title: 'macro statechart',
        description: 'xstate v5 state machine governing 10 phases',
        priority: 'must_have',
        status: 'approved'
      }
    ],
    non_functional_requirements: {
      performance: 'p95 under 50ms',
      immutability: 'zero reduction in test assertions',
      sovereignty: 'zero external daemons',
      style: 'strictly lowercase british english'
    },
    scope_boundaries: {
      in_scope: ['core harness', 'review gatekeeper'],
      out_of_scope: ['legacy external services']
    },
    metadata: [
      { key: 'tier', value: '01-product' }
    ]
  };

  const validated = validate_document_entity(DocumentEntityTypes.PRD, prd_data);
  assert.equal(validated.id, 'prd-01');
  assert.equal(validated.slug, 'dual_engine_harness');
  assert.equal(validated.functional_requirements.length, 1);
  assert.equal(validated.target_audience[0].role, 'software engineer');
});

test('document-entity-schema: throws on invalid document entity schema', () => {
  assert.throws(() => {
    validate_document_entity(DocumentEntityTypes.PRD, {
      slug: 'missing-id-and-title'
    });
  }, /validation error for "prd" entity/);

  assert.throws(() => {
    validate_document_entity('unknown_type', { id: 'x' });
  }, /unknown document entity type: "unknown_type"/);
});

test('document-entity-schema: validates user story entity linking back to prd', () => {
  const story_data = {
    id: 'story-01',
    slug: 'macro_statechart_governance',
    title: 'macro statechart lifecycle enforcement',
    linked_prd_id: 'prd-01',
    epic: 'autonomous lifecycle engineering',
    narrative: {
      as_a: 'systems architect',
      i_want: 'deterministic state transitions',
      so_that: 'unauthorised skips are prevented'
    },
    acceptance_criteria: [
      {
        id: 'ac-01',
        scenario: 'invalid transition rejection',
        given: ['harness in phase 00'],
        when: ['transition to phase 03 requested'],
        then: ['statechart rejects with invariant violation error'],
        and: []
      }
    ],
    priority: 'critical',
    status: 'completed'
  };

  const validated = validate_document_entity(DocumentEntityTypes.USER_STORY, story_data);
  assert.equal(validated.linked_prd_id, 'prd-01');
  assert.equal(validated.priority, 'critical');
  assert.equal(validated.acceptance_criteria[0].given[0], 'harness in phase 00');
});

test('document-entity-schema: validates task entity with subtasks linking to prd', () => {
  const task_data = {
    id: 'task-01-macro-engine',
    slug: 'macro-engine-implementation',
    title: 'implement macro statechart engine',
    linked_prd_id: 'prd-01',
    linked_story_id: 'story-01',
    objective: 'provide deterministic xstate v5 state machine',
    assigned_role: 'software-engineer',
    status: 'completed',
    inputs: ['docs/01-product/prd-01.md', 'docs/02-architecture/adr-001.md'],
    outputs: ['src/MacroStatechartEngine.js'],
    criteria: ['all tests pass', 'zero piumarta collection bans'],
    tasks: [
      {
        number: 1,
        slug: 'setup-states',
        title: 'initialise 10 phase states',
        description: 'define phase 00 through 09 states in xstate config',
        steps: ['create states object', 'wire initial state'],
        status: 'completed'
      }
    ]
  };

  const validated = validate_document_entity(DocumentEntityTypes.TASK, task_data);
  assert.equal(validated.linked_prd_id, 'prd-01');
  assert.equal(validated.tasks.length, 1);
  assert.equal(validated.tasks[0].slug, 'setup-states');
});

test('filestore-adapter: saves, retrieves, and filters entities without host collections', () => {
  const adapter = create_filestore_adapter({ store_root: tmp_test_store });
  assert.ok(adapter.get_store_root().includes('tmp_entity_store'));

  adapter.save('prds', 'prd-01', { id: 'prd-01', title: 'harness' });
  adapter.save('prds', 'prd-02', { id: 'prd-02', title: 'exporter' });
  adapter.save('stories', 'story-01', { id: 'story-01', linked_prd_id: 'prd-01' });

  const fetched_prd = adapter.find_by_id('prds', 'prd-01');
  assert.equal(fetched_prd.title, 'harness');

  const ids = adapter.list_ids('prds');
  assert.equal(ids.length, 2);
  assert.ok(ids.includes('prd-01'));
  assert.ok(ids.includes('prd-02'));

  const filtered_stories = adapter.find_all('stories', (s) => s.linked_prd_id === 'prd-01');
  assert.equal(filtered_stories.length, 1);
  assert.equal(filtered_stories[0].id, 'story-01');

  const deleted = adapter.delete('prds', 'prd-02');
  assert.equal(deleted, true);
  assert.equal(adapter.find_by_id('prds', 'prd-02'), null);
});

test('document-entity-store: aggregates entities linked by prd foreign key', () => {
  const store = create_document_entity_store({ store_root: tmp_test_store });

  // 1. save prd
  store.save_entity(DocumentEntityTypes.PRD, {
    id: 'prd-01',
    slug: 'harness',
    title: 'dual-engine harness',
    status: 'approved',
    functional_requirements: [
      { id: 'fr-01', title: 'state machine', description: 'xstate v5 engine', priority: 'must_have', status: 'approved' }
    ]
  });

  // 2. save user story linked to prd-01
  store.save_entity(DocumentEntityTypes.USER_STORY, {
    id: 'story-01',
    slug: 'story-harness',
    title: 'harness stories',
    linked_prd_id: 'prd-01',
    epic: 'epic 01',
    narrative: { as_a: 'developer', i_want: 'harness', so_that: 'sdlc is automated' },
    acceptance_criteria: [
      { id: 'ac-01', scenario: 'init', given: ['env'], when: ['init'], then: ['success'], and: [] }
    ]
  });

  // 3. save task linked to prd-01
  store.save_entity(DocumentEntityTypes.TASK, {
    id: 'task-01',
    slug: 'task-harness',
    title: 'implement harness',
    linked_prd_id: 'prd-01',
    assigned_role: 'software-engineer',
    status: 'completed',
    tasks: [{ number: 1, slug: 'setup', title: 'setup', description: 'setup desc', steps: ['step1'], status: 'completed' }]
  });

  // 4. save adr linked to prd-01
  store.save_entity(DocumentEntityTypes.ADR, {
    id: 'adr-001',
    slug: 'coupled_architecture',
    title: 'coupled dual engine',
    linked_prd_id: 'prd-01',
    status: 'accepted',
    context: 'dual engine trade-off',
    decision: 'couple xstate v5 and mastra v1',
    consequences: { positive: ['modularity'], negative: ['complexity'], neutral: [] }
  });

  // 5. query relational tree by prd foreign key
  const tree = store.query_by_prd('prd-01');
  assert.equal(tree.prd.id, 'prd-01');
  assert.equal(tree.stories.length, 1);
  assert.equal(tree.stories[0].id, 'story-01');
  assert.equal(tree.tasks.length, 1);
  assert.equal(tree.tasks[0].id, 'task-01');
  assert.equal(tree.adrs.length, 1);
  assert.equal(tree.adrs[0].id, 'adr-001');
});

test('document-entity-store: generates markdown documents from stored entities via document builder', () => {
  const store = create_document_entity_store({ store_root: tmp_test_store });

  store.save_entity(DocumentEntityTypes.PRD, {
    id: 'prd-01',
    slug: 'harness',
    title: 'coupled dual-engine harness',
    status: 'approved',
    author: 'systems architect',
    date: '2026-11-03',
    executive_summary: {
      vision: 'macro-micro separation',
      problem: 'agent drift',
      strategic_context: 'sdlc tooling',
      primary_objectives: ['tight quality gates']
    },
    functional_requirements: [
      { id: 'fr-01', title: 'statechart', description: 'formal finite state machine', priority: 'must_have', status: 'approved' }
    ]
  });

  const rendered_prd = store.generate_document(DocumentEntityTypes.PRD, 'prd-01');
  assert.ok(rendered_prd.includes('# coupled dual-engine harness'));
  assert.ok(rendered_prd.includes('**document id:** `prd-01`'));
  assert.ok(rendered_prd.includes('## 1. problem framing & strategic objectives'));
  assert.ok(rendered_prd.includes('### vision'));
  assert.ok(rendered_prd.includes('macro-micro separation'));
  assert.ok(rendered_prd.includes('#### fr-01: statechart'));

  store.save_entity(DocumentEntityTypes.ADR, {
    id: 'adr-001',
    slug: 'xstate_statechart',
    title: 'adr-001: xstate macro statechart',
    linked_prd_id: 'prd-01',
    context: 'we need mathematical phase governance.',
    decision: 'use xstate v5 statecharts with transition guards.',
    consequences: {
      positive: ['impossible to skip review gates'],
      negative: ['state machine definition overhead']
    }
  });

  const rendered_adr = store.generate_document(DocumentEntityTypes.ADR, 'adr-001');
  assert.ok(rendered_adr.includes('# adr-001: xstate macro statechart'));
  assert.ok(rendered_adr.includes('## 1. context & problem statement'));
  assert.ok(rendered_adr.includes('we need mathematical phase governance.'));
  assert.ok(rendered_adr.includes('## 2. decision'));
  assert.ok(rendered_adr.includes('impossible to skip review gates'));
});

test('document-migrator: migrates repository documentation into entity store', () => {
  const store = create_document_entity_store({ store_root: tmp_test_store });
  const docs_dir = path.join(package_root, 'docs');

  const report = migrate_all_documents(docs_dir, store);

  assert.ok(report.prds >= 8, `expected at least 8 prds, got ${report.prds}`);
  assert.ok(report.stories >= 8, `expected at least 8 stories, got ${report.stories}`);
  assert.ok(report.adrs >= 8, `expected at least 8 adrs, got ${report.adrs}`);
  assert.ok(report.interfaces >= 7, `expected at least 7 interfaces, got ${report.interfaces}`);
  assert.ok(report.threat_models >= 8, `expected at least 8 threat models, got ${report.threat_models}`);
  assert.ok(report.test_reports >= 8, `expected at least 8 test reports, got ${report.test_reports}`);
  assert.ok(report.releases >= 7, `expected at least 7 releases, got ${report.releases}`);
  assert.ok(report.retrospectives >= 8, `expected at least 8 retrospectives, got ${report.retrospectives}`);
  assert.ok(report.total_migrated >= 60);

  // verify prd-01 relational tree
  const tree = store.query_by_prd('prd-01');
  assert.ok(tree.prd !== null);
  assert.equal(tree.prd.id, 'prd-01');
  assert.ok(tree.stories.length > 0);
  assert.ok(tree.adrs.length > 0);
  assert.ok(tree.threat_models.length > 0);
  assert.ok(tree.test_reports.length > 0);
  assert.ok(tree.retrospectives.length > 0);
});

test('document-entity-store: builds structure-aware hybrid rag index and searches across store entities and docs markdown', () => {
  const store = create_document_entity_store({ store_root: tmp_test_store });
  const docs_dir = path.join(package_root, 'docs');
  migrate_all_documents(docs_dir, store);

  const index_file = path.join(tmp_test_store, 'doc_rag_index.json');
  const index_stats = store.index_store_for_rag({
    docs_dir,
    index_path: index_file
  });

  assert.ok(index_stats.total_chunks > 20);
  assert.ok(index_stats.entity_chunks > 10);
  assert.ok(index_stats.markdown_chunks > 10);
  assert.ok(fs.existsSync(index_file));

  // query hybrid rag (dense + bm25 reciprocal rank fusion) for piumarta + memory storage
  const results = store.search_doc_store('pure piumarta filesystem memory storage working_memory', {
    top_k: 5
  });
  assert.ok(Array.isArray(results));
  assert.ok(results.length > 0);
  assert.ok(results[0].rrf_score > 0);
  assert.ok(results.some((r) => r.linked_prd_id === 'prd-03' || r.doc_id === 'prd-03' || r.doc_id === 'adr-003'));

  // verify metadata pre-filtering by linked_prd_id and collection/type
  const filtered = store.search_doc_store('statechart transition guards', {
    top_k: 5,
    filter: { linked_prd_id: 'prd-01', type: DocumentEntityTypes.ADR }
  });
  assert.ok(filtered.length > 0);
  for (let i = 0; i < filtered.length; i += 1) {
    assert.equal(filtered[i].linked_prd_id, 'prd-01');
    assert.equal(filtered[i].type, DocumentEntityTypes.ADR);
  }
});

test('document-entity-store: synchronises structured store entities and worker notes into mastra knowledge graph', async () => {
  const store = create_document_entity_store({ store_root: tmp_test_store });
  store.save_entity(DocumentEntityTypes.PRD, {
    id: 'prd-03',
    slug: 'mastra_memory_storage',
    title: 'mastra memory storage',
    status: 'approved',
    functional_requirements: [
      { id: 'fr-01', title: 'sovereign storage', description: 'persist threads to .sdlc/mastra', priority: 'must_have', status: 'approved' }
    ]
  });
  store.save_entity(DocumentEntityTypes.ADR, {
    id: 'adr-003',
    slug: 'mastra_memory_storage_architecture',
    title: 'adr-003: mastra memory storage architecture',
    linked_prd_id: 'prd-03',
    status: 'accepted',
    context: 'prevent volatile memory loss across restarts',
    decision: 'use create_persistent_memory_domain without host Map or Set',
    consequences: { positive: ['restart durability'], negative: [], neutral: [] }
  });

  const sync_report = await store.sync_to_knowledge({
    linked_prd_id: 'prd-03',
    notes: [
      {
        target_id: 'prd-03',
        text: 'verified [[adr-003]] restart hydration in tests/mastra-memory-storage.test.js',
        source_thread_id: 'tkt-003',
        author: 'qa-worker-01'
      }
    ]
  });

  assert.ok(sync_report);
  assert.ok(sync_report.nodes_synced >= 2);
  assert.ok(sync_report.notes_appended >= 1);
  assert.ok(sync_report.knowledge);

  const scope = ['org:sdlc', 'resource:prd-03'];
  const hits = await sync_report.knowledge.search({
    scope,
    query: 'create_persistent_memory_domain'
  });
  assert.ok(hits.length >= 1);

  const adr_node = await sync_report.knowledge.resolveNode({ scope, name: 'adr-003' });
  assert.ok(adr_node);
  const mentions = await sync_report.knowledge.listKnowledgeMentioning({ scope, node: adr_node });
  assert.ok(mentions.records.length >= 1);
});
