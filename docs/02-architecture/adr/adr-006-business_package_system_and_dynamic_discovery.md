# adr: adr: adr: adr-006: business package system and dynamic discovery architecture

**document id:** `adr-006`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-03  
**linked prd:** `prd-06`  

---

## 1. context & problem statement

the dual-engine harness was originally designed with the software development lifecycle (sdlc) hardcoded into its core runtime. however, the dual-engine architecture (macro statechart governance coupled with micro agentic workflow execution) is fundamentally domain-agnostic. it can govern any complex business process—such as customer onboarding, regulatory auditing, enterprise procurement, or incident response—by changing the statecharts, workflows, agents, review gates, and tools.

without a formal package abstraction, expanding to non-sdlc business domains would require copy-pasting or bloating the core harness runtime with disparate domain concerns.

---

---

---

---

## 2. decision

we introduce the **business package** abstraction and a dynamic package discovery mechanism:

1. **package definition (`define_business_package`)**:
   - defines a standard contract for self-contained business domain packages.
   - components:
     - `metadata`: `id`, `name`, `version`, `description`.
     - `statecharts`: project-level lifecycle machine, work-item machines, and stage routing table.
     - `gates`: evaluation functions for quality review gates.
     - `workflows`: compiled mastra workflows.
     - `agents`: specialized role agents with domain prompts.
     - `tools`: domain mastra tools.
     - `skills`: domain governance rules compiled into skills.
     - `schemas`: zod input and output contracts for role agents and stages.

2. **canonical sdlc package (`create_sdlc_package`)**:
   - encapsulates all existing sdlc logic into `@sdlc/package-sdlc` (or module `SdlcPackage.js`).
   - the harness runtime delegates all sdlc-specific behavior to this package.

3. **dynamic package registry (`create_package_registry`)**:
   - manages package discovery and registration with a `PackageRegistry` class backed by a native `Map`.
   - merges workflows, tools, agents, schemas, and review gates into the live harness runtime.
   - supports discovery from filesystem directories, manifests, and explicit constructor options.

4. **100% backwards compatibility**:
   - `create_dual_engine_harness()` defaults to mounting `create_sdlc_package()` when no packages are explicitly provided.
   - all existing methods (`start_work_item`, `execute_work_item_stage`, `get_project_state`, etc.) operate seamlessly.

5. **cli package introspection**:
   - enhances `bin/cli.js` with `package list` and `package info <id>` commands for terminal discovery.

---

---

---

---

## 3. consequences

### positive
- cleanly separates runtime engine infrastructure from domain-specific business rules.
- unlocks multi-package enterprise business workflows in a single harness runtime.
- enables third-party developers to publish and install custom domain packages as standard npm packages.
- guarantees 100% backwards compatibility with all existing tests and workflows.

### negative
- slight overhead during package mounting to validate and register tools and workflows into the mastra execution bridge.
- requires careful merging of stage routing tables when multiple packages are mounted.


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
