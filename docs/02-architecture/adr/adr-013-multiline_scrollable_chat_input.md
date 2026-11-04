# adr: adr: adr: adr: multiline scrollable chat input

**document id:** `adr-013`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-04  
**linked prd:** `prd-13`  

---

## 1. context & problem statement

architectural trade-off analysis for introducing a multiline scrollable chat input component within the dual-engine harness terminal and web interface. traditional single-line prompt fields severely restrict user expression when composing detailed prompts, code snippets, or complex engineering instructions. however, implementing multiline textareas within constrained terminal or web viewports introduces significant layout challenges, including boundary overflow, vertical scrolling state management, cursor tracking across wrapped lines, and input synchronisation with the dual-engine execution pipeline. we evaluated two primary architectural patterns: a monolithic tightly coupled input-controller that embeds buffer management and rendering directly inside the chat view renderer, versus a decoupled dual-engine architecture separating state buffering, view rendering, and event propagation.

---

---

---

## 2. decision

adopt decoupled dual-engine architecture for the multiline scrollable chat input. this architecture separates the input buffer state management engine from the view rendering and event handling engine, maintaining strict interface boundaries and clear functional cohesion. input state transitions—such as newline insertion, vertical scrolling offsets, and cursor positioning—are managed via pure state reducer functions operating on immutable data structures, while the rendering engine handles terminal/dom viewport projection without side-effects.

---

---

---

## 3. consequences

### positive
- high cohesion and explicit contracts

### negative
- compliance: strictly adheres to lowercase british english standards and enforces zero uppercase characters across all architectural prose and descriptive documentation.


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
