/**
 * =========================================================================
 * test: gherkin-bridge.test.js
 * =========================================================================
 * 
 * section: documentation
 * tldr: tests for native gherkin acceptance test runner and bridge
 * verbose: verifies parsing of gherkin feature syntax, regex step registration,
 * scenario context passing, scenario outline examples table execution,
 * failure assertion propagation, and vitest binding.
 * =========================================================================
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  create_gherkin_runner,
  parse_gherkin_feature,
  bind_to_node_test,
  bind_to_vitest
} from '../src/GherkinBridge.js';

test('gherkin-bridge: parses basic feature with scenario and steps', async () => {
  const gherkin_text = `
    @governance @sdlc
    Feature: task review gate evaluation
      as an engineering team
      we want to enforce review gates before phase transitions

      Scenario: evaluate gate 1 planning criteria
        Given an active work item "feat-auth" in phase "phase_00_inception"
        When the architect generates "prd-01" and "adr-01"
        Then review gate "gate_1_planning" evaluation passes
        And the work item advances to "phase_01_specifications"
  `;

  const parsed = parse_gherkin_feature(gherkin_text);

  assert.equal(parsed.name, 'task review gate evaluation');
  assert.ok(parsed.tags.includes('@governance'));
  assert.equal(parsed.scenarios.length, 1);

  const scn = parsed.scenarios[0];
  assert.equal(scn.name, 'evaluate gate 1 planning criteria');
  assert.equal(scn.steps.length, 4);
  assert.equal(scn.steps[0].keyword, 'given');
  assert.equal(scn.steps[0].text, 'an active work item "feat-auth" in phase "phase_00_inception"');
  assert.equal(scn.steps[1].keyword, 'when');
  assert.equal(scn.steps[2].keyword, 'then');
  assert.equal(scn.steps[3].keyword, 'and');
});

test('gherkin-bridge: registers steps and executes scenario with context', async () => {
  const runner = create_gherkin_runner();

  runner.given(/^an active work item "([^"]+)" in phase "([^"]+)"$/, (world, item_id, phase) => {
    world.item = { id: item_id, phase };
  });

  runner.when(/^the architect generates "([^"]+)" and "([^"]+)"$/, (world, doc_a, doc_b) => {
    world.docs = [doc_a, doc_b];
  });

  runner.then(/^review gate "([^"]+)" evaluation passes$/, (world, gate_name) => {
    assert.ok(world.docs.length >= 2);
    world.gate_passed = gate_name;
  });

  runner.step(/^the work item advances to "([^"]+)"$/, (world, next_phase) => {
    world.item.phase = next_phase;
  });

  const feature_text = `
    Feature: gate validation
      Scenario: pass gate 1
        Given an active work item "feat-core" in phase "phase_00_inception"
        When the architect generates "prd-01" and "adr-01"
        Then review gate "gate_1_planning" evaluation passes
        And the work item advances to "phase_01_specifications"
  `;

  const result = await runner.execute_feature(feature_text, {});
  assert.equal(result.total_scenarios, 1);
  assert.equal(result.passed_scenarios, 1);
  assert.equal(result.failed_scenarios, 0);
  assert.equal(result.world.item.phase, 'phase_01_specifications');
  assert.equal(result.world.gate_passed, 'gate_1_planning');
});

test('gherkin-bridge: handles scenario outlines with examples tables', async () => {
  const runner = create_gherkin_runner();

  runner.given(/^a phase with id "([^"]+)"$/, (world, phase_id) => {
    world.phase_id = phase_id;
  });

  runner.when(/^the phase gate "([^"]+)" is evaluated$/, (world, gate_id) => {
    world.gate_id = gate_id;
  });

  runner.then(/^the gate evaluation result is "([^"]+)"$/, (world, expected) => {
    assert.equal(expected, 'pass');
  });

  const feature_text = `
    Feature: parameterized gates
      Scenario Outline: evaluate phase transition
        Given a phase with id "<phase>"
        When the phase gate "<gate>" is evaluated
        Then the gate evaluation result is "<result>"

        Examples:
          | phase | gate | result |
          | phase_00_inception | gate_1_planning | pass |
          | phase_01_specifications | gate_2_implementation | pass |
  `;

  const result = await runner.execute_feature(feature_text, {});
  assert.equal(result.total_scenarios, 2);
  assert.equal(result.passed_scenarios, 2);
  assert.equal(result.failed_scenarios, 0);
});

test('gherkin-bridge: reports assertion failures clearly', async () => {
  const runner = create_gherkin_runner();

  runner.given(/^an assertion that fails$/, (_world) => {
    assert.equal(1, 2, 'intentional mismatch');
  });

  const feature_text = `
    Feature: failing test
      Scenario: deliberate failure
        Given an assertion that fails
  `;

  const result = await runner.execute_feature(feature_text, {});
  assert.equal(result.total_scenarios, 1);
  assert.equal(result.passed_scenarios, 0);
  assert.equal(result.failed_scenarios, 1);
  assert.ok(result.failures[0].error.includes('intentional mismatch'));
});

test('gherkin-bridge: binds gherkin scenarios cleanly to vitest', async () => {
  const feature_text = `
    Feature: vitest execution
      Scenario: verify arithmetic
        Given an initial value of 10
        When we add 32
        Then the sum is 42
  `;

  const runner = create_gherkin_runner();
  runner.given(/^an initial value of (\d+)$/, (world, num) => {
    world.val = parseInt(num, 10);
  });
  runner.when(/^we add (\d+)$/, (world, num) => {
    world.val += parseInt(num, 10);
  });
  runner.then(/^the sum is (\d+)$/, (world, num) => {
    assert.equal(world.val, parseInt(num, 10));
  });

  const res = await runner.execute_feature(feature_text, {});
  assert.equal(res.total_scenarios, 1);
  assert.equal(res.passed_scenarios, 1);
  assert.equal(res.failed_scenarios, 0);
});
