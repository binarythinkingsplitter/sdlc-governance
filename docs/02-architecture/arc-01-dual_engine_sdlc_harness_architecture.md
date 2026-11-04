# arc-10: coupled dual-engine sdlc development harness architecture

**document id:** `arc-10-dual_engine_sdlc_harness_architecture.md`  
**system / component:** `@sdlc/dual-engine-harness`  
**lifecycle phase:** phase 02 (architecture & technical design)  
**governance gate:** gate 1 (planning & architecture)  
**status:** approved  
**author:** autonomous sdlc architecture agent & principal systems architect  
**date:** 2026-11-03  

---

## 1. architectural overview

the coupled dual-engine software development lifecycle (sdlc) development harness bridges deterministic process governance with agentic ai workflow automation.

the system is partitioned into two distinct execution tiers:
1. **tier 1: macro governance (xstate v5)**: formal statechart machine enforcing sequential phase transitions, invariant guards, gate evaluations, and human-in-the-loop suspension.
2. **tier 2: micro execution (mastra v1)**: modular agentic workflows executing within phase boundaries, performing prompt synthesis, test authoring, code generation, and rubric evaluation.

---

## 2. c4 container diagram

```mermaid
flowchart td
    subgraph harness["@sdlc/dual-engine-harness monorepo workspace"]
        cli["sdlc command-line interface\n(bin/cli.js)"]
        mcp["mcp server runtime\n(bin/sdlc-mcp-server.js)"]

        subgraph tier1["tier 1: macro governance"]
            statechart["xstate v5 macro engine\n(lifecycle statechart & guards)"]
            gatekeeper["review gatekeeper\n(gate 1, 2, 3, 4 verifiers)"]
            sessionstore["session snapshot store\n(.sdlc/state/session-*.json)"]
            statechart <--> gatekeeper
            statechart <--> sessionstore
        end

        subgraph tier2["tier 2: micro execution"]
            mastra["mastra v1 workflow engine\n(workflow runner & step pipeline)"]
            supervisor["hierarchical agent supervisor\n(planner, coder, reviewer)"]
            dagrunner["task dag runner\n(topological executor)"]
            evaluator["llm rubric evaluator\n(rubric scoring engine)"]
            mastra <--> supervisor
            mastra <--> dagrunner
            mastra <--> evaluator
        end

        subgraph tools["governance & verification tools"]
            immutability["test immutability verifier\n(check-test-immutability.js)"]
            mutation["mutation test runner\n(stryker in-process runner)"]
            receipts["cryptographic receipt sealer\n(sha-256 merkle + ed25519)"]
        end

        cli --> statechart
        mcp --> statechart
        statechart <-->|events & receipts| mastra
        mastra --> tools
        gatekeeper --> tools
    end

    developer["software engineer /\nproduct owner"] -->|terminal commands| cli
    agent["antigravity ide\npair programmer"] -->|mcp json-rpc| mcp
```

---

## 3. component boundaries & responsibilities

### 3.1 tier 1: macro governance subsystem
- **statechart machine definition**: declaratively encodes the 10 lifecycle phases (`phase_00_inception` through `phase_09_continuous_learning`) with strict hierarchical transitions.
- **review gatekeeper**: executes deterministic predicate checks (`has_valid_prd`, `all_tests_passing`, `test_immutability_verified`) before allowing phase exit.
- **session snapshot store**: writes atomic json snapshots to `.sdlc/state/session-<id>.json` upon review gate suspension, enabling zero-daemon persistent pause and resume.

### 3.2 tier 2: micro execution subsystem
- **mastra workflow engine**: orchestrates single-responsibility, bounded workflows using `create_step` and `create_workflow`.
- **hierarchical agent supervisor**: coordinates specialised worker agents:
  - `planner_worker_agent`: requirements decomposition and task dag generation.
  - `coder_worker_agent`: test-driven code authoring.
  - `reviewer_worker_agent`: code cleanliness and jsdoc compliance.
  - `evaluator_worker_agent`: multi-dimensional rubric scoring.
- **task dag runner**: sorts atomic tasks topologically and dispatches independent tasks across concurrent workers.

### 3.3 verification & receipt subsystem
- **test immutability engine**: parses git diffs and asts in `tests/`, ensuring assertion counts never decrease and test skips are never added.
- **mutation test engine**: executes stryker against target sources, enforcing a minimum 80% mutation survival score before phase 05 completion.
- **cryptographic receipt engine**: generates canonical sha-256 merkle roots across verified deliverables and signs them using ed25519 private keys.

---

## 4. zero-daemon operational architecture

the entire dual-engine harness operates under a strict zero-daemon model:
- **in-process runtime**: all state transitions, workflow executions, and gate verifications run directly inside standard node.js (version 20+) processes.
- **file-backed storage**: all state, logs, queues, and receipts are stored on disk in the `.sdlc/` directory using atomic file writes.
- **antigravity ide pairing**: when run in the editor, the harness provides an stdio-based mcp server requiring zero tcp port binding or network configuration.
