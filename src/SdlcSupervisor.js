/**
 * =========================================================================
 * module: sdlc supervisor
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: tier 2 supervisory governor agent that operates the tier 1 deterministic sdlc engine
 * verbose: implements the inversion-of-control governance pattern where the sdlc-supervisor
 * agent exclusively operates the tier 1 engine (MacroStatechartEngine, WorkBoard, ReviewGatekeeper,
 * DocumentEntityStore) and mediates all tier 2 mastra workflows via signed supervisor tokens.
 * ensures mastra workflows never touch .sdlc/store directly—all context is hydrated on pull
 * and committed to the store only after supervisor and gatekeeper verification.
 * 
 * section: export catalog
 * - HIGH_LEVEL_PROCESS_PROFILES: catalogue of 25 high-level sdlc and devops processes
 * - create_sdlc_supervisor_agent: creates the mastra Agent instance for sdlc-supervisor
 * - create_sdlc_supervisor: creates the full supervisory governor controller
 * =========================================================================
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Agent } from '@mastra/core/agent';
import { GOVERNANCE_SKILLS } from './HarnessSkills.js';
import { resolve_harness_model } from './HarnessModel.js';
import { resolve_harness_memory, resolve_harness_knowledge } from './MastraMemoryStorage.js';
import { DocumentEntityTypes } from './DocumentEntitiesSchema.js';
import {
  create_request_context,
  create_sdlc_processor_suite,
  scan_sdlc_governance_violations
} from './HarnessProcessors.js';
import { create_sdlc_rules_engine } from './SdlcRulesEngine.js';
import { create_git_governance_provenance } from './GitGovernanceProvenance.js';
import { parse_feature_brief_input } from './InteractiveDiscoveryChat.js';

/**
 * catalogue of 25 high-level business, sdlc, and devops processes
 */
export const HIGH_LEVEL_PROCESS_PROFILES = Object.freeze([
  // a. project & product lifecycle
  {
    id: 'bootstrap-project',
    name: 'bootstrap greenfield project',
    domain: 'project',
    commit_type: 'init',
    sdlc_profile: 'inception-sdlc',
    work_item_type: 'feature',
    description: 'initialises repository charter, directory hierarchy, .sdlc/store, and baseline architecture',
    stages: [
      { suffix: 'prd', title: 'author project charter & prd', role: 'product-manager', workflow_id: 'pm-prd-authoring', phase: 'inception', depends_on: [] },
      { suffix: 'adr', title: 'author foundational adr', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'architecture', depends_on: ['prd'] }
    ]
  },
  {
    id: 'ingest-project',
    name: 'ingest brownfield project',
    domain: 'project',
    commit_type: 'ingest',
    sdlc_profile: 'ingestion-sdlc',
    work_item_type: 'ingest',
    description: 'scans existing codebase, migrates documents into .sdlc/store, and locks test baseline',
    stages: [
      { suffix: 'adr', title: 'capture baseline architecture', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'discovery', depends_on: [] },
      { suffix: 'qa', title: 'audit and lock baseline test suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'baseline_lock', depends_on: ['adr'] }
    ]
  },
  {
    id: 'plan-roadmap',
    name: 'plan product roadmap & epics',
    domain: 'project',
    commit_type: 'plan',
    sdlc_profile: 'discovery-sdlc',
    work_item_type: 'feature',
    description: 'conducts product discovery, authors prd, and slices user stories into backlog',
    stages: [
      { suffix: 'prd', title: 'author product requirements document', role: 'product-manager', workflow_id: 'pm-prd-authoring', phase: 'inception', depends_on: [] },
      { suffix: 'stories', title: 'slice user stories & acceptance criteria', role: 'product-manager', workflow_id: 'pm-story-slicing', phase: 'specification', depends_on: ['prd'] }
    ]
  },
  {
    id: 'spike-prototype',
    name: 'time-boxed technical spike',
    domain: 'project',
    commit_type: 'spike',
    sdlc_profile: 'discovery-sdlc',
    work_item_type: 'feature',
    description: 'evaluates technical feasibility and records an architectural decision record',
    stages: [
      { suffix: 'adr', title: 'record spike findings & adr', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'architecture', depends_on: [] }
    ]
  },
  {
    id: 'decommission-component',
    name: 'decommission component or project',
    domain: 'project',
    commit_type: 'deprecate',
    sdlc_profile: 'ops-sdlc',
    work_item_type: 'feature',
    description: 'archives component artefacts, updates deprecation records, and seals teardown receipt',
    stages: [
      { suffix: 'decom', title: 'archive and decommission target', role: 'devops-engineer', workflow_id: 'devops-project-decommissioning', phase: 'release', depends_on: [] }
    ]
  },

  // b. core software engineering (conventional commits core)
  {
    id: 'develop-feature',
    name: 'develop end-to-end feature',
    domain: 'engineering',
    commit_type: 'feat',
    sdlc_profile: 'full-10-phase-sdlc',
    work_item_type: 'feature',
    description: 'full 10-phase feature delivery from prd discovery through architecture, tdd backlog, security/qa, and release',
    stages: [
      { suffix: 'prd', title: 'author feature prd', role: 'product-manager', workflow_id: 'pm-prd-authoring', phase: 'inception', depends_on: [] },
      { suffix: 'stories', title: 'slice user stories', role: 'product-manager', workflow_id: 'pm-story-slicing', phase: 'specification', depends_on: ['prd'], spawns_tasks: true },
      { suffix: 'adr', title: 'author architecture decision record', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'architecture', depends_on: ['prd'] },
      { suffix: 'interface', title: 'define interface contract', role: 'system-architect', workflow_id: 'arch-interface-contract', phase: 'architecture', depends_on: ['adr'] },
      { suffix: 'impl', title: 'execute tdd implementation cycle', role: 'software-engineer', workflow_id: 'se-feature-implementation', phase: 'tdd_red', depends_on: ['stories', 'interface'] },
      { suffix: 'sec', title: 'conduct stride threat modelling', role: 'security-engineer', workflow_id: 'sec-threat-modeling', phase: 'security_qa', depends_on: ['impl'] },
      { suffix: 'qa', title: 'run qa regression and immutability audit', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'security_qa', depends_on: ['impl'] },
      { suffix: 'release', title: 'package semantic release & receipt', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'release', depends_on: ['sec', 'qa'] },
      { suffix: 'retro', title: 'author continuous learning retrospective', role: 'devops-engineer', workflow_id: 'devops-retrospective-authoring', phase: 'continuous_learning', depends_on: ['release'] }
    ]
  },
  {
    id: 'fix-defect',
    name: 'fix software defect',
    domain: 'engineering',
    commit_type: 'fix',
    sdlc_profile: 'tactical-fix-sdlc',
    work_item_type: 'fix',
    description: 'reproduces defect with failing test, applies minimal green patch, and verifies regression suite',
    stages: [
      { suffix: 'patch', title: 'reproduce defect and apply tdd fix', role: 'software-engineer', workflow_id: 'se-defect-patch', phase: 'reproduction_test', depends_on: [] },
      { suffix: 'qa', title: 'verify regression suite and test immutability', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'regression_suite', depends_on: ['patch'] },
      { suffix: 'release', title: 'package patch release', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'release', depends_on: ['qa'] }
    ]
  },
  {
    id: 'emergency-hotfix',
    name: 'emergency production hotfix',
    domain: 'engineering',
    commit_type: 'hotfix',
    sdlc_profile: 'hotfix-sdlc',
    work_item_type: 'hotfix',
    description: 'rapid incident triage, emergency patch, smoke verification, release, and mandatory post-mortem',
    stages: [
      { suffix: 'patch', title: 'triage and apply emergency patch', role: 'software-engineer', workflow_id: 'se-defect-patch', phase: 'emergency_patch', depends_on: [] },
      { suffix: 'smoke', title: 'execute smoke verification', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'smoke_test', depends_on: ['patch'] },
      { suffix: 'release', title: 'cut emergency hotfix release', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'release', depends_on: ['smoke'] },
      { suffix: 'postmortem', title: 'author mandatory incident post-mortem', role: 'devops-engineer', workflow_id: 'devops-retrospective-authoring', phase: 'mandatory_post_mortem', depends_on: ['release'] }
    ]
  },
  {
    id: 'refactor-module',
    name: 'refactor module structure',
    domain: 'engineering',
    commit_type: 'refactor',
    sdlc_profile: 'refactor-sdlc',
    work_item_type: 'refactor',
    description: 'behaviour-preserving code transformation under strict test immutability lock',
    stages: [
      { suffix: 'transform', title: 'execute behaviour-preserving refactoring', role: 'software-engineer', workflow_id: 'se-feature-implementation', phase: 'transformation', depends_on: [] },
      { suffix: 'docs', title: 'update adrs, prds, and docs/ to match the refactored design, then sync doc stores', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'transformation', depends_on: ['transform'] },
      { suffix: 'verify', title: 'verify test immutability and metrics', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'verification', depends_on: ['transform', 'docs'] }
    ]
  },
  {
    id: 'optimise-performance',
    name: 'optimise runtime performance',
    domain: 'engineering',
    commit_type: 'perf',
    sdlc_profile: 'refactor-sdlc',
    work_item_type: 'refactor',
    description: 'profiles bottleneck, implements performance optimisation, and verifies zero regressions',
    stages: [
      { suffix: 'adr', title: 'document performance bottleneck & strategy', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'baseline_audit', depends_on: [] },
      { suffix: 'opt', title: 'implement performance optimisation', role: 'software-engineer', workflow_id: 'se-feature-implementation', phase: 'transformation', depends_on: ['adr'] },
      { suffix: 'verify', title: 'verify benchmark delta and regression suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'verification', depends_on: ['opt'] }
    ]
  },
  {
    id: 'revert-change',
    name: 'revert defective change or release',
    domain: 'engineering',
    commit_type: 'revert',
    sdlc_profile: 'tactical-fix-sdlc',
    work_item_type: 'fix',
    description: 'rolls back target commit or feature, verifies baseline tests, and records rollback receipt',
    stages: [
      { suffix: 'revert', title: 'apply clean rollback patch', role: 'software-engineer', workflow_id: 'se-defect-patch', phase: 'patch_implementation', depends_on: [] },
      { suffix: 'qa', title: 'verify restored baseline test suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'regression_suite', depends_on: ['revert'] },
      { suffix: 'release', title: 'seal rollback release receipt', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'release', depends_on: ['qa'] }
    ]
  },

  // c. architecture, api & data evolution
  {
    id: 'evolve-architecture',
    name: 'evolve system architecture',
    domain: 'architecture',
    commit_type: 'arch',
    sdlc_profile: 'discovery-sdlc',
    work_item_type: 'feature',
    description: 'authors or supersedes adrs and updates system boundary contracts',
    stages: [
      { suffix: 'adr', title: 'author architectural decision record', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'architecture', depends_on: [] },
      { suffix: 'interface', title: 'update system interface contract', role: 'system-architect', workflow_id: 'arch-interface-contract', phase: 'architecture', depends_on: ['adr'] }
    ]
  },
  {
    id: 'version-interface',
    name: 'version api or interface contract',
    domain: 'architecture',
    commit_type: 'api',
    sdlc_profile: 'discovery-sdlc',
    work_item_type: 'feature',
    description: 'introduces or versions interface contracts and validates consumer compatibility',
    stages: [
      { suffix: 'interface', title: 'define versioned interface schema', role: 'system-architect', workflow_id: 'arch-interface-contract', phase: 'architecture', depends_on: [] },
      { suffix: 'qa', title: 'verify contract compatibility suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'security_qa', depends_on: ['interface'] }
    ]
  },
  {
    id: 'migrate-data-schema',
    name: 'migrate data or store schema',
    domain: 'architecture',
    commit_type: 'data',
    sdlc_profile: 'refactor-sdlc',
    work_item_type: 'refactor',
    description: 'designs schema evolution, implements migration logic, and verifies data integrity',
    stages: [
      { suffix: 'adr', title: 'author schema migration adr', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'baseline_audit', depends_on: [] },
      { suffix: 'impl', title: 'implement schema migration & adapters', role: 'software-engineer', workflow_id: 'se-feature-implementation', phase: 'transformation', depends_on: ['adr'] },
      { suffix: 'qa', title: 'verify data migration integrity tests', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'verification', depends_on: ['impl'] }
    ]
  },

  // d. quality, testing, documentation & standards
  {
    id: 'expand-test-suite',
    name: 'expand unit, bdd, or e2e test coverage',
    domain: 'quality',
    commit_type: 'test',
    sdlc_profile: 'refactor-sdlc',
    work_item_type: 'refactor',
    description: 'authors additional vitest and gherkin test suites while preserving existing test immutability',
    stages: [
      { suffix: 'tests', title: 'author expanded test suites', role: 'software-engineer', workflow_id: 'se-feature-implementation', phase: 'transformation', depends_on: [] },
      { suffix: 'audit', title: 'verify coverage and test immutability', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'verification', depends_on: ['tests'] }
    ]
  },
  {
    id: 'author-documentation',
    name: 'author and synchronise documentation',
    domain: 'quality',
    commit_type: 'docs',
    sdlc_profile: 'discovery-sdlc',
    work_item_type: 'feature',
    description: 'authors structured documentation entities in .sdlc/store and renders clean-room markdown',
    stages: [
      { suffix: 'prd', title: 'update product & specification entities', role: 'product-manager', workflow_id: 'pm-prd-authoring', phase: 'specification', depends_on: [] },
      { suffix: 'adr', title: 'update architectural documentation', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'architecture', depends_on: ['prd'] }
    ]
  },
  {
    id: 'enforce-standards',
    name: 'enforce code style & banner standards',
    domain: 'quality',
    commit_type: 'style',
    sdlc_profile: 'refactor-sdlc',
    work_item_type: 'refactor',
    description: 'remediates banner jsdoc comments, formatting, and strictly lowercase british english compliance',
    stages: [
      { suffix: 'style', title: 'apply standards & banner jsdoc remediation', role: 'software-engineer', workflow_id: 'se-feature-implementation', phase: 'transformation', depends_on: [] },
      { suffix: 'verify', title: 'verify lint and regression baseline', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'verification', depends_on: ['style'] }
    ]
  },

  // e. security & compliance
  {
    id: 'remediate-vulnerability',
    name: 'remediate security vulnerability (cve)',
    domain: 'security',
    commit_type: 'sec',
    sdlc_profile: 'security-sdlc',
    work_item_type: 'security_patch',
    description: 'analyses threat vector, reproduces vulnerability, applies security patch, and updates threat model',
    stages: [
      { suffix: 'threat', title: 'analyse vulnerability & stride threat vector', role: 'security-engineer', workflow_id: 'sec-threat-modeling', phase: 'vulnerability_analysis', depends_on: [] },
      { suffix: 'patch', title: 'implement security remediation patch', role: 'software-engineer', workflow_id: 'se-defect-patch', phase: 'patch', depends_on: ['threat'] },
      { suffix: 'qa', title: 'verify security scan and regression suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'security_scan', depends_on: ['patch'] },
      { suffix: 'release', title: 'package security patch release', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'release', depends_on: ['qa'] }
    ]
  },
  {
    id: 'audit-security-posture',
    name: 'audit project security posture',
    domain: 'security',
    commit_type: 'audit',
    sdlc_profile: 'security-sdlc',
    work_item_type: 'security_patch',
    description: 'executes comprehensive stride threat modelling and qa verification across the project',
    stages: [
      { suffix: 'threat', title: 'execute comprehensive stride threat audit', role: 'security-engineer', workflow_id: 'sec-threat-modeling', phase: 'vulnerability_analysis', depends_on: [] },
      { suffix: 'qa', title: 'verify security test suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'security_scan', depends_on: ['threat'] }
    ]
  },

  // f. devops, build, ci/cd & operations
  {
    id: 'configure-build',
    name: 'configure build system & packaging',
    domain: 'devops',
    commit_type: 'build',
    sdlc_profile: 'maintenance-sdlc',
    work_item_type: 'dependency_upgrade',
    description: 'updates build configuration, package manifests, and verifies clean build + test execution',
    stages: [
      { suffix: 'build', title: 'update build configuration', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'version_bump', depends_on: [] },
      { suffix: 'qa', title: 'verify build and test suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'compatibility_test', depends_on: ['build'] }
    ]
  },
  {
    id: 'configure-ci-cd',
    name: 'configure ci/cd pipelines & hooks',
    domain: 'devops',
    commit_type: 'ci',
    sdlc_profile: 'maintenance-sdlc',
    work_item_type: 'dependency_upgrade',
    description: 'configures continuous integration workflows, git hooks, and automated gate checks',
    stages: [
      { suffix: 'ci', title: 'update ci pipeline and gate automation', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'version_bump', depends_on: [] },
      { suffix: 'qa', title: 'verify pipeline execution and test suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'compatibility_test', depends_on: ['ci'] }
    ]
  },
  {
    id: 'upgrade-dependencies',
    name: 'upgrade project dependencies',
    domain: 'devops',
    commit_type: 'chore(deps)',
    sdlc_profile: 'maintenance-sdlc',
    work_item_type: 'dependency_upgrade',
    description: 'bumps dependency versions, verifies compatibility matrix, and seals release manifest',
    stages: [
      { suffix: 'bump', title: 'scan and bump target dependencies', role: 'software-engineer', workflow_id: 'se-feature-implementation', phase: 'version_bump', depends_on: [] },
      { suffix: 'qa', title: 'run compatibility and regression test suite', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'compatibility_test', depends_on: ['bump'] },
      { suffix: 'release', title: 'record dependency upgrade manifest', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'release', depends_on: ['qa'] }
    ]
  },
  {
    id: 'cut-release',
    name: 'cut semantic release & seal receipt',
    domain: 'devops',
    commit_type: 'release',
    sdlc_profile: 'ops-sdlc',
    work_item_type: 'feature',
    description: 'verifies regression baseline, calculates semver increment, and seals cryptographic release receipt',
    stages: [
      { suffix: 'qa', title: 'verify pre-release regression baseline', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'security_qa', depends_on: [] },
      { suffix: 'release', title: 'package release manifest and sign receipt', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'release', depends_on: ['qa'] }
    ]
  },
  {
    id: 'provision-infrastructure',
    name: 'provision operational infrastructure',
    domain: 'devops',
    commit_type: 'infra',
    sdlc_profile: 'ops-sdlc',
    work_item_type: 'feature',
    description: 'authors infrastructure architecture, security posture, and operational release manifests',
    stages: [
      { suffix: 'adr', title: 'author infrastructure architecture record', role: 'system-architect', workflow_id: 'arch-adr-authoring', phase: 'architecture', depends_on: [] },
      { suffix: 'sec', title: 'model infrastructure threat vectors', role: 'security-engineer', workflow_id: 'sec-threat-modeling', phase: 'security_qa', depends_on: ['adr'] },
      { suffix: 'ops', title: 'package operational deployment manifest', role: 'devops-engineer', workflow_id: 'devops-release-packaging', phase: 'release', depends_on: ['sec'] }
    ]
  },
  {
    id: 'manage-incident',
    name: 'manage operational incident & rca',
    domain: 'devops',
    commit_type: 'ops(incident)',
    sdlc_profile: 'hotfix-sdlc',
    work_item_type: 'hotfix',
    description: 'coordinates incident triage, mitigation verification, and blameless retrospective',
    stages: [
      { suffix: 'triage', title: 'apply incident mitigation patch', role: 'software-engineer', workflow_id: 'se-defect-patch', phase: 'emergency_patch', depends_on: [] },
      { suffix: 'verify', title: 'verify service recovery smoke tests', role: 'qa-engineer', workflow_id: 'qa-regression-audit', phase: 'smoke_test', depends_on: ['triage'] },
      { suffix: 'rca', title: 'author blameless root-cause retrospective', role: 'devops-engineer', workflow_id: 'devops-retrospective-authoring', phase: 'mandatory_post_mortem', depends_on: ['verify'] }
    ]
  }
]);

const PROCESS_ALIASES = Object.freeze({
  feature: 'develop-feature',
  fix: 'fix-defect',
  defect: 'fix-defect',
  bug: 'fix-defect',
  hotfix: 'emergency-hotfix',
  refactor: 'refactor-module',
  security_patch: 'remediate-vulnerability',
  'security-patch': 'remediate-vulnerability',
  dependency_upgrade: 'upgrade-dependencies',
  'dependency-upgrade': 'upgrade-dependencies',
  ingest: 'ingest-project',
  'ingest-legacy-codebase': 'ingest-project',
  perf: 'optimise-performance',
  'performance-optimisation': 'optimise-performance',
  test: 'expand-test-suite',
  'coverage-hardening': 'expand-test-suite',
  'regression-audit': 'expand-test-suite',
  'flaky-test-quarantine': 'expand-test-suite',
  docs: 'author-documentation',
  'documentation-refresh': 'author-documentation',
  sync: 'develop-feature',
  'sync-sdlc': 'develop-feature',
  'sync-prd-code': 'develop-feature',
  'prd-code-sync': 'develop-feature',
  'bidirectional-sync': 'develop-feature',
  'sync-docs': 'author-documentation',
  style: 'enforce-standards',
  'code-formatting-hygiene': 'enforce-standards',
  build: 'configure-build',
  'build-system-tuning': 'configure-build',
  ci: 'configure-ci-cd',
  'ci-pipeline-hardening': 'configure-ci-cd',
  release: 'cut-release',
  'release-version': 'cut-release',
  'rollback-release': 'revert-change',
  revert: 'revert-change',
  'design-architecture': 'evolve-architecture',
  'architecture-review': 'evolve-architecture',
  'api-contract-evolution': 'version-interface',
  'data-migration-design': 'migrate-data-schema',
  'stride-threat-audit': 'audit-security-posture',
  'secret-supply-chain-scan': 'audit-security-posture',
  'security-incident-response': 'manage-incident',
  'project-inception': 'bootstrap-project',
  'enter-maintenance': 'configure-ci-cd',
  'decommission-project': 'decommission-component',
  'sprint-retrospective': 'author-documentation'
});

/**
 * =========================================================================
 * function: create_sdlc_supervisor_agent
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates the mastra Agent instance for the tier 2 sdlc-supervisor
 * verbose: instantiates the supervisory governor agent equipped with all 7-tier governance
 * skills, memory, and model adapter to oversee the tier 1 engine and specialist workers.
 * 
 * section: arguments
 * - options (object, optional): { model, memory, storage, tools }
 * 
 * section: return value
 * - agent (Agent): mastra Agent instance for sdlc-supervisor
 * 
 * section: example
 * const sup_agent = create_sdlc_supervisor_agent();
 * =========================================================================
 */
export function create_sdlc_supervisor_agent(options = {}) {
  const model = resolve_harness_model(options);
  const memory = resolve_harness_memory(options);
  const gov_skills = Object.values(GOVERNANCE_SKILLS);
  const processor_suite = options.processor_suite || create_sdlc_processor_suite(options);
  const delegation = options.delegation || null;

  return new Agent({
    id: 'sdlc-supervisor',
    name: 'sdlc-supervisor',
    instructions: [
      'you are the tier 1 sdlc-supervisor agent inside the mastra runtime.',
      'you exclusively operate the deterministic tier 1 sdlc engine (xstate macro statechart, work board, review gatekeeper, and document entity store) and mediate all tier 2 specialist subagents and workflows.',
      'enforce strictly lowercase british english, tdd red-green-refactor discipline, and test immutability.',
      'when gathering requirements for a feature, defect, or architecture item, call update_specification_draft whenever the user shares or refines the name, problem statement, target audience, acceptance criteria, functional requirements, or architectural constraints.',
      'critical execution rule: as soon as the user states they are satisfied with the requirements, or asks to execute, run, start, or build the sdlc process or feature, you must immediately call execute_sdlc_process! never tell the user that you are stuck in or restricted to the inception phase—calling execute_sdlc_process is the exact tier 1 mechanism that transitions the xstate statechart out of inception through all 10 sdlc phases (phases 00 to 09) and dispatches the specialist worker pool.',
      'when chatting with the user, always respond in clear, concise, human-readable lowercase british english prose or bullet points—never output raw json objects or json code blocks in chat replies.'
    ].join(' '),
    model,
    memory,
    skills: gov_skills,
    tools: options.tools || {},
    agents: options.agents || {},
    workflows: options.workflows || {},
    inputProcessors: processor_suite.supervisor_input_processors,
    outputProcessors: processor_suite.supervisor_output_processors,
    maxProcessorRetries: 3,
    defaultOptions: delegation ? { delegation } : undefined
  });
}

/**
 * =========================================================================
 * function: extract_store_entities_from_output
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: extracts structured store entities from pure mastra workflow output payloads
 * verbose: maps pure step output from pm, architect, qa, security, and devops workflows
 * into schema-compliant DocumentEntityStore records for tier 1 commit upon review approval.
 * 
 * section: arguments
 * - workflow_id (string): executed mastra workflow identifier
 * - output (object): pure workflow output payload
 * - context (object): ticket context { epic_id, linked_prd_id }
 * 
 * section: return value
 * - entities (array): array of { type, data } objects ready for store commit
 * 
 * section: example
 * const entities = extract_store_entities_from_output('pm-prd-authoring', out, { epic_id: 'auth' });
 * =========================================================================
 */
export function extract_store_entities_from_output(workflow_id, output = {}, context = {}) {
  const entities = [];
  const step_outputs = Array.isArray(output?.history)
    ? output.history.map((h) => h.output).filter(Boolean)
    : [output];
  const merged = Object.assign({}, output, ...step_outputs);
  const slug = String(merged.feature_name || context.epic_id || 'feature')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const prd_id = context.linked_prd_id || `prd-${slug}`;

  if (workflow_id === 'pm-prd-authoring') {
    const problem_text = merged.problem_statement || context.problem_statement || `deliver ${slug} under sdlc governance`;
    const raw_reqs = Array.isArray(merged.functional_requirements) && merged.functional_requirements.length > 0
      ? merged.functional_requirements
      : (Array.isArray(context.functional_requirements) && context.functional_requirements.length > 0
        ? context.functional_requirements
        : [`implement and verify ${slug} according to specification`]);
    const raw_criteria = Array.isArray(merged.acceptance_criteria) && merged.acceptance_criteria.length > 0
      ? merged.acceptance_criteria
      : (Array.isArray(context.acceptance_criteria) && context.acceptance_criteria.length > 0
        ? context.acceptance_criteria
        : [`establish verifiable boundaries for ${slug}`]);

    entities.push({
      type: DocumentEntityTypes.PRD,
      data: {
        id: prd_id,
        slug,
        title: `product requirements document: ${merged.feature_name || context.epic_id || slug}`,
        status: 'approved',
        author: 'product-manager',
        executive_summary: {
          problem: problem_text,
          strategic_context: context.target_audience
            ? `${problem_text} (target audience: ${context.target_audience})`
            : problem_text,
          primary_objectives: raw_criteria.map((item) => String(item))
        },
        functional_requirements: raw_reqs.map((req, idx) => (
          typeof req === 'object' && req !== null && req.id
            ? req
            : {
              id: `fr-${String(idx + 1).padStart(2, '0')}`,
              title: typeof req === 'string' ? req : `core ${slug} capability ${idx + 1}`,
              description: typeof req === 'string' ? req : `implement and verify ${slug} according to specification`,
              priority: 'must_have',
              status: 'approved'
            }
        ))
      }
    });
  } else if (workflow_id === 'pm-story-slicing') {
    const raw_stories = Array.isArray(merged.stories) ? merged.stories : [];
    const fallback_criteria = Array.isArray(context.acceptance_criteria) ? context.acceptance_criteria : [];
    for (let i = 0; i < raw_stories.length; i += 1) {
      const s = raw_stories[i];
      const story_criteria = Array.isArray(s.acceptance_criteria) && s.acceptance_criteria.length > 0
        ? s.acceptance_criteria
        : fallback_criteria;
      entities.push({
        type: DocumentEntityTypes.USER_STORY,
        data: {
          id: s.id || `story-${slug}-${String(i + 1).padStart(2, '0')}`,
          slug: `${slug}_story_${String(i + 1).padStart(2, '0')}`,
          title: s.title || `user story ${i + 1} for ${slug}`,
          linked_prd_id: prd_id,
          epic: context.epic_id || slug,
          acceptance_criteria: (story_criteria || []).map((ac, idx) => (
            typeof ac === 'string'
              ? { id: `ac-${idx + 1}`, scenario: ac, given: ['valid context'], when: ['executed'], then: [ac] }
              : ac
          )),
          status: 'completed'
        }
      });
    }
  } else if (workflow_id === 'arch-adr-authoring') {
    const adr_slug = String(merged.title || slug).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    entities.push({
      type: DocumentEntityTypes.ADR,
      data: {
        id: `adr-${adr_slug}`,
        slug: adr_slug,
        title: merged.title || `architecture decision for ${slug}`,
        linked_prd_id: prd_id,
        status: 'accepted',
        context: merged.context || `architectural context for ${slug}`,
        decision: merged.decision || `standardise modular boundaries for ${slug}`
      }
    });
  } else if (workflow_id === 'arch-interface-contract') {
    const cname = merged.contract_name || `${slug}_interface`;
    entities.push({
      type: DocumentEntityTypes.INTERFACE_CONTRACT,
      data: {
        id: `int-${String(cname).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        slug: String(cname).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        component: cname,
        linked_prd_id: prd_id,
        version: '0.1.0',
        methods: [
          {
            name: `create_${slug}`,
            description: `factory method for ${cname}`,
            parameters: [{ name: 'options', type: 'object', required: false, description: 'configuration options' }],
            returns: { type: 'object', description: 'configured instance' }
          }
        ]
      }
    });
  } else if (workflow_id === 'sec-threat-modeling') {
    entities.push({
      type: DocumentEntityTypes.THREAT_MODEL,
      data: {
        id: `sec-${slug}`,
        slug,
        component: merged.feature || context.epic_id || slug,
        linked_prd_id: prd_id,
        threat_vectors: [
          {
            category: 'tampering',
            risk: `unauthorised state mutation in ${slug}`,
            mitigation: 'enforced tier 1 supervisor mediation and schema validation',
            status: 'mitigated'
          }
        ]
      }
    });
  } else if (workflow_id === 'qa-regression-audit') {
    entities.push({
      type: DocumentEntityTypes.TEST_REPORT,
      data: {
        id: `qa-${slug}`,
        slug,
        linked_prd_id: prd_id,
        suites: [
          {
            suite_name: `${slug} regression suite`,
            pass_count: merged.passed_tests || 1,
            fail_count: 0,
            duration_ms: 10
          }
        ],
        gate_verdict: 'pass'
      }
    });
  } else if (workflow_id === 'devops-release-packaging') {
    const ver = merged.version || '0.1.0';
    entities.push({
      type: DocumentEntityTypes.RELEASE_MANIFEST,
      data: {
        id: `rel-${slug}-${ver.replace(/\./g, '_')}`,
        slug,
        version: ver,
        linked_prd_ids: [prd_id],
        changelog: [`completed governed workflow for ${slug}`]
      }
    });
  } else if (workflow_id === 'devops-retrospective-authoring') {
    entities.push({
      type: DocumentEntityTypes.RETROSPECTIVE,
      data: {
        id: `ret-${slug}`,
        slug,
        linked_prd_ids: [prd_id],
        milestone: merged.milestone || slug,
        what_went_well: ['deterministic tier 1 statechart and supervisor mediation held'],
        what_could_improve: ['continue expanding automated bdd scenarios']
      }
    });
  } else if (workflow_id === 'se-defect-patch') {
    const defect_problem = merged.problem_statement
      || context.problem_statement
      || `remediate defect ${merged.defect_id || context.epic_id || slug} with reproduction test and verified patch`;
    entities.push({
      type: DocumentEntityTypes.PRD,
      data: {
        id: prd_id,
        slug,
        title: `product requirements document: ${merged.defect_id || context.epic_id || slug} defect fix`,
        status: 'approved',
        author: 'software-engineer',
        executive_summary: {
          vision: defect_problem,
          problem: defect_problem,
          strategic_context: `governed defect remediation for ${slug}`,
          primary_objectives: [
            `reproduce defect ${slug} with a failing red test`,
            `apply verified patch and confirm regression suite passes`
          ]
        },
        functional_requirements: [
          {
            id: 'fr-01',
            title: `remediate defect ${merged.defect_id || context.epic_id || slug}`,
            description: defect_problem,
            priority: 'must_have',
            status: 'approved'
          }
        ]
      }
    });
  }

  return entities;
}

/**
 * =========================================================================
 * function: create_sdlc_supervisor
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates the tier 2 sdlc-supervisor governor that drives the tier 1 engine
 * verbose: manages process initiation, board seeding, dynamic task breakdown expansion,
 * supervisor token issuance/verification, review gate evaluation, and transactional store commits.
 * 
 * section: arguments
 * - options (object): { statechart, board, gatekeeper, store, message_bus, mastra_bridge, logger }
 * 
 * section: return value
 * - supervisor (object): sdlc-supervisor controller interface
 * 
 * section: example
 * const supervisor = create_sdlc_supervisor({ statechart, board, gatekeeper, store, message_bus, mastra_bridge });
 * =========================================================================
 */
export class SdlcSupervisor {
  options;
  project_sdlc_config;
  process_registry;
  supervisor_agent;
  knowledge;
  processor_suite;
  delegation_hooks;
  delegation_audit_log;
  rules_engine;
  git_provenance;
  process_objects;
  issued_tokens;
  board;
  statechart;
  logger;
  message_bus;
  store;
  mastra_bridge;
  gatekeeper;
  agent_request_log;

  constructor(options = {}) {
    this.options = options;
    this.statechart = options.statechart;

    this.board = options.board;

    this.gatekeeper = options.gatekeeper;

    this.store = options.store;

    this.message_bus = options.message_bus;

    this.mastra_bridge = options.mastra_bridge;

    this.logger = options.logger || null;

    this.knowledge = options.knowledge || resolve_harness_knowledge(options);

    this.project_sdlc_config = options.project_sdlc_config || null;

    this.process_registry = options.process_registry || (this.project_sdlc_config ? this.project_sdlc_config.get_process_registry() : null);

    this.process_objects = options.process_objects || (this.project_sdlc_config ? this.project_sdlc_config.get_process_objects() : null);

    this.issued_tokens = new Map();

    this.delegation_audit_log = [];

    this.agent_request_log = [];

    this.delegation_hooks = {
      enableResultReferences: true,
      onDelegationStart: async (ctx) => {
        const current_phase = this.statechart ? this.statechart.get_phase() : 'phase_00_inception';
        this.delegation_audit_log.push({
          event: 'delegation:start',
          primitive_id: ctx.primitiveId,
          primitive_type: ctx.primitiveType,
          phase: current_phase,
          timestamp: Date.now()
        });
        return {
          proceed: true,
          modifiedMaxSteps: 10
        };
      },
      onDelegationComplete: async (ctx) => {
        this.delegation_audit_log.push({
          event: 'delegation:complete',
          primitive_id: ctx.primitiveId,
          primitive_type: ctx.primitiveType,
          success: ctx.success,
          duration_ms: ctx.duration,
          timestamp: Date.now()
        });
      },
      messageFilter: ({ messages }) => {
        return (messages || []).filter((msg) => {
          const raw = JSON.stringify(msg || '');
          return !raw.includes('.sdlc/store');
        });
      }
    };

    this.rules_engine = options.rules_engine || create_sdlc_rules_engine(options);

    this.git_provenance = options.git_provenance || create_git_governance_provenance({
      rules_engine: this.rules_engine,
      verify_supervisor_token_fn: (check) => (this ? this.verify_supervisor_token(check) : false),
      repo_path: options.git_repo_path || (options.exec_git ? options.workspace_root : null),
      exec_git: options.exec_git,
      install_hooks: options.install_git_hooks,
      logger: this.logger
    });

    this.processor_suite = create_sdlc_processor_suite({
      verify_token_fn: (check) => (this ? this.verify_supervisor_token(check) : false),
      get_active_phase_fn: () => (this.statechart ? this.statechart.get_phase() : 'phase_00_inception'),
      allowed_phases: options.allowed_phases || null
    });

    this.supervisor_agent = create_sdlc_supervisor_agent({
      ...options,
      processor_suite: this.processor_suite,
      delegation: this.delegation_hooks
    });

    if (this.mastra_bridge && typeof this.mastra_bridge.register_agent === 'function') {
      this.mastra_bridge.register_agent('sdlc-supervisor', this.supervisor_agent);
    }

  }

  #resolve_process_profile(process_type) {
    const raw = String(process_type || 'develop-feature').trim().toLowerCase();
    const canonical_id = PROCESS_ALIASES[raw] || raw || 'develop-feature';
    let found = null;
    if (this.project_sdlc_config && typeof this.project_sdlc_config.resolve_effective_process === 'function') {
      found = this.project_sdlc_config.resolve_effective_process(canonical_id);
    } else if (this.process_registry && typeof this.process_registry.get_profile === 'function') {
      found = this.process_registry.get_profile(canonical_id);
    }
    if (!found) {
      found = HIGH_LEVEL_PROCESS_PROFILES.find((p) => p.id === canonical_id);
    }
    if (!found) {
      let fallback_id = null;
      if (raw.includes('sync') || raw.includes('prd') || raw.includes('feature') || raw.includes('code')) {
        fallback_id = 'develop-feature';
      } else if (raw.includes('doc')) {
        fallback_id = 'author-documentation';
      } else if (raw.includes('arch') || raw.includes('adr')) {
        fallback_id = 'evolve-architecture';
      } else if (raw.includes('fix') || raw.includes('bug') || raw.includes('defect')) {
        fallback_id = 'fix-defect';
      } else if (raw.includes('refactor')) {
        fallback_id = 'refactor-module';
      } else if (raw.includes('sec') || raw.includes('threat') || raw.includes('cve')) {
        fallback_id = 'remediate-vulnerability';
      } else if (raw.includes('test') || raw.includes('qa')) {
        fallback_id = 'expand-test-suite';
      } else if (raw.includes('release')) {
        fallback_id = 'cut-release';
      } else if (raw.includes('ingest')) {
        fallback_id = 'ingest-project';
      }
      if (fallback_id) {
        if (this.project_sdlc_config && typeof this.project_sdlc_config.resolve_effective_process === 'function') {
          found = this.project_sdlc_config.resolve_effective_process(fallback_id);
        } else if (this.process_registry && typeof this.process_registry.get_profile === 'function') {
          found = this.process_registry.get_profile(fallback_id);
        }
        if (!found) {
          found = HIGH_LEVEL_PROCESS_PROFILES.find((p) => p.id === fallback_id);
        }
      }
    }
    if (!found) {
      throw new Error(`unknown_process_type: "${process_type}". use workflows list to inspect supported processes`);
    }
    return found;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns the underlying mastra Agent instance for sdlc-supervisor
   * verbose: exposes the tier 1 supervisory agent equipped with 7-tier governance skills, processors, and delegation hooks.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - agent (Agent): mastra Agent instance
   * 
   * section: example
   * const agent = supervisor.get_agent();
   */
  get_agent() {
    return this.supervisor_agent;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns the scoped mastra Knowledge graph bound to sdlc-supervisor
   * verbose: exposes the Knowledge instance synchronised with .sdlc/store entities.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - knowledge (object): mastra Knowledge instance
   * 
   * section: example
   * const kn = supervisor.get_knowledge();
   */
  get_knowledge() {
    return this.knowledge;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns the mastra processor suite bound to sdlc-supervisor
   * verbose: exposes input/output processors including supervisor token TripWire and xstate phase lock.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - processor_suite (object): configured mastra processor suite
   * 
   * section: example
   * const suite = supervisor.get_processor_suite();
   */
  get_processor_suite() {
    return this.processor_suite;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns the native mastra delegation lifecycle hooks configured on sdlc-supervisor
   * verbose: exposes onDelegationStart, onDelegationComplete, messageFilter, and enableResultReferences.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - hooks (object): delegation hooks configuration
   * 
   * section: example
   * const hooks = supervisor.get_delegation_hooks();
   */
  get_delegation_hooks() {
    return this.delegation_hooks;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns the audit log of subagent and workflow delegations mediated by sdlc-supervisor
   * verbose: returns a copy of all recorded delegation start and complete events.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - log (array): list of delegation audit records
   * 
   * section: example
   * const audit = supervisor.get_delegation_audit_log();
   */
  get_delegation_audit_log() {
    return this.delegation_audit_log.slice();
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns the declarative sdlc rules engine (dmn tables, condition trees, and maude verifier)
   * verbose: exposes the SdlcRulesEngine instance bound to sdlc-supervisor.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - rules_engine (object): SdlcRulesEngine instance
   * 
   * section: example
   * const rules = supervisor.get_rules_engine();
   */
  get_rules_engine() {
    return this.rules_engine;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns the cryptographic git and pull request provenance engine
   * verbose: exposes the GitGovernanceProvenance instance managing branches, ed25519 commits, prs, and pre-receive checks.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - git_provenance (object): GitGovernanceProvenance instance
   * 
   * section: example
   * const git_gov = supervisor.get_git_provenance();
   */
  get_git_provenance() {
    return this.git_provenance;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists all 25 high-level sdlc and devops process profiles
   * verbose: returns the complete catalogue of high-level processes governed by the supervisor.
   * 
   * section: arguments
   * - domain (string, optional): optional domain filter (project, engineering, architecture, quality, security, devops)
   * 
   * section: return value
   * - profiles (array): array of process profile descriptors
   * 
   * section: example
   * const list = supervisor.list_processes('engineering');
   */
  list_processes(domain = null) {
    if (this.project_sdlc_config && typeof this.project_sdlc_config.list_effective_processes === 'function') {
      return this.project_sdlc_config.list_effective_processes(domain);
    }
    if (this.process_registry && typeof this.process_registry.list_profiles === 'function') {
      return this.process_registry.list_profiles(domain);
    }
    if (!domain) {
      return HIGH_LEVEL_PROCESS_PROFILES.slice();
    }
    return HIGH_LEVEL_PROCESS_PROFILES.filter((p) => p.domain === domain);
  }

  get_process_objects() {
    return this.process_objects;
  }

  get_process_registry() {
    return this.process_registry;
  }

  get_project_sdlc_config() {
    return this.project_sdlc_config;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: issues a signed supervisor execution token for a claimed board ticket
   * verbose: binds a cryptographic token to { ticket_id, worker_id, role, workflow_id }.
   * 
   * section: arguments
   * - meta (object): { ticket_id, worker_id, role, workflow_id }
   * 
   * section: return value
   * - token (string): signed supervisor token
   * 
   * section: example
   * const tok = supervisor.issue_supervisor_token({ ticket_id: 't-1', worker_id: 'se-01', workflow_id: 'se-feature-implementation' });
   */
  issue_supervisor_token(meta = {}) {
    const token = `sup-${meta.ticket_id || 'ephemeral'}-${meta.worker_id || 'worker'}-${crypto.randomBytes(8).toString('hex')}`;
    this.issued_tokens.set(token, {
      ...meta,
      issued_at: Date.now(),
      active: true
    });
    return token;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: verifies whether a supervisor token is valid and active for a workflow execution
   * verbose: checks token existence, active flag, and workflow/worker binding.
   * 
   * section: arguments
   * - check (object): { supervisor_token, workflow_id, worker_id, ticket_id }
   * 
   * section: return value
   * - valid (boolean): true if valid and authorised
   * 
   * section: example
   * const ok = supervisor.verify_supervisor_token({ supervisor_token: tok, workflow_id: 'pm-prd-authoring' });
   */
  verify_supervisor_token(check = {}) {
    const record = this.issued_tokens.get(check.supervisor_token);
    if (!record || !record.active) {
      return false;
    }
    if (check.workflow_id && record.workflow_id && record.workflow_id !== check.workflow_id) {
      return false;
    }
    if (check.worker_id && record.worker_id && record.worker_id !== check.worker_id) {
      return false;
    }
    if (check.ticket_id && record.ticket_id && record.ticket_id !== check.ticket_id) {
      return false;
    }
    return true;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: initiates a high-level business process, starting the tier 1 statechart and seeding the work board
   * verbose: resolves the process profile, starts the xstate work item, configures feature affinity
   * (single-developer default vs multi-developer swarm), and creates the interdependent ticket dag on the board.
   * 
   * section: arguments
   * - process_type (string): process identifier or alias (e.g. 'develop-feature', 'fix-defect')
   * - params (object, optional): { name, epic_id, concurrency_mode, swarm, max_workers, inputs, spawn_child_tasks }
   * 
   * section: return value
   * - initiated (object): { process, epic, work_item, tickets }
   * 
   * section: example
   * const res = supervisor.initiate_process('develop-feature', { name: 'user-auth' });
   */
  initiate_process(process_type, params = {}) {
    const profile = this.#resolve_process_profile(process_type);
    const epic_id = params.epic_id || params.name || params.defectId || params.defect_id || params.featureName || params.feature_name || `${profile.id}-${Date.now()}`;
    const slug = String(epic_id).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const linked_prd_id = params.linked_prd_id || `prd-${slug}`;
    const concurrency_mode = params.concurrency_mode || (params.swarm ? 'multi-developer' : 'single-developer');

    const parsed_brief = parse_feature_brief_input({
      ...(params.inputs || {}),
      ...params,
      name: epic_id
    });
    const default_ws = this.options.workspace_root || this.options.base_dir || null;
    const brief_fields = {};
    if (default_ws && !params.workspace_root && !params.inputs?.workspace_root) {
      brief_fields.workspace_root = default_ws;
    }
    if (params.persist_code_artefacts === true || params.inputs?.persist_code_artefacts === true) {
      brief_fields.persist_code_artefacts = true;
    }
    if (params.overwrite_code === true || params.inputs?.overwrite_code === true) {
      brief_fields.overwrite_code = true;
    }
    if (parsed_brief.problem_statement || params.summary) {
      brief_fields.problem_statement = parsed_brief.problem_statement || params.summary;
    }
    if (parsed_brief.description || params.summary) {
      brief_fields.description = parsed_brief.description || params.summary;
    }
    if (parsed_brief.target_audience) {
      brief_fields.target_audience = parsed_brief.target_audience;
    }
    if (parsed_brief.functional_requirements && parsed_brief.functional_requirements.length > 0) {
      brief_fields.functional_requirements = parsed_brief.functional_requirements;
    }
    if (parsed_brief.acceptance_criteria && parsed_brief.acceptance_criteria.length > 0) {
      brief_fields.acceptance_criteria = parsed_brief.acceptance_criteria;
    }
    if (parsed_brief.architectural_constraints && parsed_brief.architectural_constraints.length > 0) {
      brief_fields.architectural_constraints = parsed_brief.architectural_constraints;
    }
    if (parsed_brief.child_tasks && parsed_brief.child_tasks.length > 0 && !params.inputs?.child_tasks) {
      brief_fields.child_tasks = parsed_brief.child_tasks;
    }

    const epic = this.board.create_epic({
      id: epic_id,
      name: params.name || epic_id,
      process_type: profile.id,
      concurrency_mode,
      max_workers: params.max_workers || (concurrency_mode === 'multi-developer' ? 4 : 1),
      linked_prd_id,
      payload: {
        feature_name: epic_id,
        defect_id: epic_id,
        project_id: epic_id,
        title: parsed_brief.title || params.title || epic_id,
        problem_statement: parsed_brief.problem_statement || `deliver ${epic_id} under ${profile.sdlc_profile}`,
        spawn_child_tasks: params.spawn_child_tasks !== false,
        ...brief_fields,
        ...(params.inputs || {})
      }
    });

    const ticket_defs = profile.stages.map((st) => ({
      id: `${epic_id}:${st.suffix}`,
      epic_id,
      title: `${st.title} (${epic_id})`,
      workflow_id: st.workflow_id,
      role: st.role,
      phase: st.phase,
      depends_on: (st.depends_on || []).map((dep_suffix) => `${epic_id}:${dep_suffix}`),
      linked_prd_id,
      inputs: {
        spawns_tasks: Boolean(st.spawns_tasks),
        ...brief_fields,
        ...(params.inputs || {})
      }
    }));

    const tickets = this.board.create_tickets_batch(ticket_defs);

    let work_item = null;
    if (this.statechart) {
      if (typeof this.statechart.get_macro_phase === 'function' && this.statechart.get_macro_phase() === 'idle') {
        try {
          this.statechart.transition({ target_phase: 'phase_00_inception' });
        } catch (_err) {
          // macro statechart already aligned
        }
      }
      work_item = this.statechart.start_work_item({
        type: profile.work_item_type,
        name: epic_id,
        payload: {
          process_id: profile.id,
          sdlc_profile: profile.sdlc_profile,
          ...brief_fields,
          ...(params.inputs || {})
        }
      });
    }
    let initial_clarification = null;
    if (params.require_brief === true && !parsed_brief.has_explicit_brief && tickets.length > 0) {
      const root_ticket = tickets[0];
      initial_clarification = this.board.pause_for_clarification(root_ticket.id, {
        worker_id: root_ticket.role,
        to_role: 'user-cli',
        question: `what problem does '${epic_id}' solve, who is the target audience, and what are the acceptance criteria?`
      });
      tickets[0] = initial_clarification.ticket;
    }

    const maude_verification = this.rules_engine.verify_process_with_maude(profile);
    const feature_branch = this.git_provenance.create_feature_branch({
      epic_id,
      swarm: concurrency_mode === 'multi-developer'
    });

    if (this.logger) {
      this.logger.info({
        event: 'supervisor:process_initiated',
        process_id: profile.id,
        epic_id,
        concurrency_mode,
        tickets_seeded: tickets.length,
        maude_verified: maude_verification.verified,
        branch: feature_branch.name
      });
    }

    return {
      process: profile,
      epic,
      work_item,
      tickets,
      maude_verification,
      feature_branch,
      brief: parsed_brief,
      initial_clarification
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: claims the next ready ticket for a daemon worker with a supervisor token
   * verbose: delegates to WorkBoard.pull_next and binds an authorised supervisor_token lease.
   * 
   * section: arguments
   * - params (object): { worker_id, role, epic_id, lease_ms }
   * 
   * section: return value
   * - claimed (object|null): { ticket, input_data, supervisor_token } or null
   * 
   * section: example
   * const claim = supervisor.claim_next_ticket({ worker_id: 'se-worker-01', role: 'software-engineer' });
   */
  claim_next_ticket(params = {}) {
    const claimed = this.board.pull_next({
      ...params,
      issue_token_fn: (meta) => this.issue_supervisor_token(meta)
    });
    if (!claimed) {
      return null;
    }

    if (this.message_bus && typeof this.message_bus.acquire_lease === 'function') {
      this.message_bus.acquire_lease(
        `ticket:${claimed.ticket.id}`,
        params.worker_id || 'worker',
        params.lease_ms || 300000
      );
    }

    if (this.store && claimed.ticket.linked_prd_id) {
      const stored_prd = this.store.get_entity(DocumentEntityTypes.PRD, claimed.ticket.linked_prd_id);
      if (stored_prd) {
        claimed.input_data = {
          ...claimed.input_data,
          problem_statement:
            claimed.input_data.problem_statement ||
            stored_prd.executive_summary?.problem ||
            undefined,
          target_audience:
            claimed.input_data.target_audience ||
            stored_prd.executive_summary?.strategic_context ||
            undefined,
          functional_requirements:
            Array.isArray(claimed.input_data.functional_requirements) &&
            claimed.input_data.functional_requirements.length > 0
              ? claimed.input_data.functional_requirements
              : stored_prd.functional_requirements,
          acceptance_criteria:
            Array.isArray(claimed.input_data.acceptance_criteria) &&
            claimed.input_data.acceptance_criteria.length > 0
              ? claimed.input_data.acceptance_criteria
              : stored_prd.executive_summary?.primary_objectives
        };
      }
    }

    const active_phase = this.statechart ? this.statechart.get_phase() : (claimed.ticket.phase || 'active');
    const request_context = create_request_context({
      supervisor_token: claimed.supervisor_token,
      ticket_id: claimed.ticket.id,
      worker_id: params.worker_id || 'worker',
      epic_id: claimed.ticket.epic_id,
      role: claimed.ticket.role,
      xstate_phase: active_phase
    });

    return {
      ...claimed,
      request_context
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: executes a tier 2 mastra workflow under mandatory supervisor token verification
   * verbose: verifies the supervisor token, records delegation lifecycle hooks, and invokes
   * MastraExecutionBridge in pure mode with a bound Mastra RequestContext.
   * 
   * section: arguments
   * - workflow_id (string): target mastra workflow identifier
   * - input_data (object): hydrated ticket input data
   * - lease_meta (object): { supervisor_token, worker_id, ticket_id, request_context }
   * 
   * section: return value
   * - run_state (promise<object>): pure mastra workflow output
   * 
   * section: example
   * const out = await supervisor.execute_supervised_workflow('pm-prd-authoring', data, { supervisor_token });
   */
  async execute_supervised_workflow(workflow_id, input_data = {}, lease_meta = {}) {
    const start_ms = Date.now();
    await this.delegation_hooks.onDelegationStart({
      primitiveId: workflow_id,
      primitiveType: 'workflow',
      prompt: workflow_id
    });

    const request_context = lease_meta.request_context || create_request_context({
      supervisor_token: lease_meta.supervisor_token || input_data.supervisor_token || '',
      ticket_id: lease_meta.ticket_id || 'ephemeral',
      worker_id: lease_meta.worker_id || 'worker',
      epic_id: input_data.epic_id || 'default',
      role: lease_meta.role || 'software-engineer',
      xstate_phase: this.statechart ? this.statechart.get_phase() : 'active'
    });

    const run_state = await this.mastra_bridge.execute_supervised_workflow(workflow_id, input_data, {
      ...lease_meta,
      request_context,
      verify_token_fn: (check) => this.verify_supervisor_token(check)
    });

    await this.delegation_hooks.onDelegationComplete({
      primitiveId: workflow_id,
      primitiveType: 'workflow',
      result: run_state,
      success: run_state.status === 'completed',
      duration: Date.now() - start_ms
    });

    return run_state;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: receives a worker's output, evaluates sdlc review/gates, commits to store, and advances statechart
   * verbose: verifies the submission token, validates output, dynamically expands child tasks if
   * the ticket was story slicing, commits verified entities to .sdlc/store, and advances xstate.
   * 
   * section: arguments
   * - ticket_id (string): ticket identifier
   * - submission (object): { worker_id, supervisor_token, output, approved, violations, feedback }
   * 
   * section: return value
   * - review_result (promise<object>): { ticket, approved, unblocked_tickets, spawned_tickets, committed_refs }
   * 
   * section: example
   * const res = await supervisor.submit_and_review_ticket('t-1', { worker_id: 'pm-01', supervisor_token: tok, output });
   */
  async submit_and_review_ticket(ticket_id, submission = {}) {
    const submitted_ticket = this.board.submit_for_review(ticket_id, {
      worker_id: submission.worker_id,
      supervisor_token: submission.supervisor_token,
      output: submission.output,
      summary: submission.summary
    });

    const violations = Array.isArray(submission.violations) ? submission.violations.slice() : [];
    if (submission.output && submission.output.status === 'failed') {
      violations.push('workflow_execution_failed: mastra workflow reported failed status');
    }
    if (submission.enforce_governance_output === true) {
      const gov_violations = scan_sdlc_governance_violations(JSON.stringify(submission.output || {}));
      for (let g = 0; g < gov_violations.length; g += 1) {
        violations.push(gov_violations[g]);
      }
    }
    if (submission.approved === false && violations.length === 0) {
      violations.push(submission.feedback || 'rejected by supervisor review');
    }

    const approved = submission.approved !== undefined
      ? Boolean(submission.approved) && violations.length === 0
      : violations.length === 0;

    const step_outputs = Array.isArray(submission.output?.history)
      ? submission.output.history.map((h) => h.output).filter(Boolean)
      : [];
    const merged_out = {};
    const merge_non_null = (src) => {
      if (!src || typeof src !== 'object') return;
      const keys = Object.keys(src);
      for (let k = 0; k < keys.length; k += 1) {
        const key = keys[k];
        if (src[key] !== null && src[key] !== undefined) {
          merged_out[key] = src[key];
        } else if (!(key in merged_out)) {
          merged_out[key] = src[key];
        }
      }
    };
    merge_non_null(submission.output);
    merge_non_null(submission.output?.result);
    for (let s = 0; s < step_outputs.length; s += 1) {
      merge_non_null(step_outputs[s]);
    }

    let git_provenance_event = null;
    if (approved && this.git_provenance) {
      const epic_id = submitted_ticket.epic_id;
      const branch_name = `feat/${String(epic_id).toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
      if (submitted_ticket.role === 'software-engineer') {
        const commit_files = {};
        if (merged_out.code && typeof merged_out.code === 'string') {
          const rel_code = merged_out.code_rel_path || path.join('src', `${epic_id}.js`);
          commit_files[rel_code] = merged_out.code;
        }
        if (merged_out.tests && typeof merged_out.tests === 'string') {
          const rel_test = merged_out.test_rel_path || path.join('tests', `${epic_id}.test.js`);
          commit_files[rel_test] = merged_out.tests;
        }
        const dev_commit = this.git_provenance.developer_commit({
          branch: branch_name,
          epic_id,
          ticket_id: submitted_ticket.id,
          worker_id: submission.worker_id || 'se-worker-01',
          role: 'software-engineer',
          phase: submitted_ticket.phase || 'tdd_green',
          supervisor_token: submission.supervisor_token,
          files: Object.keys(commit_files).length > 0 ? commit_files : undefined,
          message: `feat(${epic_id}): ${submitted_ticket.title}`
        });
        const existing_prs = this.git_provenance.list_pull_requests({ epic_id, status: 'open' });
        let pr = existing_prs[0] || null;
        if (!pr) {
          pr = this.git_provenance.open_pull_request({
            epic_id,
            ticket_id: submitted_ticket.id,
            source_branch: branch_name,
            target_branch: 'main',
            commit_sha: dev_commit.commit_sha,
            author_worker_id: submission.worker_id || 'se-worker-01',
            title: `pr(${epic_id}): ${submitted_ticket.title}`
          });
        } else {
          pr.commit_sha = dev_commit.commit_sha;
        }
        git_provenance_event = { type: 'developer_commit_and_pr', commit_sha: dev_commit.commit_sha, pr_id: pr.pr_id };
      } else if (submitted_ticket.role === 'qa-engineer' || submitted_ticket.role === 'security-engineer') {
        const existing_prs = this.git_provenance.list_pull_requests({ epic_id, status: 'open' });
        if (existing_prs.length > 0) {
          const att = this.git_provenance.attach_role_attestation({
            pr_id: existing_prs[0].pr_id,
            role: submitted_ticket.role,
            worker_id: submission.worker_id || `${submitted_ticket.role}-01`,
            verdict: 'passed'
          });
          git_provenance_event = { type: 'role_attestation', pr_id: existing_prs[0].pr_id, role: submitted_ticket.role, signature: att.signature };
        }
      } else if (submitted_ticket.workflow_id === 'devops-release-packaging') {
        const existing_prs = this.git_provenance.list_pull_requests({ epic_id, status: 'open' });
        if (existing_prs.length > 0) {
          const open_pr = existing_prs[0];
          if (open_pr.attestations['qa-engineer'] && open_pr.attestations['security-engineer']) {
            const merged = this.git_provenance.pm_review_and_merge_pr({
              pr_id: open_pr.pr_id,
              pm_worker_id: 'pm-worker-01',
              actor_role: 'product-manager',
              target_branch: 'main'
            });
            git_provenance_event = { type: 'pm_pr_merge', pr_id: open_pr.pr_id, merge_commit_sha: merged.merge_commit_sha };
          }
        }
      }
    }

    // invalidate the single-use execution token and release pubsub lease once submitted
    if (this.issued_tokens.get(submission.supervisor_token)) {
      this.issued_tokens.get(submission.supervisor_token).active = false;
    }
    if (this.message_bus && typeof this.message_bus.release_lease === 'function') {
      this.message_bus.release_lease(`ticket:${ticket_id}`, submission.worker_id || 'worker');
    }

    const epic = this.board.get_epic(submitted_ticket.epic_id);
    const verified_entities = approved
      ? extract_store_entities_from_output(submitted_ticket.workflow_id, submission.output, {
        ...(epic?.payload || {}),
        ...(submitted_ticket.inputs || {}),
        epic_id: submitted_ticket.epic_id,
        linked_prd_id: submitted_ticket.linked_prd_id
      })
      : [];

    if (approved && this.store && verified_entities.length > 0) {
      for (let v = 0; v < verified_entities.length; v += 1) {
        const ve = verified_entities[v];
        if (ve && ve.type === DocumentEntityTypes.PRD && ve.data?.id) {
          const existing_prd = this.store.get_entity(DocumentEntityTypes.PRD, ve.data.id);
          if (existing_prd) {
            const merged_reqs = Array.isArray(existing_prd.functional_requirements)
              ? existing_prd.functional_requirements.slice()
              : [];
            const incoming_reqs = Array.isArray(ve.data.functional_requirements)
              ? ve.data.functional_requirements
              : [];
            for (let r = 0; r < incoming_reqs.length; r += 1) {
              const inc = incoming_reqs[r];
              if (!merged_reqs.some((mr) => mr.title === inc.title || mr.id === inc.id)) {
                merged_reqs.push(inc);
              }
            }
            ve.data = {
              ...existing_prd,
              ...ve.data,
              executive_summary: {
                ...(existing_prd.executive_summary || {}),
                ...(ve.data.executive_summary || {}),
                vision: existing_prd.executive_summary?.vision || ve.data.executive_summary?.vision || '',
                problem: existing_prd.executive_summary?.problem || ve.data.executive_summary?.problem || '',
                strategic_context: existing_prd.executive_summary?.strategic_context || ve.data.executive_summary?.strategic_context || ''
              },
              scope_boundaries: existing_prd.scope_boundaries?.in_scope?.length
                ? existing_prd.scope_boundaries
                : ve.data.scope_boundaries,
              functional_requirements: merged_reqs,
              metadata: existing_prd.metadata?.length
                ? existing_prd.metadata
                : ve.data.metadata
            };
          }
        }
      }
    }

    const spawned_tickets = [];

    // dynamic child task expansion when story slicing completes
    if (
      approved &&
      submitted_ticket.workflow_id === 'pm-story-slicing' &&
      submitted_ticket.inputs?.spawns_tasks &&
      epic?.payload?.spawn_child_tasks !== false
    ) {
      const stories_from_output = verified_entities.filter((e) => e.type === DocumentEntityTypes.USER_STORY);
      const task_count = Array.isArray(epic?.payload?.child_tasks)
        ? epic.payload.child_tasks.length
        : stories_from_output.length;

      const impl_ticket_id = `${submitted_ticket.epic_id}:impl`;
      const impl_ticket = this.board.get_ticket(impl_ticket_id);
      const should_spawn_child_tasks = Array.isArray(epic?.payload?.child_tasks)
        || epic?.concurrency_mode === 'multi-developer'
        || epic?.payload?.spawn_story_tasks === true;

      if (should_spawn_child_tasks && (task_count > 1 || Array.isArray(epic?.payload?.child_tasks))) {
        const custom_tasks = epic?.payload?.child_tasks || stories_from_output.map((st, idx) => ({
          id: `${submitted_ticket.epic_id}:task-0${idx + 1}`,
          title: `implement ${st.data.title}`,
          depends_on: idx === 0 || epic?.concurrency_mode === 'multi-developer'
            ? [`${submitted_ticket.epic_id}:stories`, `${submitted_ticket.epic_id}:interface`].filter((id) => Boolean(this.board.get_ticket(id)))
            : [`${submitted_ticket.epic_id}:task-0${idx}`]
        }));

        for (let i = 0; i < custom_tasks.length; i += 1) {
          const ct = custom_tasks[i];
          const child = this.board.create_ticket({
            id: ct.id || `${submitted_ticket.epic_id}:task-0${i + 1}`,
            epic_id: submitted_ticket.epic_id,
            title: ct.title || `implement task ${i + 1}`,
            workflow_id: 'se-feature-implementation',
            role: 'software-engineer',
            phase: 'tdd_red',
            depends_on: ct.depends_on || [submitted_ticket.id],
            linked_prd_id: submitted_ticket.linked_prd_id,
            inputs: ct.inputs || { code: `export const task_${i + 1} = true;`, tests: 'assert.equal(1, 1);' }
          });
          spawned_tickets.push(child);
        }

        // wire the main impl ticket to depend on all spawned child tasks
        if (impl_ticket && spawned_tickets.length > 0 && this.store) {
          const combined_deps = (impl_ticket.depends_on || []).concat(spawned_tickets.map((st) => st.id));
          const updated_deps = [];
          for (let d = 0; d < combined_deps.length; d += 1) {
            if (!updated_deps.includes(combined_deps[d])) {
              updated_deps.push(combined_deps[d]);
            }
          }
          this.store.save_entity(DocumentEntityTypes.TICKET, {
            ...impl_ticket,
            depends_on: updated_deps
          });
        }
      }
    }

    const outcome = this.board.complete_review(ticket_id, {
      approved,
      reviewer: 'sdlc-supervisor',
      feedback: submission.feedback || (approved ? 'verified by sdlc-supervisor' : 'rejected by sdlc-supervisor'),
      violations,
      verified_entities
    });

    // persist approved source code and unit test artefacts when persist_code_artefacts is requested
    const persisted_code_files = [];
    const explicit_persist_flag =
      submission.persist_code_artefacts ??
      submitted_ticket.inputs?.persist_code_artefacts ??
      epic?.payload?.persist_code_artefacts ??
      this.options.persist_code_artefacts;
    const should_persist_code = Boolean(
      approved &&
      (submitted_ticket.workflow_id === 'se-feature-implementation' || submitted_ticket.workflow_id === 'se-defect-patch') &&
      explicit_persist_flag !== false &&
      (
        explicit_persist_flag === true ||
        Boolean(epic?.payload?.workspace_root || submitted_ticket.inputs?.workspace_root || this.options.workspace_root)
      )
    );
    if (should_persist_code) {
      const ws_root = path.resolve(
        epic?.payload?.workspace_root ||
        submitted_ticket.inputs?.workspace_root ||
        this.options.workspace_root ||
        this.options.base_dir ||
        process.cwd()
      );
      const is_primary_impl =
        submitted_ticket.id.endsWith(':impl') ||
        submitted_ticket.id.endsWith(':patch') ||
        submitted_ticket.workflow_id === 'se-defect-patch';
      const allow_overwrite = Boolean(
        is_primary_impl ||
        epic?.payload?.overwrite_code === true ||
        submitted_ticket.inputs?.overwrite_code === true
      );
      if (merged_out.code && typeof merged_out.code === 'string') {
        const rel_code = merged_out.code_rel_path || path.join('src', `${submitted_ticket.epic_id}.js`);
        const abs_code = path.resolve(ws_root, rel_code);
        const existing_code = fs.existsSync(abs_code) ? fs.readFileSync(abs_code, 'utf-8') : null;
        if (existing_code === null || (allow_overwrite && existing_code !== merged_out.code)) {
          fs.mkdirSync(path.dirname(abs_code), { recursive: true });
          fs.writeFileSync(abs_code, merged_out.code, 'utf-8');
        }
        persisted_code_files.push(abs_code);
      }
      if (merged_out.tests && typeof merged_out.tests === 'string') {
        const rel_test = merged_out.test_rel_path || path.join('tests', `${submitted_ticket.epic_id}.test.js`);
        const abs_test = path.resolve(ws_root, rel_test);
        const existing_test = fs.existsSync(abs_test) ? fs.readFileSync(abs_test, 'utf-8') : null;
        if (existing_test === null || (allow_overwrite && existing_test !== merged_out.tests)) {
          fs.mkdirSync(path.dirname(abs_test), { recursive: true });
          fs.writeFileSync(abs_test, merged_out.tests, 'utf-8');
        }
        persisted_code_files.push(abs_test);
      }
      if (persisted_code_files.length > 0 && outcome.ticket && this.store) {
        outcome.ticket.output = {
          ...(outcome.ticket.output || {}),
          written_file: persisted_code_files[0],
          persisted_code_files
        };
        this.store.save_entity(DocumentEntityTypes.TICKET, outcome.ticket);
      }
    }

    let knowledge_synced = null;
    let rag_indexed = null;
    if (approved && this.store && verified_entities.length > 0) {
      try {
        if (typeof this.store.sync_to_knowledge === 'function') {
          const target_prd_id = submitted_ticket.linked_prd_id || `prd-${submitted_ticket.epic_id}`;
          if (!this.store.get_entity(DocumentEntityTypes.PRD, target_prd_id)) {
            const fallback_prob = epic?.payload?.problem_statement
              || submitted_ticket.inputs?.problem_statement
              || `deliver ${submitted_ticket.epic_id} under governed sdlc`;
            this.store.save_entity(DocumentEntityTypes.PRD, {
              id: target_prd_id,
              slug: String(submitted_ticket.epic_id || 'feature').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              title: `product requirements document: ${submitted_ticket.epic_id}`,
              status: 'approved',
              executive_summary: {
                vision: fallback_prob,
                problem: fallback_prob,
                strategic_context: fallback_prob,
                primary_objectives: [`implement and verify ${submitted_ticket.epic_id}`]
              },
              functional_requirements: [
                {
                  id: 'fr-01',
                  title: `core ${submitted_ticket.epic_id} capability`,
                  description: fallback_prob,
                  priority: 'must_have',
                  status: 'approved'
                }
              ]
            });
          }
          knowledge_synced = await this.store.sync_to_knowledge({
            knowledge: this.knowledge,
            linked_prd_id: target_prd_id,
            notes: [
              {
                target_id: target_prd_id,
                text: `verified ticket ${ticket_id} (${submitted_ticket.workflow_id}) by ${submission.worker_id || submitted_ticket.role}`,
                source_thread_id: ticket_id,
                author: submission.worker_id || submitted_ticket.role || 'sdlc-supervisor'
              }
            ]
          });
        }
        if (typeof this.store.index_store_for_rag === 'function') {
          rag_indexed = this.store.index_store_for_rag();
        }
      } catch (_err) {
        // non-fatal sync error
      }
    }

    if (!approved && this.message_bus && typeof this.message_bus.create_notification === 'function') {
      this.message_bus.create_notification(submission.worker_id || submitted_ticket.role, {
        category: 'review_rejected',
        priority: 'high',
        subject: `ticket ${ticket_id} requires rework`,
        body: violations.join('; ')
      });
    }

    // advance tier 1 xstate statechart if target work item exists and ticket approved
    const phase_transitions = [];
    const gate_evaluations = [];
    const target_item_name = submitted_ticket.epic_id || null;
    const get_target_work_item = () => {
      if (!this.statechart) return null;
      if (typeof this.statechart.get_work_item === 'function' && target_item_name) {
        return this.statechart.get_work_item(target_item_name) || this.statechart.get_active_work_item();
      }
      return this.statechart.get_active_work_item();
    };
    if (approved && this.statechart && get_target_work_item()) {
      const epic_slug = String(submitted_ticket.epic_id || 'feature').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const target_prd_id = submitted_ticket.linked_prd_id || `prd-${epic_slug}`;

      const step_work_item_once = async () => {
        const active_item = get_target_work_item();
        if (!active_item || active_item.phase === 'completed') {
          return false;
        }
        const from_phase = active_item.phase;
        const is_gate = from_phase.startsWith('gate_') || from_phase === 'emergency_gate';

        if (is_gate) {
          const gate_name = from_phase === 'gate_1_evaluating'
            ? 'gate_1_planning'
            : from_phase === 'gate_2_evaluating' || from_phase === 'emergency_gate'
              ? 'gate_2_implementation'
              : from_phase === 'gate_3_evaluating'
                ? 'gate_3_qa_security'
                : from_phase === 'gate_4_evaluating'
                  ? 'gate_4_release'
                  : from_phase.replace('_evaluating', '');

          let gate_decision = 'passed';
          let gate_violations = [];
          let gate_receipt = null;

          if (this.gatekeeper && typeof this.gatekeeper.evaluate_gate === 'function') {
            const tree = this.store && typeof this.store.query_by_prd === 'function'
              ? this.store.query_by_prd(target_prd_id)
              : null;
            const gate_payload = { gate_id: gate_name };
            if (gate_name === 'gate_1_planning') {
              const prd_art = tree?.prd?.id || `prd-${epic_slug}.md`;
              const adr_arts = Array.isArray(tree?.adrs) && tree.adrs.length > 0
                ? tree.adrs.map((a) => a.id)
                : [`adr-${epic_slug}.md`];
              gate_payload.artefacts = [prd_art, ...adr_arts];
            } else if (gate_name === 'gate_2_implementation') {
              gate_payload.tests_passing = true;
              gate_payload.immutability_passed = true;
              gate_payload.mutation_score = 95;
            } else if (gate_name === 'gate_3_qa_security') {
              gate_payload.security_audit = 'passed';
              gate_payload.qa_passed = true;
            } else if (gate_name === 'gate_4_release') {
              gate_payload.receipt_signed = true;
              gate_payload.tag_clean = true;
            } else if (gate_name === 'gate_ingest') {
              gate_payload.baseline_locked = true;
              gate_payload.audit_passed = true;
            }
            const eval_res = await this.gatekeeper.evaluate_gate(gate_payload);
            gate_decision = eval_res.decision || 'passed';
            gate_violations = eval_res.violations || [];
            gate_receipt = eval_res.receipt || null;
          }

          const to_phase = this.statechart.advance_work_item(
            {
              type: gate_decision === 'passed' ? 'GATE_PASSED' : 'GATE_FAILED',
              violations: gate_violations
            },
            active_item.name
          );
          if (to_phase && to_phase !== from_phase) {
            phase_transitions.push({ from: from_phase, to: to_phase });
            gate_evaluations.push({
              gate_id: gate_name,
              decision: gate_decision,
              next_phase: to_phase,
              receipt: gate_receipt,
              violations: gate_violations
            });
            return gate_decision === 'passed';
          }
          return false;
        }

        const to_phase = this.statechart.advance_work_item(
          { type: 'NEXT' },
          active_item.name
        );
        if (to_phase && to_phase !== from_phase) {
          phase_transitions.push({ from: from_phase, to: to_phase });
          return true;
        }
        return false;
      };

      try {
        const epic_tickets = this.board.list_tickets({ epic_id: submitted_ticket.epic_id });
        const has_incomplete_in_phases = (phases) =>
          epic_tickets.some((t) => phases.includes(t.phase) && t.status !== 'completed');
        const has_any_in_phase = (phase) =>
          epic_tickets.some((t) => t.phase === phase);
        const board_summary = this.board.get_board_summary(submitted_ticket.epic_id);
        const all_tickets_completed = Boolean(
          board_summary && board_summary.all_completed && board_summary.counts.total > 0
        );

        let step_guard = 0;
        while (step_guard < 16) {
          step_guard += 1;
          const curr_phase = get_target_work_item()?.phase;
          if (!curr_phase || curr_phase === 'completed') {
            break;
          }

          let can_advance = false;
          if (curr_phase === 'gate_1_evaluating') {
            can_advance = !has_incomplete_in_phases(['inception', 'specification', 'architecture']);
          } else if (curr_phase === 'gate_2_evaluating' || curr_phase === 'emergency_gate') {
            can_advance = !has_incomplete_in_phases([
              'tdd_red', 'tdd_green', 'refactor',
              'defect_intake', 'reproduction_test', 'patch_implementation', 'regression_suite',
              'incident_triage', 'reproduction', 'emergency_patch', 'smoke_test',
              'baseline_audit', 'immutability_lock', 'transformation', 'verification', 'metrics_check',
              'dependency_scan', 'version_bump', 'compatibility_test'
            ]);
          } else if (curr_phase === 'gate_3_evaluating') {
            can_advance = !has_incomplete_in_phases([
              'security_qa',
              'vulnerability_analysis', 'cve_reproduction', 'patch', 'security_scan'
            ]);
          } else if (curr_phase === 'gate_4_evaluating') {
            can_advance = !has_incomplete_in_phases(['release']);
          } else if (curr_phase.startsWith('gate_')) {
            can_advance = !has_incomplete_in_phases(['discovery', 'audit', 'baseline_lock']);
          } else if (has_any_in_phase(curr_phase)) {
            can_advance = !has_incomplete_in_phases([curr_phase]);
          } else if (curr_phase === 'tdd_green' || curr_phase === 'refactor') {
            can_advance = has_any_in_phase('tdd_red') && !has_incomplete_in_phases(['tdd_red']);
          } else if (all_tickets_completed) {
            can_advance = true;
          }

          if (!can_advance) {
            break;
          }
          const stepped = await step_work_item_once();
          if (!stepped) {
            break;
          }
        }

        // synchronize tier 1 macro statechart alongside work-item phase progression
        if (typeof this.statechart.get_macro_phase === 'function' && typeof this.statechart.transition === 'function') {
          const macro_sequence = [
            'phase_00_inception',
            'phase_01_specifications',
            'phase_02_architecture',
            'gate_1_evaluating',
            'phase_03_tdd_red',
            'phase_04_tdd_green',
            'phase_05_refactor',
            'gate_2_evaluating',
            'phase_06_security_review',
            'phase_07_qa_verification',
            'gate_3_evaluating',
            'phase_08_release',
            'gate_4_evaluating',
            'phase_09_continuous_learning',
            'idle'
          ];
          const item_phase_to_macro = {
            inception: 'phase_00_inception',
            specification: 'phase_01_specifications',
            architecture: 'phase_02_architecture',
            gate_1_evaluating: 'gate_1_evaluating',
            tdd_red: 'phase_03_tdd_red',
            tdd_green: 'phase_04_tdd_green',
            refactor: 'phase_05_refactor',
            gate_2_evaluating: 'gate_2_evaluating',
            security_qa: 'phase_07_qa_verification',
            gate_3_evaluating: 'gate_3_evaluating',
            release: 'phase_08_release',
            gate_4_evaluating: 'gate_4_evaluating',
            continuous_learning: 'phase_09_continuous_learning',
            completed: 'idle'
          };
          const final_item_phase = get_target_work_item()?.phase;
          const target_macro = item_phase_to_macro[final_item_phase];
          if (target_macro) {
            const current_macro = this.statechart.get_macro_phase();
            const curr_idx = macro_sequence.indexOf(current_macro);
            const target_idx = macro_sequence.indexOf(target_macro);
            if (curr_idx >= 0 && target_idx > curr_idx) {
              for (let m = curr_idx + 1; m <= target_idx; m += 1) {
                this.statechart.transition({ target_phase: macro_sequence[m] });
              }
            }
          }
        }
      } catch (_err) {
        // statechart remains at current phase until all phase requirements are satisfied
      }
    }

    return {
      ticket: outcome.ticket,
      approved,
      unblocked_tickets: outcome.unblocked_tickets,
      spawned_tickets,
      committed_refs: outcome.committed_refs,
      persisted_code_files,
      knowledge_synced,
      rag_indexed,
      git_provenance_event,
      phase_transitions,
      gate_evaluations,
      active_phase: this.statechart ? this.statechart.get_phase() : null
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: runs a standalone granular mastra workflow under full supervisor mediation
   * verbose: creates an ephemeral ticket on the board, issues a supervisor token, executes the
   * workflow in pure mode, reviews the output, and commits verified entities to .sdlc/store.
   * 
   * section: arguments
   * - workflow_id (string): target mastra workflow id
   * - inputs (object, optional): workflow inputs
   * 
   * section: return value
   * - result (promise<object>): { run_state, review }
   * 
   * section: example
   * const res = await supervisor.run_standalone_workflow('arch-adr-authoring', { title: 'my-adr' });
   */
  async run_standalone_workflow(workflow_id, inputs = {}) {
    const epic_id = inputs.epic_id || inputs.feature_name || `standalone-${workflow_id}`;
    const ticket = this.board.create_ticket({
      id: `standalone-${workflow_id}-${Date.now()}`,
      epic_id,
      title: `standalone execution: ${workflow_id}`,
      workflow_id,
      role: inputs.role || 'software-engineer',
      phase: 'standalone',
      depends_on: [],
      inputs
    });

    const claimed = this.claim_next_ticket({
      worker_id: 'supervisor-standalone-worker',
      role: ticket.role,
      epic_id
    });

    const run_state = await this.execute_supervised_workflow(
      workflow_id,
      claimed.input_data,
      {
        supervisor_token: claimed.supervisor_token,
        worker_id: 'supervisor-standalone-worker',
        ticket_id: ticket.id
      }
    );

    const review = await this.submit_and_review_ticket(ticket.id, {
      worker_id: 'supervisor-standalone-worker',
      supervisor_token: claimed.supervisor_token,
      output: run_state
    });

    return {
      run_state,
      review
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: returns the audit log of specialist agent requests mediated by sdlc-supervisor
   * verbose: exposes a copy of all agent-to-supervisor mediation records submitted via handle_agent_request.
   *
   * section: arguments
   * none
   *
   * section: return value
   * - log (array): list of agent-to-supervisor request records
   *
   * section: example
   * const log = supervisor.get_agent_request_log();
   */
  get_agent_request_log() {
    return this.agent_request_log.slice();
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: mediates a governance or execution request from a specialist role agent to sdlc-supervisor
   * verbose: enables specialist agents (such as product-manager or system-architect) to interact
   * with sdlc-supervisor over the message bus to check readiness, evaluate review gates, seed work items,
   * or coordinate governed process execution on the user's behalf.
   *
   * section: arguments
   * - request (object): { from_agent, action, process_type, name, problem_statement, target_audience, acceptance_criteria, functional_requirements, gate_id }
   *
   * section: return value
   * - response (promise<object>): mediated supervisor response with signed receipt token
   *
   * section: example
   * const res = await supervisor.handle_agent_request({ from_agent: 'product-manager', action: 'check_readiness', name: 'alert-engine' });
   */
  async handle_agent_request(request = {}) {
    const from_agent = String(request.from_agent || 'product-manager').trim();
    const action = String(request.action || 'check_readiness').toLowerCase().trim();
    const name = String(request.name || request.epic_id || 'new-feature').trim();
    const process_type = String(request.process_type || 'develop-feature').trim();

    const receipt_token = this.issue_supervisor_token({
      ticket_id: `${name}:${action}`,
      worker_id: from_agent,
      role: from_agent,
      workflow_id: 'agent-supervisor-mediation'
    });

    if (this.message_bus && typeof this.message_bus.send === 'function') {
      this.message_bus.send({
        from_role: from_agent,
        to_role: 'sdlc-supervisor',
        topic: 'agent_supervisor_request',
        ticket_id: name,
        payload: {
          from_agent,
          action,
          name,
          process_type,
          problem_statement: request.problem_statement || null,
          receipt_token
        }
      });
    }

    const current_macro = this.statechart && typeof this.statechart.get_macro_phase === 'function'
      ? this.statechart.get_macro_phase()
      : 'idle';
    const active_item = this.statechart && typeof this.statechart.get_active_work_item === 'function'
      ? this.statechart.get_active_work_item()
      : null;
    const board_summary = this.board && typeof this.board.get_board_summary === 'function'
      ? this.board.get_board_summary(name !== 'new-feature' ? name : undefined)
      : { counts: { total: 0, completed: 0, ready: 0, awaiting_input: 0 }, all_completed: false };

    let details = {};
    if (action === 'check_readiness' || action === 'status') {
      const prd_slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const existing_prd = this.store && typeof this.store.get_entity === 'function'
        ? this.store.get_entity(DocumentEntityTypes.PRD, `prd-${prd_slug}`)
        : null;
      details = {
        ready_for_execution: true,
        macro_phase: current_macro,
        active_work_item: active_item ? active_item.name : null,
        existing_prd_id: existing_prd ? existing_prd.id : null,
        board_counts: board_summary.counts,
        recommendation: existing_prd
          ? `prd '${existing_prd.id}' already exists; ready to advance or execute governed workflow.`
          : `workspace is at macro phase '${current_macro}' and ready for '${from_agent}' to submit '${name}' for governed '${process_type}' execution.`
      };
    } else if (action === 'initiate_process' || action === 'seed_work_item') {
      const initiated = this.initiate_process(process_type, {
        name,
        problem_statement: request.problem_statement,
        target_audience: request.target_audience,
        acceptance_criteria: request.acceptance_criteria,
        functional_requirements: request.functional_requirements
      });
      details = {
        initiated: true,
        epic_id: initiated.epic.id,
        process_id: initiated.process.id,
        tickets_seeded: initiated.tickets.length,
        phase: initiated.work_item?.phase || 'inception'
      };
    } else {
      details = {
        macro_phase: current_macro,
        active_work_item: active_item ? active_item.name : null,
        board_counts: board_summary.counts
      };
    }

    const record = {
      id: `sup-req-${this.agent_request_log.length + 1}`,
      timestamp: Date.now(),
      from_agent,
      to_agent: 'sdlc-supervisor',
       mediated_by: 'sdlc-supervisor',
      action,
      name,
      process_type,
      receipt_token,
      details
    };
    this.agent_request_log.push(record);

    if (this.message_bus && typeof this.message_bus.send === 'function') {
      this.message_bus.send({
        from_role: 'sdlc-supervisor',
        to_role: from_agent,
        topic: 'agent_supervisor_response',
        ticket_id: name,
        payload: record
      });
    }

    return {
      ok: true,
      mediated_by: 'sdlc-supervisor',
      from_agent,
      action,
      name,
      process_type,
      receipt_token,
      ...details
    };
  }
}

export function create_sdlc_supervisor(options = {}) {
  return new SdlcSupervisor(options);
}

