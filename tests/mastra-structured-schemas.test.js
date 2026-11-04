/**
 * =========================================================================
 * test: mastra-structured-schemas.test.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test suite for structured agent schemas and compiled mastra governance skills
 * verbose: verifies zod input/output schemas for all role agents, fail-closed validation,
 * compilation of the 7-tier governance rules into native mastra skills, and agent skill binding.
 * 
 * section: example
 * node --test packages/sdlc/packages/dual-engine-harness/tests/mastra-structured-schemas.test.js
 * =========================================================================
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  ProductManagerInputSchema,
  ProductManagerOutputSchema,
  SystemArchitectInputSchema,
  SystemArchitectOutputSchema,
  SoftwareEngineerInputSchema,
  SoftwareEngineerOutputSchema,
  SecurityEngineerInputSchema,
  SecurityEngineerOutputSchema,
  QaEngineerInputSchema,
  QaEngineerOutputSchema,
  DevopsEngineerInputSchema,
  DevopsEngineerOutputSchema,
  validate_agent_input,
  validate_agent_output,
  get_role_schema_pair
} from '../src/MastraSchemas.js';
import {
  create_role_agents,
  create_harness_skills,
  resolve_role_governance_skills,
  GOVERNANCE_SKILLS
} from '../src/HarnessSkills.js';

test('mastra-schemas: validates product manager structured input and output', () => {
  const valid_input = {
    feature_name: 'test_feature',
    problem_statement: 'addresses user latency issues',
    target_audience: 'api consumers',
    constraints: ['zero host classes']
  };

  const parsed_input = validate_agent_input(ProductManagerInputSchema, valid_input);
  assert.equal(parsed_input.feature_name, 'test_feature');

  const valid_output = {
    prd: {
      title: 'test feature prd',
      document_id: 'prd-06-test.md',
      problem_statement: 'user latency issues',
      scope: ['core routing'],
      non_goals: ['ui changes'],
      acceptance_criteria: ['response time under 10ms']
    },
    stories: [
      {
        id: 'story-01',
        title: 'fast routing dispatch',
        given: 'an incoming request',
        when: 'routed through the kernel',
        then: 'dispatches under 10ms'
      }
    ]
  };

  const parsed_output = validate_agent_output(ProductManagerOutputSchema, valid_output);
  assert.equal(parsed_output.prd.title, 'test feature prd');
  assert.equal(parsed_output.stories.length, 1);

  // fail-closed validation on missing required fields
  assert.throws(() => {
    validate_agent_output(ProductManagerOutputSchema, { prd: { title: 'incomplete' } });
  }, /validation_failed/);
});

test('mastra-schemas: validates system architect structured input and output', () => {
  const valid_input = {
    feature_name: 'auth_module',
    title: 'auth_architecture',
    decision: 'use stateless tokens'
  };

  const parsed_input = validate_agent_input(SystemArchitectInputSchema, valid_input);
  assert.equal(parsed_input.feature_name, 'auth_module');

  const valid_output = {
    adr: {
      id: 'adr-004',
      document_id: 'adr-004-auth.md',
      title: 'stateless token architecture',
      status: 'accepted',
      context: 'need scalable authentication',
      decision: 'use hmac tokens without server sessions',
      consequences: ['no session store needed', 'revocation requires blocklist']
    },
    interface_contract: {
      document_id: 'int-03-auth.json',
      schema_version: '0.1.0',
      methods: [
        {
          name: 'verify_token',
          params: ['token_string'],
          return_type: 'boolean',
          description: 'validates cryptographic signature'
        }
      ]
    }
  };

  const parsed_output = validate_agent_output(SystemArchitectOutputSchema, valid_output);
  assert.equal(parsed_output.adr.status, 'accepted');
  assert.equal(parsed_output.interface_contract.methods.length, 1);

  // rejects invalid status
  assert.throws(() => {
    validate_agent_output(SystemArchitectOutputSchema, {
      ...valid_output,
      adr: { ...valid_output.adr, status: 'invalid_status' }
    });
  }, /validation_failed/);
});

test('mastra-schemas: validates security, software engineer, qa, and devops schemas', () => {
  // software engineer
  const swe_output = validate_agent_output(SoftwareEngineerOutputSchema, {
    implementation: {
      source_code: 'export function run() { return true; }',
      code_file: 'src/run.js',
      exported_symbols: ['run'],
      banner_documentation_present: true,
      piumarta_invariants_preserved: true
    }
  });
  assert.equal(swe_output.implementation.banner_documentation_present, true);

  // security engineer
  const sec_output = validate_agent_output(SecurityEngineerOutputSchema, {
    threat_model: {
      document_id: 'sec-04-threat.md',
      stride_vectors: [
        {
          category: 'spoofing',
          threat: 'token forgery',
          mitigation: 'sha-256 signature verification',
          status: 'mitigated'
        }
      ],
      sign_off: true,
      residual_risk: 'low'
    }
  });
  assert.equal(sec_output.threat_model.sign_off, true);

  // qa engineer
  const qa_output = validate_agent_output(QaEngineerOutputSchema, {
    test_report: {
      document_id: 'qa-04-report.md',
      total_tests: 12,
      assertions_count: 34,
      immutability_verified: true,
      mutation_score: 92,
      sign_off: true
    }
  });
  assert.equal(qa_output.test_report.mutation_score, 92);

  // devops engineer
  const devops_output = validate_agent_output(DevopsEngineerOutputSchema, {
    release_manifest: {
      document_id: 'rel-03-manifest.md',
      version: '0.2.0',
      semver_bump: 'minor',
      changelog_entry: 'added structured schemas and governance skills',
      sealed_receipt: { gate_id: 'gate_4', hash: 'abc123hash', timestamp: new Date().toISOString() }
    },
    retrospective: {
      document_id: 'ret-04-delivery.md',
      key_learnings: ['schemas prevent hallucination'],
      improvements: ['automate contract validation'],
      metrics: { duration_ms: 1200, test_count: 55 }
    }
  });
  assert.equal(devops_output.release_manifest.semver_bump, 'minor');

  // helper get_role_schema_pair
  const pm_pair = get_role_schema_pair('product-manager');
  assert.ok(pm_pair.input && pm_pair.output);
});

test('mastra-governance: provides pre-compiled static governance skills with zero runtime io', () => {
  const skills = GOVERNANCE_SKILLS;
  assert.ok(skills && typeof skills === 'object');
  const skill_keys = Object.keys(skills);

  // verify core tier and specific governance skills exist
  assert.ok(skill_keys.length >= 10, `expected at least 10 pre-compiled skills, got ${skill_keys.length}`);
  assert.ok(skills['gov-british-english'], 'gov-british-english skill must exist');
  assert.ok(skills['gov-jsdoc-guide'], 'gov-jsdoc-guide skill must exist');
  assert.ok(skills['gov-mandatory-sdlc-orchestrator-governance'], 'gov-mandatory-sdlc-orchestrator-governance must exist');
  assert.ok(skills['gov-tier-02-architecture'], 'architecture tier skill must exist');
  assert.ok(skills['gov-zero-host-collections'], 'zero host collections skill must exist');
  assert.ok(skills['gov-test-immutability'], 'test immutability skill must exist');

  // verify skill conforms to mastra skill structure
  const british = skills['gov-british-english'];
  assert.equal(british.__inline, true);
  assert.ok(british.instructions.length > 0);
  assert.ok(british.references.length > 0);
  assert.equal(british.path, 'inline/gov-british-english');
});

test('mastra-governance: resolves pre-compiled role skill assignments without disk io', () => {
  const tiers = GOVERNANCE_SKILLS;
  assert.ok(tiers['gov-tier-00-core']);
  assert.ok(tiers['gov-tier-01-lifecycle']);
  assert.ok(tiers['gov-tier-02-architecture']);
  assert.ok(tiers['gov-tier-03-code-engineering']);
  assert.ok(tiers['gov-tier-04-testing']);
  assert.ok(tiers['gov-tier-05-security']);
  assert.ok(tiers['gov-tier-06-operations']);
  assert.ok(tiers['gov-agents-master']);

  // verify role resolution
  const swe_skills = resolve_role_governance_skills('software-engineer');
  assert.ok(swe_skills.some((s) => s.name === 'gov-tier-03-code-engineering'));
  assert.ok(swe_skills.some((s) => s.name === 'gov-tier-04-testing'));
  assert.ok(swe_skills.some((s) => s.name === 'gov-test-immutability'));

  const sec_skills = resolve_role_governance_skills('security-engineer');
  assert.ok(sec_skills.some((s) => s.name === 'gov-tier-05-security'));

  const pm_skills = resolve_role_governance_skills('product-manager');
  assert.ok(pm_skills.some((s) => s.name === 'gov-tier-01-lifecycle'));
});

test('mastra-governance: equips role agents with compiled governance skills', async () => {
  const agents = create_role_agents({ enable_governance_skills: true });
  assert.ok(agents['software-engineer']);

  const swe = agents['software-engineer'];
  const skills_list = await swe.listSkills();
  assert.ok(skills_list.length >= 3, `expected at least 3 skills on swe, got ${skills_list.length}`);

  // verify that swe agent has code engineering or piumarta skills
  const skill_names = skills_list.map((s) => s.name);
  assert.ok(
    skill_names.includes('piumarta-compliance') ||
    skill_names.includes('gov-tier-03-code-engineering')
  );
});
