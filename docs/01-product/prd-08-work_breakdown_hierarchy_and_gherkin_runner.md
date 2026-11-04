# product requirements document: canonical work breakdown hierarchy and native gherkin runner

**document id:** `prd-08`  
**system / component:** `@sdlc/dual-engine-harness`  
**status:** approved  
**author:** autonomous product manager agent  
**date:** 2026-11-03  

---

## 1. problem framing & strategic objectives

### vision
### vision
### vision
two distinct architectural issues have emerged during sdlc workflows:

1. **work breakdown directory layout and documentation pollution**:
   in previous iterations, an ambiguous directory naming convention attempted to assign `03` to `03-work-breakdown/`, which conflicted directly with the canonical master documentation hierarchy where directory `03` is strictly `03-data/` (`adr-001`, `adr-040`, `dat-01`). furthermore, legacy work breakdown generators produced uninformative folder names (`task-001/`), redundant nested filenames (`task-001-task-001-...md`), legacy `subtasks/` folders containing flawed `undefined.md` files, and unstructured text.
   to eliminate this friction, the system requires a canonical work breakdown manager that generates descriptive top-level task directories (named by what the task does), a generic `task.md` specification file, a nested `tasks/` directory, and numbered descriptive task files (`01-<step>.md`, `02-<step>.md`) with rich struc

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

### fr-01: work breakdown hierarchy and gherkin runner core capability
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-01: work breakdown hierarchy and gherkin runner core capability

---

## 4. non-functional requirements

- **performance:** p95 phase transition latency under 50ms
- **immutability:** zero reduction in test assertions
- **sovereignty:** zero external runtime daemon dependencies
- **style:** strictly lowercase british english

---

## 5. scope boundaries

### in scope
- work_breakdown_hierarchy_and_gherkin_runner

### out of scope
- legacy external services
