# lld-40: dual-engine statechart & mastra workflow engine specification

**document id:** `lld-40-dual_engine_statechart_and_mastra_engine_spec.md`  
**system / component:** `@sdlc/dual-engine-harness`  
**lifecycle phase:** phase 02 (architecture & technical design)  
**governance gate:** gate 1 (planning & architecture)  
**status:** approved  
**author:** autonomous sdlc technical design agent & principal systems architect  
**date:** 2026-11-03  

---

## 1. execution sequence diagram

```mermaid
flowchart td
    subgraph runphase["phase execution lifecycle"]
        start["statechart enters phase\n(e.g. phase_03_tdd_red)"]
        initdag["initialise task backlog dag\n(planner agent)"]
        dispatch["dispatch next unblocked task\n(topological dag runner)"]
        mastrawf["execute mastra workflow\n(atomic step pipeline)"]
        eval["llm rubric evaluation\n(evaluator agent)"]
        commit["update task state in dag\n(completed)"]
        checkall{"all dag tasks\ncompleted?"}
        evalgate["evaluate review gate invariants\n(gatekeeper)"]
        gatepass{"gatekeeper\ndecision?"}
        suspend["suspend to disk\n(hitl approval pending)"]
        nextphase["transition to next phase\n(e.g. phase_04_tdd_green)"]
        blocked["transition to gate_blocked\n(log failure report)"]

        start --> initdag
        initdag --> dispatch
        dispatch --> mastrawf
        mastrawf --> eval
        eval --> commit
        commit --> checkall
        checkall -->|no| dispatch
        checkall -->|yes| evalgate
        evalgate --> gatepass
        gatepass -->|approved| nextphase
        gatepass -->|requires hitl| suspend
        gatepass -->|failed| blocked
    end
```

---

## 2. statechart transition table (xstate v5)

| current state | triggering event | guard predicate | target state | action executed |
|---|---|---|---|---|
| `phase_00_inception` | `phase_transition_request` | `has_valid_prd_draft` | `phase_01_specifications` | `persist_snapshot` |
| `phase_01_specifications` | `phase_transition_request` | `has_complete_stories` | `phase_02_architecture` | `persist_snapshot` |
| `phase_02_architecture` | `gate_verify_request` | `is_gate_1_valid` | `gate_1_evaluating` | `evaluate_gate_1` |
| `gate_1_evaluating` | `gate_approval_granted` | `is_hitl_approved` | `phase_03_tdd_red` | `seal_gate_1_receipt` |
| `gate_1_evaluating` | `gate_approval_rejected` | `always` | `gate_blocked` | `emit_diagnostic_report` |
| `phase_03_tdd_red` | `phase_transition_request` | `has_failing_tests` | `phase_04_tdd_green` | `unlock_src_writes` |
| `phase_04_tdd_green` | `phase_transition_request` | `all_tests_passing` | `phase_05_refactor` | `lock_src_writes` |
| `phase_05_refactor` | `gate_verify_request` | `is_gate_2_valid` | `gate_2_evaluating` | `evaluate_gate_2` |
| `gate_2_evaluating` | `gate_approval_granted` | `mutation_and_immutability_ok` | `phase_06_security_review` | `seal_gate_2_receipt` |
| `phase_06_security_review` | `phase_transition_request` | `zero_high_vulns` | `phase_07_qa_verification` | `persist_snapshot` |
| `phase_07_qa_verification` | `gate_verify_request` | `is_gate_3_valid` | `gate_3_evaluating` | `evaluate_gate_3` |
| `gate_3_evaluating` | `gate_approval_granted` | `qa_matrix_satisfied` | `phase_08_release` | `seal_gate_3_receipt` |
| `phase_08_release` | `gate_verify_request` | `is_gate_4_valid` | `gate_4_evaluating` | `evaluate_gate_4` |
| `gate_4_evaluating` | `gate_approval_granted` | `release_signed_and_tagged` | `phase_09_continuous_learning` | `seal_gate_4_receipt` |
| `phase_09_continuous_learning` | `lifecycle_completed` | `retrospective_committed` | `idle` | `archive_session` |

---

## 3. mastra workflow step pipeline

each atomic task dispatched by the task dag executes a 4-step mastra workflow:

1. **step 1: context_assembly_step**:
   - inputs: `task_id`, `phase`, `relevant_paths`.
   - action: reads files, trims markdown ast to prompt token budget, and generates bounded system context.
   - output: `assembled_prompt_context`.

2. **step 2: agent_reasoning_step**:
   - inputs: `assembled_prompt_context`, `agent_role` (`planner`, `coder`, `reviewer`).
   - action: executes model inference with sandboxed tool capabilities.
   - output: `raw_generated_artefacts` (code patches, test blocks, or markdown).

3. **step 3: ast_validation_step**:
   - inputs: `raw_generated_artefacts`.
   - action: runs `@babel/parser` or syntax parser; validates banner jsdoc formatting and absence of banned collections (`map`, `set`).
   - output: `validated_artefacts` or parse error diagnostic.

4. **step 4: rubric_evaluation_step**:
   - inputs: `validated_artefacts`, `evaluation_rubric`.
   - action: executes evaluator agent scoring (correctness, conciseness, standards); if score < 0.85, triggers retry loop up to 3 times.
   - output: `final_task_result` with score and committed file hashes.

---

## 4. test immutability ast verification algorithm

the test immutability verifier (`check-test-immutability.js`) enforces zero assertion reduction:

```javascript
/**
 * section: documentation
 * tldr: test assertion immutability validation algorithm
 * verbose: parses baseline and current test files into ast representations,
 * extracts assertion counts, and asserts that the current count is greater than
 * or equal to baseline without removed test blocks.
 * 
 * @version 0.1.0
 * @param {string} baseline_source - baseline test file source code
 * @param {string} current_source - current test file source code
 * @returns {object} validation outcome { valid: boolean, delta: number, violations: string[] }
 */
export function verify_test_immutability(baseline_source, current_source) {
  const baseline_counts = count_test_assertions(baseline_source);
  const current_counts = count_test_assertions(current_source);

  const delta = current_counts.assertions - baseline_counts.assertions;
  const violations = [];

  if (delta < 0) {
    violations.push(`assertion count decreased: baseline=${baseline_counts.assertions}, current=${current_counts.assertions}`);
  }

  if (current_counts.skipped > baseline_counts.skipped) {
    violations.push(`test skipping introduced: baseline=${baseline_counts.skipped}, current=${current_counts.skipped}`);
  }

  return {
    valid: violations.length === 0,
    delta,
    violations
  };
}
```
