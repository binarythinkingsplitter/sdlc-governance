# {{title}}

**document id:** `{{id}}`  
**system / component:** `{{system_component}}`  
**status:** {{status}}  
**author:** {{author}}  
**date:** {{date}}  

---

## 1. problem framing & strategic objectives

### vision
{{executive_summary.vision}}

### problem statement
{{executive_summary.problem}}

### strategic context
{{executive_summary.strategic_context}}

{{#if executive_summary.primary_objectives.length}}
### primary objectives
{{#each executive_summary.primary_objectives}}
- {{this}}
{{/each}}
{{/if}}

---

## 2. user personas & target audience

{{#each target_audience}}
### persona {{@number}}: {{role}}
- **id:** `{{id}}`
- **description:** {{description}}
{{#if responsibilities.length}}
- **responsibilities:**
{{#each responsibilities}}
  - {{this}}
{{/each}}
{{/if}}

{{/each}}
---

## 3. functional requirements

{{#each functional_requirements}}
### {{id}}: {{title}}
- **priority:** {{priority}}
- **status:** {{status}}
- **description:** {{description}}

{{/each}}
---

## 4. non-functional requirements

- **performance:** {{non_functional_requirements.performance}}
- **immutability:** {{non_functional_requirements.immutability}}
- **sovereignty:** {{non_functional_requirements.sovereignty}}
- **style:** {{non_functional_requirements.style}}

---

## 5. scope boundaries

### in scope
{{#each scope_boundaries.in_scope}}
- {{this}}
{{/each}}

### out of scope
{{#each scope_boundaries.out_of_scope}}
- {{this}}
{{/each}}
