# retrospective: {{milestone}}

**document id:** `{{id}}`  
**milestone:** {{milestone}}  
**linked prds:** {{join linked_prd_ids ", "}}  

---

## 1. what went well

{{#each what_went_well}}
- {{this}}
{{/each}}

---

## 2. areas for improvement & frictions

{{#each what_could_improve}}
- {{this}}
{{/each}}

---

## 3. agreed action items

{{#each action_items}}
- [ ] **{{action}}** (owner: {{owner}}, status: {{status}})
{{/each}}
