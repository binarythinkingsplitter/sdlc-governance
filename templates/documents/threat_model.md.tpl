# threat model: {{component}}

**document id:** `{{id}}`  
**component:** `{{component}}`  
**linked prd:** `{{linked_prd_id}}`  

---

## 1. stride threat analysis matrix

| threat category | risk description | architectural mitigation & control | status |
| :--- | :--- | :--- | :--- |
{{#each threat_vectors}}
| {{category}} | {{risk}} | {{mitigation}} | {{status}} |
{{/each}}

---

## 2. attack surface & boundaries

{{#each boundaries}}
- **{{name}}**: {{description}}
{{/each}}

---

## 3. security review sign-off

- [{{#if sign_off.approved}}x{{else}} {{/if}}] approval verdict: **{{#if sign_off.approved}}approved{{else}}rejected{{/if}}**
- **date:** {{sign_off.date}}
- **auditor:** {{sign_off.auditor}}
