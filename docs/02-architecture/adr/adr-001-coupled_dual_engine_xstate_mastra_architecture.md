# adr: adr: adr: adr-041: coupled dual-engine architecture (xstate v5 statecharts + mastra v1 agentic workflows)

**document id:** `adr-001`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-04  
**linked prd:** `prd-01`  

---

## 1. context & problem statement

in autonomous software engineering environments, software development lifecycle (sdlc) operations require two distinct, seemingly contradictory execution characteristics:
1. **deterministic phase governance**: non-negotiable, mathematically provable transition invariants, verification gates, and tamper-evident audit trails.
2. **dynamic, multi-agent micro execution**: non-deterministic, creative code synthesis, exploratory test generation, heuristic debugging, and tool usage across specialised llm agents.

coupling these paradigms naively causes catastrophic failure modes: either agent workflows drift into unconstrained hallucination and test tampering, or rigid state machines deadlock when agents require non-linear remediation cycles.

---

---

---

---

## 2. decision

1. **mathematical correctness**: the macro lifecycle must be impossible to bypass; invalid state transitions must throw compile-time or statechart errors.
2. **zero external daemon dependencies**: local developer cli execution must operate without external docker, redis, or cloud server processes.
3. **agent modularity**: autonomous tasks must execute through bounded, single-responsibility mastra workflows (`planner`, `coder`, `reviewer`, `evaluator`).
4. **test immutability**: test assertions must be cryptographically protected from deletion or weakening.
5. **persistent hitl suspension**: long-running workflows must suspend and resume cleanly without blocking processes.

---

---

---

---

## 3. consequences

### positive
- **guaranteed phase discipline**: production code writes in `src/` are physically locked until gate 1 passes and failing tests exist in `tests/`.
- **tamper-evident audit lineage**: every review gate seals a signed cryptographic receipt in `.sdlc/receipts/`.
- **zero host overhead**: runs anywhere standard node.js runs, requiring zero external server daemons.

### negative
- **statechart serialization overhead**: state snapshots require disk writes at each transition. *mitigation: atomic file operations (`write_file_atomic`) maintain sub-10ms snapshot latency.*
- **cyclic agent retry loops**: agent remediation loops could potentially run infinitely. *mitigation: bounded retry limits (default 3 retries) trigger escalation to human review upon exhaustion.*


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
