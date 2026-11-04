# product requirements document: project-operating-mode-switch

**document id:** `prd-project_operating_mode_switch`  
**system / component:** `@sdlc/dual-engine-harness`  
**status:** approved  
**author:** product-manager  
**date:** 2026-11-04  

---

## 1. problem framing & strategic objectives

### vision


### problem statement
Developers need control over how new features and functionality are integrated into the existing codebase—whether to strictly append new components on top or insert/retrospectively merge them into existing flows—configured via environment variables or feature toggles.

### strategic context
Developers need control over how new features and functionality are integrated into the existing codebase—whether to strictly append new components on top or insert/retrospectively merge them into existing flows—configured via environment variables or feature toggles. (target audience: Developers and automated agents utilizing the dual-engine sdlc harness to build and evolve features.)

### primary objectives
- Given environment configuration is set to append mode, When a new feature or functionality is generated or applied, Then it adds the new functionality on top of existing code without overwriting existing structures.
- Given environment configuration is set to insert mode, When a new feature or functionality is generated or applied, Then it retrospectively merges the new functionality with existing structures or integrates cleanly into the core flow.
- Given no operating mode is explicitly configured in the environment, When the feature switch initializes, Then it defaults to a safe canonical operating mode with appropriate warning logging.

---

## 2. user personas & target audience

---

## 3. functional requirements

### fr-01: Introduce a configuration switch (commonly known as a feature toggle, operational mode switch, or merge/append strategy toggle) to control project operating mode.
- **priority:** must_have
- **status:** approved
- **description:** Introduce a configuration switch (commonly known as a feature toggle, operational mode switch, or merge/append strategy toggle) to control project operating mode.

### fr-02: Support two primary strategies: 'append' (adds new functionality on top of existing) and 'insert' (retrospectively merges new functionality with existing or creates new integrated structures).
- **priority:** must_have
- **status:** approved
- **description:** Support two primary strategies: 'append' (adds new functionality on top of existing) and 'insert' (retrospectively merges new functionality with existing or creates new integrated structures).

### fr-03: Provide validation and default fallback mechanisms for unconfigured environments.
- **priority:** must_have
- **status:** approved
- **description:** Provide validation and default fallback mechanisms for unconfigured environments.

---

## 4. non-functional requirements

- **performance:** 
- **immutability:** 
- **sovereignty:** 
- **style:** 

---

## 5. scope boundaries

### in scope

### out of scope
