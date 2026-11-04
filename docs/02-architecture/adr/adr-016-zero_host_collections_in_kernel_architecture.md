# adr: zero-host-collections-in-kernel

**document id:** `adr-016-zero_host_collections_in_kernel_architecture.md`  
**system / component:** `@thing/sdlc-dual_engine_harness`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-04  

---

## context
maintain pure piumarta meta-circularity

modern autonomous software engineering requires strict architectural boundaries to prevent unconstrained agent drift. when designing zero host collections in kernel, the following technical constraints must be upheld:
1. **clean modular design**: single responsibility, high cohesion, and low coupling across components.
2. **explicit interfaces**: well-defined contracts and schema validation.
3. **sovereign execution**: all runtime dependencies must execute within the workspace boundary without external daemon processes.

---

## 1. decision

we decide to implement: ban Map and Set in core model

specifically:
1. **class architecture**: model components as es6 classes (using inheritance where it fits) and native Map/Set collections, with structured banner-style jsdoc comments (v0.1.0).
2. **state persistence**: store configuration and operational state directly within the workspace under `.sdlc/`, ensuring full auditability and restart durability.
3. **formal gate verification**: ensure all deliverables are verifiable by the formal review gatekeeper through automated disk inspection and live test execution.

## 2. consequences

### positive
- **modularity**: high cohesion and loose coupling across components.
- **verifiability**: zero-mock execution allows formal review gates to evaluate real disk state.
- **invariable compliance**: strictly adheres to system architecture standards and repository master guidelines.

### negative / neutral
- requires comprehensive unit testing and immutability verification on every change.
