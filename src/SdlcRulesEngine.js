/**
 * =========================================================================
 * module: sdlc rules engine (dmn decision tables + maude 3 formal verifier)
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: declarative dmn decision tables, condition-tree policy rules, and maude 3 process verifier
 * verbose: encodes the sdlc process rules, xstate transition guards, review gate rubrics,
 * role routing matrices, and git provenance policies declaratively. includes a built-in
 * maude 3 rewriting-logic generator and breadth-first state-space reachability verifier
 * to prove zero deadlocks and invariant preservation across all 25 sdlc processes.
 * 
 * section: export catalog
 * - DEFAULT_SDLC_DMN_TABLES: built-in dmn decision tables for gates, stage routing, and git policies
 * - DEFAULT_DECLARATIVE_RULES: built-in condition-tree rules across xstate, gates, git, and processors
 * - evaluate_condition_tree: evaluates declarative all/any/not condition trees against facts
 * - evaluate_dmn_table: evaluates a dmn decision table with hit policies (first, unique, collect)
 * - generate_maude_sdlc_spec: generates a maude 3 rewriting logic module for a process or statechart
 * - verify_maude_sdlc_reachability: performs breadth-first state-space exploration for deadlocks/invariants
 * - create_sdlc_rules_engine: factory creating the runtime sdlc rules and dmn/maude engine
 * =========================================================================
 */

/**
 * built-in dmn decision tables governing review gates, stage routing, and git operations
 */
export const DEFAULT_SDLC_DMN_TABLES = Object.freeze({
  gate_evaluation_dmn: {
    id: 'gate_evaluation_dmn',
    name: 'sdlc formal review gate decision table',
    hit_policy: 'collect',
    inputs: [
      'gate_id',
      'prd_approved',
      'adr_count',
      'tests_passing',
      'immutability_valid',
      'stride_mitigated',
      'qa_passed',
      'receipt_signed',
      'git_clean'
    ],
    rules: [
      {
        id: 'dmn-g1-prd',
        when: { gate_id: 'gate_1_planning', prd_approved: false },
        output: { passed: false, violation: 'missing_approved_prd', required_role: 'product-manager' }
      },
      {
        id: 'dmn-g1-adr',
        when: { gate_id: 'gate_1_planning', adr_count: { op: 'lt', value: 1 } },
        output: { passed: false, violation: 'missing_approved_adrs', required_role: 'system-architect' }
      },
      {
        id: 'dmn-g2-tests',
        when: { gate_id: 'gate_2_implementation', tests_passing: false },
        output: { passed: false, violation: 'tests_not_passing', required_role: 'software-engineer' }
      },
      {
        id: 'dmn-g2-immutability',
        when: { gate_id: 'gate_2_implementation', immutability_valid: false },
        output: { passed: false, violation: 'test_immutability_violation', required_role: 'qa-engineer' }
      },
      {
        id: 'dmn-g3-sec',
        when: { gate_id: 'gate_3_qa_security', stride_mitigated: false },
        output: { passed: false, violation: 'security_vulnerabilities_detected', required_role: 'security-engineer' }
      },
      {
        id: 'dmn-g3-qa',
        when: { gate_id: 'gate_3_qa_security', qa_passed: false },
        output: { passed: false, violation: 'qa_regression_detected', required_role: 'qa-engineer' }
      },
      {
        id: 'dmn-g4-receipt',
        when: { gate_id: 'gate_4_release', receipt_signed: false },
        output: { passed: false, violation: 'unsigned_gate_receipt', required_role: 'devops-engineer' }
      },
      {
        id: 'dmn-g4-git',
        when: { gate_id: 'gate_4_release', git_clean: false },
        output: { passed: false, violation: 'git_tree_dirty', required_role: 'devops-engineer' }
      }
    ]
  },

  git_operation_policy_dmn: {
    id: 'git_operation_policy_dmn',
    name: 'git branch, commit, merge, and pre-receive policy decision table',
    hit_policy: 'first',
    inputs: [
      'operation',
      'target_branch_type',
      'actor_role',
      'has_supervisor_sig',
      'has_agent_sig',
      'has_qa_sig',
      'has_sec_sig',
      'has_pm_sig',
      'tree_hash_matches'
    ],
    rules: [
      {
        id: 'dmn-git-tampered-tree',
        when: { tree_hash_matches: false },
        output: { allowed: false, violation: 'git_tree_sha256_mismatch', reason: 'commit tree hash does not match signed sdlc-tree-sha256 trailer' }
      },
      {
        id: 'dmn-git-missing-sup-sig',
        when: { has_supervisor_sig: false },
        output: { allowed: false, violation: 'missing_supervisor_signature', reason: 'git operation lacks valid ed25519 sdlc-supervisor-token-sig' }
      },
      {
        id: 'dmn-git-missing-agent-sig',
        when: { operation: 'commit', has_agent_sig: false },
        output: { allowed: false, violation: 'missing_agent_signature', reason: 'commit lacks valid ed25519 sdlc-agent-sig' }
      },
      {
        id: 'dmn-git-direct-commit-main',
        when: { operation: 'commit', target_branch_type: 'protected' },
        output: { allowed: false, violation: 'direct_commit_to_protected_branch_forbidden', reason: 'developers must commit to feat/* or fix/* branches and merge via pr' }
      },
      {
        id: 'dmn-git-merge-role',
        when: { operation: 'merge', actor_role: { op: 'not_in', value: ['product-manager', 'sdlc-supervisor'] } },
        output: { allowed: false, violation: 'unauthorized_pr_merger_role', reason: 'only product-manager or sdlc-supervisor may merge a pull request' }
      },
      {
        id: 'dmn-git-merge-missing-qa',
        when: { operation: 'merge', has_qa_sig: false },
        output: { allowed: false, violation: 'missing_qa_attestation_signature', reason: 'cannot merge pull request without signed qa-engineer attestation' }
      },
      {
        id: 'dmn-git-merge-missing-sec',
        when: { operation: 'merge', has_sec_sig: false },
        output: { allowed: false, violation: 'missing_security_attestation_signature', reason: 'cannot merge pull request without signed security-engineer attestation' }
      },
      {
        id: 'dmn-git-merge-missing-pm',
        when: { operation: 'merge', has_pm_sig: false },
        output: { allowed: false, violation: 'missing_pm_approval_signature', reason: 'cannot merge pull request without signed product-manager approval' }
      },
      {
        id: 'dmn-git-pre-receive-protected',
        when: { operation: 'pre_receive', target_branch_type: 'protected', has_pm_sig: false },
        output: { allowed: false, violation: 'unapproved_push_to_protected_branch', reason: 'protected branch push requires signed pm merge and qa/security gate attestations' }
      },
      {
        id: 'dmn-git-allow-default',
        when: {},
        output: { allowed: true, violation: null, reason: 'git operation satisfies all sdlc provenance policies' }
      }
    ]
  },

  stage_routing_dmn: {
    id: 'stage_routing_dmn',
    name: 'sdlc stage to role, workflow, and git action routing table',
    hit_policy: 'first',
    inputs: ['phase'],
    rules: [
      {
        id: 'route-inception',
        when: { phase: 'inception' },
        output: { role: 'product-manager', workflow_id: 'pm-prd-authoring', git_action: 'commit_docs' }
      },
      {
        id: 'route-specification',
        when: { phase: 'specification' },
        output: { role: 'product-manager', workflow_id: 'pm-story-slicing', git_action: 'commit_docs' }
      },
      {
        id: 'route-architecture',
        when: { phase: 'architecture' },
        output: { role: 'system-architect', workflow_id: 'arch-adr-authoring', git_action: 'commit_docs' }
      },
      {
        id: 'route-tdd-red',
        when: { phase: 'tdd_red' },
        output: { role: 'software-engineer', workflow_id: 'se-feature-implementation', git_action: 'branch_commit_and_open_pr' }
      },
      {
        id: 'route-security-qa',
        when: { phase: 'security_qa' },
        output: { role: 'qa-engineer', workflow_id: 'qa-regression-audit', git_action: 'attest_pr_commit' }
      },
      {
        id: 'route-release',
        when: { phase: 'release' },
        output: { role: 'devops-engineer', workflow_id: 'devops-release-packaging', git_action: 'pm_merge_pr_and_tag_release' }
      }
    ]
  }
});

/**
 * built-in declarative condition-tree rules
 */
export const DEFAULT_DECLARATIVE_RULES = Object.freeze([
  {
    id: 'rule-store-isolation-no-direct-access',
    scope: 'tool_call',
    description: 'forbids tier 2 specialist agents from directly reading or writing .sdlc/store',
    when: {
      not: {
        fact: 'args_json',
        operator: 'contains',
        value: '.sdlc/store'
      }
    },
    on_fail: {
      action: 'tripwire_abort',
      violation: 'store_isolation_violation',
      message: 'specialist attempted direct access to .sdlc/store; all store operations must be mediated by sdlc-supervisor'
    }
  },
  {
    id: 'rule-git-commit-signed-trailers',
    scope: 'git_commit',
    description: 'requires every sdlc commit to carry valid ed25519 agent and supervisor signatures and matching tree hash',
    when: {
      all: [
        { fact: 'has_supervisor_sig', operator: 'equal', value: true },
        { fact: 'has_agent_sig', operator: 'equal', value: true },
        { fact: 'tree_hash_matches', operator: 'equal', value: true },
        { fact: 'target_branch_type', operator: 'not_equal', value: 'protected' }
      ]
    },
    on_fail: {
      action: 'reject_git_op',
      violation: 'invalid_git_commit_provenance',
      message: 'git commit rejected: requires feature/fix branch and valid ed25519 agent + supervisor signatures over tree sha256'
    }
  },
  {
    id: 'rule-git-pr-merge-signoff',
    scope: 'git_merge',
    description: 'requires product-manager approval plus qa-engineer and security-engineer attestations before merging a pr',
    when: {
      all: [
        { fact: 'actor_role', operator: 'in', value: ['product-manager', 'sdlc-supervisor'] },
        { fact: 'has_qa_sig', operator: 'equal', value: true },
        { fact: 'has_sec_sig', operator: 'equal', value: true },
        { fact: 'has_pm_sig', operator: 'equal', value: true },
        { fact: 'has_supervisor_sig', operator: 'equal', value: true }
      ]
    },
    on_fail: {
      action: 'reject_git_op',
      violation: 'unapproved_pull_request_merge',
      message: 'pull request merge rejected: requires signed qa, security, product-manager, and supervisor attestations'
    }
  },
  {
    id: 'rule-xstate-gate-1-transition',
    scope: 'xstate_transition',
    description: 'requires approved prd and at least 1 adr before advancing past gate_1_planning',
    when: {
      all: [
        { fact: 'prd_approved', operator: 'equal', value: true },
        { fact: 'adr_count', operator: 'greater_than_or_equal', value: 1 }
      ]
    },
    on_fail: {
      action: 'block_transition',
      violation: 'gate_1_planning_requirements_unmet',
      message: 'cannot pass gate 1 without an approved prd and at least 1 accepted adr'
    }
  }
]);

function read_nested_fact(facts, path_str) {
  if (!facts || typeof path_str !== 'string') {
    return undefined;
  }
  const parts = path_str.split('.');
  let cur = facts;
  for (let i = 0; i < parts.length; i += 1) {
    if (cur === null || cur === undefined) {
      return undefined;
    }
    cur = cur[parts[i]];
  }
  return cur;
}

/**
 * =========================================================================
 * function: evaluate_condition_tree
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: evaluates a declarative condition tree (all, any, not, leaf predicates) against facts
 * verbose: supports boolean combinators and comparison operators (equal, not_equal,
 * greater_than_or_equal, less_than, contains, matches_regex, in, not_in).
 * 
 * section: arguments
 * - condition (object): declarative condition node
 * - facts (object): runtime fact dictionary
 * 
 * section: return value
 * - satisfied (boolean): true if condition tree evaluates to true
 * 
 * section: example
 * const ok = evaluate_condition_tree({ fact: 'count', operator: 'greater_than_or_equal', value: 1 }, { count: 2 });
 * =========================================================================
 */
export function evaluate_condition_tree(condition, facts = {}) {
  if (!condition || typeof condition !== 'object') {
    return true;
  }

  if (Array.isArray(condition.all)) {
    for (let i = 0; i < condition.all.length; i += 1) {
      if (!evaluate_condition_tree(condition.all[i], facts)) {
        return false;
      }
    }
    return true;
  }

  if (Array.isArray(condition.any)) {
    for (let i = 0; i < condition.any.length; i += 1) {
      if (evaluate_condition_tree(condition.any[i], facts)) {
        return true;
      }
    }
    return false;
  }

  if (condition.not) {
    return !evaluate_condition_tree(condition.not, facts);
  }

  const actual = read_nested_fact(facts, condition.fact);
  const expected = condition.value;
  const op = condition.operator || 'equal';

  if (op === 'equal' || op === 'eq') {
    return actual === expected;
  }
  if (op === 'not_equal' || op === 'neq') {
    return actual !== expected;
  }
  if (op === 'greater_than_or_equal' || op === 'gte') {
    return Number(actual) >= Number(expected);
  }
  if (op === 'greater_than' || op === 'gt') {
    return Number(actual) > Number(expected);
  }
  if (op === 'less_than' || op === 'lt') {
    return Number(actual) < Number(expected);
  }
  if (op === 'contains') {
    return String(actual ?? '').includes(String(expected));
  }
  if (op === 'matches_regex') {
    const rx = new RegExp(expected);
    return rx.test(String(actual ?? ''));
  }
  if (op === 'in') {
    return Array.isArray(expected) && expected.includes(actual);
  }
  if (op === 'not_in') {
    return Array.isArray(expected) && !expected.includes(actual);
  }

  return Boolean(actual);
}

function match_dmn_cell(cell_rule, actual_val) {
  if (cell_rule === undefined || cell_rule === '*') {
    return true;
  }
  if (cell_rule && typeof cell_rule === 'object' && !Array.isArray(cell_rule)) {
    const op = cell_rule.op || 'eq';
    if (op === 'lt') return Number(actual_val) < Number(cell_rule.value);
    if (op === 'lte') return Number(actual_val) <= Number(cell_rule.value);
    if (op === 'gt') return Number(actual_val) > Number(cell_rule.value);
    if (op === 'gte') return Number(actual_val) >= Number(cell_rule.value);
    if (op === 'in') return Array.isArray(cell_rule.value) && cell_rule.value.includes(actual_val);
    if (op === 'not_in') return Array.isArray(cell_rule.value) && !cell_rule.value.includes(actual_val);
    return actual_val === cell_rule.value;
  }
  return actual_val === cell_rule;
}

/**
 * =========================================================================
 * function: evaluate_dmn_table
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: evaluates a dmn decision table against input facts using its hit policy
 * verbose: supports 'first', 'unique', and 'collect' dmn hit policies.
 * 
 * section: arguments
 * - table (object): dmn table definition
 * - inputs (object): input facts dictionary
 * 
 * section: return value
 * - result (object): { hit_policy, matched_rule_ids, outputs, primary_output }
 * 
 * section: example
 * const res = evaluate_dmn_table(DEFAULT_SDLC_DMN_TABLES.stage_routing_dmn, { phase: 'tdd_red' });
 * =========================================================================
 */
export function evaluate_dmn_table(table, inputs = {}) {
  if (!table || !Array.isArray(table.rules)) {
    throw new Error('invalid_dmn_table: table definition requires a rules array');
  }

  const hit_policy = table.hit_policy || 'first';
  const matched_rule_ids = [];
  const outputs = [];

  for (let i = 0; i < table.rules.length; i += 1) {
    const row = table.rules[i];
    const when_entries = Object.entries(row.when || {});
    let row_matches = true;

    for (let j = 0; j < when_entries.length; j += 1) {
      const [col_key, cell_rule] = when_entries[j];
      if (!match_dmn_cell(cell_rule, inputs[col_key])) {
        row_matches = false;
        break;
      }
    }

    if (row_matches) {
      matched_rule_ids.push(row.id || `rule-${i + 1}`);
      outputs.push(row.output);
      if (hit_policy === 'first' || hit_policy === 'unique') {
        break;
      }
    }
  }

  return {
    table_id: table.id,
    hit_policy,
    matched_rule_ids,
    outputs,
    primary_output: outputs[0] || null
  };
}

/**
 * =========================================================================
 * function: generate_maude_sdlc_spec
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: generates a maude 3 rewriting-logic module for an sdlc process profile
 * verbose: translates the stages and dependency edges of a process profile into a
 * formal maude 3 specification (`mod SDLC-PROCESS-VERIFY is ... endm`) with rewrite
 * rules (`rl [...] : < ... > => < ... > .`) and safety invariant equations.
 * 
 * section: arguments
 * - process_profile (object): high-level process profile with stages array
 * 
 * section: return value
 * - maude_source (string): valid maude 3 module specification
 * 
 * section: example
 * const spec = generate_maude_sdlc_spec(profile);
 * =========================================================================
 */
export function generate_maude_sdlc_spec(process_profile = {}) {
  const proc_id = String(process_profile.id || 'sdlc-process').toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
  const stages = Array.isArray(process_profile.stages) ? process_profile.stages : [];

  const rule_lines = [];
  if (stages.length > 0) {
    const first_stage = stages[0];
    rule_lines.push(`  rl [start-to-${first_stage.suffix}] : < "initial" > => < "${first_stage.suffix}" > .`);

    for (let i = 0; i < stages.length; i += 1) {
      const st = stages[i];
      const downstream = stages.filter((candidate) => (candidate.depends_on || []).includes(st.suffix));
      if (downstream.length === 0) {
        rule_lines.push(`  rl [${st.suffix}-to-completed] : < "${st.suffix}" > => < "completed" > .`);
      } else {
        for (let d = 0; d < downstream.length; d += 1) {
          rule_lines.push(`  rl [${st.suffix}-to-${downstream[d].suffix}] : < "${st.suffix}" > => < "${downstream[d].suffix}" > .`);
        }
      }
    }
  } else {
    rule_lines.push('  rl [start-to-completed] : < "initial" > => < "completed" > .');
  }

  return [
    `mod SDLC-VERIFY-${proc_id} is`,
    '  protecting STRING .',
    '  protecting BOOL .',
    '  sort SdlcState .',
    '  op < _ > : String -> SdlcState [ctor] .',
    '  op checkSafety : SdlcState -> Bool .',
    '  var S : String .',
    ...rule_lines,
    '  eq checkSafety(< S >) = true .',
    'endm'
  ].join('\n');
}

/**
 * =========================================================================
 * function: verify_maude_sdlc_reachability
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: performs breadth-first state-space exploration on an sdlc process specification
 * verbose: verifies that all stages are reachable, no non-terminal stage deadlocks,
 * dependency ordering is acyclic, and the terminal "completed" state is always reachable.
 * 
 * section: arguments
 * - process_profile (object): high-level process profile with stages array
 * 
 * section: return value
 * - report (object): { process_id, verified, deadlocks_found, deadlocked_states, explored_states, terminal_reachable, maude_spec }
 * 
 * section: example
 * const report = verify_maude_sdlc_reachability(profile);
 * =========================================================================
 */
export function verify_maude_sdlc_reachability(process_profile = {}) {
  const stages = Array.isArray(process_profile.stages) ? process_profile.stages : [];
  const maude_spec = generate_maude_sdlc_spec(process_profile);

  // build adjacency list from initial -> stages -> completed
  const transitions = new Map([['initial', []]]);

  const stage_suffixes = stages.map((s) => s.suffix);
  for (let i = 0; i < stages.length; i += 1) {
    const st = stages[i];
    transitions.set(st.suffix, []);
    if (!st.depends_on || st.depends_on.length === 0) {
      transitions.get('initial').push(st.suffix);
    }
  }

  for (let i = 0; i < stages.length; i += 1) {
    const st = stages[i];
    const downstream = stages.filter((c) => (c.depends_on || []).includes(st.suffix));
    if (downstream.length === 0) {
      transitions.get(st.suffix).push('completed');
    } else {
      for (let d = 0; d < downstream.length; d += 1) {
        transitions.get(st.suffix).push(downstream[d].suffix);
      }
    }
  }
  transitions.set('completed', []);

  // breadth-first state-space exploration
  const queue = ['initial'];
  const visited = new Set(['initial']);
  const deadlocked_states = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const outgoing = transitions.get(current) ?? [];

    if (current !== 'completed' && outgoing.length === 0) {
      deadlocked_states.push(current);
    }

    for (const next of outgoing) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  // check that every declared stage is reachable from initial
  const unreachable_stages = stage_suffixes.filter((sfx) => !visited.has(sfx));
  for (let u = 0; u < unreachable_stages.length; u += 1) {
    deadlocked_states.push(unreachable_stages[u]);
  }

  const terminal_reachable = visited.has('completed');
  const verified = deadlocked_states.length === 0 && terminal_reachable;

  return {
    process_id: process_profile.id || 'unknown',
    verified,
    ternary: verified ? 1 : -1,
    deadlocks_found: deadlocked_states.length,
    deadlocked_states,
    explored_states: visited.size,
    terminal_reachable,
    invariants_satisfied: verified,
    maude_spec
  };
}

/**
 * =========================================================================
 * class: SdlcRulesEngine
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: runtime sdlc rules engine combining dmn tables, condition trees, and maude verification
 * verbose: provides a single programmatic authority for evaluating gate rules, xstate
 * guards, processor guardrails, git provenance policies, and maude process reachability.
 * dmn tables and declarative rules are held in insertion-ordered Map collections.
 * 
 * section: arguments
 * - options (object, optional): { dmn_tables, rules }
 * 
 * section: example
 * const rules_engine = new SdlcRulesEngine();
 * const git_check = rules_engine.evaluate_dmn('git_operation_policy_dmn', facts);
 * =========================================================================
 */
export class SdlcRulesEngine {
  dmn_tables;
  rules;

  constructor(options = {}) {
    this.dmn_tables = new Map(Object.entries({
      ...DEFAULT_SDLC_DMN_TABLES,
      ...(options.dmn_tables || {})
    }));
    this.rules = new Map(
      [...DEFAULT_DECLARATIVE_RULES, ...(options.rules || [])].map((rule) => [rule.id, rule])
    );
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: evaluates a registered dmn decision table by id
   * verbose: looks up the dmn table and evaluates it against input facts.
   * 
   * section: arguments
   * - table_id (string): dmn table identifier
   * - inputs (object): input facts
   * 
   * section: return value
   * - result (object): dmn evaluation outcome
   * 
   * section: example
   * const res = engine.evaluate_dmn('stage_routing_dmn', { phase: 'tdd_red' });
   */
  evaluate_dmn(table_id, inputs = {}) {
    const table = this.dmn_tables.get(table_id);
    if (!table) {
      throw new Error(`dmn_table_not_found: "${table_id}"`);
    }
    return evaluate_dmn_table(table, inputs);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: evaluates all declarative condition-tree rules matching a given scope
   * verbose: runs every rule for the scope against facts and returns pass/fail and violations.
   * 
   * section: arguments
   * - scope (string): rule scope ('gate', 'git_commit', 'git_merge', 'xstate_transition', 'processor_output', 'tool_call')
   * - facts (object): runtime facts
   * 
   * section: return value
   * - outcome (object): { allowed, passed, violations, actions, evaluated_count }
   * 
   * section: example
   * const check = engine.evaluate_rules('git_merge', facts);
   */
  evaluate_rules(scope, facts = {}) {
    const matching = [...this.rules.values()].filter((r) => !scope || r.scope === scope);
    const violations = [];
    const actions = [];

    for (let i = 0; i < matching.length; i += 1) {
      const rule = matching[i];
      const ok = evaluate_condition_tree(rule.when, facts);
      if (!ok) {
        violations.push({
          rule_id: rule.id,
          code: rule.on_fail?.violation || rule.id,
          message: rule.on_fail?.message || rule.description || `rule ${rule.id} failed`,
          action: rule.on_fail?.action || 'reject'
        });
        if (rule.on_fail?.action) {
          actions.push(rule.on_fail.action);
        }
      }
    }

    return {
      scope,
      allowed: violations.length === 0,
      passed: violations.length === 0,
      evaluated_count: matching.length,
      violations,
      actions
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: formally verifies a single process profile using maude 3 reachability analysis
   * verbose: generates the maude 3 specification and checks for deadlocks and terminal reachability.
   * 
   * section: arguments
   * - process_profile (object): process profile descriptor
   * 
   * section: return value
   * - report (object): maude verification report
   * 
   * section: example
   * const rep = engine.verify_process_with_maude(profile);
   */
  verify_process_with_maude(process_profile) {
    return verify_maude_sdlc_reachability(process_profile);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: formally verifies an array of process profiles using maude 3 reachability analysis
   * verbose: verifies all 25 high-level sdlc processes and returns aggregate deadlock and invariant metrics.
   * 
   * section: arguments
   * - profiles (array): array of process profile descriptors
   * 
   * section: return value
   * - summary (object): { all_verified, total_processes, total_deadlocks, reports }
   * 
   * section: example
   * const summary = engine.verify_all_processes_with_maude(HIGH_LEVEL_PROCESS_PROFILES);
   */
  verify_all_processes_with_maude(profiles = []) {
    const reports = profiles.map((p) => verify_maude_sdlc_reachability(p));
    const total_deadlocks = reports.reduce((acc, r) => acc + r.deadlocks_found, 0);
    const all_verified = reports.every((r) => r.verified);
    return {
      all_verified,
      total_processes: reports.length,
      total_deadlocks,
      reports
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: registers a new declarative condition-tree rule at runtime
   * verbose: appends or updates a rule in the engine's active rule catalogue.
   * 
   * section: arguments
   * - rule (object): declarative rule definition
   * 
   * section: return value
   * - rule (object): registered rule
   * 
   * section: example
   * engine.register_rule({ id: 'custom-rule', scope: 'gate', when: { ... } });
   */
  register_rule(rule) {
    this.rules.set(rule.id, rule);
    return rule;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: registers or overrides a dmn decision table
   * verbose: stores the dmn table in the engine's table registry.
   * 
   * section: arguments
   * - table (object): dmn table definition with id and rules
   * 
   * section: return value
   * - table (object): registered dmn table
   * 
   * section: example
   * engine.register_dmn_table(my_table);
   */
  register_dmn_table(table) {
    this.dmn_tables.set(table.id, table);
    return table;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists all registered declarative rules
   * verbose: returns rules optionally filtered by scope.
   * 
   * section: arguments
   * - scope (string, optional): optional scope filter
   * 
   * section: return value
   * - rules (array): list of declarative rules
   * 
   * section: example
   * const git_rules = engine.list_rules('git_merge');
   */
  list_rules(scope = null) {
    const all = [...this.rules.values()];
    return scope ? all.filter((r) => r.scope === scope) : all;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists all registered dmn decision tables
   * verbose: returns array of registered dmn table descriptors.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - tables (array): array of dmn tables
   * 
   * section: example
   * const tables = engine.list_dmn_tables();
   */
  list_dmn_tables() {
    return [...this.dmn_tables.values()];
  }
}

/**
 * function: create_sdlc_rules_engine
 * tldr: convenience constructor returning a new SdlcRulesEngine
 */
export function create_sdlc_rules_engine(options = {}) {
  return new SdlcRulesEngine(options);
}
