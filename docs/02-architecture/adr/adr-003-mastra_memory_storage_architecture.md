# adr: adr: adr: adr-003: mastra memory storage architecture

**document id:** `adr-003`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-04  
**linked prd:** `prd-03`  

---

## 1. context & problem statement

in the development of mastra memory storage, architectural trade-offs between host platform coupling, execution sovereignty, and architectural invariants must be formally evaluated.

modern autonomous software engineering requires strict architectural boundaries to prevent unconstrained agent drift. when designing mastra memory storage, the following technical constraints must be upheld:
1. **idiomatic es6 object model**: use native `Map`, `Set`, `WeakMap`, and `WeakSet` for associative lookups and membership, and es6 classes (with inheritance where it fits) for stateful components.
2. **es6 classes**: components are es6 classes using `extends` for shared behaviour; `create_*` helpers remain as thin convenience constructors returning `new Class()`.
3. **sovereign execution**: all runtime dependencies must execute within the workspace boundary without external daemon processes (such as external databases or docker containers).

---

---

---

## 2. decision

we decide to implement: adopt decoupled dual-engine architecture

specifically:
1. **class architecture**: model components as es6 classes (using inheritance where it fits) with structured banner-style jsdoc comments (v0.1.0); `create_*` helpers remain as convenience constructors.
2. **state persistence**: store configuration and operational state directly within the workspace under `.sdlc/mastra/{threads,messages,working_memory,observations,knowledge}`, ensuring full auditability and restart durability without volatile in-memory loss.
3. **structure-aware hybrid rag & knowledge graph**: combine deterministic foreign-key traversal (`query_by_prd`), `@mastra/core/knowledge` scoped nodes (`resolve_harness_knowledge`, `sync_to_knowledge`), and reciprocal rank fusion (rrf) over dense embeddings and bm25 lexical scores (`index_store_for_rag`, `search_doc_store`, `chunk_markdown_sections`).
4. **formal gate verification**: ensure all deliverables are verifiable by the formal review gatekeeper through automated disk inspection and live test execution.

---

---

---

## 3. consequences

### positive
- **modularity**: high cohesion and loose coupling across components.
- **verifiability**: zero-mock execution allows formal review gates to evaluate real disk state.
- **invariable compliance**: adheres to the repository's modern es6 standards and master guidelines.

### negative
- requires rigorous automated gate verification


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
