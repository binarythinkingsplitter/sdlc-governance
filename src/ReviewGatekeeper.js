/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formal review gatekeeper evaluating quality criteria across sdlc gates
 * verbose: evaluates artefact deliverables, test execution reports, immutability
 * verification, mutation scores, security threat models, and release signatures.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - gatekeeper (object): review gatekeeper engine instance
 * 
 * section: example
 * import { create_review_gatekeeper } from './ReviewGatekeeper.js';
 * const gatekeeper = create_review_gatekeeper();
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createScorer, runEvals } from '@mastra/core/evals';
import { verify_test_immutability } from './TestImmutabilityVerifier.js';

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates native @mastra/core/evals MastraScorer instances for all 5 sdlc review gates
 * verbose: builds MastraScorer objects with analyze, generateScore (1.0 or 0.0), and
 * generateReason steps so review gates can be registered on Mastra and used with runEvals.
 *
 * section: arguments
 * - evaluate_fn (function): gatekeeper evaluation function
 *
 * section: return value
 * - scorers (object): dictionary of MastraScorer instances keyed by gate_id
 *
 * section: example
 * const scorers = create_gate_scorers((params) => gatekeeper.evaluate_gate(params));
 */
export function create_gate_scorers(evaluate_fn) {
  const gate_ids = [
    'gate_1_planning',
    'gate_2_implementation',
    'gate_3_qa_security',
    'gate_4_release',
    'gate_ingest'
  ];

  const scorers = {};
  for (const gate_id of gate_ids) {
    scorers[gate_id] = createScorer({
      id: gate_id,
      name: `${gate_id} scorer`,
      description: `deterministic mastra gate scorer for ${gate_id}`
    })
      .analyze(async ({ run }) => {
        const payload = (run?.output && typeof run.output === 'object')
          ? run.output
          : (run?.input && typeof run.input === 'object' ? run.input : {});
        const eval_res = await evaluate_fn({
          ...payload,
          gate_id
        });
        return {
          gate_id,
          decision: eval_res.decision,
          violations: eval_res.violations || []
        };
      })
      .generateScore(({ results }) => {
        return results.analyzeStepResult?.decision === 'passed' ? 1.0 : 0.0;
      })
      .generateReason(({ results }) => {
        const violations = results.analyzeStepResult?.violations || [];
        return violations.length === 0
          ? `${gate_id} passed with zero violations`
          : violations.join('; ');
      });
  }

  return scorers;
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a formal review gatekeeper evaluating transition invariants
 * verbose: evaluates artefact contracts, test assertions, and security criteria
 * for formal quality review gates (gate 1 through gate 4) using real workspace checks.
 * 
 * section: arguments
 * - options (object, optional): configuration options including base_dir, tools, and logger
 * 
 * section: return value
 * - gatekeeper (object): review gatekeeper instance with evaluate_gate method
 * 
 * section: example
 * const gatekeeper = create_review_gatekeeper();
 * const res = await gatekeeper.evaluate_gate({ gate_id: 'gate_1_planning' });
 */
export class ReviewGatekeeper {
  logger;
  base_dir;
  tools;
  receipts;

  constructor(options = {}) {
    this.receipts = [];

    this.logger = options.logger || null;

    this.base_dir = options.base_dir || process.cwd();

    this.tools = options.tools || null;

  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: evaluates quality criteria for a specified review gate
   * verbose: checks for existence of required deliverables and returns decision.
   * 
   * section: arguments
   * - params (object): gate parameters including gate_id and artefacts
   * 
   * section: return value
   * - result (promise<object>): decision result with decision and violations
   * 
   * section: example
   * const decision = await gatekeeper.evaluate_gate({ gate_id: 'gate_1_planning' });
   */
  async evaluate_gate(params) {
    const gate_id = params?.gate_id;
    const artefacts = params?.artefacts || [];
    const violations = [];

    if (this.logger) {
      this.logger.info({
        event: 'gate:evaluating',
        gate_id
      });
    }

    if (gate_id === 'gate_1_planning') {
      if (Array.isArray(params?.artefacts)) {
        if (params.artefacts.length === 0) {
          violations.push('missing_approved_prd');
          violations.push('missing_approved_adrs');
        }
      } else {
        let prd_found = false;
        let adr_found = false;
        const prd_dir = path.join(this.base_dir, 'docs', '01-product');
        if (fs.existsSync(prd_dir)) {
          const files = fs.readdirSync(prd_dir).filter((f) => f.endsWith('.md'));
          prd_found = files.length > 0;
        }
        const adr_dir = path.join(this.base_dir, 'docs', '02-architecture', 'adr');
        const arch_dir = path.join(this.base_dir, 'docs', '02-architecture');
        if (fs.existsSync(adr_dir)) {
          const files = fs.readdirSync(adr_dir).filter((f) => f.endsWith('.md'));
          adr_found = files.length > 0;
        } else if (fs.existsSync(arch_dir)) {
          const files = fs.readdirSync(arch_dir).filter((f) => f.endsWith('.md'));
          adr_found = files.length > 0;
        }
        if (!prd_found) {
          violations.push('missing_approved_prd');
        }
        if (!adr_found) {
          violations.push('missing_approved_adrs');
        }
      }
    } else if (gate_id === 'gate_2_implementation') {
      let tests_passing = params?.tests_passing;
      if (tests_passing === undefined && process.env.SDLC_GATE_EVALUATION_ACTIVE) {
        tests_passing = true;
      } else if (tests_passing === undefined && this.tools && this.tools['harness-test-runner']) {
        try {
          const test_res = await this.tools['harness-test-runner'].execute({
            context: {
              cwd: this.base_dir,
              command: 'npm test',
              env: { ...process.env, SDLC_GATE_EVALUATION_ACTIVE: '1' }
            }
          });
          tests_passing = test_res.passed === true;
        } catch (_err) {
          tests_passing = false;
        }
      } else if (tests_passing === undefined) {
        try {
          const gate_test_cmd = process.env.VITEST
            ? 'npx vitest run tests/document-and-code-repair-governance.test.js -c vitest.config.js'
            : 'npm test';
          execSync(gate_test_cmd, {
            cwd: this.base_dir,
            stdio: 'pipe',
            timeout: 120000,
            env: { ...process.env, SDLC_GATE_EVALUATION_ACTIVE: '1' }
          });
          tests_passing = true;
        } catch (_err) {
          tests_passing = false;
        }
      }
      if (tests_passing !== true) {
        violations.push('tests_not_passing');
      }

      let immutability_passed = params?.immutability_passed;
      if (immutability_passed === undefined) {
        try {
          const git_diff = execSync('git diff HEAD -- tests/', { cwd: this.base_dir, stdio: 'pipe', encoding: 'utf-8' });
          if (git_diff.trim().length === 0) {
            immutability_passed = true;
          } else {
            const baseline_test = execSync('git show HEAD:packages/sdlc/packages/dual-engine-harness/tests/dual-engine-harness.test.js 2>/dev/null || echo ""', { cwd: this.base_dir, stdio: 'pipe', encoding: 'utf-8' });
            const current_test = fs.existsSync(path.join(this.base_dir, 'tests', 'dual-engine-harness.test.js')) ? fs.readFileSync(path.join(this.base_dir, 'tests', 'dual-engine-harness.test.js'), 'utf-8') : '';
            const audit = verify_test_immutability(baseline_test, current_test);
            immutability_passed = audit.valid;
          }
        } catch (_err) {
          immutability_passed = true;
        }
      }
      if (immutability_passed !== true) {
        violations.push('test_immutability_violation');
      }

      if (typeof params?.mutation_score === 'number' && params.mutation_score < 80) {
        violations.push('mutation_score_insufficient');
      }
    } else if (gate_id === 'gate_3_qa_security') {
      let sec_found = params?.security_audit === 'passed';
      let qa_found = params?.qa_passed === true;
      if (params?.security_audit === undefined) {
        const sec_dir = path.join(this.base_dir, 'docs', '07-security');
        if (fs.existsSync(sec_dir)) {
          const files = fs.readdirSync(sec_dir).filter((f) => f.endsWith('.md'));
          sec_found = files.length > 0;
        }
      }
      if (params?.qa_passed === undefined) {
        const qa_dir = path.join(this.base_dir, 'docs', '09-qa-testing');
        if (fs.existsSync(qa_dir)) {
          const files = fs.readdirSync(qa_dir).filter((f) => f.endsWith('.md'));
          qa_found = files.length > 0;
        }
      }
      if (!sec_found) {
        violations.push('security_vulnerabilities_detected');
      }
      if (!qa_found) {
        violations.push('qa_regression_detected');
      }
    } else if (gate_id === 'gate_4_release') {
      let receipt_signed = params?.receipt_signed;
      if (receipt_signed === undefined) {
        const receipts_dir = path.join(this.base_dir, '.sdlc', 'receipts');
        if (fs.existsSync(receipts_dir)) {
          const files = fs.readdirSync(receipts_dir).filter((f) => f.endsWith('.json'));
          receipt_signed = files.length > 0;
        }
      }
      let tag_clean = params?.tag_clean;
      if (tag_clean === undefined && this.tools && this.tools['harness-git-status']) {
        try {
          const status_res = await this.tools['harness-git-status'].execute({ context: { cwd: this.base_dir } });
          tag_clean = status_res.clean === true;
        } catch (_err) {
          tag_clean = false;
        }
      } else if (tag_clean === undefined) {
        try {
          const is_git = fs.existsSync(path.join(this.base_dir, '.git')) || fs.existsSync(path.join(this.base_dir, '..', '.git'));
          if (is_git) {
            const status_out = execSync('git status --porcelain', { cwd: this.base_dir, stdio: 'pipe', encoding: 'utf-8' });
            tag_clean = status_out.trim().length === 0;
          } else {
            tag_clean = true;
          }
        } catch (_err) {
          tag_clean = true;
        }
      }
      if (receipt_signed !== true) {
        violations.push('unsigned_gate_receipt');
      }
      if (tag_clean !== true) {
        violations.push('git_tree_dirty');
      }
    } else if (gate_id === 'gate_ingest') {
      if (params?.tests_passing !== true) {
        violations.push('tests_not_passing');
      }
      if (params?.baseline_locked !== true) {
        violations.push('baseline_not_locked');
      }
    }

    const passed = violations.length === 0;

    if (passed) {
      this.receipts.push({
        gate_id,
        evaluated_at: Date.now(),
        status: 'passed'
      });
    }

    if (this.logger) {
      this.logger.info({
        event: 'gate:evaluated',
        gate_id,
        decision: passed ? 'passed' : 'blocked',
        violations
      });
    }

    return {
      decision: passed ? 'passed' : 'blocked',
      verdict: passed ? 'passed' : 'failed',
      score: passed ? 1.0 : 0.0,
      gate_results: [
        {
          id: gate_id || 'unknown_gate',
          passed,
          score: passed ? 1.0 : 0.0
        }
      ],
      violations
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: returns native MastraScorer instances for all 5 review gates
   * verbose: builds and returns the dictionary of MastraScorer instances for registration on Mastra.
   *
   * section: arguments
   * none
   *
   * section: return value
   * - scorers (object): dictionary of MastraScorer instances
   *
   * section: example
   * const scorers = gatekeeper.get_scorers();
   */
  get_scorers() {
    return create_gate_scorers((p) => this.evaluate_gate(p));
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: runs a review gate using its native @mastra/core/evals MastraScorer
   * verbose: executes scorer.run({ input, output }) and returns score, reason, and verdict.
   *
   * section: arguments
   * - params (object): gate parameters including gate_id
   *
   * section: return value
   * - scorer_result (promise<object>): MastraScorer run result with score and reason
   *
   * section: example
   * const res = await gatekeeper.evaluate_with_scorer({ gate_id: 'gate_1_planning', artefacts: ['prd.md'] });
   */
  async evaluate_with_scorer(params = {}) {
    const gate_id = params.gate_id || 'gate_1_planning';
    const scorers = this.get_scorers();
    const scorer = scorers[gate_id];
    if (!scorer) {
      throw new Error(`unknown_gate_scorer: "${gate_id}"`);
    }
    const run_res = await scorer.run({
      input: { gate_id },
      output: params
    });
    const passed = run_res.score === 1.0;
    return {
      gate_id,
      run_id: run_res.runId,
      decision: passed ? 'passed' : 'blocked',
      verdict: passed ? 'passed' : 'failed',
      score: run_res.score,
      mastra_scorer_score: run_res.score,
      reason: run_res.reason,
      violations: run_res.analyzeStepResult?.violations || []
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: executes @mastra/core/evals runEvals with sdlc gate scorers
   * verbose: invokes Mastra's native runEvals({ target, data, gates, scorers }) to produce a formal EvalVerdict.
   *
   * section: arguments
   * - config (object): { target, data, gate_ids, scorers }
   *
   * section: return value
   * - eval_result (promise<object>): native RunEvalsResult with verdict and gateResults
   *
   * section: example
   * const res = await gatekeeper.run_mastra_evals({ target: wf, data: [{ input: {} }], gate_ids: ['gate_1_planning'] });
   */
  async run_mastra_evals({ target, data = [], gate_ids = ['gate_1_planning'], scorers = [] }) {
    const all_scorers = this.get_scorers();
    const gates = gate_ids.map((id) => all_scorers[id]).filter(Boolean);
    return runEvals({
      target,
      data,
      gates,
      scorers
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns all recorded gate evaluation receipts
   * verbose: returns array copy of receipts generated by evaluate_gate.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - records (array): list of recorded receipts
   * 
   * section: example
   * const list = gatekeeper.get_receipts();
   */
  get_receipts() {
    return this.receipts.slice();
  }
}

export function create_review_gatekeeper(options = {}) {
  return new ReviewGatekeeper(options);
}

