/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test suite for coupled dual-engine sdlc development harness
 * verbose: verifies macro statechart lifecycle transitions (xstate v5), transition invariant
 * guards, review gate verification, task backlog dag topological sorting, and mastra workflow
 * micro execution. written as red test suite for phase 03 tdd.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * assertions executed by vitest runner
 * 
 * section: example
 * node --test packages/sdlc/packages/dual-engine-harness/tests/dual-engine-harness.test.js
 */

import { test, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Workflow, createStep } from '@mastra/core/workflows';

const exec_file_async = promisify(execFile);
import {
  create_dual_engine_harness,
  create_macro_statechart,
  create_task_dag_runner,
  create_review_gatekeeper,
  verify_test_immutability,
  create_mastra_execution_bridge,
  create_harness_skills,
  create_role_agents,
  create_antigravity_language_model,
  resolve_harness_model
} from '../src/index.js';

test('dual-engine: initialises macro statechart in phase_00_inception', () => {
  const harness = create_dual_engine_harness({ session_id: 'test-session-001' });
  assert.equal(harness.get_active_phase(), 'phase_00_inception');
  assert.equal(harness.get_active_gate(), null);
});

test('dual-engine: rejects invalid phase transition skipping prerequisite review gates', () => {
  const harness = create_dual_engine_harness({ session_id: 'test-session-002' });
  assert.throws(
    () => {
      harness.send_event({
        type: 'phase_transition_request',
        target_phase: 'phase_04_tdd_green'
      });
    },
    /invalid_phase_transition/
  );
});

test('dual-engine: gate 1 blocks transition when specifications or adrs are missing', async () => {
  const gatekeeper = create_review_gatekeeper();
  const evaluation = await gatekeeper.evaluate_gate({
    gate_id: 'gate_1_planning',
    artefacts: []
  });
  assert.equal(evaluation.decision, 'blocked');
  assert.ok(evaluation.violations.length > 0);
});

test('dual-engine: task dag runner sorts nodes in topological order', () => {
  const runner = create_task_dag_runner();
  const dag = {
    nodes: [
      { id: 'task-c', depends_on: ['task-b'] },
      { id: 'task-a', depends_on: [] },
      { id: 'task-b', depends_on: ['task-a'] }
    ]
  };
  const execution_order = runner.compute_topological_order(dag);
  assert.ok(execution_order.length === 3 && execution_order[0] === 'task-a' && execution_order[1] === 'task-b' && execution_order[2] === 'task-c');
});

test('dual-engine: suspends session and resumes with verified state snapshot', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-session-003' });
  const snapshot_path = await harness.suspend_session('awaiting human sign-off');
  assert.ok(snapshot_path.includes('test-session-003'));

  const resumed = await harness.resume_session(snapshot_path, { action: 'approve' });
  assert.equal(resumed.session_id, 'test-session-003');
});

test('dual-engine: test immutability verifier detects decreased assertion count', () => {
  const baseline_code = `
    test('sample', () => {
      assert.equal(1, 1);
      assert.equal(2, 2);
    });
  `;
  const weakened_code = `
    test('sample', () => {
      assert.equal(1, 1);
    });
  `;
  const result = verify_test_immutability(baseline_code, weakened_code);
  assert.equal(result.valid, false);
  assert.equal(result.delta, -1);
  assert.ok(result.violations.some((v) => v.includes('assertion count decreased')));
});

test('dual-engine: task dag runner throws on cyclic dependencies', () => {
  const runner = create_task_dag_runner();
  const cyclic_dag = {
    nodes: [
      { id: 'task-alpha', depends_on: ['task-beta'] },
      { id: 'task-beta', depends_on: ['task-alpha'] }
    ]
  };
  assert.throws(
    () => {
      runner.compute_topological_order(cyclic_dag);
    },
    /invalid_cyclic_dependency/
  );
});

test('dual-engine: gate 2 blocks transition when mutation score is below 80 percent', async () => {
  const gatekeeper = create_review_gatekeeper();
  const evaluation = await gatekeeper.evaluate_gate({
    gate_id: 'gate_2_implementation',
    tests_passing: true,
    immutability_passed: true,
    mutation_score: 72
  });
  assert.equal(evaluation.decision, 'blocked');
  assert.ok(evaluation.violations.includes('mutation_score_insufficient'));
});

test('dual-engine: gate 3 blocks transition on security audit failures', async () => {
  const gatekeeper = create_review_gatekeeper();
  const evaluation = await gatekeeper.evaluate_gate({
    gate_id: 'gate_3_qa_security',
    security_audit: 'failed',
    qa_passed: true
  });
  assert.equal(evaluation.decision, 'blocked');
  assert.ok(evaluation.violations.includes('security_vulnerabilities_detected'));
});

test('dual-engine: gate 4 blocks transition on unsealed receipts or dirty working tree', async () => {
  const gatekeeper = create_review_gatekeeper();
  const evaluation = await gatekeeper.evaluate_gate({
    gate_id: 'gate_4_release',
    receipt_signed: false,
    tag_clean: true
  });
  assert.equal(evaluation.decision, 'blocked');
  assert.ok(evaluation.violations.includes('unsigned_gate_receipt'));
});

test('dual-engine: test immutability verifier detects introduced test skips', () => {
  const baseline_code = `
    test('sample', () => {
      assert.equal(1, 1);
    });
  `;
  const skipped_code = `
    test.skip('sample', () => {
      assert.equal(1, 1);
    });
  `;
  const result = verify_test_immutability(baseline_code, skipped_code);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((v) => v.includes('test skipping introduced')));
});

test('dual-engine: statechart supports sequential lifecycle transition', () => {
  const statechart = create_macro_statechart();
  assert.equal(statechart.get_phase(), 'phase_00_inception');

  const p1 = statechart.transition({ target_phase: 'phase_01_specifications' });
  assert.equal(p1, 'phase_01_specifications');

  const p2 = statechart.transition({ target_phase: 'phase_02_architecture' });
  assert.equal(p2, 'phase_02_architecture');
});

test('dual-engine: rejects session_id with path traversal characters', () => {
  assert.throws(
    () => {
      create_dual_engine_harness({ session_id: '../../etc/passwd' });
    },
    /invalid_session_id/
  );
});

test('dual-engine: resume_session rejects snapshot path outside state directory', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-secure-001' });
  await assert.rejects(
    async () => {
      await harness.resume_session('/etc/shadow', { action: 'approve' });
    },
    /security_violation/
  );
});

test('dual-engine: mastra execution bridge scores task and records history', async () => {
  const bridge = create_mastra_execution_bridge();
  const outcome = await bridge.execute_task({ id: 'task-gen-01' }, 'coder', { code: 'const x = 1;' });
  assert.equal(outcome.task_id, 'task-gen-01');
  assert.equal(outcome.status, 'success');
  assert.ok(outcome.rubric_score >= 0.85);

  const history = bridge.get_execution_history();
  assert.equal(history.length, 1);
  assert.equal(history[0].task_id, 'task-gen-01');
});

test('dual-engine: harness tracks phase transition history', () => {
  const harness = create_dual_engine_harness({ session_id: 'test-history-001' });
  assert.equal(harness.get_history().length, 1);

  harness.send_event({ target_phase: 'phase_01_specifications' });
  assert.equal(harness.get_history().length, 2);
  assert.equal(harness.get_history()[1], 'phase_01_specifications');
});

test('dual-engine: harness executes task via coupled mastra bridge', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-exec-001' });
  const result = await harness.execute_task({ id: 'task-test-01' }, 'coder', {});
  assert.equal(result.task_id, 'task-test-01');
  assert.equal(result.status, 'success');
});

test('dual-engine: gatekeeper records sealed receipts on pass', async () => {
  const gatekeeper = create_review_gatekeeper();
  const res = await gatekeeper.evaluate_gate({
    gate_id: 'gate_1_planning',
    artefacts: ['prd-01.md', 'adr-001.md']
  });
  assert.equal(res.decision, 'passed');
  assert.equal(gatekeeper.get_receipts().length, 1);
  assert.equal(gatekeeper.get_receipts()[0].gate_id, 'gate_1_planning');
});

test('dual-engine: lists registered mastra workflows from mastra container', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-wf-list-001' });
  const workflows = await harness.list_workflows();
  assert.ok(Array.isArray(workflows));
  assert.ok(workflows.length > 0);
  assert.ok(workflows.some((w) => w.id === 'helloworld-workflow' || w.name === 'helloworld-workflow'));
});

test('dual-engine: executes registered mastra workflow through harness', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-wf-exec-001' });
  const run_result = await harness.execute_workflow('helloworld-workflow', { message: 'standalone-verification' });
  assert.equal(run_result.status, 'completed');
  assert.ok(run_result.history.length > 0);
  assert.equal(run_result.history[0].output.echo, 'standalone-verification');
});

test('dual-engine: ast validation in mastra pipeline flags syntax errors', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-ast-001' });
  const outcome = await harness.execute_task({ id: 'task-syntax-err' }, 'coder', {
    code: 'const invalid = ;'
  });
  assert.equal(outcome.status, 'remediation_required');
  assert.ok(outcome.diagnostics.length > 0);
  assert.ok(outcome.diagnostics.some((d) => d.includes('Unexpected token')));
});

test('dual-engine: exposes genuine xstate v5 state machine and actor', () => {
  const harness = create_dual_engine_harness({ session_id: 'test-xstate-001' });
  const machine = harness.get_machine();
  const actor = harness.get_actor();
  assert.ok(machine);
  assert.equal(machine.id, 'sdlc-macro-lifecycle');
  assert.ok(actor);
  assert.equal(typeof actor.send, 'function');
  assert.equal(typeof actor.getSnapshot, 'function');
  assert.equal(actor.getSnapshot().value, 'phase_00_inception');
});

test('dual-engine: xstate actor tracks state transitions and snapshots', () => {
  const harness = create_dual_engine_harness({ session_id: 'test-xstate-002' });
  const actor = harness.get_actor();
  assert.equal(actor.getSnapshot().value, 'phase_00_inception');
  harness.send_event({ target_phase: 'phase_01_specifications' });
  assert.equal(actor.getSnapshot().value, 'phase_01_specifications');
  harness.send_event({ target_phase: 'phase_02_architecture' });
  assert.equal(actor.getSnapshot().value, 'phase_02_architecture');
  harness.send_event({ target_phase: 'gate_1_evaluating' });
  assert.equal(actor.getSnapshot().value, 'gate_1_evaluating');
  assert.equal(harness.get_active_gate(), 'gate_1');
});

test('dual-engine: central pino log store records statechart and mastra events', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-log-001' });
  harness.send_event({ target_phase: 'phase_01_specifications' });
  await harness.execute_task({ id: 'task-log-01' }, 'coder', {
    code: 'export const a = 1;'
  });

  const logs = harness.get_logs();
  assert.ok(logs.length >= 3);

  const statechart_logs = harness.query_logs({ component: 'statechart' });
  assert.ok(statechart_logs.length > 0);
  assert.ok(statechart_logs.some((l) => l.event === 'statechart:transition:success'));

  const mastra_logs = harness.query_logs({ component: 'mastra' });
  assert.ok(mastra_logs.length > 0);
  assert.ok(mastra_logs.some((l) => l.event === 'mastra:task:start'));
  assert.ok(mastra_logs.some((l) => l.event === 'mastra:task:completed'));
});

test('dual-engine: central log store persists logs to disk when log_file is configured', async () => {
  const test_log_file = '.sdlc/logs/test-harness.log';
  const harness = create_dual_engine_harness({
    session_id: 'test-log-persist',
    log_file: test_log_file
  });

  harness.send_event({ target_phase: 'phase_01_specifications' });
  await harness.execute_workflow('helloworld-workflow', {});

  // small flush tick
  await new Promise((resolve) => setTimeout(resolve, 50));

  const fs = await import('node:fs');
  assert.ok(fs.existsSync(test_log_file));
  const raw_lines = fs.readFileSync(test_log_file, 'utf-8');
  assert.ok(raw_lines.includes('statechart:transition:success'));
  assert.ok(raw_lines.includes('helloworld-workflow'));
});

test('dual-engine: product manager agent workflow generates prd and user stories', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-pm-role-001' });
  const prd_res = await harness.execute_workflow('pm-prd-authoring', {
    feature_name: 'user-auth',
    problem_statement: 'users need secure authentication',
    target_audience: 'frontend developers',
    scope_boundaries: ['jwt tokens', 'refresh flow']
  });
  assert.equal(prd_res.status, 'completed');
  assert.ok(prd_res.history.length >= 2);
  const prd_out = prd_res.history[1].output;
  assert.ok(prd_out.prd_markdown.includes('product requirements document: user-auth'));

  const story_res = await harness.execute_workflow('pm-story-slicing', {
    feature_name: 'user-auth'
  });
  assert.equal(story_res.status, 'completed');
  assert.ok(story_res.history[0].output.stories.length > 0);
});

test('dual-engine: system architect agent workflow generates adr and interface schema', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-arch-role-001' });
  const adr_res = await harness.execute_workflow('arch-adr-authoring', {
    title: 'zero-host-collections-in-kernel',
    context: 'maintain pure piumarta meta-circularity',
    decision: 'ban Map and Set in core model'
  });
  assert.equal(adr_res.status, 'completed');
  assert.ok(adr_res.history[0].output.adr_markdown.includes('# adr: zero-host-collections-in-kernel'));

  const contract_res = await harness.execute_workflow('arch-interface-contract', {
    interface_name: 'SessionAuthInterface'
  });
  assert.equal(contract_res.status, 'completed');
  assert.equal(contract_res.history[0].output.contract_name, 'SessionAuthInterface');
});

test('dual-engine: software engineer agent workflow executes tdd implementation cycle', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-se-role-001' });
  const se_res = await harness.execute_workflow('se-feature-implementation', {
    task_id: 'auth-01',
    tests: 'assert.equal(1, 1);',
    code: 'export function auth() { return true; }'
  });
  assert.equal(se_res.status, 'completed');
  assert.equal(se_res.history.length, 4);
  const quality = se_res.history[3].output;
  assert.equal(quality.status, 'success');
  assert.ok(quality.rubric_score >= 0.8);
});

test('dual-engine: security engineer agent workflow analyzes stride threat vectors', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-sec-role-001' });
  const sec_res = await harness.execute_workflow('sec-threat-modeling', {
    feature_name: 'token-rotation'
  });
  assert.equal(sec_res.status, 'completed');
  const vectors = sec_res.history[0].output.vectors;
  assert.ok(vectors.spoofing);
  assert.ok(vectors.tampering);
  assert.ok(vectors.repudiation);
});

test('dual-engine: sovereign project lifecycle transitions through maintenance and retirement', () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-sovereign-001',
    project_state: 'active_development'
  });
  assert.equal(harness.get_project_state(), 'active_development');

  harness.enter_maintenance('scheduled security audit');
  assert.equal(harness.get_project_state(), 'maintenance_mode');

  harness.deprecate_project({ sunset_date: '2027-01-01' });
  assert.equal(harness.get_project_state(), 'deprecation');

  harness.commence_retirement({ reason: 'superseded by v2' });
  assert.equal(harness.get_project_state(), 'project_retirement');
});

test('dual-engine: work item execution pathways advance through deterministic stages', () => {
  const harness = create_dual_engine_harness({ session_id: 'test-workitem-001' });
  const item = harness.start_work_item({
    type: 'fix',
    name: 'fix-memory-leak'
  });
  assert.equal(item.type, 'fix');
  assert.equal(item.phase, 'defect_intake');
  assert.equal(harness.get_active_phase(), 'defect_intake');

  const step1 = harness.advance_work_item({ type: 'NEXT' });
  assert.equal(step1, 'reproduction_test');

  const step2 = harness.advance_work_item({ type: 'NEXT' });
  assert.equal(step2, 'patch_implementation');

  const active = harness.get_active_work_item();
  assert.equal(active.name, 'fix-memory-leak');
  assert.equal(active.phase, 'patch_implementation');
});

test('dual-engine: maintenance mode guard blocks new feature work items', () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-guard-maint',
    project_state: 'maintenance_mode'
  });
  assert.throws(
    () => {
      harness.start_work_item({ type: 'feature', name: 'new-search-bar' });
    },
    /maintenance_mode_active/
  );

  // hotfix should be permitted in maintenance mode
  const hotfix = harness.start_work_item({ type: 'hotfix', name: 'cve-fix' });
  assert.equal(hotfix.type, 'hotfix');
  assert.equal(hotfix.phase, 'incident_triage');
});

test('dual-engine: execute_work_item_stage advances feature through inception and specifications', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-stage-feature-01' });
  harness.start_work_item({
    type: 'feature',
    name: 'session-revocation',
    payload: { problem_statement: 'token theft mitigation' }
  });

  assert.equal(harness.get_active_work_item().phase, 'inception');

  const s1 = await harness.execute_work_item_stage();
  assert.equal(s1.stage_type, 'workflow');
  assert.ok(s1.executed_workflows.includes('pm-prd-authoring'));
  assert.equal(s1.advanced, true);
  assert.equal(harness.get_active_work_item().phase, 'specification');

  const s2 = await harness.execute_work_item_stage();
  assert.equal(s2.stage_type, 'workflow');
  assert.ok(s2.executed_workflows.includes('pm-story-slicing'));
  assert.equal(s2.advanced, true);
  assert.equal(harness.get_active_work_item().phase, 'architecture');

  const s3 = await harness.execute_work_item_stage();
  assert.equal(s3.stage_type, 'workflow');
  assert.ok(s3.executed_workflows.includes('arch-adr-authoring'));
  assert.ok(s3.executed_workflows.includes('arch-interface-contract'));
  assert.equal(s3.advanced, true);
  assert.equal(harness.get_active_work_item().phase, 'gate_1_evaluating');
});

test('dual-engine: execute_work_item_stage evaluates review gates and blocks on failure', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-stage-gate-01' });
  harness.start_work_item({ type: 'feature', name: 'api-rate-limit' });

  // advance to gate 1
  await harness.execute_work_item_stage(); // inception -> specification
  await harness.execute_work_item_stage(); // specification -> architecture
  await harness.execute_work_item_stage(); // architecture -> gate_1_evaluating

  assert.equal(harness.get_active_work_item().phase, 'gate_1_evaluating');

  // gate evaluation fails without artefacts
  const blocked = await harness.execute_work_item_stage({ artefacts: [] });
  assert.equal(blocked.stage_type, 'gate');
  assert.equal(blocked.decision, 'blocked');
  assert.equal(blocked.advanced, false);
  assert.equal(harness.get_active_work_item().phase, 'gate_1_evaluating');

  // gate evaluation succeeds with required artefacts
  const passed = await harness.execute_work_item_stage({
    artefacts: ['prd-rate-limit', 'adr-token-bucket']
  });
  assert.equal(passed.stage_type, 'gate');
  assert.equal(passed.decision, 'passed');
  assert.equal(passed.advanced, true);
  assert.equal(harness.get_active_work_item().phase, 'tdd_red');
});

test('dual-engine: execute_work_item_stage executes fix workflow pathway through patch and release', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-stage-fix-01' });
  harness.start_work_item({
    type: 'fix',
    name: 'fix-null-pointer',
    payload: { patch_code: 'export function fix() { return 42; }' }
  });

  assert.equal(harness.get_active_work_item().phase, 'defect_intake');

  const s1 = await harness.execute_work_item_stage();
  assert.equal(s1.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'reproduction_test');

  const s2 = await harness.execute_work_item_stage({ tests: 'assert.ok(true);' });
  assert.equal(s2.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'patch_implementation');

  const s3 = await harness.execute_work_item_stage();
  assert.equal(s3.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'regression_suite');

  const s4 = await harness.execute_work_item_stage({ assertion_delta: 1, skipped_tests: 0 });
  assert.equal(s4.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'gate_2_evaluating');

  const s5 = await harness.execute_work_item_stage({
    tests_passing: true,
    immutability_passed: true,
    mutation_score: 92
  });
  assert.equal(s5.stage_type, 'gate');
  assert.equal(s5.decision, 'passed');
  assert.equal(harness.get_active_work_item().phase, 'release');

  const s6 = await harness.execute_work_item_stage({ version: '0.1.1' });
  assert.equal(s6.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'completed');

  // subsequent execution on completed work item returns terminal status
  const terminal = await harness.execute_work_item_stage();
  assert.equal(terminal.stage_type, 'terminal');
  assert.equal(terminal.advanced, false);
});

test('dual-engine: execute_work_item_stage throws when no work item is active', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-no-work-item' });
  await assert.rejects(
    async () => {
      await harness.execute_work_item_stage();
    },
    /no_active_work_item/
  );
});

test('dual-engine: sovereign lifecycle supports approval, reactivation, and decommissioning', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-sovereign-full',
    project_state: 'uninitialised'
  });

  assert.equal(harness.get_project_state(), 'uninitialised');
  harness.start_project({ project_name: 'nebula-core' });
  assert.equal(harness.get_project_state(), 'project_inception');

  harness.approve_inception();
  assert.equal(harness.get_project_state(), 'active_development');

  harness.enter_maintenance('database schema migration');
  assert.equal(harness.get_project_state(), 'maintenance_mode');

  harness.reactivate_project();
  assert.equal(harness.get_project_state(), 'active_development');

  harness.deprecate_project({ sunset_date: '2026-12-31' });
  assert.equal(harness.get_project_state(), 'deprecation');

  harness.commence_retirement({ reason: 'sunset complete' });
  assert.equal(harness.get_project_state(), 'project_retirement');

  const decommission_result = await harness.decommission_project({ project_id: 'nebula-core' });
  assert.equal(decommission_result.sovereign_state, 'archived');
  assert.equal(harness.get_project_state(), 'archived');
  assert.equal(decommission_result.workflow_result.status, 'completed');
});

test('dual-engine: cli commands execute and report status accurately', async () => {
  const cli_path = fs.existsSync(path.resolve('bin/cli.js'))
    ? path.resolve('bin/cli.js')
    : path.resolve('packages/sdlc/packages/dual-engine-harness/bin/cli.js');

  const { stdout: status_out } = await exec_file_async(process.execPath, [cli_path, 'status', '--session=test-status-clean']);
  assert.ok(status_out.includes('sovereign project state: active_development'));
  assert.ok(status_out.includes('active macro phase: phase_00_inception'));

  const { stdout: wf_out } = await exec_file_async(process.execPath, [cli_path, 'role-workflow', 'list']);
  assert.ok(wf_out.includes('registered role workflows'));
  assert.ok(wf_out.includes('pm-prd-authoring'));

  const { stdout: immut_out } = await exec_file_async(process.execPath, [cli_path, 'immutability-check', '--current=10', '--baseline=10']);
  assert.ok(immut_out.includes('immutability verified: true'));
});

test('dual-engine: harness tools execute test runners, file writers, and git audits', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-tools-001' });
  const tools = harness.list_tools();
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length >= 4);
  assert.ok(tools.some((t) => t.id === 'harness-test-runner'));
  assert.ok(tools.some((t) => t.id === 'harness-artefact-writer'));
  assert.ok(tools.some((t) => t.id === 'harness-immutability-audit'));
  assert.ok(tools.some((t) => t.id === 'harness-git-status'));

  const immut_res = await harness.execute_tool('harness-immutability-audit', {
    baseline: 'assert.ok(true);',
    current: 'assert.ok(true); assert.equal(1, 1);'
  });
  assert.equal(immut_res.valid, true);
  assert.equal(immut_res.delta, 1);

  const runner_res = await harness.execute_tool('harness-test-runner', {
    command: 'node -e "process.exit(0)"'
  });
  assert.equal(runner_res.passed, true);

  const git_res = await harness.execute_tool('harness-git-status', {});
  assert.ok(typeof git_res.clean === 'boolean');
});

test('dual-engine: ingests custom workflows dynamically into live mastra container', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-custom-ingest-001' });

  const custom_step = createStep({
    id: 'customEcho',
    execute: async (params) => {
      const init = params.inputData || params.getInitData() || {};
      return { echo: init.payload || 'default' };
    }
  });

  const custom_wf = new Workflow({
    id: 'custom-extension-workflow',
    name: 'custom-extension-workflow'
  }).then(custom_step);
  custom_wf.commit();

  const ingested = harness.ingest_workflows({ 'custom-extension-workflow': custom_wf });
  assert.ok(Array.isArray(ingested));
  assert.ok(ingested.length > 0);
  assert.ok(ingested.includes('custom-extension-workflow'));

  const all_wf = await harness.list_workflows();
  assert.ok(all_wf.some((w) => w.id === 'custom-extension-workflow' || w.name === 'custom-extension-workflow'));

  const exec_res = await harness.execute_workflow('custom-extension-workflow', {
    payload: 'extended-mastra-run'
  });
  assert.equal(exec_res.status, 'completed');
  assert.ok(exec_res.history.length > 0);
  assert.equal(exec_res.history[0].output.echo, 'extended-mastra-run');
});

test('dual-engine: creates a new real feature and validates full lifecycle end-to-end', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-real-feature-e2e' });
  const fixture_dir = path.resolve('.sdlc', 'tmp', 'feature-e2e');

  const item = harness.start_work_item({
    type: 'feature',
    name: 'hash-verifier',
    payload: {
      problem_statement: 'verifies sha-256 payload integrity across messages',
      target_audience: 'agent engineers',
      persist_artefacts: true,
      workspace_root: fixture_dir
    }
  });

  assert.equal(item.phase, 'inception');

  // 1. inception (pm prd)
  const s1 = await harness.execute_work_item_stage();
  assert.equal(s1.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'specification');

  // 2. specification (pm story slicing)
  const s2 = await harness.execute_work_item_stage();
  assert.equal(s2.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'architecture');

  // 3. architecture (system architect adr & schema)
  const s3 = await harness.execute_work_item_stage({
    title: 'hash-chain-verification-architecture',
    decision: 'use sha-256 hash chains with piumarta dynamic dispatch'
  });
  assert.equal(s3.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'gate_1_evaluating');

  // 4. gate 1 evaluation
  const g1 = await harness.execute_work_item_stage({
    artefacts: ['prd-hash-verifier', 'adr-hash-chain-verification-architecture']
  });
  assert.equal(g1.decision, 'passed');
  assert.equal(harness.get_active_work_item().phase, 'tdd_red');

  // 5. tdd red
  const s5 = await harness.execute_work_item_stage({
    tests: 'assert.equal(typeof hash_verify, "function");',
    test_file: 'tests/hash-verifier.test.js'
  });
  assert.equal(s5.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'tdd_green');

  // 6. tdd green
  const s6 = await harness.execute_work_item_stage({
    code: 'export function hash_verify(v) { return Boolean(v); }',
    code_file: 'src/hash-verifier.js'
  });
  assert.equal(s6.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'refactor');

  // 7. refactor
  const s7 = await harness.execute_work_item_stage();
  assert.equal(s7.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'gate_2_evaluating');

  // 8. gate 2 evaluation
  const g2 = await harness.execute_work_item_stage({
    tests_passing: true,
    immutability_passed: true,
    mutation_score: 95
  });
  assert.equal(g2.decision, 'passed');
  assert.equal(harness.get_active_work_item().phase, 'security_qa');

  // 9. security & qa review
  const s9 = await harness.execute_work_item_stage({
    assertion_delta: 2,
    skipped_tests: 0
  });
  assert.equal(s9.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'gate_3_evaluating');

  // 10. gate 3 evaluation
  const g3 = await harness.execute_work_item_stage({
    security_audit: 'passed',
    qa_passed: true
  });
  assert.equal(g3.decision, 'passed');
  assert.equal(harness.get_active_work_item().phase, 'release');

  // 11. release packaging
  const s11 = await harness.execute_work_item_stage({ version: '1.0.0' });
  assert.equal(s11.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'gate_4_evaluating');

  // 12. gate 4 evaluation
  const g4 = await harness.execute_work_item_stage({
    receipt_signed: true,
    tag_clean: true
  });
  assert.equal(g4.decision, 'passed');
  assert.equal(harness.get_active_work_item().phase, 'continuous_learning');

  // 13. continuous learning
  const s13 = await harness.execute_work_item_stage();
  assert.equal(s13.stage_type, 'workflow');
  assert.equal(harness.get_active_work_item().phase, 'completed');

  // verify final work item state
  const completed_item = harness.get_active_work_item();
  assert.equal(completed_item.phase, 'completed');
  assert.equal(completed_item.name, 'hash-verifier');

  // cleanup fixture directory
  if (fs.existsSync(fixture_dir)) {
    fs.rmSync(fixture_dir, { recursive: true, force: true });
  }
});

test('dual-engine: compiles native mastra skills and binds to role agents', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-skills-001' });
  const skills = harness.list_skills();
  assert.ok(skills.length >= 4);

  const skill_names = skills.map((s) => s.name);
  assert.ok(skill_names.includes('tdd-lifecycle'));
  assert.ok(skill_names.includes('stride-security-analysis'));
  assert.ok(skill_names.includes('banner-documentation'));
  assert.ok(skill_names.includes('release-engineering'));
  assert.ok(!skill_names.includes('piumarta-compliance'));

  const agents = await harness.list_agents();
  assert.equal(agents.length, 6);

  const se = agents.find((a) => a.id === 'software-engineer');
  assert.ok(se);
  assert.ok(se.skills.some((s) => s.name === 'tdd-lifecycle'));
  assert.ok(se.skills.some((s) => s.name === 'banner-documentation'));
  assert.equal(se.skills.some((s) => s.name === 'piumarta-compliance'), false);

  const sec = agents.find((a) => a.id === 'security-engineer');
  assert.ok(sec);
  assert.ok(sec.skills.some((s) => s.name === 'stride-security-analysis'));

  const devops = agents.find((a) => a.id === 'devops-engineer');
  assert.ok(devops);
  assert.ok(devops.skills.some((s) => s.name === 'release-engineering'));
});

test('dual-engine: role agent executes task and permits standard code without piumarta bans', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-skills-002' });

  // 1. standard class syntax is permitted in general sdlc tasks
  const class_res = await harness.execute_agent_task('software-engineer', { id: 'task-class' }, {
    code: 'class StandardService { constructor() { this.active = true; } }'
  });
  assert.equal(class_res.valid, true);
  assert.equal(class_res.violations.length, 0);

  // 2. standard host collection Map is permitted in general sdlc tasks
  const map_res = await harness.execute_agent_task('software-engineer', { id: 'task-map' }, {
    code: 'const table = new Map(); table.set("k", 1);'
  });
  assert.equal(map_res.valid, true);
  assert.equal(map_res.violations.length, 0);

  // 3. valid code execution succeeds
  const valid_res = await harness.execute_agent_task('software-engineer', { id: 'task-clean-valid' }, {
    code: 'function compute_answer() { return 42; }'
  });
  assert.equal(valid_res.valid, true);
  assert.equal(valid_res.violations.length, 0);
});

test('dual-engine: role agent enforces tdd lifecycle skill prerequisites', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-skills-003' });

  // 1. tdd required but no tests provided
  const no_tests_res = await harness.execute_agent_task('software-engineer', { id: 'task-tdd-missing' }, {
    requires_tdd: true,
    code: 'function compute_sum(a, b) { return a + b; }'
  });
  assert.equal(no_tests_res.valid, false);
  assert.ok(no_tests_res.violations.some((v) => v.includes('failing red test suite required before green code implementation')));

  // 2. tdd required and tests provided
  const valid_tdd_res = await harness.execute_agent_task('software-engineer', { id: 'task-tdd-ok' }, {
    requires_tdd: true,
    tests: 'assert.equal(compute_sum(1, 2), 3);',
    code: 'function compute_sum(a, b) { return a + b; }'
  });
  assert.equal(valid_tdd_res.valid, true);
  assert.equal(valid_tdd_res.violations.length, 0);
});

test('dual-engine: executes dag tasks deterministically using skill-equipped role agents', async () => {
  const harness = create_dual_engine_harness({ session_id: 'test-skills-004' });

  // 1. valid dag topological execution
  const dag = {
    nodes: [
      { id: 'sec-audit', role: 'security-engineer', depends_on: ['code-feature'] },
      { id: 'arch-spec', role: 'system-architect', depends_on: [] },
      { id: 'code-feature', role: 'software-engineer', depends_on: ['arch-spec'], inputs: { code: 'const answer = 42;' } }
    ]
  };

  const outcome = await harness.execute_dag_with_role_agents(dag);
  assert.equal(outcome.success, true);
  assert.deepEqual(outcome.order, ['arch-spec', 'code-feature', 'sec-audit']);
  assert.equal(outcome.completed_count, 3);

  // 2. failing dag execution halts pipeline
  const failing_dag = {
    nodes: [
      { id: 'bad-code', role: 'software-engineer', depends_on: [], inputs: { requires_tdd: true, code: 'function no_tests() {}' } },
      { id: 'next-task', role: 'qa-engineer', depends_on: ['bad-code'] }
    ]
  };

  const fail_outcome = await harness.execute_dag_with_role_agents(failing_dag);
  assert.equal(fail_outcome.success, false);
  assert.equal(fail_outcome.failed_task, 'bad-code');
  assert.equal(fail_outcome.completed_count, 0);
});

test('dual-engine: cli commands execute skill, agent, and dag operations', async () => {
  const cli_path = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/cli.js');

  const { stdout: skill_out } = await exec_file_async('node', [cli_path, 'skill', 'list']);
  assert.ok(skill_out.includes('registered mastra skills (4):'));
  assert.ok(skill_out.includes('tdd-lifecycle'));

  const { stdout: agent_out } = await exec_file_async('node', [cli_path, 'agent', 'list']);
  assert.ok(agent_out.includes('registered role agents (6):'));
  assert.ok(agent_out.includes('software-engineer'));

  const { stdout: dag_out } = await exec_file_async('node', [cli_path, 'dag', 'run']);
  assert.ok(dag_out.includes('dag executed deterministically: success=true'));
});

test('dual-engine: resolves gemini-3.8-flash-medium model adapter with medium reasoning effort', () => {
  const model = resolve_harness_model({
    model_id: 'gemini-3.8-flash-medium',
    reasoning_effort: 'medium'
  });
  assert.equal(model.provider, 'antigravity');
  assert.equal(model.modelId, 'gemini-3.8-flash-medium');
  assert.equal(model.reasoningEffort, 'medium');
  assert.equal(model.specificationVersion, 'v2');
});

test('dual-engine: role agent generates content using antigravity gemini model adapter', async () => {
  const custom_runner = async ({ prompt, model_id, reasoning_effort }) => {
    return `[${model_id}:${reasoning_effort}] solution generated for: ${prompt}`;
  };
  const model = create_antigravity_language_model({
    model_id: 'gemini-3.8-flash-medium',
    reasoning_effort: 'medium',
    runner: custom_runner
  });
  const harness = create_dual_engine_harness({
    session_id: 'test-gemini-model-001',
    model
  });
  const coder = harness.get_agent('software-engineer');
  assert.ok(coder);
  assert.equal(coder.model.modelId, 'gemini-3.8-flash-medium');
  assert.equal(coder.model.reasoningEffort, 'medium');

  const gen = await coder.generate('implement piumarta vtable message dispatch');
  assert.ok(gen.text.includes('gemini-3.8-flash-medium:medium'));
  assert.ok(gen.text.includes('piumarta vtable'));
});

test('dual-engine: gatekeeper autonomously discovers artefacts and executes tests without caller flags', async () => {
  const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const gatekeeper = create_review_gatekeeper({ base_dir: package_root });

  // gate 1 auto-discovers prds and adrs on disk
  const g1 = await gatekeeper.evaluate_gate({ gate_id: 'gate_1_planning' });
  assert.equal(g1.decision, 'passed');
  assert.equal(g1.violations.length, 0);

  // gate 2 executes live test runner and immutability check
  const g2 = await gatekeeper.evaluate_gate({ gate_id: 'gate_2_implementation' });
  assert.equal(g2.decision, 'passed');
  assert.equal(g2.violations.length, 0);

  // gate 3 auto-discovers security threat models and qa test plans
  const g3 = await gatekeeper.evaluate_gate({ gate_id: 'gate_3_qa_security' });
  assert.equal(g3.decision, 'passed');
  assert.equal(g3.violations.length, 0);
});

afterAll(() => {
  const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const candidate_roots = [package_root];
  if (process.cwd() !== package_root && !candidate_roots.includes(process.cwd())) {
    candidate_roots.push(process.cwd());
  }

  const test_tokens = [
    'api_rate_limit',
    'api-rate-limit',
    'session_revocation',
    'session-revocation',
    'user_auth',
    'user-auth',
    'token_rotation',
    'token-rotation',
    'fix_null_pointer',
    'fix-null-pointer',
    'sessionauthinterface',
    'SessionAuthInterface',
    'nebula-core',
    'nebula_core'
  ];

  for (const root of candidate_roots) {
    const doc_dirs = [
      path.join(root, 'docs', '01-product'),
      path.join(root, 'docs', '02-architecture', 'adr'),
      path.join(root, 'docs', '04-interfaces'),
      path.join(root, 'docs', '05-work-breakdown'),
      path.join(root, 'docs', '07-security'),
      path.join(root, 'docs', '08-operations'),
      path.join(root, 'docs', '09-qa-testing')
    ];

    for (const d of doc_dirs) {
      if (fs.existsSync(d)) {
        const files = fs.readdirSync(d);
        for (const f of files) {
          if (test_tokens.some((token) => f.includes(token))) {
            try { fs.unlinkSync(path.join(d, f)); } catch (_e) {}
          }
        }
      }
    }

    const code_files = [
      path.join(root, 'src', 'feature.js'),
      path.join(root, 'src', 'fix-null-pointer.js'),
      path.join(root, 'tests', 'feature.test.js'),
      path.join(root, 'tests', 'fix-null-pointer.test.js')
    ];
    for (const f of code_files) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_e) {}
      }
    }
  }
});
