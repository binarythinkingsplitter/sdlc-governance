# user stories & acceptance criteria: {{title}}

**feature identifier:** `{{slug}}`  
**document id:** `{{id}}`  
**governance gate:** gate 1 (planning & architecture)  
**status:** {{status}}  
**linked prd:** `{{linked_prd_id}}`  

---

## 1. epic overview

{{epic}}

---

## 2. user narrative

**as a** {{narrative.as_a}},  
**i want** {{narrative.i_want}},  
**so that** {{narrative.so_that}}.  

---

## 3. acceptance criteria

{{#each acceptance_criteria}}
### {{id}}: {{scenario}}
{{#if given.length}}
{{#each given}}
- **given** {{this}}
{{/each}}
{{/if}}
{{#if when.length}}
{{#each when}}
- **when** {{this}}
{{/each}}
{{/if}}
{{#if then.length}}
{{#each then}}
- **then** {{this}}
{{/each}}
{{/if}}
{{#if and.length}}
{{#each and}}
- **and** {{this}}
{{/each}}
{{/if}}

{{/each}}
