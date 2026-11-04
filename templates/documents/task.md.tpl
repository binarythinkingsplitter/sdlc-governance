# task: {{title}}

**document id:** `{{id}}`  
**task identifier:** `{{slug}}`  
**linked prd:** `{{linked_prd_id}}`  
**assigned role:** `{{assigned_role}}`  
**status:** {{status}}  

---

## 1. task objective

{{objective}}

---

## 2. inputs & prerequisites

{{#each inputs}}
- {{this}}
{{/each}}

---

## 3. expected outputs

{{#each outputs}}
- {{this}}
{{/each}}

---

## 4. completion criteria

{{#each criteria}}
- [x] {{this}}
{{/each}}

---

## 5. decomposed child tasks

{{#each tasks}}
### task {{pad_start number 2 "0"}}: {{title}}
- **slug:** `{{slug}}`
- **status:** {{status}}
- **description:** {{description}}
{{#if steps.length}}
- **steps:**
{{#each steps}}
  1. {{this}}
{{/each}}
{{/if}}

{{/each}}
