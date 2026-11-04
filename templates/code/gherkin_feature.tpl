@sdlc @prd-{{linked_prd_id}}
Feature: {{title}}
  {{epic}}

  As a {{narrative.as_a}}
  I want {{narrative.i_want}}
  So that {{narrative.so_that}}

{{#each acceptance_criteria}}
  @{{id}}
  Scenario: {{scenario}}
{{#each given}}
    Given {{this}}
{{/each}}
{{#each when}}
    When {{this}}
{{/each}}
{{#each then}}
    Then {{this}}
{{/each}}
{{#each and}}
    And {{this}}
{{/each}}

{{/each}}
