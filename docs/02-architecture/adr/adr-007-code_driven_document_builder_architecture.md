# adr: adr: adr: adr-007: code-driven template-backed document builder architecture

**document id:** `adr-007`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-03  
**linked prd:** `prd-07`  

---

## 1. context & problem statement

in an autonomous software development lifecycle platform, agents and human contributors continuously author structured artefacts across all lifecycle stages: prds, user stories, adrs, interfaces, threat models, qa test plans, and release manifests.

previously, these documents were composed via unstandardised string templates or raw markdown concatenation within individual agent steps. this created maintenance friction, non-uniform markdown structures, and missed opportunities for automated validation (e.g. ensuring all required sections are populated prior to review gate submission).

---

---

---

---

## 2. decision

we introduce a pure, functional, fluent document builder engine (`DocumentBuilder.js`) with built-in templates:

1. **fluent builder pattern using es6 classes**:
   - implemented as a `DocumentBuilder` base class with per-template subclasses (`PrdBuilder`, `AdrBuilder`, ...) and a `SectionBuilder`, chaining by returning `this` (`create_document_builder` remains as a convenience constructor).
   - uses es6 `class` and `extends` syntax.
   - stores sections and metadata using native Map, Set and modern ES6 collections.

2. **unbroken section chaining**:
   - `doc.section.create(id)` creates and registers a section, returning a section builder.
   - the section builder exposes content authoring helpers (`heading`, `contents`, `text`, `code`, `table`, `list`) while delegating document-level methods (`section.create`, `title`, `description`, `render`, `save`).
   - this guarantees unbroken chaining:
     `prd.create("demo").title("demo").description("desc").section.create("s1").heading("h1").contents("c1").section.create("s2").heading("h2").contents("c2").save("path.md")`.

3. **canonical document templates**:
   - pre-compiled layouts for standard document types:
     - `prd`: product requirements document
     - `threat_model`: stride security audit
     - `test_report`: qa regression & test report
     - `release`: release manifest & receipt verification
     - `retrospective`: continuous learning review
     - `generic`: unconstrained markdown deliverable

4. **security & path traversal defence**:
   - `.save(filepath)` validates that the resolved path does not escape the configured `workspace_root`.
   - automatically provisions nested parent directories with `fs.mkdirSync({ recursive: true })`.

---

---

---

---

## 3. consequences

### positive
- standardises all generated documentation into canonical clean-room layouts.
- eliminates boilerplate string concatenation across role agent workflows.
- simplifies programmatic artifact authoring for both autonomous agents and testing suites.
- preserves a consistent es6 class-based design.

### negative
- introduces a lightweight abstraction layer that role workflows should adopt over time.


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
