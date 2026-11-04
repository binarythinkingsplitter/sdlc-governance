# product requirements document: business package system & dynamic discovery

**document id:** `prd-06`  
**system / component:** `@sdlc/dual-engine-harness`  
**status:** approved  
**author:** autonomous product manager agent  
**date:** 2026-11-03  

---

## 1. problem framing & strategic objectives

### vision
### vision
### vision
currently, `@sdlc/dual-engine-harness` bundles the generic dual-engine execution platform together with the software engineering (sdlc) lifecycle logic. the dual-engine runtime possesses universal capabilities: macro statecharts (xstate v5), micro agentic pipelines (mastra v1), task dag dependency execution, review gate evaluations, structured schema validation, and centralised pino telemetry logging.

to enable the engine to execute business logic for any enterprise domain—including sdlc, procurement, hr operations, regulatory compliance, customer onboarding, and financial auditing—the platform must cleanly decouple **what the engine is** (the generic execution platform) from **what the engine does** (domain business packages).

a new first-class abstraction, the **business package**, encapsulates domain statecharts, stage routing tables, review gate evaluators, micro workflows, role agents, domain tools, governance rules, and zod contracts. the harness runtime d

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

### fr-01: business package system core capability
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-01: business package system core capability

---

## 4. non-functional requirements

- **performance:** p95 phase transition latency under 50ms
- **immutability:** zero reduction in test assertions
- **sovereignty:** zero external runtime daemon dependencies
- **style:** strictly lowercase british english

---

## 5. scope boundaries

### in scope
- business_package_system

### out of scope
- legacy external services
