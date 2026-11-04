# release manifest: {{version}}

**document id:** `{{id}}`  
**version:** `{{version}}`  
**timestamp:** {{timestamp}}  
**linked prds:** {{join linked_prd_ids ", "}}  

---

## 1. release deliverables & checksums

| deliverable artefact | sha-256 checksum | description |
| :--- | :--- | :--- |
{{#each deliverables}}
| `{{path}}` | `{{checksum}}` | {{description}} |
{{/each}}

---

## 2. cryptographic gate receipts

{{#each gate_receipts}}
- **gate {{gate}}**: signature `{{signature}}` ({{timestamp}})
{{/each}}

---

## 3. release changelog

{{#each changelog}}
- {{this}}
{{/each}}
