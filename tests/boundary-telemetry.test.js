/**
 * =========================================================================
 * test: boundary-telemetry.test.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test suite for central log store boundary telemetry across harness components
 * verbose: verifies structured logging at all critical boundaries: dag topological sorting,
 * cycle detection, harness tools execution, schema validation failures, and snapshot persistence.
 * 
 * section: example
 * node --test packages/sdlc/packages/dual-engine-harness/tests/boundary-telemetry.test.js
 * =========================================================================
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { create_central_log_store } from '../src/CentralLogStore.js';
import { create_task_dag_runner } from '../src/TaskDagEngine.js';
import { create_harness_tools } from '../src/HarnessTools.js';
import {
  ProductManagerInputSchema,
  validate_agent_input,
  validate_agent_output
} from '../src/MastraSchemas.js';
import { create_dual_engine_harness } from '../src/index.js';

test('boundary-telemetry: task dag runner emits logs on sort and cycle detection', () => {
  const store = create_central_log_store({ session_id: 'test-dag-telemetry' });
  const logger = store.get_logger('dag');
  const runner = create_task_dag_runner({ logger });

  const dag = {
    nodes: [
      { id: 'b', depends_on: ['a'] },
      { id: 'a', depends_on: [] }
    ]
  };

  const order = runner.compute_topological_order(dag);
  assert.deepEqual(order, ['a', 'b']);

  const sort_logs = store.query_logs({ event: 'dag:sort:completed' });
  assert.equal(sort_logs.length, 1);
  assert.deepEqual(sort_logs[0].ordered_nodes, ['a', 'b']);

  // verify cycle detection telemetry
  const cyclic_dag = {
    nodes: [
      { id: 'x', depends_on: ['y'] },
      { id: 'y', depends_on: ['x'] }
    ]
  };

  assert.throws(() => {
    runner.compute_topological_order(cyclic_dag);
  }, /invalid_cyclic_dependency/);

  const cycle_logs = store.query_logs({ event: 'dag:cycle_detected' });
  assert.equal(cycle_logs.length, 1);
  assert.equal(cycle_logs[0].component, 'dag');
});

test('boundary-telemetry: harness tools emit execution start and completion logs', async () => {
  const store = create_central_log_store({ session_id: 'test-tools-telemetry' });
  const logger = store.get_logger('tools');
  const tools = create_harness_tools({ logger });

  const writer = tools['harness-artefact-writer'];
  const tmp_file = 'tests/tmp_telemetry_check.txt';
  const res = await writer.execute({
    context: {
      file_path: tmp_file,
      content: 'telemetry_test_content'
    }
  });

  assert.equal(res.written, true);

  // cleanup
  if (fs.existsSync(tmp_file)) {
    fs.unlinkSync(tmp_file);
  }

  const tool_start_logs = store.query_logs({ event: 'tool:execution:started' });
  assert.ok(tool_start_logs.length >= 1);
  assert.equal(tool_start_logs[0].tool_id, 'harness-artefact-writer');

  const tool_done_logs = store.query_logs({ event: 'tool:execution:completed' });
  assert.ok(tool_done_logs.length >= 1);
  assert.equal(tool_done_logs[0].tool_id, 'harness-artefact-writer');
  assert.equal(tool_done_logs[0].success, true);
});

test('boundary-telemetry: schema validation logs failures when logger is provided', () => {
  const store = create_central_log_store({ session_id: 'test-schema-telemetry' });
  const logger = store.get_logger('schema');

  assert.throws(() => {
    validate_agent_input(ProductManagerInputSchema, { feature_name: '' }, logger);
  }, /validation_failed/);

  const fail_logs = store.query_logs({ event: 'schema:validation_failed' });
  assert.equal(fail_logs.length, 1);
  assert.equal(fail_logs[0].type, 'input');
  assert.ok(fail_logs[0].issues);
});

test('boundary-telemetry: dual engine harness wires all child loggers and logs snapshot persistence', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-telemetry-harness',
    auto_persist: true,
    log_file: null
  });

  const dag_logger = harness.get_logger('dag');
  assert.ok(dag_logger);

  // start work item triggers auto_persist which emits snapshot:persisted
  harness.start_work_item({
    type: 'feature',
    name: 'test-telemetry-work-item'
  });

  const persist_logs = harness.query_logs({ event: 'snapshot:persisted' });
  assert.ok(persist_logs.length >= 1);
  assert.equal(persist_logs[0].session_id, 'test-telemetry-harness');
});
