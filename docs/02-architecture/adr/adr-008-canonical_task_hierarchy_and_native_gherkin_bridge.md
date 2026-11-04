# adr: adr: adr: architectural decision record: canonical task hierarchy and native gherkin bridge

**document id:** `adr-008`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-03  
**linked prd:** `prd-08`  

---

## 1. context & problem statement

in the clean-room documentation hierarchy specified in `adr-001` and `adr-040`, directory `03` is strictly `03-data/` for data models, entity-relationship diagrams, and storage schemas. past experiments improperly attempted to use `03-work-breakdown/`, causing directory collision and creating 194 malformed `undefined.md` files within legacy `subtasks/` folders.
additionally, bdd acceptance criteria authored in gherkin syntax (`given`, `when`, `then`) require a test runner that executes within node.js without pulling heavy external dependencies or introducing unnecessary abstractions.

---

---

---

---

## 2. decision

**document id:** `adr-008`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-03  
**linked prd:** `prd-08`  

---

---

## 3. consequences

### positive
- `03-data/` is permanently protected from directory clashes.
- task folders are immediately identifiable by purpose rather than opaque sequential numbers.
- zero malformed or undefined child task files.
- bdd specifications execute seamlessly inside `node --test` alongside tdd unit tests.
- zero runtime dependencies added.
- **

### negative
- does not support esoteric cucumber features (e.g. distributed cross-machine step execution), which are unneeded in our embedded harness.


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
