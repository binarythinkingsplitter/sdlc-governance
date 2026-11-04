/**
 * =========================================================================
 * module: GherkinBridge.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: native gherkin acceptance test runner and node:test bridge
 * verbose: parses standard gherkin syntax (feature, scenario, outline, given/when/then),
 * registers step definitions via parallel primitive arrays, executes scenarios deterministically,
 * and binds directly to node:test without external runtime dependencies.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - object: exports parser, runner factory, and node:test binding helper
 * 
 * section: example
 * import { create_gherkin_runner, parse_gherkin_feature } from './GherkinBridge.js';
 * const runner = create_gherkin_runner();
 * runner.given(/^an account with (\d+)$/, (world, amount) => { world.balance = Number(amount); });
 * =========================================================================
 */

/**
 * =========================================================================
 * function: parse_gherkin_feature
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: parses raw gherkin string into structured feature and scenario ast
 * verbose: tokenises lines, extracts tags, feature metadata, background steps,
 * scenarios, and expands scenario outlines with examples tables.
 * 
 * section: arguments
 * - text (string): gherkin specification string
 * 
 * section: return value
 * - feature (object): structured feature object with scenarios and steps
 * 
 * section: example
 * const feature = parse_gherkin_feature('Feature: auth\nScenario: login\nGiven a user');
 * =========================================================================
 */
export function parse_gherkin_feature(text) {
  if (typeof text !== 'string') {
    throw new Error('invalid_argument: gherkin text must be a string');
  }

  const raw_lines = text.split('\n');
  let feature_name = 'unnamed feature';
  let feature_desc = '';
  const feature_tags = [];
  const scenarios = [];
  let current_scenario = null;
  let in_examples = false;
  let example_headers = [];
  let example_rows = [];
  let pending_tags = [];

  for (let i = 0; i < raw_lines.length; i++) {
    const line = raw_lines[i].trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    // tags
    if (line.startsWith('@')) {
      const tags = line.split(/\s+/).filter(Boolean);
      for (let t = 0; t < tags.length; t++) {
        pending_tags.push(tags[t]);
      }
      continue;
    }

    // feature heading
    if (/^feature:/i.test(line)) {
      feature_name = line.replace(/^feature:\s*/i, '').trim();
      for (let t = 0; t < pending_tags.length; t++) {
        feature_tags.push(pending_tags[t]);
      }
      pending_tags = [];
      continue;
    }

    // scenario or scenario outline
    if (/^(scenario|scenario outline):/i.test(line)) {
      finalize_current_scenario();
      const is_outline = /^scenario outline:/i.test(line);
      const name = line.replace(/^(scenario|scenario outline):\s*/i, '').trim();
      current_scenario = {
        name,
        is_outline,
        tags: pending_tags.slice(),
        steps: [],
        examples: []
      };
      pending_tags = [];
      in_examples = false;
      example_headers = [];
      example_rows = [];
      continue;
    }

    // examples table in scenario outline
    if (/^examples:/i.test(line)) {
      in_examples = true;
      example_headers = [];
      example_rows = [];
      continue;
    }

    if (in_examples && line.startsWith('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter((_c, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (example_headers.length === 0) {
        example_headers = cells;
      } else {
        example_rows.push(cells);
      }
      continue;
    }

    // step keywords: given, when, then, and, but
    const step_match = line.match(/^(given|when|then|and|but)\s+(.+)$/i);
    if (step_match && current_scenario) {
      current_scenario.steps.push({
        keyword: step_match[1].toLowerCase(),
        text: step_match[2].trim()
      });
      continue;
    }

    // narrative text under feature
    if (!current_scenario && !line.startsWith('|')) {
      feature_desc = feature_desc ? `${feature_desc}\n${line}` : line;
    }
  }

  finalize_current_scenario();

  function finalize_current_scenario() {
    if (!current_scenario) return;

    if (current_scenario.is_outline && example_headers.length > 0 && example_rows.length > 0) {
      // expand outline into concrete scenarios
      for (let r = 0; r < example_rows.length; r++) {
        const row = example_rows[r];
        const scenario_copy = {
          name: `${current_scenario.name} (example ${r + 1})`,
          tags: current_scenario.tags.slice(),
          steps: []
        };

        for (let s = 0; s < current_scenario.steps.length; s++) {
          const step = current_scenario.steps[s];
          let expanded_text = step.text;
          for (let h = 0; h < example_headers.length; h++) {
            const header = example_headers[h];
            const val = row[h] !== undefined ? row[h] : '';
            expanded_text = expanded_text.split(`<${header}>`).join(val);
          }
          scenario_copy.steps.push({
            keyword: step.keyword,
            text: expanded_text
          });
        }

        scenarios.push(scenario_copy);
      }
    } else {
      scenarios.push(current_scenario);
    }

    current_scenario = null;
    in_examples = false;
  }

  return {
    name: feature_name,
    description: feature_desc,
    tags: feature_tags,
    scenarios
  };
}

/**
 * =========================================================================
 * function: create_gherkin_runner
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates native gherkin acceptance scenario runner
 * verbose: registers step definitions in an es6 class backed by Map collections,
 * matches steps sequentially, passes scenario context, and collects execution metrics.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - runner (object): fluent gherkin runner instance
 * 
 * section: example
 * const runner = create_gherkin_runner();
 * runner.given('a step', (world) => { world.x = 1; });
 * =========================================================================
 */
/**
 * =========================================================================
 * class: GherkinRunner
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: provides ES6 class for native Gherkin acceptance scenario execution
 * verbose: manages step definitions with ES6 classes and Map collections,
 * matching steps, passing scenario context, and collecting execution metrics.
 * =========================================================================
 */
export class GherkinRunner {
  constructor() {
    this.steps = new Map(); // keyword -> array of { pattern, handler }
    this.all_steps = [];
  }

  register(keyword, pattern, handler) {
    if (!pattern) throw new Error('invalid_argument: pattern is required');
    if (typeof handler !== 'function') throw new Error('invalid_argument: step handler must be a function');

    const entry = {
      keyword: keyword.toLowerCase(),
      pattern: pattern instanceof RegExp ? pattern : new RegExp(`^${pattern}$`),
      handler
    };
    this.all_steps.push(entry);
    const list = this.steps.get(entry.keyword) || [];
    list.push(entry);
    this.steps.set(entry.keyword, list);
  }

  find_step_match(text) {
    for (const step of this.all_steps) {
      const match = text.match(step.pattern);
      if (match) {
        return {
          handler: step.handler,
          args: match.slice(1)
        };
      }
    }
    return null;
  }

  given(pattern, fn) {
    this.register('given', pattern, fn);
    return this;
  }

  when(pattern, fn) {
    this.register('when', pattern, fn);
    return this;
  }

  then(pattern, fn) {
    this.register('then', pattern, fn);
    return this;
  }

  step(pattern, fn) {
    this.register('step', pattern, fn);
    return this;
  }

  async execute_scenario(scenario, world = {}) {
    const start_time = Date.now();
    const steps_executed = [];

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const match = this.find_step_match(step.text);

      if (!match) {
        throw new Error(`undefined_step: no step definition matches "${step.keyword} ${step.text}"`);
      }

      try {
        await match.handler(world, ...match.args);
        steps_executed.push({
          keyword: step.keyword,
          text: step.text,
          status: 'passed'
        });
      } catch (err) {
        steps_executed.push({
          keyword: step.keyword,
          text: step.text,
          status: 'failed',
          error: err.message
        });
        throw err;
      }
    }

    return {
      name: scenario.name,
      passed: true,
      duration_ms: Date.now() - start_time,
      steps: steps_executed,
      world
    };
  }

  async execute_feature(feature_input, initial_world = {}) {
    const feature = typeof feature_input === 'string'
      ? parse_gherkin_feature(feature_input)
      : feature_input;

    const start_time = Date.now();
    let passed_scenarios = 0;
    let failed_scenarios = 0;
    const failures = [];
    const world = initial_world;

    for (let i = 0; i < feature.scenarios.length; i++) {
      const scenario = feature.scenarios[i];
      try {
        await this.execute_scenario(scenario, world);
        passed_scenarios++;
      } catch (err) {
        failed_scenarios++;
        failures.push({
          scenario: scenario.name,
          error: err.message,
          stack: err.stack
        });
      }
    }

    return {
      feature_name: feature.name,
      total_scenarios: feature.scenarios.length,
      passed_scenarios,
      failed_scenarios,
      failures,
      duration_ms: Date.now() - start_time,
      world
    };
  }
}

/**
 * =========================================================================
 * function: create_gherkin_runner
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: creates native Gherkin runner instance
 * verbose: instantiates and returns a GherkinRunner class instance.
 * =========================================================================
 */
export function create_gherkin_runner() {
  return new GherkinRunner();
}

/**
 * =========================================================================
 * function: bind_to_node_test
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: binds gherkin scenarios directly to node:test runner
 * verbose: registers step definitions and invokes test_fn for each scenario in feature.
 * 
 * section: arguments
 * - test_fn (function): node:test or test context function
 * - feature_text (string): gherkin feature text
 * - setup_fn (function): callback to register step definitions on runner
 * 
 * section: return value
 * - void
 * 
 * section: example
 * bind_to_node_test(test, feature_str, (runner) => { runner.given(...); });
 * =========================================================================
 */
export function bind_to_node_test(test_target, feature_text, setup_fn) {
  let run_test;
  if (test_target && typeof test_target.test === 'function') {
    run_test = (name, fn) => test_target.test(name, fn);
  } else if (typeof test_target === 'function') {
    run_test = (name, fn) => test_target(name, fn);
  } else {
    throw new Error('invalid_argument: test_target must be a test runner function or test context');
  }

  const runner = create_gherkin_runner();
  if (typeof setup_fn === 'function') {
    setup_fn(runner);
  }

  const feature = parse_gherkin_feature(feature_text);

  for (let i = 0; i < feature.scenarios.length; i++) {
    const scenario = feature.scenarios[i];
    run_test(`scenario: ${scenario.name}`, async () => {
      const world = {};
      await runner.execute_scenario(scenario, world);
    });
  }
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: binds gherkin scenarios directly to vitest
 * verbose: registers gherkin scenarios as first-class tests using vitest runner.
 * 
 * section: arguments
 * - test_target (function|object): vitest test runner function or context
 * - feature_text (string): gherkin feature text
 * - setup_fn (function): callback to register step definitions on runner
 * 
 * section: return value
 * - void
 * 
 * section: example
 * bind_to_vitest(test, feature_str, (runner) => { runner.given(...); });
 * =========================================================================
 */
export function bind_to_vitest(test_target, feature_text, setup_fn) {
  return bind_to_node_test(test_target, feature_text, setup_fn);
}
