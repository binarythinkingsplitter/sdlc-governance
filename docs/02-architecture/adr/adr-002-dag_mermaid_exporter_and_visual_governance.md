# adr: adr: adr: adr-002: dag mermaid exporter and visual governance

**document id:** `adr-002`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-04  
**linked prd:** `prd-02`  

---

## 1. context & problem statement

task backlog dags in `TaskDagEngine.js` compute topological order using plain arrays and, where lookups matter, native `Map`s. while the json graph format is easily consumed programmatically, human engineers and automated audit logs require visual diagrams to inspect critical paths, parallelisation opportunities, and security checkpoints.

---

---

---

## 2. decision

we introduce `DagMermaidExporter.js` in `packages/sdlc/packages/dual-engine-harness/src/`:
1. **stateless generator**: the exporter is a stateless procedural generator `export_dag_to_mermaid(dag, options)`; it may use native `Map` and `Set` internally.
2. **mermaid grammar**: outputs standard github-flavoured markdown mermaid syntax:
   - diagram header: `flowchart TD`
   - node declarations with escaped identifier sanitisation: `node_id["[role] task_id"]`
   - dependency edges: `dep_id --> node_id`
   - status class styling: `classDef completed fill:#dafbe1,stroke:#2da44e,stroke-width:2px;`
3. **integration**: exposed on harness instance as `harness.export_dag_mermaid(dag)` and accessible via cli subcommand `sdlc-harness dag export`.

---

---

---

## 3. consequences

### positive
- **positive**: consistent modern es6 style and banner jsdoc documentation.
- **

### negative
- requires rigorous automated gate verification


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
