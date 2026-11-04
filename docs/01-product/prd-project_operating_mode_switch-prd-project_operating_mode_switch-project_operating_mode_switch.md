# product requirements document: project-operating-mode-switch

**document id:** `prd-project_operating_mode_switch`  
**system / component:** `@sdlc/dual-engine-harness`  
**status:** approved  
**author:** product-manager  
**date:** 2026-11-04  

---

## 1. problem framing & strategic objectives

### vision
### vision


### problem statement
Developers need control over how new features and functionality are integrated into the existing codebase—whether to strictly append new components on top or insert/retrospectively merge them into existing flows—configured via environment variables or feature toggles.

### strategic context
Developers need control over how new features and functionality are integrated into the existing codebase—whether to strictly append new components on top or insert/retrospectively merge them into existing flows—configured via environment variables or feature toggles. (target audience: Developers and automated agents utilizing the dual-engine sdlc harness to build and evolve features.)

### primary objectives
- Given environment configuration is set to append mode, When a new feature or functionality is generated or applied, Then it adds the new functionality on top of existing code without overwriting existing structures.
- Given environment configuration is set t

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

### fr-01: introduce a configuration switch (commonly known as a feature toggle, operational mode switch, or merge/append strategy toggle) to control project operating mode.
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-01: introduce a configuration switch (commonly known as a feature toggle, operational mode switch, or merge/append strategy toggle) to control project operating mode.

### fr-02: support two primary strategies: 'append' (adds new functionality on top of existing) and 'insert' (retrospectively merges new functionality with existing or creates new integrated structures).
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-02: support two primary strategies: 'append' (adds new functionality on top of existing) and 'insert' (retrospectively merges new functionality with existing or creates new integrated structures).

### fr-03: provide validation and default fallback mechanisms for unconfigured environments.
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-03: provide validation and default fallback mechanisms for unconfigured environments.

---

## 4. non-functional requirements

- **performance:** p95 phase transition latency under 50ms
- **immutability:** zero reduction in test assertions
- **sovereignty:** zero external runtime daemon dependencies
- **style:** strictly lowercase british english

---

## 5. scope boundaries

### in scope
- prd-project_operating_mode_switch-project_operating_mode_switch

### out of scope
- legacy external services
