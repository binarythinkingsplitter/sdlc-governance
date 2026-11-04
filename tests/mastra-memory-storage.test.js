import { test, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  create_dual_engine_harness,
  create_mastra_execution_bridge
} from '../src/index.js';
import {
  create_mastra_memory_storage,
  resolve_harness_storage,
  resolve_harness_memory,
  resolve_harness_knowledge,
  create_persistent_memory_domain
} from '../src/MastraMemoryStorage.js';

const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const test_storage_dir = path.join(package_root, '.sdlc', 'test-mastra-storage');

test('mastra-memory-storage: verifies primary operation', () => {
  const instance = create_mastra_memory_storage();
  assert.ok(instance);
  assert.ok(instance.storage);
  assert.ok(instance.memory);
});

test('mastra-memory-storage: initialises filesystem store without in-memory fallback', async () => {
  if (fs.existsSync(test_storage_dir)) {
    fs.rmSync(test_storage_dir, { recursive: true, force: true });
  }

  const storage = resolve_harness_storage({
    storage_type: 'filesystem',
    storage_dir: test_storage_dir
  });

  assert.ok(storage);
  assert.equal(storage.id, 'filesystem');
  assert.equal(storage.name, 'FilesystemStore');
  assert.ok(fs.existsSync(test_storage_dir));
});

test('mastra-memory-storage: creates thread-scoped memory attached to storage', async () => {
  const storage = resolve_harness_storage({
    storage_type: 'filesystem',
    storage_dir: test_storage_dir
  });

  const memory = resolve_harness_memory({
    name: 'test-agent-memory',
    storage,
    working_memory: true
  });

  assert.ok(memory);
  assert.equal(memory.name, 'test-agent-memory');
  assert.ok(typeof memory.createThread === 'function');
  assert.ok(typeof memory.getMergedThreadConfig === 'function');
});

test('mastra-memory-storage: wires persistent filesystem storage into mastra execution bridge', async () => {
  const bridge = create_mastra_execution_bridge({
    storage_type: 'filesystem',
    storage_dir: test_storage_dir
  });

  const instance = bridge.get_mastra_instance();
  assert.ok(instance);
  const storage = instance.storage || (instance.getStorage && instance.getStorage());
  assert.ok(storage);
  assert.equal(storage.id, 'filesystem');
});

test('mastra-memory-storage: dual-engine harness passes storage and memory to role agents', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-memory-harness-001',
    storage_type: 'filesystem',
    storage_dir: test_storage_dir,
    enable_memory: true
  });

  const coder = harness.get_agent('software-engineer');
  assert.ok(coder);
  assert.ok(coder.hasOwnMemory());
  const mem = await coder.getMemory();
  assert.ok(mem);
  assert.equal(mem.name, 'software-engineer-memory');
});

test('mastra-memory-storage: persists threads, messages, working memory, and observations to disk and hydrates on restart', async () => {
  const restart_dir = path.join(test_storage_dir, 'restart-persistence');
  if (fs.existsSync(restart_dir)) {
    fs.rmSync(restart_dir, { recursive: true, force: true });
  }

  const storage_first = resolve_harness_storage({
    storage_type: 'filesystem',
    storage_dir: restart_dir
  });
  assert.ok(typeof create_persistent_memory_domain === 'function');

  const mem_domain_first = storage_first.stores.memory;
  await mem_domain_first.saveThread({
    thread: {
      id: 'thread-ep-01',
      resourceId: 'res-prd-01',
      title: 'discovery session for prd-01',
      createdAt: new Date('2026-11-04T00:00:00Z'),
      updatedAt: new Date('2026-11-04T00:05:00Z'),
      metadata: {
        workingMemory: JSON.stringify({ active_phase: 'phase_01_specifications', active_prd_id: 'prd-01' })
      }
    }
  });

  await mem_domain_first.saveMessages({
    messages: [
      {
        id: 'msg-ep-01',
        threadId: 'thread-ep-01',
        resourceId: 'res-prd-01',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'define pure piumarta memory storage' }] },
        createdAt: new Date('2026-11-04T00:01:00Z')
      }
    ]
  });

  await mem_domain_first.saveResource({
    resource: {
      id: 'res-prd-01',
      workingMemory: JSON.stringify({ epic_status: 'active', linked_adr: 'adr-003' }),
      metadata: { owner: 'sdlc-supervisor' },
      createdAt: new Date('2026-11-04T00:00:00Z'),
      updatedAt: new Date('2026-11-04T00:05:00Z')
    }
  });

  assert.ok(fs.existsSync(path.join(restart_dir, 'threads', 'thread-ep-01.json')));
  assert.ok(fs.existsSync(path.join(restart_dir, 'messages', 'thread-ep-01.json')));
  assert.ok(fs.existsSync(path.join(restart_dir, 'working_memory', 'thread-ep-01.json')));
  assert.ok(fs.existsSync(path.join(restart_dir, 'working_memory', 'res-prd-01.json')));

  // simulate cold process restart by creating a brand new storage instance on the same directory
  const storage_restarted = resolve_harness_storage({
    storage_type: 'filesystem',
    storage_dir: restart_dir
  });
  const mem_domain_restarted = storage_restarted.stores.memory;

  const hydrated_thread = await mem_domain_restarted.getThreadById({ threadId: 'thread-ep-01' });
  assert.ok(hydrated_thread);
  assert.equal(hydrated_thread.id, 'thread-ep-01');
  assert.equal(hydrated_thread.resourceId, 'res-prd-01');
  assert.ok(hydrated_thread.metadata.workingMemory.includes('phase_01_specifications'));

  const hydrated_msgs = await mem_domain_restarted.listMessages({ threadId: 'thread-ep-01' });
  assert.ok(hydrated_msgs);
  assert.equal(hydrated_msgs.messages.length, 1);
  assert.equal(hydrated_msgs.messages[0].id, 'msg-ep-01');

  const hydrated_resource = await mem_domain_restarted.getResourceById({ resourceId: 'res-prd-01' });
  assert.ok(hydrated_resource);
  assert.equal(hydrated_resource.id, 'res-prd-01');
  assert.ok(hydrated_resource.workingMemory.includes('adr-003'));
});

test('mastra-memory-storage: resolves knowledge instance and persists knowledge nodes and records across restarts', async () => {
  const kn_dir = path.join(test_storage_dir, 'knowledge-persistence');
  if (fs.existsSync(kn_dir)) {
    fs.rmSync(kn_dir, { recursive: true, force: true });
  }

  const bundle_first = create_mastra_memory_storage({
    storage_type: 'filesystem',
    storage_dir: kn_dir
  });
  assert.ok(bundle_first.knowledge);
  assert.ok(typeof resolve_harness_knowledge === 'function');

  const scope = ['org:sdlc', 'resource:prd-03'];
  const adr_node = await bundle_first.knowledge.createNode({
    scope,
    name: 'adr-003',
    kind: 'adr',
    description: 'mastra memory storage architecture',
    content: 'pure piumarta factory functions and .sdlc/mastra persistence'
  });
  const prd_node = await bundle_first.knowledge.createNode({
    scope,
    name: 'prd-03',
    kind: 'prd',
    description: 'mastra memory storage product requirements',
    content: 'governed by [[adr-003]]'
  });

  const rec = await bundle_first.knowledge.appendKnowledge({
    scope,
    node: prd_node,
    text: 'verified [[adr-003]] thread hydration in gate_2',
    sourceThreadId: 'tkt-mem-01',
    resolutionScope: scope,
    defaultScope: scope,
    metadata: { author: 'qa-worker-01' }
  });
  assert.ok(rec.id);
  assert.ok(fs.existsSync(path.join(kn_dir, 'knowledge')));

  // simulate cold restart and verify knowledge graph is hydrated
  const kn_restarted = resolve_harness_knowledge({
    storage_type: 'filesystem',
    storage_dir: kn_dir
  });
  const search_hits = await kn_restarted.search({ scope, query: 'piumarta' });
  assert.ok(search_hits.length >= 1);
  const mentioning = await kn_restarted.listKnowledgeMentioning({ scope, node: adr_node });
  assert.ok(mentioning.records.length >= 1);
});

test('mastra-memory-storage: integrates rag search tool, knowledge graph tool, thread memory, and supervisor auto-sync into mastra agents', async () => {
  const agent_int_dir = path.join(test_storage_dir, 'agent-integration');
  if (fs.existsSync(agent_int_dir)) {
    fs.rmSync(agent_int_dir, { recursive: true, force: true });
  }

  const harness = create_dual_engine_harness({
    session_id: 'test-agent-mem-rag-int',
    storage_type: 'filesystem',
    storage_dir: agent_int_dir,
    store_root: path.join(agent_int_dir, 'store'),
    enable_memory: true
  });

  // 1. verify harness tools include harness-doc-rag-search and harness-knowledge-graph and are bound to role agents
  const tools = harness.list_tools();
  assert.ok(tools.some((t) => t.id === 'harness-doc-rag-search'));
  assert.ok(tools.some((t) => t.id === 'harness-knowledge-graph'));

  const architect = harness.get_agent('system-architect');
  assert.ok(architect);
  const arch_tools = await architect.listTools();
  const arch_tool_ids = Object.values(arch_tools).map((t) => t.id);
  assert.ok(arch_tool_ids.includes('harness-doc-rag-search'));
  assert.ok(arch_tool_ids.includes('harness-knowledge-graph'));

  // 2. execute harness-doc-rag-search and harness-knowledge-graph tools through harness
  const store = harness.get_store();
  store.save_entity('prd', {
    id: 'prd-03',
    slug: 'mastra_memory_storage',
    title: 'mastra memory storage',
    status: 'approved',
    functional_requirements: [
      { id: 'fr-01', title: 'persistent threads', description: 'save threads in .sdlc/mastra/threads', priority: 'must_have', status: 'approved' }
    ]
  });

  const rag_res = await harness.execute_tool('harness-doc-rag-search', {
    query: 'persistent threads .sdlc/mastra/threads',
    top_k: 3
  });
  assert.ok(rag_res);
  assert.ok(Array.isArray(rag_res.hits));
  assert.ok(rag_res.hits.length >= 1);
  assert.equal(rag_res.hits[0].doc_id, 'prd-03');

  const kn_tool_res = await harness.execute_tool('harness-knowledge-graph', {
    action: 'append_note',
    linked_prd_id: 'prd-03',
    target_id: 'prd-03',
    text: 'agent verified [[prd-03]] rag tool integration',
    author: 'system-architect'
  });
  assert.equal(kn_tool_res.ok, true);

  // 3. verify supervisor automatically syncs approved ticket entities to knowledge graph and rag index
  const supervisor = harness.get_supervisor();
  assert.ok(typeof supervisor.get_knowledge === 'function');
  const initiated = supervisor.initiate_process('evolve-architecture', {
    name: 'memory-agent-sync',
    inputs: {
      problem_statement: 'synchronise adr entities into mastra knowledge graph automatically'
    }
  });
  const claim = supervisor.claim_next_ticket({
    worker_id: 'arch-worker-01',
    role: 'system-architect',
    epic_id: initiated.epic.id
  });
  assert.ok(claim);

  const wf_out = await supervisor.execute_supervised_workflow(
    claim.ticket.workflow_id,
    claim.input_data,
    {
      supervisor_token: claim.supervisor_token,
      worker_id: 'arch-worker-01',
      ticket_id: claim.ticket.id,
      request_context: claim.request_context
    }
  );
  const review = await supervisor.submit_and_review_ticket(claim.ticket.id, {
    worker_id: 'arch-worker-01',
    supervisor_token: claim.supervisor_token,
    output: wf_out
  });
  assert.equal(review.approved, true);
  assert.ok(review.knowledge_synced);
  assert.ok(review.rag_indexed);
});

afterAll(() => {
  if (fs.existsSync(test_storage_dir)) {
    fs.rmSync(test_storage_dir, { recursive: true, force: true });
  }
  const stray_adr = path.join(package_root, 'docs', '02-architecture', 'adr', 'adr-011-new-feature.md');
  if (fs.existsSync(stray_adr)) {
    fs.unlinkSync(stray_adr);
  }
});
