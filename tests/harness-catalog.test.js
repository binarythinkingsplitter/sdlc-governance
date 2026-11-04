/**
 * =========================================================================
 * module: harness catalog test suite
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test suite verifying harness catalogues, types, and unified cli verb-noun commands
 * verbose: asserts that all 10 sdlc macro phases, 5 review gates, 7 work-item pathways,
 * multi-agent dags, templates, and entity types are enumerated with structured metadata,
 * and verifies terminal cli outputs for list and noun verbs.
 * =========================================================================
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  list_sdlc_phases,
  list_review_gates,
  list_work_item_types,
  list_dag_pipelines,
  list_templates_catalog,
  list_all_types,
  list_domain_nouns,
  list_tier_architecture,
  list_sdlc_statecharts,
  format_sdlc_phases_catalog,
  format_review_gates_catalog,
  format_tier_architecture_catalog,
  format_sdlc_statecharts_catalog
} from '../src/index.js';

const exec_file_async = promisify(execFile);
const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli_path = path.join(package_root, 'bin', 'cli.js');

test('harness-catalog: enumerates all 10 sequential sdlc macro phases', () => {
  const phases = list_sdlc_phases();
  assert.equal(Array.isArray(phases), true);
  assert.equal(phases.length, 10);

  const ids = phases.map((p) => p.id);
  assert.deepEqual(ids, [
    'phase_00_inception',
    'phase_01_specifications',
    'phase_02_architecture',
    'phase_03_tdd_red',
    'phase_04_tdd_green',
    'phase_05_refactor',
    'phase_06_security_review',
    'phase_07_qa_verification',
    'phase_08_release',
    'phase_09_continuous_learning'
  ]);

  for (let i = 0; i < phases.length; i++) {
    assert.equal(phases[i].order, i);
    assert.ok(phases[i].name.length > 0);
    assert.ok(phases[i].description.length > 0);
  }

  // verify gate associations
  const arch_phase = phases.find((p) => p.id === 'phase_02_architecture');
  assert.equal(arch_phase.gate, 'gate_1_planning');

  const refactor_phase = phases.find((p) => p.id === 'phase_05_refactor');
  assert.equal(refactor_phase.gate, 'gate_2_implementation');

  const qa_phase = phases.find((p) => p.id === 'phase_07_qa_verification');
  assert.equal(qa_phase.gate, 'gate_3_qa_security');

  const release_phase = phases.find((p) => p.id === 'phase_08_release');
  assert.equal(release_phase.gate, 'gate_4_release');
});

test('harness-catalog: enumerates all 5 formal review gates with evaluated phases and invariants', () => {
  const gates = list_review_gates();
  assert.equal(Array.isArray(gates), true);
  assert.equal(gates.length, 5);

  const ids = gates.map((g) => g.id);
  assert.ok(ids.includes('gate_1_planning'));
  assert.ok(ids.includes('gate_2_implementation'));
  assert.ok(ids.includes('gate_3_qa_security'));
  assert.ok(ids.includes('gate_4_release'));
  assert.ok(ids.includes('gate_ingest'));

  for (const gate of gates) {
    assert.ok(gate.name.length > 0);
    assert.ok(gate.description.length > 0);
    assert.ok(Array.isArray(gate.evaluates));
    assert.ok(gate.evaluates.length > 0);
    assert.ok(Array.isArray(gate.invariants));
    assert.ok(gate.invariants.length > 0);
  }
});

test('harness-catalog: enumerates all 7 tactical work-item pathways with stage flows', () => {
  const items = list_work_item_types();
  assert.equal(Array.isArray(items), true);
  assert.equal(items.length, 7);

  const ids = items.map((i) => i.id);
  assert.deepEqual(ids, [
    'feature',
    'fix',
    'hotfix',
    'refactor',
    'security_patch',
    'dependency_upgrade',
    'ingest'
  ]);

  for (const item of items) {
    assert.ok(item.name.length > 0);
    assert.ok(item.description.length > 0);
    assert.ok(Array.isArray(item.stages));
    assert.ok(item.stages.length >= 4);
    assert.equal(item.stages[item.stages.length - 1], 'completed');
  }
});

test('harness-catalog: enumerates registered dag pipelines and templates catalog', () => {
  const dags = list_dag_pipelines();
  assert.ok(Array.isArray(dags));
  assert.ok(dags.length >= 2);
  assert.ok(dags.some((d) => d.id === 'linear-trio'));
  assert.ok(dags.some((d) => d.id === 'sdlc-feature-dag'));

  const templates = list_templates_catalog();
  assert.ok(Array.isArray(templates.documents));
  assert.ok(templates.documents.length >= 7);
  assert.ok(templates.documents.some((d) => d.id === 'prd'));
  assert.ok(templates.documents.some((d) => d.id === 'adr'));

  assert.ok(Array.isArray(templates.code));
  assert.ok(templates.code.length >= 3);
  assert.ok(templates.code.some((c) => c.id === 'test_suite'));
});

test('harness-catalog: catalogues all system entity and command types with supported verbs', () => {
  const types = list_all_types();
  assert.ok(Array.isArray(types));
  assert.equal(types.length, 14);

  const ids = types.map((t) => t.id);
  assert.ok(ids.includes('phases'));
  assert.ok(ids.includes('gates'));
  assert.ok(ids.includes('work-items'));
  assert.ok(ids.includes('dag'));
  assert.ok(ids.includes('workflows'));
  assert.ok(ids.includes('skills'));
  assert.ok(ids.includes('agents'));
  assert.ok(ids.includes('packages'));
  assert.ok(ids.includes('rules'));
  assert.ok(ids.includes('store'));
  assert.ok(ids.includes('templates'));
  assert.ok(ids.includes('code'));
  assert.ok(ids.includes('project'));
  assert.ok(ids.includes('tests'));

  for (const t of types) {
    assert.ok(t.singular.length > 0);
    assert.ok(t.plural.length > 0);
    assert.ok(t.description.length > 0);
    assert.ok(Array.isArray(t.verbs));
    assert.ok(t.verbs.length >= 2);
  }
});

test('harness-cli: lists phases, gates, work-items, dag, and templates via unified list verb', async () => {
  const { stdout: phases_out } = await exec_file_async(process.execPath, [cli_path, 'list', 'phases']);
  assert.ok(phases_out.includes('sdlc macro phases (10):'));
  assert.ok(phases_out.includes('phase_00_inception'));
  assert.ok(phases_out.includes('phase_09_continuous_learning'));

  const { stdout: gates_out } = await exec_file_async(process.execPath, [cli_path, 'list', 'gates']);
  assert.ok(gates_out.includes('formal review gates (5):'));
  assert.ok(gates_out.includes('gate_1_planning'));
  assert.ok(gates_out.includes('gate_4_release'));

  const { stdout: items_out } = await exec_file_async(process.execPath, [cli_path, 'list', 'work-items']);
  assert.ok(items_out.includes('supported work-item pathways (7):'));
  assert.ok(items_out.includes('feature'));
  assert.ok(items_out.includes('hotfix'));

  const { stdout: dag_out } = await exec_file_async(process.execPath, [cli_path, 'list', 'dag']);
  assert.ok(dag_out.includes('registered dag pipelines (2):'));
  assert.ok(dag_out.includes('linear-trio'));

  const { stdout: types_out } = await exec_file_async(process.execPath, [cli_path, 'list']);
  assert.ok(types_out.includes('available entity and command types (14):'));
  assert.ok(types_out.includes('phases:'));
  assert.ok(types_out.includes('gates:'));
  assert.ok(types_out.includes('work-items'));
});

test('harness-cli: executes noun commands with standardised list and status verbs', async () => {
  const { stdout: phases_list } = await exec_file_async(process.execPath, [cli_path, 'phases', 'list']);
  assert.ok(phases_list.includes('sdlc macro phases (10):'));

  const { stdout: phases_status } = await exec_file_async(process.execPath, [cli_path, 'phases', 'status']);
  assert.ok(phases_status.includes('active macro phase:'));

  const { stdout: gates_list } = await exec_file_async(process.execPath, [cli_path, 'gates', 'list']);
  assert.ok(gates_list.includes('formal review gates (5):'));

  const { stdout: gates_status } = await exec_file_async(process.execPath, [cli_path, 'gates', 'status']);
  assert.ok(gates_status.includes('active gate:'));

  const { stdout: items_list } = await exec_file_async(process.execPath, [cli_path, 'work-items', 'list']);
  assert.ok(items_list.includes('supported work-item pathways (7):'));

  const { stdout: dag_list } = await exec_file_async(process.execPath, [cli_path, 'dag', 'list']);
  assert.ok(dag_list.includes('registered dag pipelines (2):'));

  const { stdout: help_out } = await exec_file_async(process.execPath, [cli_path, 'help']);
  assert.ok(help_out.includes('verbs (direct actions):'));
  assert.ok(help_out.includes('nouns (standardised verbs:'));
});

test('harness-catalog: standardises tier 1 and tier 2 entities, verbs, tools, and work domain noun', async () => {
  const tiers = list_tier_architecture();
  assert.equal(tiers.length, 2);
  assert.equal(tiers[0].id, 'tier_1');
  assert.equal(tiers[1].id, 'tier_2');

  const tier1_ids = tiers[0].entities.map((e) => e.id);
  assert.ok(tier1_ids.includes('project'));
  assert.ok(tier1_ids.includes('work'));
  assert.ok(tier1_ids.includes('phases'));
  assert.ok(tier1_ids.includes('gates'));
  assert.ok(tier1_ids.includes('processes'));
  assert.ok(tier1_ids.includes('board'));
  assert.ok(tier1_ids.includes('store'));
  assert.ok(tier1_ids.includes('rules'));
  assert.ok(tier1_ids.includes('pr'));

  const tier2_ids = tiers[1].entities.map((e) => e.id);
  assert.ok(tier2_ids.includes('agents'));
  assert.ok(tier2_ids.includes('workflows'));
  assert.ok(tier2_ids.includes('skills'));
  assert.ok(tier2_ids.includes('pool'));
  assert.ok(tier2_ids.includes('dag'));
  assert.ok(tier2_ids.includes('tools'));
  assert.ok(tier2_ids.includes('packages'));

  const nouns = list_domain_nouns();
  const work_noun = nouns.find((n) => n.id === 'work');
  assert.ok(work_noun);
  assert.ok(work_noun.verbs.includes('list'));
  assert.ok(work_noun.verbs.includes('create'));
  assert.ok(work_noun.verbs.includes('switch'));
  assert.ok(work_noun.verbs.includes('run'));

  assert.equal(format_sdlc_phases_catalog(), format_sdlc_phases_catalog());
  assert.equal(format_review_gates_catalog(), format_review_gates_catalog());
  assert.equal(format_tier_architecture_catalog(), format_tier_architecture_catalog());

  const { stdout: tiers_out } = await exec_file_async(process.execPath, [cli_path, 'tiers', 'list']);
  assert.ok(tiers_out.includes('tier 1: deterministic governance & state engine'));
  assert.ok(tiers_out.includes('tier 2: mastra agentic & workflow execution engine'));

  const statecharts = list_sdlc_statecharts();
  assert.equal(statecharts.length, 9);
  assert.ok(statecharts.some((s) => s.id === 'project-sovereign-lifecycle'));
  assert.ok(statecharts.some((s) => s.id === 'sdlc-macro-lifecycle'));
  assert.ok(statecharts.some((s) => s.id === 'feature-lifecycle'));
  assert.ok(statecharts.some((s) => s.id === 'fix-lifecycle'));

  const formatted_charts = format_sdlc_statecharts_catalog();
  assert.ok(formatted_charts.includes('xstate v5 governance statecharts (9):'));

  const { stdout: cli_charts_out } = await exec_file_async(process.execPath, [cli_path, 'list', 'statecharts']);
  assert.ok(cli_charts_out.includes('xstate v5 governance statecharts (9):'));
  assert.ok(cli_charts_out.includes('project-sovereign-lifecycle'));
  assert.ok(cli_charts_out.includes('sdlc-macro-lifecycle'));
});
