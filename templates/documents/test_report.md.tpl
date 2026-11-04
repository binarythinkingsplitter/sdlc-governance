# qa test report: {{slug}}

**document id:** `{{id}}`  
**target version:** `{{target_version}}`  
**pass rate:** {{pass_rate}}%  
**gate verdict:** {{gate_verdict}}  
**linked prd:** `{{linked_prd_id}}`  

---

## 1. test execution results

| test suite | pass | fail | duration |
| :--- | :--- | :--- | :--- |
{{#each suites}}
| {{suite_name}} | {{pass_count}} | {{fail_count}} | {{duration_ms}}ms |
{{/each}}

---

## 2. test immutability audit

- **baseline assertions:** {{immutability_audit.baseline_assertions}}
- **current assertions:** {{immutability_audit.current_assertions}}
- **delta:** {{immutability_audit.delta}}
- **verdict:** {{#if immutability_audit.valid}}verified (no assertion decrease){{else}}violation{{/if}}
