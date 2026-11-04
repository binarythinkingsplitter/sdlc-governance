# phase 00: inception & problem framing - dual-engine sdlc development harness

**document id:** `inc-22-dual_engine_sdlc_harness.md`  
**phase:** phase 00 (inception & problem framing)  
**status:** approved  
**owner:** principal systems architect & product manager  
**date:** 2026-11-03  

---

## 1. initiative vision

initialise the coupled dual-engine autonomous software development lifecycle (sdlc) harness integrating:
1. **tier 1 (macro governance)**: deterministic, mathematically verifiable statechart engine (`xstate v5`) enforcing sequential lifecycle phases, transition invariants, and strict quality review gates.
2. **tier 2 (micro execution)**: agentic ai workflow engine (`mastra v1`) orchestrating modular, single-responsibility workflows for autonomous code synthesis, test authoring, evaluation rubrics, and tool execution.

## 2. problem framing & strategic objectives

- **the unconstrained agent trap**: natural language prompts are merely advisory. without hard runtime governance, autonomous coding agents bypass specifications, jump directly into writing production code, and weaken test assertions to force green builds.
- **the rigid automation trap**: hardcoded static pipelines lack the semantic reasoning needed to iteratively repair code, evaluate complex rubrics, or synthesize unit test suites.
- **objective**: deliver an end-to-end executable harness that can be bootstrapped locally with zero external runtime daemons and dogfooded to evolve its own capabilities.

## 3. deliverable references

- foundational product requirements document: [`prd-01-dual_engine_sdlc_harness.md`](file:///home/ben/.gemini/antigravity/worktrees/thing-next/init_dual_engine_sdlc/docs/01-product/prd-01-dual_engine_sdlc_harness.md)
- workspace package registration: `@sdlc/dual-engine-harness` in `packages/sdlc/packages/dual-engine-harness`
