/**
 * =========================================================================
 * module: sdlc supervisor, work board, and daemon pool test suite
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: vitest suite verifying the 2-tier sdlc-supervisor, work board, message bus, and worker pool
 * verbose: validates ticket and agent_message store schemas, dag dependency unblocking,
 * single-developer feature affinity vs multi-developer swarm mode, mandatory supervisor token
 * mediation, zero direct mastra store access, clarification handshakes, 3-strike rework
 * escalation, and end-to-end execution of the 25 high-level sdlc/devops processes.
 * =========================================================================
 */

import { test, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  create_dual_engine_harness,
  create_document_entity_store,
  create_agent_message_bus,
  create_work_board,
  create_sdlc_supervisor,
  create_worker_pool_daemon,
  list_high_level_processes,
  DocumentEntityTypes,
  SupervisorRequestContextSchema,
  create_request_context,
  create_supervisor_token_input_processor,
  create_xstate_phase_lock_processor,
  create_sdlc_governance_output_processor,
  create_sdlc_processor_suite,
  create_harness_workspace,
  create_review_gatekeeper,
  HIGH_LEVEL_PROCESS_PROFILES,
  create_sdlc_rules_engine,
  compress_payload,
  decompress_payload,
  create_content_pointer,
  create_git_governance_provenance,
  format_tool_trace_summary,
  format_chat_reply_prose,
  create_terminal_chat_io
} from '../src/index.js';

const temp_dirs = [];

function create_isolated_env() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-sup-board-'));
  temp_dirs.push(tmp);
  const store_root = path.join(tmp, '.sdlc', 'store');
  const store = create_document_entity_store({
    workspace_root: tmp,
    store_root
  });
  const harness = create_dual_engine_harness({
    workspace_root: tmp,
    store_root,
    store,
    session_id: `test-sup-${Date.now()}`
  });
  return { tmp, store, harness };
}

afterAll(() => {
  for (const dir of temp_dirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_err) {
      // ignore cleanup errors
    }
  }
});

test('supervisor-board: catalogues all 25 high-level sdlc and devops processes across 6 domains', () => {
  const all = list_high_level_processes();
  assert.equal(all.length, 25);

  const domains = ['project', 'engineering', 'architecture', 'quality', 'security', 'devops'];
  for (const dom of domains) {
    const by_dom = list_high_level_processes(dom);
    assert.ok(by_dom.length >= 2, `expected domain ${dom} to have processes`);
  }

  const commit_types = all.map((p) => p.commit_type);
  assert.ok(commit_types.includes('feat'));
  assert.ok(commit_types.includes('fix'));
  assert.ok(commit_types.includes('refactor'));
  assert.ok(commit_types.includes('perf'));
  assert.ok(commit_types.includes('test'));
  assert.ok(commit_types.includes('docs'));
  assert.ok(commit_types.includes('style'));
  assert.ok(commit_types.includes('build'));
  assert.ok(commit_types.includes('ci'));
  assert.ok(commit_types.includes('chore(deps)'));
  assert.ok(commit_types.includes('revert'));
});

test('supervisor-board: enforces dag dependency ordering and unblocks downstream tickets on completion', () => {
  const { store } = create_isolated_env();
  const bus = create_agent_message_bus({ store });
  const board = create_work_board({ store, message_bus: bus });

  board.create_epic({ id: 'dag-test', concurrency_mode: 'single-developer' });
  const created = board.create_tickets_batch([
    { id: 't-1', epic_id: 'dag-test', title: 'prd', workflow_id: 'pm-prd-authoring', role: 'product-manager', depends_on: [] },
    { id: 't-2', epic_id: 'dag-test', title: 'stories', workflow_id: 'pm-story-slicing', role: 'product-manager', depends_on: ['t-1'] },
    { id: 't-3', epic_id: 'dag-test', title: 'adr', workflow_id: 'arch-adr-authoring', role: 'system-architect', depends_on: ['t-1'] },
    { id: 't-4', epic_id: 'dag-test', title: 'code', workflow_id: 'se-feature-implementation', role: 'software-engineer', depends_on: ['t-2', 't-3'] }
  ]);

  assert.equal(created.length, 4);
  assert.equal(board.get_ticket('t-1').status, 'ready');
  assert.equal(board.get_ticket('t-2').status, 'blocked');
  assert.equal(board.get_ticket('t-3').status, 'blocked');
  assert.equal(board.get_ticket('t-4').status, 'blocked');

  // completing t-1 unblocks both t-2 and t-3 simultaneously, while t-4 stays blocked
  const claim1 = board.pull_next({ worker_id: 'pm-01', role: 'product-manager' });
  assert.equal(claim1.ticket.id, 't-1');
  board.submit_for_review('t-1', {
    worker_id: 'pm-01',
    supervisor_token: claim1.supervisor_token,
    output: { status: 'completed' }
  });
  const rev1 = board.complete_review('t-1', { approved: true });
  assert.equal(rev1.unblocked_tickets.length, 2);
  assert.equal(board.get_ticket('t-2').status, 'ready');
  assert.equal(board.get_ticket('t-3').status, 'ready');
  assert.equal(board.get_ticket('t-4').status, 'blocked');

  // cyclic dependencies are rejected deterministically
  assert.throws(() => {
    board.create_tickets_batch([
      { id: 'cyc-a', epic_id: 'dag-test', title: 'a', workflow_id: 'pm-prd-authoring', role: 'product-manager', depends_on: ['cyc-b'] },
      { id: 'cyc-b', epic_id: 'dag-test', title: 'b', workflow_id: 'pm-prd-authoring', role: 'product-manager', depends_on: ['cyc-a'] }
    ]);
  }, /invalid_cyclic_dependency/);
});

test('supervisor-board: enforces single-developer feature affinity by default and supports multi-developer swarm', () => {
  const { store } = create_isolated_env();
  const board = create_work_board({ store });

  // 1. single-developer mode (default): one developer owns all se tickets for feature-a
  board.create_epic({ id: 'feature-a', concurrency_mode: 'single-developer' });
  board.create_tickets_batch([
    { id: 'fa-1', epic_id: 'feature-a', title: 'task 1', workflow_id: 'se-feature-implementation', role: 'software-engineer', depends_on: [] },
    { id: 'fa-2', epic_id: 'feature-a', title: 'task 2', workflow_id: 'se-feature-implementation', role: 'software-engineer', depends_on: [] }
  ]);

  const claim_se1 = board.pull_next({ worker_id: 'se-worker-01', role: 'software-engineer', epic_id: 'feature-a' });
  assert.ok(claim_se1);
  assert.equal(claim_se1.ticket.id, 'fa-1');
  assert.equal(board.get_epic('feature-a').assigned_developer, 'se-worker-01');

  // se-worker-02 cannot claim fa-2 because feature-a has affinity to se-worker-01
  const claim_se2_blocked = board.pull_next({ worker_id: 'se-worker-02', role: 'software-engineer', epic_id: 'feature-a' });
  assert.equal(claim_se2_blocked, null);

  // but se-worker-02 CAN claim a ticket on a different feature (feature-b) in parallel
  board.create_epic({ id: 'feature-b', concurrency_mode: 'single-developer' });
  board.create_ticket({ id: 'fb-1', epic_id: 'feature-b', title: 'task b1', workflow_id: 'se-feature-implementation', role: 'software-engineer', depends_on: [] });
  const claim_se2_other = board.pull_next({ worker_id: 'se-worker-02', role: 'software-engineer', epic_id: 'feature-b' });
  assert.ok(claim_se2_other);
  assert.equal(claim_se2_other.ticket.id, 'fb-1');

  // 2. multi-developer swarm mode: multiple workers can claim independent tasks on a large feature concurrently
  board.create_epic({ id: 'large-epic', concurrency_mode: 'multi-developer', max_workers: 3 });
  board.create_tickets_batch([
    { id: 'le-1', epic_id: 'large-epic', title: 'sub 1', workflow_id: 'se-feature-implementation', role: 'software-engineer', depends_on: [] },
    { id: 'le-2', epic_id: 'large-epic', title: 'sub 2', workflow_id: 'se-feature-implementation', role: 'software-engineer', depends_on: [] }
  ]);

  const swarm_1 = board.pull_next({ worker_id: 'se-worker-01', role: 'software-engineer', epic_id: 'large-epic' });
  const swarm_2 = board.pull_next({ worker_id: 'se-worker-02', role: 'software-engineer', epic_id: 'large-epic' });
  assert.ok(swarm_1);
  assert.ok(swarm_2);
  assert.notEqual(swarm_1.ticket.id, swarm_2.ticket.id);
});

test('supervisor-board: enforces mandatory supervisor mediation and prevents mastra from writing to store before review approval', async () => {
  const { store, harness } = create_isolated_env();
  const supervisor = harness.get_supervisor();
  const board = harness.get_work_board();

  // 1. unsupervised workflow execution without supervisor_token is rejected
  await assert.rejects(
    async () => {
      await supervisor.execute_supervised_workflow('pm-prd-authoring', { feature_name: 'rogue' }, {});
    },
    /unauthorized_unsupervised_execution/
  );

  // 2. forged supervisor_token is rejected
  await assert.rejects(
    async () => {
      await supervisor.execute_supervised_workflow(
        'pm-prd-authoring',
        { feature_name: 'rogue' },
        { supervisor_token: 'forged-token-123', worker_id: 'pm-01', ticket_id: 't-1' }
      );
    },
    /invalid_supervisor_token/
  );

  // 3. during mastra execution, .sdlc/store prds collection remains empty until supervisor approves review
  board.create_epic({ id: 'auth-flow', linked_prd_id: 'prd-auth_flow' });
  board.create_ticket({
    id: 'auth-flow:prd',
    epic_id: 'auth-flow',
    title: 'author prd',
    workflow_id: 'pm-prd-authoring',
    role: 'product-manager',
    linked_prd_id: 'prd-auth_flow'
  });

  const claimed = supervisor.claim_next_ticket({ worker_id: 'pm-worker-01', role: 'product-manager', epic_id: 'auth-flow' });
  assert.ok(claimed);

  const run_state = await supervisor.execute_supervised_workflow(
    'pm-prd-authoring',
    claimed.input_data,
    {
      supervisor_token: claimed.supervisor_token,
      worker_id: 'pm-worker-01',
      ticket_id: claimed.ticket.id
    }
  );
  assert.equal(run_state.status, 'completed');

  // verify mastra did NOT write the prd to .sdlc/store during execution
  assert.equal(store.get_entity(DocumentEntityTypes.PRD, 'prd-auth_flow'), null);

  // now submit to supervisor and approve review -> store is populated transactionally
  const rev = await supervisor.submit_and_review_ticket(claimed.ticket.id, {
    worker_id: 'pm-worker-01',
    supervisor_token: claimed.supervisor_token,
    output: run_state
  });
  assert.equal(rev.approved, true);
  const stored_prd = store.get_entity(DocumentEntityTypes.PRD, 'prd-auth_flow');
  assert.ok(stored_prd);
  assert.ok(stored_prd.title.includes('auth-flow'));
});

test('supervisor-board: handles inter-agent clarification pause/resume and 3-attempt rework escalation', async () => {
  const { harness } = create_isolated_env();
  const board = harness.get_work_board();
  const bus = harness.get_message_bus();
  const supervisor = harness.get_supervisor();

  board.create_epic({ id: 'esc-epic' });
  board.create_ticket({
    id: 'esc-1',
    epic_id: 'esc-epic',
    title: 'implement token validator',
    workflow_id: 'se-feature-implementation',
    role: 'software-engineer',
    max_retries: 3
  });

  // 1. worker claims ticket and pauses for clarification from system-architect
  const claim0 = supervisor.claim_next_ticket({ worker_id: 'se-worker-01', role: 'software-engineer', epic_id: 'esc-epic' });
  const paused = board.pause_for_clarification('esc-1', {
    worker_id: 'se-worker-01',
    to_role: 'system-architect',
    question: 'should expired tokens return 401 or 403?'
  });
  assert.equal(paused.ticket.status, 'awaiting_input');

  const arch_inbox = bus.get_inbox('system-architect', { topic: 'clarification_request' });
  assert.equal(arch_inbox.length, 1);
  assert.equal(arch_inbox[0].payload.question, 'should expired tokens return 401 or 403?');

  // architect resolves clarification -> ticket flips back to ready with answer in context
  const resumed = board.resolve_clarification('esc-1', {
    from_worker: 'arch-worker-01',
    role: 'system-architect',
    request_id: arch_inbox[0].id,
    answer: 'return 401 unauthorized'
  });
  assert.equal(resumed.status, 'ready');

  // 2. rework loop: 3 rejected submissions trigger escalation to sdlc-supervisor
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const claim = supervisor.claim_next_ticket({ worker_id: 'se-worker-01', role: 'software-engineer', epic_id: 'esc-epic' });
    assert.ok(claim);
    assert.equal(claim.input_data.clarifications[0].answer, 'return 401 unauthorized');

    const rev = await supervisor.submit_and_review_ticket('esc-1', {
      worker_id: 'se-worker-01',
      supervisor_token: claim.supervisor_token,
      output: { status: 'completed' },
      approved: false,
      violations: [`missing test assertion on attempt ${attempt}`]
    });

    assert.equal(rev.approved, false);
    if (attempt < 3) {
      assert.equal(rev.ticket.status, 'rework');
      assert.equal(rev.ticket.retry_count, attempt);
    } else {
      assert.equal(rev.ticket.status, 'escalated');
      assert.equal(rev.ticket.retry_count, 3);
    }
  }

  const sup_escalations = bus.get_inbox('sdlc-supervisor', { topic: 'escalation' });
  assert.equal(sup_escalations.length, 1);
  assert.equal(sup_escalations[0].ticket_id, 'esc-1');
  assert.ok(claim0);
});

test('supervisor-board: daemon worker pool drains full develop-feature process end-to-end and populates store', async () => {
  const { tmp, store, harness } = create_isolated_env();
  const pool = harness.get_worker_pool();

  // scale software-engineer pool to 4 daemons
  pool.scale('software-engineer', 4);
  assert.equal(pool.list_workers({ role: 'software-engineer' }).length, 4);

  const result = await harness.run_process('develop-feature', {
    name: 'session-vault',
    inputs: {
      child_tasks: [
        { id: 'session-vault:task-01', title: 'implement vault encryption', depends_on: ['session-vault:stories', 'session-vault:interface'] },
        { id: 'session-vault:task-02', title: 'implement vault key rotation', depends_on: ['session-vault:task-01'] }
      ]
    }
  });

  assert.equal(result.board_summary.all_completed, true);
  assert.equal(result.board_summary.counts.completed, 11); // 9 base stages + 2 dynamically spawned child tasks

  // verify both source module and unit test suite were persisted to disk and pass execution
  const src_file = path.join(tmp, 'src', 'session-vault.js');
  const test_file = path.join(tmp, 'tests', 'session-vault.test.js');
  assert.equal(fs.existsSync(src_file), true);
  assert.equal(fs.existsSync(test_file), true);
  assert.ok(fs.readFileSync(src_file, 'utf-8').includes('export function create_session_vault'));
  assert.ok(fs.readFileSync(test_file, 'utf-8').includes('create_session_vault'));

  // verify all 4 formal review gates were evaluated through ReviewGatekeeper with sealed receipts
  const gate_receipts = harness.get_gatekeeper().get_receipts();
  const evaluated_gate_ids = gate_receipts.map((r) => r.gate_id);
  assert.ok(evaluated_gate_ids.includes('gate_1_planning'));
  assert.ok(evaluated_gate_ids.includes('gate_2_implementation'));
  assert.ok(evaluated_gate_ids.includes('gate_3_qa_security'));
  assert.ok(evaluated_gate_ids.includes('gate_4_release'));

  // verify all se tickets on single-developer feature were executed by the same se-worker
  const se_tickets = harness.get_work_board().list_tickets({ epic_id: 'session-vault', role: 'software-engineer' });
  assert.equal(se_tickets.length, 3);
  const assigned_owners = new Set(se_tickets.map((t) => t.affinity));
  assert.equal(assigned_owners.size, 1);

  // verify relational tree in .sdlc/store was populated by supervisor upon review approvals
  const tree = store.query_by_prd('prd-session_vault');
  assert.ok(tree.prd);
  assert.ok(tree.stories.length >= 1);
  assert.ok(tree.adrs.length >= 1);
  assert.ok(tree.interfaces.length >= 1);
  assert.ok(tree.threat_models.length >= 1);
  assert.ok(tree.test_reports.length >= 1);
  assert.ok(tree.releases.length >= 1);
  assert.ok(tree.retrospectives.length >= 1);
  assert.equal(tree.tickets.length, 11);

  const board_md = store.render_board_markdown('session-vault');
  assert.ok(board_md.includes('# work board: session-vault'));
  assert.ok(board_md.includes('session-vault:task-01'));
  assert.ok(board_md.includes('**completed**'));
});

test('supervisor-board: enforces native mastra RequestContext schema, TripWire input processor, and xstate-phase-lock processor', async () => {
  const { harness } = create_isolated_env();
  const supervisor = harness.get_supervisor();
  const board = harness.get_work_board();

  board.create_epic({ id: 'ctx-epic' });
  board.create_ticket({
    id: 'ctx-1',
    epic_id: 'ctx-epic',
    title: 'author prd',
    workflow_id: 'pm-prd-authoring',
    role: 'product-manager'
  });

  const claimed = supervisor.claim_next_ticket({
    worker_id: 'pm-worker-01',
    role: 'product-manager',
    epic_id: 'ctx-epic'
  });
  assert.ok(claimed.request_context);
  assert.equal(claimed.request_context.get('supervisor_token'), claimed.supervisor_token);
  assert.equal(claimed.request_context.get('ticket_id'), 'ctx-1');
  assert.equal(claimed.request_context.get('worker_id'), 'pm-worker-01');
  assert.equal(claimed.request_context.get('role'), 'product-manager');

  const parsed_schema = SupervisorRequestContextSchema.safeParse(claimed.request_context.all);
  assert.equal(parsed_schema.success, true);

  // verify TripWire abort on missing token in supervisor_token_guard processor
  const guard = create_supervisor_token_input_processor({
    verify_token_fn: (check) => supervisor.verify_supervisor_token(check)
  });

  let tripwire_triggered = false;
  await assert.rejects(
    async () => {
      await guard.processInput({
        messages: [],
        requestContext: create_request_context({}),
        abort: (reason, opts) => {
          tripwire_triggered = opts?.retry === false;
          throw new Error(reason);
        }
      });
    },
    /tripwire_unauthorized_execution/
  );
  assert.equal(tripwire_triggered, true);

  // verify xstate-phase-lock processor injects active xstate phase and aborts disallowed phases
  const phase_lock = create_xstate_phase_lock_processor({
    get_active_phase_fn: () => harness.get_active_phase(),
    allowed_phases: ['phase_01_specifications']
  });

  await assert.rejects(
    async () => {
      await phase_lock.processInput({
        messages: [],
        systemMessages: [],
        requestContext: claimed.request_context,
        abort: (reason) => {
          throw new Error(reason);
        }
      });
    },
    /xstate_phase_lock_violation/
  );
});

test('supervisor-board: enforces native mastra output processors (self-correction retry & .sdlc/store redaction) and delegation hooks', async () => {
  const { harness } = create_isolated_env();
  const supervisor = harness.get_supervisor();
  const gov_out = create_sdlc_governance_output_processor({ max_retries: 3 });

  // 1. processOutputStep triggers self-correction retry (abort with { retry: true }) on direct .sdlc/store access
  let retry_flag = null;
  await assert.rejects(
    async () => {
      await gov_out.processOutputStep({
        text: 'fs.readFileSync(".sdlc/store/prds/prd-1.json")',
        retryCount: 0,
        abort: (reason, opts) => {
          retry_flag = opts?.retry;
          throw new Error(reason);
        }
      });
    },
    /sdlc_governance_output_violation/
  );
  assert.equal(retry_flag, true);

  // 2. processToolResult redacts any direct .sdlc/store path leakage
  const redacted = await gov_out.processToolResult({
    toolName: 'read-file',
    result: { leaked: 'found secret in .sdlc/store/prds/prd-1.json' }
  });
  assert.equal(redacted.redacted, true);

  // 3. delegation hooks filter out .sdlc/store messages and record audit trail
  const hooks = supervisor.get_delegation_hooks();
  assert.equal(hooks.enableResultReferences, true);
  const filtered = hooks.messageFilter({
    messages: [
      { role: 'user', content: 'clean context message' },
      { role: 'assistant', content: 'direct path .sdlc/store/tickets/t-1.json' }
    ]
  });
  assert.equal(filtered.length, 1);
});

test('supervisor-board: integrates native Mastra EventEmitterPubSub leases, agent signals, A2AAgent, Workspace sandbox, and MastraScorer evals', async () => {
  const { tmp, harness } = create_isolated_env();
  const bus = harness.get_message_bus();
  const gatekeeper = create_review_gatekeeper({ base_dir: tmp });

  // 1. EventEmitterPubSub distributed lease acquisition and conflict rejection
  assert.ok(bus.get_pubsub());
  assert.equal(bus.acquire_lease('ticket:lease-1', 'se-worker-01', 60000), true);
  assert.equal(bus.acquire_lease('ticket:lease-1', 'se-worker-02', 60000), false);
  assert.equal(bus.release_lease('ticket:lease-1', 'se-worker-01'), true);
  assert.equal(bus.acquire_lease('ticket:lease-1', 'se-worker-02', 60000), true);

  // 2. native agent signals and XML markup notifications
  const sig = bus.send_signal('se-worker-01', {
    from: 'sdlc-supervisor',
    kind: 'ticket_ready',
    text: 'ticket t-99 is ready for claim'
  });
  assert.ok(sig.xml.includes('<signal'));
  const notif = bus.create_notification('se-worker-01', {
    category: 'gate_alert',
    priority: 'high',
    subject: 'gate 2 review',
    body: 'all assertions passed'
  });
  assert.ok(notif.xml);
  const drained = bus.drain_signals('se-worker-01');
  assert.equal(drained.signals.length, 2);
  assert.ok(drained.summary);
  assert.equal(bus.drain_signals('se-worker-01').signals.length, 0);

  // 3. native A2AAgent registration for remote specialist agents
  const a2a = bus.register_a2a_agent({
    id: 'remote-sec-scanner',
    name: 'remote-sec-scanner',
    agent_url: 'https://agents.internal.example/a2a/sec-scanner'
  });
  assert.equal(a2a.compatible, true);
  assert.equal(bus.list_a2a_agents().length, 1);

  // 4. native Workspace (LocalFilesystem + LocalSandbox) blocks .sdlc/store in before hook
  const ws = create_harness_workspace({ workspace_root: tmp });
  assert.ok(ws.filesystem);
  assert.ok(ws.sandbox);
  await assert.rejects(
    async () => {
      await ws.tools.hooks.before('mastra_workspace_read_file', { path: '.sdlc/store/prds/prd-1.json' });
    },
    /store_isolation_violation/
  );

  // 5. native ReviewGatekeeper MastraScorer (createScorer / runEvals)
  const scorers = gatekeeper.get_scorers();
  assert.ok(scorers.gate_1_planning);
  assert.ok(scorers.gate_2_implementation);
  const score_res = await gatekeeper.evaluate_with_scorer({
    gate_id: 'gate_2_implementation',
    tests_passing: true,
    immutability_passed: true
  });
  assert.equal(score_res.decision, 'passed');
  assert.equal(score_res.verdict, 'passed');
  assert.equal(score_res.score, 1.0);
  assert.equal(score_res.mastra_scorer_score, 1.0);
});

test('supervisor-board: enforces declarative sdlc rules engine (dmn tables, condition trees, and maude 3 formal verification of all 25 processes)', () => {
  const rules_engine = create_sdlc_rules_engine();

  // 1. dmn table evaluation for review gates
  const gate1_fail = rules_engine.evaluate_dmn('gate_evaluation_dmn', {
    gate_id: 'gate_1_planning',
    prd_approved: true,
    adr_count: 0
  });
  assert.equal(gate1_fail.matched_rule_ids.includes('dmn-g1-adr'), true);
  assert.equal(gate1_fail.primary_output.passed, false);
  assert.equal(gate1_fail.primary_output.violation, 'missing_approved_adrs');

  const gate2_pass = rules_engine.evaluate_dmn('gate_evaluation_dmn', {
    gate_id: 'gate_2_implementation',
    tests_passing: true,
    immutability_valid: true
  });
  assert.equal(gate2_pass.matched_rule_ids.length, 0);

  // 2. dmn table evaluation for git operation policy (developer vs pm separation of duties)
  const dev_direct_main = rules_engine.evaluate_dmn('git_operation_policy_dmn', {
    operation: 'commit',
    actor_role: 'software-engineer',
    target_branch_type: 'protected',
    has_supervisor_sig: true,
    has_agent_sig: true,
    tree_hash_matches: true
  });
  assert.equal(dev_direct_main.primary_output.allowed, false);
  assert.equal(dev_direct_main.primary_output.violation, 'direct_commit_to_protected_branch_forbidden');

  const dev_feat_branch = rules_engine.evaluate_dmn('git_operation_policy_dmn', {
    operation: 'commit',
    actor_role: 'software-engineer',
    target_branch_type: 'feature',
    has_supervisor_sig: true,
    has_agent_sig: true,
    tree_hash_matches: true
  });
  assert.equal(dev_feat_branch.primary_output.allowed, true);

  const pm_merge_ready = rules_engine.evaluate_dmn('git_operation_policy_dmn', {
    operation: 'merge',
    actor_role: 'product-manager',
    target_branch_type: 'protected',
    has_supervisor_sig: true,
    has_agent_sig: true,
    has_qa_sig: true,
    has_sec_sig: true,
    has_pm_sig: true,
    tree_hash_matches: true
  });
  assert.equal(pm_merge_ready.primary_output.allowed, true);

  // 3. declarative condition-tree rules
  const eval_commit = rules_engine.evaluate_rules('git_commit', {
    target_branch_type: 'protected',
    has_supervisor_sig: true,
    has_agent_sig: true,
    tree_hash_matches: true
  });
  assert.equal(eval_commit.passed, false);
  assert.equal(eval_commit.violations[0].rule_id, 'rule-git-commit-signed-trailers');

  // 4. maude 3 formal rewriting-logic verification across all 25 high-level sdlc processes
  const maude_summary = rules_engine.verify_all_processes_with_maude(HIGH_LEVEL_PROCESS_PROFILES);
  assert.equal(maude_summary.total_processes, 25);
  assert.equal(maude_summary.all_verified, true);
  assert.equal(maude_summary.total_deadlocks, 0);
});

test('supervisor-board: enforces brotli pointer compression, real-world git/pr separation of duties, and local + server pre-receive verification', async () => {
  const { harness } = create_isolated_env();
  const git_prov = create_git_governance_provenance({
    rules_engine: harness.get_rules_engine()
  });

  // 1. brotli payload compression and lightweight content pointers
  const large_payload = {
    title: 'comprehensive architecture specification',
    sections: Array.from({ length: 40 }, (_, i) => `section-${i}: detailed specification content with repetitive tokens`)
  };
  const compressed = compress_payload(large_payload);
  assert.equal(compressed.encoding, 'br');
  assert.ok(compressed.compressed_bytes < compressed.original_bytes);
  const restored = decompress_payload(compressed);
  assert.deepEqual(restored, large_payload);

  const pointer = create_content_pointer('adr', 'adr-001', large_payload, {
    branch: 'feat/payment-gateway'
  });
  assert.equal(pointer.entity_type, 'adr');
  assert.equal(pointer.entity_id, 'adr-001');
  assert.equal(pointer.sha256.length, 64);
  assert.ok(pointer.compressed_bytes < pointer.original_bytes);

  // 2. developer creates feature branch and commits with ed25519 trailers (direct commit to main is blocked)
  const branch_rec = git_prov.create_feature_branch({
    epic_id: 'payment-gateway',
    worker_id: 'se-worker-01'
  });
  assert.equal(branch_rec.name, 'feat/payment-gateway');

  assert.throws(() => {
    git_prov.developer_commit({
      epic_id: 'payment-gateway',
      ticket_id: 'payment-gateway:impl',
      worker_id: 'se-worker-01',
      role: 'software-engineer',
      branch: 'main',
      supervisor_token: 'sup-tok-123',
      message: 'feat(payment): rogue direct commit to main'
    });
  }, /git_commit_rejected/);

  const dev_commit = git_prov.developer_commit({
    epic_id: 'payment-gateway',
    ticket_id: 'payment-gateway:impl',
    worker_id: 'se-worker-01',
    role: 'software-engineer',
    branch: 'feat/payment-gateway',
    phase: 'phase_04_tdd_green',
    supervisor_token: 'sup-tok-123',
    message: 'feat(payment): implement idempotent charge handler',
    files: { 'src/charge.js': 'export const charge = () => true;' }
  });
  assert.ok(dev_commit.commit_sha);
  assert.ok(dev_commit.trailers['sdlc-agent-sig']);
  assert.ok(dev_commit.trailers['sdlc-supervisor-token-sig']);

  // 3. local git hook verification accepts valid signed commit and rejects tampered tree hash
  const local_ok = git_prov.verify_local_commit(dev_commit);
  assert.equal(local_ok.valid, true);

  const tampered_commit = {
    ...dev_commit,
    tree_sha256: '0000000000000000000000000000000000000000000000000000000000000000'
  };
  const local_tampered = git_prov.verify_local_commit(tampered_commit);
  assert.equal(local_tampered.valid, false);
  assert.ok(local_tampered.violations.includes('git_tree_sha256_mismatch'));

  // 4. developer opens PR; PM cannot merge before QA and Security attestations
  const pr = git_prov.open_pull_request({
    epic_id: 'payment-gateway',
    source_branch: 'feat/payment-gateway',
    target_branch: 'main',
    commit_sha: dev_commit.commit_sha,
    author_worker_id: 'se-worker-01',
    title: 'feat(payment-gateway): charge handler'
  });
  assert.equal(pr.status, 'open');

  assert.throws(() => {
    git_prov.pm_review_and_merge_pr({
      pr_id: pr.pr_id,
      pm_worker_id: 'pm-worker-01',
      actor_role: 'product-manager'
    });
  }, /pr_merge_rejected/);

  // 5. independent QA and Security agents verify PR commit_sha and attach ed25519 attestations
  git_prov.attach_role_attestation({
    pr_id: pr.pr_id,
    role: 'qa-engineer',
    worker_id: 'qa-worker-01',
    verdict: 'passed',
    metrics: { total_tests: 42, failed_tests: 0 }
  });
  git_prov.attach_role_attestation({
    pr_id: pr.pr_id,
    role: 'security-engineer',
    worker_id: 'sec-worker-01',
    verdict: 'passed',
    metrics: { critical_findings: 0 }
  });

  // 6. PM reviews and merges PR into main with multi-signature merge receipt
  const merged = git_prov.pm_review_and_merge_pr({
    pr_id: pr.pr_id,
    pm_worker_id: 'pm-worker-01',
    actor_role: 'product-manager'
  });
  assert.equal(merged.merged, true);
  assert.equal(merged.pr.status, 'merged');
  assert.ok(merged.merge_commit.trailers['sdlc-qa-sig']);
  assert.ok(merged.merge_commit.trailers['sdlc-sec-sig']);
  assert.ok(merged.merge_commit.trailers['sdlc-pm-approval-sig']);
  assert.ok(merged.merge_commit.trailers['sdlc-supervisor-receipt-sig']);

  // 7. server-side pre-receive hook verifies full chain on refs/heads/main and blocks unmerged direct pushes
  const pre_receive_main_ok = git_prov.verify_server_pre_receive({
    ref_name: 'refs/heads/main',
    commits: [dev_commit, merged.merge_commit]
  });
  assert.equal(pre_receive_main_ok.accepted, true);

  const pre_receive_direct_push_blocked = git_prov.verify_server_pre_receive({
    ref_name: 'refs/heads/main',
    commits: [dev_commit]
  });
  assert.equal(pre_receive_direct_push_blocked.accepted, false);
  assert.ok(
    pre_receive_direct_push_blocked.violations.some((v) =>
      v.includes('unapproved_push_to_protected_branch')
    )
  );

  // 8. end-to-end develop-feature run with physical git repo (exec_git: true) on disk
  const git_tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-real-git-'));
  temp_dirs.push(git_tmp);
  const git_store = create_document_entity_store({
    workspace_root: git_tmp,
    store_root: path.join(git_tmp, '.sdlc', 'store')
  });
  const git_harness = create_dual_engine_harness({
    workspace_root: git_tmp,
    store_root: path.join(git_tmp, '.sdlc', 'store'),
    store: git_store,
    exec_git: true,
    session_id: `test-real-git-${Date.now()}`
  });

  // verify physical .git/hooks/commit-msg is installed and blocks unsigned raw git commits
  assert.equal(fs.existsSync(path.join(git_tmp, '.git', 'hooks', 'commit-msg')), true);
  assert.throws(() => {
    execFileSync('git', ['commit', '--allow-empty', '-m', 'feat: rogue unsigned commit'], {
      cwd: git_tmp,
      stdio: 'pipe'
    });
  });

  const e2e = await git_harness.run_process('develop-feature', { name: 'crypto-ledger' });
  assert.equal(e2e.board_summary.all_completed, true);
  assert.equal(e2e.maude_verification.verified, true);
  const ledger_prs = git_harness.get_git_provenance().list_pull_requests({ epic_id: 'crypto-ledger' });
  assert.equal(ledger_prs.length, 1);
  assert.equal(ledger_prs[0].status, 'merged');

  // verify physical git log on main has the merge commit and feature commit, and git notes has qa/sec attestations
  const real_log = git_harness.get_git_provenance().get_git_log('main', 10);
  assert.ok(real_log.length >= 3);
  assert.ok(real_log[0].subject.includes('merge(crypto-ledger): merge pr-crypto-ledger-01'));
  const head_check = git_harness.get_git_provenance().verify_local_commit(real_log[0].commit_sha);
  assert.equal(head_check.valid, true);
  assert.equal(head_check.is_merge_commit, true);

  const notes_raw = execFileSync(
    'git',
    ['notes', '--ref=refs/notes/sdlc-attestations', 'show', ledger_prs[0].commit_sha],
    { cwd: git_tmp, encoding: 'utf-8' }
  );
  assert.ok(notes_raw.includes('qa-engineer'));
  assert.ok(notes_raw.includes('security-engineer'));

  // 9. cli blocks direct tier 1 & tier 2 internal workflow execution and exposes domain nouns/verbs
  const cli_file = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../bin/cli.js');
  assert.throws(() => {
    execFileSync(process.execPath, [cli_file, 'workflows', 'run', 'pm-prd-authoring'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  }, /unauthorized_direct_tier2_execution/);
  assert.throws(() => {
    execFileSync(process.execPath, [cli_file, 'agents', 'run', 'software-engineer'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  }, /unauthorized_direct_tier2_execution/);
  assert.throws(() => {
    execFileSync(process.execPath, [cli_file, 'processes', 'run', 'develop-feature', 'rogue'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  }, /unauthorized_direct_tier1_execution/);
  assert.throws(() => {
    execFileSync(process.execPath, [cli_file, 'work-items', 'execute'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  }, /unauthorized_direct_tier1_execution/);
  assert.throws(() => {
    execFileSync(process.execPath, [cli_file, 'board', 'create', 'develop-feature', 'rogue'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  }, /unauthorized_direct_tier1_execution/);

  // 10. cli executes domain noun-verb commands (feature create, defect create) cleanly and persists code/tests by default
  const cli_feat_out = execFileSync(
    process.execPath,
    [cli_file, 'feature', 'create', 'token-vault', 'hardware-backed token vault', `--workspace=${git_tmp}`],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_feat_out.includes("feature 'token-vault' created: completed=true"));
  assert.equal(fs.existsSync(path.join(git_tmp, 'src', 'token-vault.js')), true);
  assert.equal(fs.existsSync(path.join(git_tmp, 'tests', 'token-vault.test.js')), true);

  const cli_defect_out = execFileSync(
    process.execPath,
    [cli_file, 'defect', 'create', 'null-pointer-login', `--workspace=${git_tmp}`, '--persist=false'],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_defect_out.includes("defect 'null-pointer-login' completed=true"));
});

test('interactive discovery chat, inline/file briefs, and mid-process clarification resolution', async () => {
  const { harness, store } = create_isolated_env();

  // 1. multi-turn interactive inception chat with product-manager agent gathers problem, audience, criteria, and reqs
  const chat_res = await harness.run_inception_chat({
    name: 'session-vault',
    silent: true,
    responses: [
      'encrypted session token storage with automatic key rotation',
      'backend authentication microservices',
      'tokens encrypted at rest with chacha20-poly1305; expired sessions purged within 60s',
      'expose create_session_vault factory; zero host map or class usage'
    ]
  });
  assert.equal(chat_res.cancelled, false);
  assert.equal(chat_res.brief.problem_statement, 'encrypted session token storage with automatic key rotation');
  assert.equal(chat_res.brief.target_audience, 'backend authentication microservices');
  assert.equal(chat_res.brief.acceptance_criteria.length, 2);
  assert.equal(chat_res.brief.functional_requirements.length, 2);

  // 2. running develop-feature with the chat inputs persists the user's specification into .sdlc/store prd and stories
  const proc_res = await harness.run_process('develop-feature', {
    ...chat_res.inputs,
    name: 'session-vault',
    inputs: chat_res.inputs
  });
  assert.equal(proc_res.board_summary.all_completed, true);

  const stored_prd = store.get_entity(DocumentEntityTypes.PRD, 'prd-session_vault');
  assert.ok(stored_prd);
  assert.equal(
    stored_prd.executive_summary.problem,
    'encrypted session token storage with automatic key rotation'
  );
  assert.ok(
    stored_prd.executive_summary.strategic_context.includes('backend authentication microservices')
  );
  assert.equal(stored_prd.functional_requirements.length, 2);
  assert.equal(stored_prd.functional_requirements[0].title, 'expose create_session_vault factory');
  const session_vault_tree = store.query_by_prd('prd-session_vault');
  assert.equal(session_vault_tree.stories.length, 2);

  // 3. markdown specification file parsing (--file)
  const spec_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-spec-'));
  temp_dirs.push(spec_dir);
  const spec_file = path.join(spec_dir, 'audit-trail.md');
  fs.writeFileSync(
    spec_file,
    [
      '# immutable audit trail',
      '## problem statement',
      'tamper-evident hash-chained audit log for governance events',
      '## target audience',
      'security compliance auditors',
      '## acceptance criteria',
      '- every event includes previous sha256 digest',
      '- chain verification detects any mutated record',
      '## functional requirements',
      '- append_audit_event function',
      '- verify_audit_chain function'
    ].join('\n'),
    'utf-8'
  );

  const file_brief = harness.parse_brief({ name: 'audit-trail', file: spec_file });
  assert.equal(file_brief.has_explicit_brief, true);
  assert.equal(file_brief.source, 'markdown_file');
  assert.equal(file_brief.problem_statement, 'tamper-evident hash-chained audit log for governance events');
  assert.equal(file_brief.acceptance_criteria.length, 2);
  assert.equal(file_brief.functional_requirements.length, 2);

  // 4. require_brief pauses root ticket in awaiting_input until clarified via clarify_process
  const paused_run = await harness.run_process('develop-feature', {
    name: 'mystery-feature',
    require_brief: true
  });
  assert.equal(paused_run.board_summary.all_completed, false);
  assert.equal(paused_run.board_summary.counts.awaiting_input, 1);

  const clarified_run = await harness.clarify_process({
    epic_id: 'mystery-feature',
    silent: true,
    answer: 'rate-limited webhook dispatcher with exponential backoff',
    acceptance_criteria: ['retries 5xx responses with jitter', 'respects per-tenant rate limits']
  });
  assert.equal(clarified_run.resolved_count, 1);
  assert.equal(clarified_run.board_summary.all_completed, true);

  const mystery_prd = store.get_entity(DocumentEntityTypes.PRD, 'prd-mystery_feature');
  assert.ok(mystery_prd);
  assert.equal(
    mystery_prd.executive_summary.problem,
    'rate-limited webhook dispatcher with exponential backoff'
  );

  // 5. top-level cli chat verb and implicit chat on feature create without description
  const cli_file = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../bin/cli.js');
  const cli_chat_out = execFileSync(
    process.execPath,
    [
      cli_file,
      'chat',
      'key-rotator',
      '--chat-inputs=automated ed25519 key rotation|platform ops|zero-downtime rotation; audit receipt|/done',
      `--workspace=${spec_dir}`,
      '--persist=false'
    ],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_chat_out.includes("feature 'key-rotator' created from chat: completed=true"));

  const cli_implicit_create_out = execFileSync(
    process.execPath,
    [
      cli_file,
      'feature',
      'create',
      'implicit-vault',
      '--chat-inputs=zero-trust secret store|backend services|encrypted storage; rotation|/done',
      `--workspace=${spec_dir}`,
      '--persist=false'
    ],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_implicit_create_out.includes("feature 'implicit-vault' created: completed=true"));

  assert.throws(() => {
    execFileSync(process.execPath, [cli_file, 'feature', 'chat', 'rogue'], {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  }, /unknown feature verb: chat/);

  // 6. interactive agentic chat with sdlc-supervisor, specialist consultation, agent switching, and tool execution
  const hello_probe_session = await harness.run_agentic_chat({
    silent: true,
    responses: ['helloworld', '/exit']
  });
  assert.equal(hello_probe_session.cancelled, false);
  assert.equal(hello_probe_session.tool_calls.length, 0);
  assert.equal(hello_probe_session.draft_was_populated, false);
  assert.equal(hello_probe_session.process_result, null);
  assert.ok(hello_probe_session.transcript.some((t) => t.text === 'sdlc-supervisor> 42'));

  const cli_hello_out = execFileSync(
    process.execPath,
    [
      cli_file,
      'chat',
      '--chat-inputs=helloworld|how are you?|what features do we have?|what are the review gates?|explain the phases|/exit',
      `--workspace=${spec_dir}`,
      '--persist=false'
    ],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_hello_out.includes('sdlc-supervisor> 42'));
  assert.ok(cli_hello_out.includes('sdlc-supervisor> i am online and ready as sdlc-supervisor'));
  assert.ok(cli_hello_out.includes('tool:list_entities'));
  assert.ok(cli_hello_out.includes('gate_1_planning'));
  assert.ok(cli_hello_out.includes('phase_00_inception'));
  assert.ok(!cli_hello_out.includes('tool:update_specification_draft'));
  assert.ok(!cli_hello_out.includes('created from chat'));

  const agentic_session = await harness.run_agentic_chat({
    silent: true,
    responses: [
      'status',
      'list features',
      'ask security-engineer about token encryption',
      'switch to system-architect',
      'create feature agentic-vault zero-knowledge session storage',
      '/exit'
    ]
  });
  assert.equal(agentic_session.cancelled, false);
  assert.equal(agentic_session.active_agent, 'system-architect');
  assert.ok(agentic_session.tool_calls.some((tc) => tc.tool === 'inspect_workspace_status'));
  assert.ok(agentic_session.tool_calls.some((tc) => tc.tool === 'list_entities'));
  assert.ok(agentic_session.tool_calls.some((tc) => tc.tool === 'consult_specialist_agent'));
  assert.ok(agentic_session.tool_calls.some((tc) => tc.tool === 'switch_active_agent'));
  assert.ok(agentic_session.tool_calls.some((tc) => tc.tool === 'execute_sdlc_process'));
  assert.ok(agentic_session.process_result);
  assert.equal(agentic_session.process_result.epic.id, 'agentic-vault');
  assert.equal(agentic_session.process_result.board_summary.all_completed, true);

  const cli_agent_chat_out = execFileSync(
    process.execPath,
    [
      cli_file,
      'chat',
      'product-manager',
      '--chat-inputs=status|ask system-architect about module boundaries|/exit',
      `--workspace=${spec_dir}`,
      '--persist=false'
    ],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_agent_chat_out.includes('active agent: product-manager'));
  assert.ok(cli_agent_chat_out.includes('tool:inspect_workspace_status'));
  assert.ok(cli_agent_chat_out.includes('tool:consult_specialist_agent'));

  // 7. concise tool trace formatting, raw json prose conversion, and live progress telemetry
  const draft_trace = format_tool_trace_summary(
    'update_specification_draft',
    {
      name: 'dashboard-chat',
      problem_statement: 'interactive chat interface',
      functional_requirements: ['channels', 'multi-agent invite'],
      acceptance_criteria: ['passes unit tests']
    },
    { name: 'dashboard-chat' }
  );
  assert.ok(draft_trace.includes("draft='dashboard-chat' updated:"));
  assert.ok(draft_trace.includes('functional_requirements[2]'));
  assert.ok(!draft_trace.includes('{'));

  const prose_from_json = format_chat_reply_prose('{"status":"approved","tickets_completed":9,"features":["channels","mentions"]}');
  assert.ok(prose_from_json.includes('- status: approved'));
  assert.ok(prose_from_json.includes('- tickets completed: 9'));
  assert.ok(!prose_from_json.includes('{'));

  const status_events = [];
  const custom_io = create_terminal_chat_io({
    responses: ['create feature progress-demo live progress telemetry', '/exit'],
    silent: true,
    status: (line) => status_events.push(line)
  });
  await harness.run_agentic_chat({
    io: custom_io,
    silent: true
  });
  assert.ok(status_events.some((line) => line.includes('thinking...')));
  assert.ok(status_events.some((line) => line.includes("initiating 'develop-feature' for 'progress-demo'")));
  assert.ok(status_events.some((line) => line.includes('working on progress-demo:prd')));
  assert.ok(status_events.some((line) => line.includes('completed progress-demo:prd')));
  assert.ok(status_events.some((line) => line.includes('evaluating prompt')));
  assert.ok(status_events.some((line) => line.includes('step:discoverRequirements')));
  assert.ok(status_events.some((line) => line.includes('step:formatPrdDocument')));
  assert.ok(status_events.some((line) => line.includes('step:authorFailingTests')));
  assert.ok(status_events.some((line) => line.includes('step:authorImplementationCode')));
  assert.ok(status_events.some((line) => line.includes('[tier-1 xstate] phase transition:')));
  assert.ok(status_events.some((line) => line.includes('[tier-1 gatekeeper] gate_1_planning: passed')));
  assert.ok(status_events.some((line) => line.includes('[tier-1 gatekeeper] gate_2_implementation: passed')));
  assert.ok(status_events.some((line) => line.includes('[tier-1 gatekeeper] gate_3_qa_security: passed')));
  assert.ok(status_events.some((line) => line.includes('[tier-1 gatekeeper] gate_4_release: passed')));
  assert.equal(harness.get_active_work_item().phase, 'completed');
  assert.equal(harness.get_macro_phase(), 'idle');

  // 8. multi-turn requirement gathering followed by "i am satisfied, execute the sdlc process"
  //    plus re-running an existing epic without throwing dag_cycle_detected
  const multi_turn_session = await harness.run_agentic_chat({
    name: 'progress-demo',
    silent: true,
    responses: [
      'top status bar layout with responsive terminal resize handling',
      'audience: cli developers',
      'criteria: displays active phase; handles terminal resize',
      'i am satisfied, execute the sdlc process',
      '/exit'
    ]
  });
  assert.ok(multi_turn_session.tool_calls.some((tc) => tc.tool === 'execute_sdlc_process'));
  assert.ok(multi_turn_session.process_result);
  assert.equal(multi_turn_session.process_result.epic.id, 'progress-demo');
  assert.equal(multi_turn_session.process_result.board_summary.all_completed, true);
  assert.equal(harness.get_active_work_item().phase, 'completed');
  assert.equal(harness.get_macro_phase(), 'idle');

  // 9. deterministic catalogue enumeration across successive calls + concurrent multi-work-item management
  const catalog_session = await harness.run_agentic_chat({
    silent: true,
    responses: [
      'enumerate the phases and gates',
      'what are the phases and gates?',
      'enumerate the tiers and entities',
      'work create feature concurrent-feat-a real-time dashboard widgets',
      'work create fix concurrent-fix-b race condition in token lease',
      'work create refactor concurrent-ref-c extract pure dictionary helpers',
      'work list',
      'work switch concurrent-feat-a',
      'work advance concurrent-feat-a',
      'work run concurrent-fix-b',
      '/exit'
    ]
  });

  const assistant_replies = catalog_session.transcript
    .filter((t) => t.speaker !== 'user')
    .map((t) => t.text);
  // index 0 is greeting; index 1 and index 2 are the two successive phase+gate enumerations
  assert.equal(assistant_replies[1], assistant_replies[2]);
  assert.ok(assistant_replies[1].includes('sdlc macro phases (10):'));
  assert.ok(assistant_replies[1].includes('formal review gates (5):'));
  assert.ok(assistant_replies[1].includes('phase_01_specifications'));
  assert.ok(assistant_replies[1].includes('gate_ingest'));
  assert.ok(assistant_replies[3].includes('tier 1: deterministic governance & state engine'));
  assert.ok(assistant_replies[3].includes('tier 2: mastra agentic & workflow execution engine'));

  const tracked_work = harness.list_work_items();
  const feat_a = harness.get_work_item('concurrent-feat-a');
  const fix_b = harness.get_work_item('concurrent-fix-b');
  const ref_c = harness.get_work_item('concurrent-ref-c');
  assert.ok(tracked_work.length >= 3);
  assert.equal(feat_a.type, 'feature');
  assert.equal(feat_a.phase, 'specification');
  assert.equal(feat_a.focused, true);
  assert.equal(fix_b.type, 'fix');
  assert.equal(fix_b.phase, 'completed');
  assert.equal(fix_b.board_summary.all_completed, true);
  assert.equal(ref_c.type, 'refactor');
  assert.equal(ref_c.phase, 'baseline_audit');

  // cli work noun verification
  const work_session_id = `work-cli-${Date.now()}`;
  const cli_work_create_1 = execFileSync(
    process.execPath,
    [cli_file, 'work', 'create', 'feature', 'alpha-work', 'alpha feature spec', `--session=${work_session_id}`, `--workspace=${spec_dir}`],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_work_create_1.includes("work 'alpha-work' [feature] created at phase 'inception'"));

  const cli_work_create_2 = execFileSync(
    process.execPath,
    [cli_file, 'work', 'create', 'fix', 'beta-fix', 'beta bugfix spec', `--session=${work_session_id}`, `--workspace=${spec_dir}`],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_work_create_2.includes("work 'beta-fix' [fix] created at phase 'defect_intake'"));
  assert.ok(cli_work_create_2.includes('concurrent_work_items=2'));

  const cli_work_list = execFileSync(
    process.execPath,
    [cli_file, 'work', 'list', `--session=${work_session_id}`, `--workspace=${spec_dir}`],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_work_list.includes('concurrent work items (2):'));
  assert.ok(cli_work_list.includes('alpha-work [feature]'));
  assert.ok(cli_work_list.includes('beta-fix [fix]'));

  const cli_work_switch = execFileSync(
    process.execPath,
    [cli_file, 'work', 'switch', 'alpha-work', `--session=${work_session_id}`, `--workspace=${spec_dir}`],
    { encoding: 'utf-8' }
  );
  assert.ok(cli_work_switch.includes("switched active work focus to 'alpha-work' [feature]"));

  // 10. asking "list the statecharts" in chat (even with an active work item focused)
  //     invokes inspect_sdlc_catalog({ category: 'statecharts' }) and never triggers mutating tools
  const statechart_chat_session = await harness.run_agentic_chat({
    silent: true,
    responses: [
      'list the statecharts',
      '/statecharts',
      '/exit'
    ]
  });
  const statechart_catalog_calls = statechart_chat_session.tool_calls.filter(
    (tc) => tc.tool === 'inspect_sdlc_catalog' && tc.output?.category === 'statecharts'
  );
  assert.equal(statechart_catalog_calls.length, 2);
  assert.equal(statechart_catalog_calls[0].output.statecharts.length, 9);
  assert.equal(
    statechart_chat_session.tool_calls.some((tc) =>
      ['execute_sdlc_process', 'apply_direct_code_fix', 'update_specification_draft', 'manage_work_items'].includes(tc.tool)
    ),
    false
  );
});
