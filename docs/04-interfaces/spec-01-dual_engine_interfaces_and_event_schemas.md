# spec-01: dual-engine sdlc harness interfaces & event schemas

**document id:** `spec-01-dual_engine_interfaces_and_event_schemas.md`  
**system / component:** `@sdlc/dual-engine-harness`  
**lifecycle phase:** phase 01 (product planning & specifications)  
**governance gate:** gate 1 (planning & architecture)  
**status:** proposed / in review  
**author:** autonomous sdlc specification agent & systems architect  
**date:** 2026-11-03  

---

## 1. interface architecture overview

the dual-engine sdlc development harness defines strict interface contracts across three tiers:
1. **tier 1: macro statechart interface (xstate v5)**: contracts for state transitions, guard evaluations, and session persistence.
2. **tier 2: micro execution workflow interface (mastra v1)**: contracts for worker agent prompts, tool invocations, step outputs, and rubric evaluation.
3. **ide integration interface (mcp)**: contracts for model context protocol tools and resources exposed to antigravity ide.

---

## 2. tier 1: statechart events & context schemas

### 2.1 statechart context schema (`macro_statechart_context`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "macro_statechart_context",
  "type": "object",
  "required": ["session_id", "project_name", "active_phase", "artefacts", "gate_receipts", "task_dag", "created_at", "updated_at"],
  "properties": {
    "session_id": { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" },
    "project_name": { "type": "string" },
    "active_phase": {
      "type": "string",
      "enum": [
        "phase_00_inception",
        "phase_01_specifications",
        "phase_02_architecture",
        "phase_03_tdd_red",
        "phase_04_tdd_green",
        "phase_05_refactor",
        "phase_06_security_review",
        "phase_07_qa_verification",
        "phase_08_release",
        "phase_09_continuous_learning",
        "idle",
        "gate_blocked"
      ]
    },
    "active_gate": {
      "type": ["string", "null"],
      "enum": ["gate_1_planning", "gate_2_implementation", "gate_3_qa_security", "gate_4_release", null]
    },
    "artefacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["artefact_id", "phase", "path", "sha256", "validated_at"],
        "properties": {
          "artefact_id": { "type": "string" },
          "phase": { "type": "string" },
          "path": { "type": "string" },
          "sha256": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
          "validated_at": { "type": "integer" }
        }
      }
    },
    "gate_receipts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["gate_id", "receipt_path", "merkle_root", "signature", "sealed_at"],
        "properties": {
          "gate_id": { "type": "string" },
          "receipt_path": { "type": "string" },
          "merkle_root": { "type": "string" },
          "signature": { "type": "string" },
          "sealed_at": { "type": "integer" }
        }
      }
    },
    "task_dag": {
      "type": "object",
      "required": ["nodes", "edges"],
      "properties": {
        "nodes": { "type": "array", "items": { "$ref": "#/definitions/task_dag_node" } },
        "edges": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["from", "to"],
            "properties": {
              "from": { "type": "string" },
              "to": { "type": "string" }
            }
          }
        }
      }
    },
    "created_at": { "type": "integer" },
    "updated_at": { "type": "integer" }
  },
  "definitions": {
    "task_dag_node": {
      "type": "object",
      "required": ["task_id", "name", "phase", "agent_role", "status", "depends_on"],
      "properties": {
        "task_id": { "type": "string" },
        "name": { "type": "string" },
        "phase": { "type": "string" },
        "agent_role": { "type": "string", "enum": ["planner", "coder", "reviewer", "evaluator", "security_auditor"] },
        "status": { "type": "string", "enum": ["pending", "in_progress", "completed", "failed", "blocked"] },
        "depends_on": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

### 2.2 statechart transition events

```json
{
  "events": [
    {
      "name": "phase_transition_request",
      "payload": {
        "type": "object",
        "required": ["session_id", "target_phase", "artefacts"],
        "properties": {
          "session_id": { "type": "string" },
          "target_phase": { "type": "string" },
          "artefacts": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    {
      "name": "gate_verify_request",
      "payload": {
        "type": "object",
        "required": ["session_id", "gate_id"],
        "properties": {
          "session_id": { "type": "string" },
          "gate_id": { "type": "string", "enum": ["gate_1_planning", "gate_2_implementation", "gate_3_qa_security", "gate_4_release"] }
        }
      }
    },
    {
      "name": "gate_approval_granted",
      "payload": {
        "type": "object",
        "required": ["session_id", "gate_id", "approver", "receipt"],
        "properties": {
          "session_id": { "type": "string" },
          "gate_id": { "type": "string" },
          "approver": { "type": "string" },
          "receipt": { "type": "object" },
          "notes": { "type": "string" }
        }
      }
    },
    {
      "name": "session_suspend",
      "payload": {
        "type": "object",
        "required": ["session_id", "reason"],
        "properties": {
          "session_id": { "type": "string" },
          "reason": { "type": "string" }
        }
      }
    },
    {
      "name": "session_resume",
      "payload": {
        "type": "object",
        "required": ["session_id", "action"],
        "properties": {
          "session_id": { "type": "string" },
          "action": { "type": "string", "enum": ["approve", "reject", "retry"] },
          "notes": { "type": "string" }
        }
      }
    }
  ]
}
```

---

## 3. tier 2: mastra workflow contracts

### 3.1 workflow execution input & output schema

every micro execution mastra workflow (`create_step` -> `create_workflow`) adheres to standard input and output contracts:

```json
{
  "workflow_contract": {
    "input_schema": {
      "type": "object",
      "required": ["task_id", "phase", "context_files", "parameters"],
      "properties": {
        "task_id": { "type": "string" },
        "phase": { "type": "string" },
        "context_files": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["path", "content"],
            "properties": {
              "path": { "type": "string" },
              "content": { "type": "string" }
            }
          }
        },
        "parameters": { "type": "object" }
      }
    },
    "output_schema": {
      "type": "object",
      "required": ["task_id", "status", "generated_files", "diagnostics", "rubric_score"],
      "properties": {
        "task_id": { "type": "string" },
        "status": { "type": "string", "enum": ["success", "failure", "remediation_required"] },
        "generated_files": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["path", "action", "content_hash"],
            "properties": {
              "path": { "type": "string" },
              "action": { "type": "string", "enum": ["created", "modified", "deleted"] },
              "content_hash": { "type": "string" }
            }
          }
        },
        "diagnostics": { "type": "array", "items": { "type": "string" } },
        "rubric_score": { "type": "number", "minimum": 0.0, "maximum": 1.0 }
      }
    }
  }
}
```

---

## 4. model context protocol (mcp) tools & resources

### 4.1 mcp tools definition

| tool name | summary | mandatory arguments | return schema |
|---|---|---|---|
| `sdlc_get_status` | retrieve real-time macro phase, active gate, and task status | `session_id` (string, optional) | `macro_statechart_context` |
| `sdlc_submit_artefact` | register and validate an artefact at phase boundary | `session_id` (string), `artefact_path` (string), `phase` (string) | `{ "valid": boolean, "sha256": string, "errors": string[] }` |
| `sdlc_run_gate_check` | evaluate all deterministic invariants for active gate | `gate_id` (string), `session_id` (string) | `{ "decision": "passed" \| "blocked", "violations": string[], "receipt": object \| null }` |
| `sdlc_trigger_workflow` | dispatch granular mastra workflow for task | `task_id` (string), `agent_role` (string), `inputs` (object) | `workflow_contract.output_schema` |
| `sdlc_check_immutability` | check git diff against assertion immutability rules | `base_commit` (string, optional), `target_dir` (string, optional) | `{ "status": "pass" \| "fail", "delta": number, "violations": string[] }` |

### 4.2 mcp resource uri scheme

- `sdlc://state`: active json statechart representation.
- `sdlc://backlog`: current markdown / json backlog dag and task progression.
- `sdlc://receipts`: list of cryptographically signed gate receipts in `.sdlc/receipts/`.
- `sdlc://logs/tool-calls`: tail of structured tool interception audit logs.

---

## 5. cryptographic receipt schema

every formal review gate seals a tamper-evident json receipt in `.sdlc/receipts/`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "cryptographic_gate_receipt",
  "type": "object",
  "required": [
    "receipt_id",
    "gate_id",
    "phase",
    "project",
    "git_commit",
    "merkle_root",
    "verified_artefacts",
    "issuer",
    "signature",
    "sealed_at"
  ],
  "properties": {
    "receipt_id": { "type": "string" },
    "gate_id": { "type": "string", "enum": ["gate_1_planning", "gate_2_implementation", "gate_3_qa_security", "gate_4_release"] },
    "phase": { "type": "string" },
    "project": { "type": "string" },
    "git_commit": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
    "merkle_root": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "verified_artefacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "sha256"],
        "properties": {
          "path": { "type": "string" },
          "sha256": { "type": "string" }
        }
      }
    },
    "issuer": { "type": "string" },
    "signature": { "type": "string" },
    "sealed_at": { "type": "integer" }
  }
}
```
