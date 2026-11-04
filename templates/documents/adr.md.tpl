# adr: {{title}}

**document id:** `{{id}}`  
**status:** {{status}}  
**author:** {{author}}  
**date:** {{date}}  
**linked prd:** `{{linked_prd_id}}`  

---

## 1. context & problem statement

{{context}}

---

## 2. decision

{{decision}}

---

## 3. consequences

### positive
{{#each consequences.positive}}
- {{this}}
{{/each}}

### negative
{{#each consequences.negative}}
- {{this}}
{{/each}}

{{#if consequences.neutral.length}}
### neutral
{{#each consequences.neutral}}
- {{this}}
{{/each}}
{{/if}}

{{#if compliance_rules.length}}
---

## 4. compliance & invariants

{{#each compliance_rules}}
- {{this}}
{{/each}}
{{/if}}
