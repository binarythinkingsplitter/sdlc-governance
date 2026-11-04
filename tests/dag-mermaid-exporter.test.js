/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test suite for dag mermaid exporter
 * verbose: verifies mermaid flowchart generation for task dags including directional edges,
 * role badges, status class styling, empty dag fallback, and pure piumarta compliance.
 * written as red unit test suite before implementing source module.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * assertions executed by vitest runner
 * 
 * section: example
 * node --test packages/sdlc/packages/dual-engine-harness/tests/dag-mermaid-exporter.test.js
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { export_dag_to_mermaid } from '../src/DagMermaidExporter.js';

test('dag-mermaid: exports basic dag into flowchart td with role badges', () => {
  const dag = {
    nodes: [
      { id: 'task-a', role: 'system-architect', depends_on: [] },
      { id: 'task-b', role: 'software-engineer', depends_on: ['task-a'] }
    ]
  };

  const mermaid = export_dag_to_mermaid(dag);
  assert.ok(mermaid.includes('flowchart TD'));
  assert.ok(mermaid.includes('task_a["[system-architect] task-a"]'));
  assert.ok(mermaid.includes('task_b["[software-engineer] task-b"]'));
  assert.ok(mermaid.includes('task_a --> task_b'));
});

test('dag-mermaid: applies status styling classes for completed, running, and failed nodes', () => {
  const dag = {
    nodes: [
      { id: 't1', role: 'product-manager', status: 'completed', depends_on: [] },
      { id: 't2', role: 'software-engineer', status: 'running', depends_on: ['t1'] },
      { id: 't3', role: 'qa-engineer', status: 'failed', depends_on: ['t2'] },
      { id: 't4', role: 'devops-engineer', status: 'pending', depends_on: ['t3'] }
    ]
  };

  const mermaid = export_dag_to_mermaid(dag);
  assert.ok(mermaid.includes('classDef completed fill:#dafbe1'));
  assert.ok(mermaid.includes('classDef running fill:#ddf4ff'));
  assert.ok(mermaid.includes('classDef failed fill:#ffebe9'));
  assert.ok(mermaid.includes('classDef pending fill:#f6f8fa'));
  assert.ok(mermaid.includes('class t1 completed;'));
  assert.ok(mermaid.includes('class t2 running;'));
  assert.ok(mermaid.includes('class t3 failed;'));
  assert.ok(mermaid.includes('class t4 pending;'));
});

test('dag-mermaid: handles empty dag gracefully with fallback placeholder', () => {
  const mermaid = export_dag_to_mermaid({ nodes: [] });
  assert.ok(mermaid.includes('flowchart TD'));
  assert.ok(mermaid.includes('empty["no tasks planned"]'));
});

test('dag-mermaid: supports horizontal flowchart direction lr option', () => {
  const dag = {
    nodes: [
      { id: 'step-1', role: 'security-engineer', depends_on: [] }
    ]
  };
  const mermaid = export_dag_to_mermaid(dag, { direction: 'LR' });
  assert.ok(mermaid.includes('flowchart LR'));
  assert.ok(mermaid.includes('step_1["[security-engineer] step-1"]'));
});
