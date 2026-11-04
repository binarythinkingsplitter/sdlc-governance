# product requirements document: product-manager discovery & agent-to-supervisor mediation

**document id:** `prd-10`  
**system / component:** `@sdlc/dual-engine-harness / interactive discovery chat & supervisor bridge`  
**status:** approved  
**author:** autonomous sdlc product engineering team  
**date:** 2026-11-04  

---

## 1. problem framing & strategic objectives

### vision
### vision
### vision
when operators launch the interactive cli chat (`sdlc-harness chat`) and enter a free-form prompt describing an idea or asking what features should be implemented, the harness previously defaulted to `sdlc-supervisor` or triggered overly broad regex safeguards (`is_sdlc_execution_request`, `detect_prd_code_sync_request`, and `explicit_create_match`) that immediately synthesised a product requirements document (prd) in `.sdlc/store` and executed the full ten-phase `develop-feature` process.

in normal interactive workflows, users do not want to converse directly with the internal `sdlc-supervisor` governor, nor do they want exploratory discussions to mutate `.sdlc/store` or launch code generation prematurely. instead, the default conversational partner must be the `product-manager` specialist agent, operating in collaborative discovery and feature-brainstorming mode by default, while specialist agents interact with `sdlc-supervisor` on the user's behalf through a g

### problem statement
unconstrained agent drift vs rigid workflow gridlock

### strategic context
clean modular sdlc development

### primary objectives
- leverage native es6 collections and classes in the core model
- enforce mathematical transition guards and quality gates

---

## 2. user personas & target audience

### persona 1: software engineer
- **id:** `persona-swe`
- **description:** executes tdd red-green cycles and adheres to governance standards
- **responsibilities:**
  - author tests
  - write clean modular code

---

## 3. functional requirements

### fr-01: product manager discovery and supervisor mediation core capability
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-01: product manager discovery and supervisor mediation core capability

---

## 4. non-functional requirements

- **performance:** p95 phase transition latency under 50ms
- **immutability:** zero reduction in test assertions
- **sovereignty:** zero external runtime daemon dependencies
- **style:** strictly lowercase british english

---

## 5. scope boundaries

### in scope
- product_manager_discovery_and_supervisor_mediation

### out of scope
- legacy external services
