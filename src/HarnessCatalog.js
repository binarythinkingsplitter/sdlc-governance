/**
 * =========================================================================
 * module: harness catalog
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: central catalogue of all sdlc types, phases, gates, work-items, and dags
 * verbose: exposes structured metadata and enumeration helpers for sdlc macro phases,
 * review gates, tactical work-item pathways, multi-agent dags, templates, and entity types.
 * provides unified discovery for cli command introspection and auto-completion.
 * 
 * section: export catalog
 * - list_sdlc_phases: returns all 10 sdlc macro phases with descriptions and review gates
 * - list_review_gates: returns all 5 formal review gates with validation criteria
 * - list_work_item_types: returns all 7 tactical work-item types with state paths
 * - list_dag_pipelines: returns registered dag pipeline recipes
 * - list_templates_catalog: returns available document and code snippet templates
 * - list_all_types: returns catalogue of all entity and command types with supported verbs
 * =========================================================================
 */

import { HIGH_LEVEL_PROCESS_PROFILES } from './SdlcSupervisor.js';

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: lists all 25 high-level sdlc and devops processes governed by sdlc-supervisor
 * verbose: returns the complete catalogue of high-level processes across project, engineering,
 * architecture, quality, security, and devops domains.
 * 
 * section: arguments
 * - domain (string, optional): optional domain filter
 * 
 * section: return value
 * - processes (array): array of high-level process profile objects
 * 
 * section: example
 * const processes = list_high_level_processes();
 */
export function list_high_level_processes(domain = null) {
  if (!domain) {
    return HIGH_LEVEL_PROCESS_PROFILES.slice();
  }
  return HIGH_LEVEL_PROCESS_PROFILES.filter((p) => p.domain === domain);
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: lists all 10 sequential sdlc macro phases
 * verbose: returns structured list of the 10 macro lifecycle phases with descriptions
 * and their associated review gates.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - phases (array): list of phase descriptor objects
 * 
 * section: example
 * const phases = list_sdlc_phases();
 */
export function list_sdlc_phases() {
  return [
    {
      id: 'phase_00_inception',
      name: 'inception',
      description: 'initial project discovery, charter definition, and problem framing',
      order: 0,
      gate: null
    },
    {
      id: 'phase_01_specifications',
      name: 'specifications',
      description: 'user stories, prds, and functional requirements definition',
      order: 1,
      gate: null
    },
    {
      id: 'phase_02_architecture',
      name: 'architecture',
      description: 'architectural decision records (adrs), c4 models, and interface schemas',
      order: 2,
      gate: 'gate_1_planning'
    },
    {
      id: 'phase_03_tdd_red',
      name: 'tdd red',
      description: 'authoring failing test suites specifying desired behaviours',
      order: 3,
      gate: null
    },
    {
      id: 'phase_04_tdd_green',
      name: 'tdd green',
      description: 'minimal implementation code to satisfy failing tests',
      order: 4,
      gate: null
    },
    {
      id: 'phase_05_refactor',
      name: 'refactor',
      description: 'clean-room refactoring, object calisthenics, and architectural compliance',
      order: 5,
      gate: 'gate_2_implementation'
    },
    {
      id: 'phase_06_security_review',
      name: 'security review',
      description: 'stride threat modelling, vulnerability assessment, and secret audits',
      order: 6,
      gate: null
    },
    {
      id: 'phase_07_qa_verification',
      name: 'qa verification',
      description: 'quality assurance, end-to-end integration, and mutation testing',
      order: 7,
      gate: 'gate_3_qa_security'
    },
    {
      id: 'phase_08_release',
      name: 'release',
      description: 'semantic version tagging, changelog compilation, and artifact sealing',
      order: 8,
      gate: 'gate_4_release'
    },
    {
      id: 'phase_09_continuous_learning',
      name: 'continuous learning',
      description: 'retrospectives, architectural metrics, and continuous improvements',
      order: 9,
      gate: null
    }
  ];
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: lists all 5 formal sdlc review gates
 * verbose: returns structured list of review gates with evaluated phases and invariants.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - gates (array): list of gate descriptor objects
 * 
 * section: example
 * const gates = list_review_gates();
 */
export function list_review_gates() {
  return [
    {
      id: 'gate_1_planning',
      name: 'planning gate',
      evaluates: ['phase_00_inception', 'phase_01_specifications', 'phase_02_architecture'],
      description: 'validates specifications and architecture before code implementation commences',
      invariants: [
        'prd present and valid',
        'user stories defined in 05-work-breakdown',
        'adr recorded in 02-architecture/adr',
        'interface schemas valid in 04-interfaces'
      ]
    },
    {
      id: 'gate_2_implementation',
      name: 'implementation gate',
      evaluates: ['phase_03_tdd_red', 'phase_04_tdd_green', 'phase_05_refactor'],
      description: 'validates tdd cycle completion, test suite health, and mutation score',
      invariants: [
        'all tests passing (100% green)',
        'test immutability preserved (zero dropped assertions)',
        'mutation score >= 80%'
      ]
    },
    {
      id: 'gate_3_qa_security',
      name: 'qa & security gate',
      evaluates: ['phase_06_security_review', 'phase_07_qa_verification'],
      description: 'validates security threat analysis and comprehensive qa verification',
      invariants: [
        'stride threat model complete in 07-security',
        'zero unresolved high/critical vulnerabilities',
        'qa verification and integration tests passing'
      ]
    },
    {
      id: 'gate_4_release',
      name: 'release gate',
      evaluates: ['phase_08_release'],
      description: 'validates production release readiness, changelog, and clean working tree',
      invariants: [
        'clean git working tree',
        'sealed cryptographic gate receipts',
        'semantic version bump recorded'
      ]
    },
    {
      id: 'gate_ingest',
      name: 'ingestion gate',
      evaluates: ['all_phases'],
      description: 'validates whole-project compliance across all sdlc phases during onboarding',
      invariants: [
        'all prerequisite phase documentation discovered',
        'test suites passing',
        'governance rules satisfied'
      ]
    }
  ];
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: lists all 7 supported tactical work-item pathways
 * verbose: returns structured list of work-item types with description and transition paths.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - types (array): list of work-item type objects
 * 
 * section: example
 * const types = list_work_item_types();
 */
export function list_work_item_types() {
  return [
    {
      id: 'feature',
      name: 'feature',
      description: 'full 10-phase agile lifecycle from inception to continuous learning',
      stages: [
        'inception',
        'specification',
        'architecture',
        'gate_1_evaluating',
        'tdd_red',
        'tdd_green',
        'refactor',
        'gate_2_evaluating',
        'security_qa',
        'gate_3_evaluating',
        'release',
        'gate_4_evaluating',
        'continuous_learning',
        'completed'
      ]
    },
    {
      id: 'fix',
      name: 'defect fix',
      description: 'tactical defect resolution pathway with reproduction tests and regression gates',
      stages: [
        'defect_intake',
        'reproduction_test',
        'patch_implementation',
        'regression_suite',
        'gate_2_evaluating',
        'release',
        'completed'
      ]
    },
    {
      id: 'hotfix',
      name: 'emergency hotfix',
      description: 'emergency production triage pathway with smoke verification and mandatory post-mortem',
      stages: [
        'incident_triage',
        'reproduction',
        'emergency_patch',
        'smoke_test',
        'emergency_gate',
        'release',
        'mandatory_post_mortem',
        'completed'
      ]
    },
    {
      id: 'refactor',
      name: 'code refactoring',
      description: 'structural clean-up pathway with immutability locks and metrics verification',
      stages: [
        'baseline_audit',
        'immutability_lock',
        'transformation',
        'verification',
        'metrics_check',
        'gate_2_evaluating',
        'completed'
      ]
    },
    {
      id: 'security_patch',
      name: 'security patch',
      description: 'targeted cve remediation pathway with reproduction and security scans',
      stages: [
        'vulnerability_analysis',
        'cve_reproduction',
        'patch',
        'security_scan',
        'gate_3_evaluating',
        'release',
        'completed'
      ]
    },
    {
      id: 'dependency_upgrade',
      name: 'dependency upgrade',
      description: 'dependency version bump pathway with automated compatibility verification',
      stages: [
        'dependency_scan',
        'version_bump',
        'compatibility_test',
        'gate_2_evaluating',
        'release',
        'completed'
      ]
    },
    {
      id: 'ingest',
      name: 'project ingestion',
      description: 'repository ingestion pathway discovering artefacts and sealing whole-project receipts',
      stages: [
        'discovery',
        'audit',
        'baseline_lock',
        'gate_ingest_evaluating',
        'completed'
      ]
    }
  ];
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: lists registered dag pipeline recipes and execution modes
 * verbose: returns structured list of multi-agent dag topologies and execution options.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - dags (array): list of dag pipeline recipes
 * 
 * section: example
 * const dags = list_dag_pipelines();
 */
export function list_dag_pipelines() {
  return [
    {
      id: 'linear-trio',
      name: '3-stage linear role pipeline',
      description: 'sequential pipeline coordinating architect, software engineer, and security engineer',
      nodes: ['system-architect', 'software-engineer', 'security-engineer'],
      topological: true
    },
    {
      id: 'sdlc-feature-dag',
      name: 'full sdlc feature dag',
      description: 'multi-agent collaborative graph mapping all 6 roles to discrete feature milestones',
      nodes: [
        'product-manager',
        'system-architect',
        'software-engineer',
        'security-engineer',
        'qa-engineer',
        'devops-engineer'
      ],
      topological: true
    }
  ];
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: lists available document and code generation templates
 * verbose: returns catalogue of canonical document templates and code generation templates.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - templates (object): dictionary of document and code snippet templates
 * 
 * section: example
 * const catalogue = list_templates_catalog();
 */
export function list_templates_catalog() {
  return {
    documents: [
      { id: 'prd', name: 'product requirements document', description: 'problem definition, personas, user journeys, and acceptance criteria' },
      { id: 'adr', name: 'architectural decision record', description: 'context, architectural decision, consequences, and compliance notes' },
      { id: 'interface', name: 'interface specification', description: 'openapi contracts, internal interfaces, and payload schemas' },
      { id: 'threat_model', name: 'stride threat model', description: 'stride threat vector matrix, mitigation strategies, and risk scores' },
      { id: 'test_report', name: 'qa test verification report', description: 'automated test suite metrics, assertion counts, and coverage' },
      { id: 'retrospective', name: 'sprint retrospective', description: 'continuous learning, lessons learned, and systemic improvements' },
      { id: 'task', name: 'child task specification', description: 'numbered work-breakdown child task with verification criteria' }
    ],
    code: [
      { id: 'test_suite', name: 'test suite generator', description: 'automated test suite boilerplate for node:test and vitest' },
      { id: 'factory_function', name: 'factory function generator', description: 'clean-room factory function returning an es6 class instance, with banner jsdoc' },
      { id: 'migration_script', name: 'migration script generator', description: 'document entity migration script generator' }
    ]
  };
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: lists all entity, domain, and command types supported by the harness
 * verbose: returns structured catalogue of all harness types with singular and plural
 * identifiers, descriptions, and their standardized supported verbs.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - types (array): list of supported type descriptor objects
 * 
 * section: example
 * const types = list_all_types();
 */
export function list_all_types() {
  return [
    {
      id: 'phases',
      singular: 'phase',
      plural: 'phases',
      description: '10-phase sdlc macro statechart governing project progression',
      verbs: ['list', 'status', 'transition']
    },
    {
      id: 'gates',
      singular: 'gate',
      plural: 'gates',
      description: 'formal review gates evaluating quality and security invariants',
      verbs: ['list', 'status', 'check']
    },
    {
      id: 'work-items',
      singular: 'work-item',
      plural: 'work-items',
      aliases: ['items', 'item'],
      description: 'tactical work-item execution pathways (tier 1 read-only inspection; executed via domain nouns)',
      verbs: ['list', 'status']
    },
    {
      id: 'dag',
      singular: 'dag',
      plural: 'dags',
      description: 'directed acyclic graph for multi-agent deterministic execution',
      verbs: ['list', 'run', 'export']
    },
    {
      id: 'workflows',
      singular: 'workflow',
      plural: 'workflows',
      aliases: ['role-workflow', 'role-workflows'],
      description: 'mastra autonomous role workflows (tier 2 read-only inspection; executed only via tier 1 supervisor)',
      verbs: ['list', 'info']
    },
    {
      id: 'skills',
      singular: 'skill',
      plural: 'skills',
      description: 'compiled mastra skills equipping role agents',
      verbs: ['list', 'info']
    },
    {
      id: 'agents',
      singular: 'agent',
      plural: 'agents',
      description: 'autonomous role agents executing specialised tasks (tier 2 read-only inspection; executed only via tier 1 supervisor)',
      verbs: ['list', 'info']
    },
    {
      id: 'packages',
      singular: 'package',
      plural: 'packages',
      description: 'modular business domain packages mounted into the harness',
      verbs: ['list', 'info']
    },
    {
      id: 'rules',
      singular: 'rule',
      plural: 'rules',
      aliases: ['governance'],
      description: '7-tier agile sdlc governance framework and compliance rules',
      verbs: ['list', 'check']
    },
    {
      id: 'store',
      singular: 'store',
      plural: 'store',
      aliases: ['entities', 'entity'],
      description: 'data-based document entity store with filestore adapter',
      verbs: ['list', 'migrate', 'show', 'prd', 'render', 'export']
    },
    {
      id: 'templates',
      singular: 'template',
      plural: 'templates',
      description: 'canonical document templates and code snippet templates',
      verbs: ['list', 'render']
    },
    {
      id: 'code',
      singular: 'code',
      plural: 'code',
      description: 'code generation from templates and document entities',
      verbs: ['list', 'generate']
    },
    {
      id: 'project',
      singular: 'project',
      plural: 'project',
      description: 'sovereign project lifecycle governance states',
      verbs: ['status', 'start', 'approve', 'maintenance', 'reactivate', 'deprecate', 'retire', 'decommission', 'ingest']
    },
    {
      id: 'tests',
      singular: 'test',
      plural: 'tests',
      description: 'vitest test execution with interactive web ui, terminal reporting, and immutability audits',
      verbs: ['run', 'verify']
    }
  ];
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: lists all domain nouns and verbs that expose tier 1 sdlc capabilities on the cli
 * verbose: maps user-facing engineering domain nouns (feature, defect, hotfix, refactor, spike,
 * architecture, quality, security, release, dependencies, ci, docs, style, pr, board, project)
 * to their supported verbs and underlying tier 1 processes.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - nouns (array): list of domain noun descriptors
 * 
 * section: example
 * const nouns = list_domain_nouns();
 */
export function list_domain_nouns() {
  return [
    {
      id: 'work',
      aliases: ['works', 'work-item', 'work-items'],
      verbs: ['list', 'create', 'status', 'show', 'switch', 'focus', 'advance', 'run', 'clarify'],
      processes: [
        'develop-feature',
        'develop-epic-swarm',
        'fix-defect',
        'emergency-hotfix',
        'refactor-module',
        'security-patch',
        'upgrade-dependencies',
        'ingest-legacy-codebase'
      ],
      description: 'unified concurrent work-item management across all 7 sdlc pathways (feature, fix, hotfix, refactor, security_patch, dependency_upgrade, ingest)'
    },
    {
      id: 'feature',
      aliases: ['features'],
      verbs: ['list', 'create', 'clarify', 'show', 'status'],
      processes: ['develop-feature', 'develop-epic-swarm'],
      description: 'manage product features end-to-end (prd, stories, adr, tdd, qa/security, pr merge)'
    },
    {
      id: 'defect',
      aliases: ['defects', 'bug', 'bugs', 'fix', 'fixes'],
      verbs: ['list', 'create', 'clarify', 'show', 'status'],
      processes: ['fix-defect'],
      description: 'manage defect reproduction, root-cause patching, and regression verification'
    },
    {
      id: 'hotfix',
      aliases: ['hotfixes'],
      verbs: ['list', 'create', 'clarify', 'show', 'status'],
      processes: ['emergency-hotfix'],
      description: 'execute emergency production hotfixes with mandatory post-mortem'
    },
    {
      id: 'refactor',
      aliases: ['refactors', 'refactoring'],
      verbs: ['list', 'create', 'clarify', 'show', 'status'],
      processes: ['refactor-module'],
      description: 'execute behaviour-preserving structural refactoring under immutability lock'
    },
    {
      id: 'spike',
      aliases: ['spikes', 'prototype'],
      verbs: ['list', 'create', 'clarify', 'show', 'status'],
      processes: ['spike-prototype'],
      description: 'run time-boxed technical feasibility spikes and architectural prototypes'
    },
    {
      id: 'architecture',
      aliases: ['adr', 'adrs', 'contract', 'contracts'],
      verbs: ['list', 'create', 'clarify', 'review', 'contract', 'migration', 'show'],
      processes: ['design-architecture', 'architecture-review', 'api-contract-evolution', 'data-migration-design'],
      description: 'author and review architectural decision records, api contracts, and data migrations'
    },
    {
      id: 'quality',
      aliases: ['qa'],
      verbs: ['list', 'audit', 'coverage', 'quarantine', 'optimise', 'show'],
      processes: ['regression-audit', 'coverage-hardening', 'flaky-test-quarantine', 'performance-optimisation'],
      description: 'execute regression audits, coverage hardening, flaky test quarantine, and performance tuning'
    },
    {
      id: 'security',
      aliases: ['sec'],
      verbs: ['list', 'patch', 'audit', 'scan', 'incident', 'show'],
      processes: ['security-patch', 'stride-threat-audit', 'secret-supply-chain-scan', 'security-incident-response'],
      description: 'execute cve patches, stride threat audits, supply-chain scans, and incident response'
    },
    {
      id: 'release',
      aliases: ['releases'],
      verbs: ['list', 'create', 'rollback', 'show'],
      processes: ['release-version', 'rollback-release'],
      description: 'package semantic version releases, verify gate receipts, or rollback releases'
    },
    {
      id: 'dependencies',
      aliases: ['deps', 'dependency'],
      verbs: ['list', 'upgrade'],
      processes: ['upgrade-dependencies'],
      description: 'audit and upgrade project dependencies with compatibility verification'
    },
    {
      id: 'ci',
      aliases: ['pipeline', 'build'],
      verbs: ['list', 'harden', 'tune'],
      processes: ['ci-pipeline-hardening', 'build-system-tuning'],
      description: 'harden ci/cd pipelines and tune build/bundler configurations'
    },
    {
      id: 'docs',
      aliases: ['documentation'],
      verbs: ['list', 'refresh', 'render', 'export', 'migrate'],
      processes: ['documentation-refresh'],
      description: 'refresh, render, export, and migrate numbered clean-room documentation'
    },
    {
      id: 'style',
      aliases: ['format'],
      verbs: ['check', 'fix'],
      processes: ['code-formatting-hygiene'],
      description: 'enforce banner jsdoc, lowercase british english, and formatting hygiene'
    },
    {
      id: 'pr',
      aliases: ['prs', 'pull-request', 'pull-requests'],
      verbs: ['list', 'show', 'status'],
      processes: [],
      description: 'inspect governed pull requests, ed25519 role attestations, and pm merge receipts'
    },
    {
      id: 'board',
      aliases: ['tickets'],
      verbs: ['list', 'status', 'show', 'export'],
      processes: [],
      description: 'inspect work board epics, topological ticket dags, and kanban markdown'
    },
    {
      id: 'project',
      aliases: [],
      verbs: ['status', 'start', 'approve', 'maintenance', 'reactivate', 'deprecate', 'retire', 'decommission', 'ingest', 'retrospective'],
      processes: ['project-inception', 'ingest-legacy-codebase', 'enter-maintenance', 'decommission-project', 'sprint-retrospective'],
      description: 'manage the sovereign project lifecycle and sprint retrospectives'
    },
    {
      id: 'statecharts',
      aliases: ['statechart', 'machines', 'state-machines'],
      verbs: ['list', 'status', 'show'],
      processes: [],
      description: 'inspect the 9 canonical xstate v5 statecharts governing project, macro lifecycle, and work-item pathways'
    }
  ];
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: returns the standardised tier 1 and tier 2 architecture, entities, and verbs matrix
 * verbose: enumerates the coupled dual-engine tiers, the domain entities managed at each tier,
 * their supported cli verbs, and the corresponding deterministic mastra agent tools.
 * 
 * section: arguments
 * - tier_filter (string|number, optional): filter by 'tier_1', 'tier_2', 1, or 2
 * 
 * section: return value
 * - tiers (array): list of tier descriptors with entities, verbs, and tools
 * 
 * section: example
 * const tiers = list_tier_architecture();
 */
export function list_tier_architecture(tier_filter = null) {
  const tiers = [
    {
      id: 'tier_1',
      number: 1,
      name: 'tier 1: deterministic governance & state engine',
      engine: 'xstate v5 statecharts + maude 3 formal verification + dmn rules + filestore + git ed25519 provenance',
      description: 'sovereign lifecycle governance, 10-phase macro statechart, 5 review gates, concurrent work-item actors, work board, and schema-validated entity store',
      entities: [
        {
          id: 'project',
          singular: 'project',
          plural: 'projects',
          states: ['uninitialised', 'project_inception', 'active_development', 'maintenance_mode', 'deprecation', 'project_retirement', 'archived'],
          verbs: ['status', 'start', 'approve', 'maintenance', 'reactivate', 'deprecate', 'retire', 'decommission', 'ingest', 'retrospective'],
          tools: ['inspect_workspace_status', 'execute_sdlc_process'],
          description: 'sovereign project lifecycle statechart governing workspace operating mode'
        },
        {
          id: 'work',
          singular: 'work',
          plural: 'work',
          aliases: ['feature', 'fix', 'defect', 'hotfix', 'refactor', 'security_patch', 'dependency_upgrade', 'ingest'],
          pathways: ['feature', 'fix', 'hotfix', 'refactor', 'security_patch', 'dependency_upgrade', 'ingest'],
          verbs: ['list', 'create', 'status', 'show', 'switch', 'focus', 'advance', 'run', 'clarify'],
          tools: ['manage_work_items', 'execute_sdlc_process', 'resolve_board_clarification'],
          description: 'concurrent tactical work items across all 7 sdlc pathways, each backed by an independent xstate actor and board epic'
        },
        {
          id: 'phases',
          singular: 'phase',
          plural: 'phases',
          count: 10,
          verbs: ['list', 'status', 'transition'],
          tools: ['inspect_sdlc_catalog', 'inspect_workspace_status'],
          description: '10 sequential macro sdlc phases (phase_00_inception through phase_09_continuous_learning)'
        },
        {
          id: 'gates',
          singular: 'gate',
          plural: 'gates',
          count: 5,
          verbs: ['list', 'status', 'check'],
          tools: ['inspect_sdlc_catalog', 'evaluate_review_gate'],
          description: '5 formal review gates (gate_1_planning, gate_2_implementation, gate_3_qa_security, gate_4_release, gate_ingest)'
        },
        {
          id: 'processes',
          singular: 'process',
          plural: 'processes',
          count: 25,
          verbs: ['list', 'show'],
          tools: ['inspect_sdlc_catalog', 'execute_sdlc_process'],
          description: '25 governed high-level sdlc and devops process profiles across 6 engineering domains'
        },
        {
          id: 'board',
          singular: 'ticket',
          plural: 'tickets',
          aliases: ['board', 'epic', 'epics'],
          verbs: ['list', 'status', 'show', 'export'],
          tools: ['inspect_workspace_status', 'manage_work_items', 'resolve_board_clarification'],
          description: 'jira-style topological ticket dag, single-use supervisor token leases, and clarification pauses'
        },
        {
          id: 'store',
          singular: 'entity',
          plural: 'entities',
          entity_types: ['prd', 'user_story', 'task', 'adr', 'interface_contract', 'threat_model', 'test_report', 'release_manifest', 'retrospective', 'ticket', 'agent_message'],
          verbs: ['list', 'show', 'prd', 'render', 'export', 'migrate'],
          tools: ['list_entities', 'show_entity', 'update_specification_draft'],
          description: 'zod schema-validated document entity store'
        },
        {
          id: 'statecharts',
          singular: 'statechart',
          plural: 'statecharts',
          count: 9,
          verbs: ['list', 'status', 'show'],
          tools: ['inspect_sdlc_catalog', 'inspect_workspace_status'],
          description: '9 xstate v5 statecharts (1 sovereign project machine, 1 10-phase macro lifecycle machine, and 7 tactical work-item pathway machines)'
        },
        {
          id: 'rules',
          singular: 'rule',
          plural: 'rules',
          verbs: ['list', 'check'],
          tools: ['inspect_sdlc_catalog', 'evaluate_review_gate'],
          description: '7-tier governance rules, dmn decision tables, condition trees, and maude 3 reachability specifications'
        },
        {
          id: 'pr',
          singular: 'pr',
          plural: 'prs',
          verbs: ['list', 'show', 'status'],
          tools: ['inspect_workspace_status', 'manage_work_items'],
          description: 'cryptographic git branches, ed25519 role attestations, and product-manager merge receipts'
        }
      ]
    },
    {
      id: 'tier_2',
      number: 2,
      name: 'tier 2: mastra agentic & workflow execution engine',
      engine: 'mastra v1 agents + model router + role workflows + daemon worker pool + deterministic tools',
      description: 'autonomous role agents, 16 role workflows, 7-tier compiled governance skills, daemon worker pool, and shared deterministic tools',
      entities: [
        {
          id: 'agents',
          singular: 'agent',
          plural: 'agents',
          count: 7,
          roles: ['sdlc-supervisor', 'product-manager', 'system-architect', 'software-engineer', 'security-engineer', 'qa-engineer', 'devops-engineer'],
          verbs: ['list', 'info', 'show', 'chat', 'consult', 'switch'],
          tools: ['inspect_sdlc_catalog', 'consult_specialist_agent', 'switch_active_agent'],
          description: '7 mastra role agents wired to the mastra model router and equipped with deterministic sdlc tools'
        },
        {
          id: 'workflows',
          singular: 'workflow',
          plural: 'workflows',
          count: 16,
          verbs: ['list', 'info', 'show'],
          tools: ['inspect_sdlc_catalog', 'execute_sdlc_process'],
          description: '16 role-specific mastra workflows executed in pure mode under tier 1 supervisor token verification'
        },
        {
          id: 'skills',
          singular: 'skill',
          plural: 'skills',
          count: 13,
          verbs: ['list', 'info'],
          tools: ['inspect_sdlc_catalog'],
          description: '7-tier compiled governance skills and 6 specialist role skill definitions'
        },
        {
          id: 'pool',
          singular: 'worker',
          plural: 'workers',
          aliases: ['pool'],
          verbs: ['list', 'status', 'start', 'stop', 'scale'],
          tools: ['manage_worker_pool', 'inspect_workspace_status'],
          description: 'autonomous daemon worker pool claiming ready tickets and executing mastra role workflows'
        },
        {
          id: 'dag',
          singular: 'dag',
          plural: 'dags',
          verbs: ['list', 'run', 'export'],
          tools: ['inspect_sdlc_catalog'],
          description: 'multi-agent topological task execution graph and mermaid diagram exporter'
        },
        {
          id: 'tools',
          singular: 'tool',
          plural: 'tools',
          verbs: ['list', 'info'],
          tools: ['inspect_sdlc_catalog'],
          description: 'shared deterministic cli and mastra tools ensuring 1:1 capability parity'
        },
        {
          id: 'packages',
          singular: 'package',
          plural: 'packages',
          verbs: ['list', 'info'],
          tools: ['inspect_sdlc_catalog'],
          description: 'modular business domain packages mounted into the dual-engine harness'
        }
      ]
    }
  ];

  if (tier_filter !== null && tier_filter !== undefined && tier_filter !== '') {
    const norm = String(tier_filter).toLowerCase().trim();
    return tiers.filter((t) =>
      t.id === norm ||
      String(t.number) === norm ||
      `tier-${t.number}` === norm ||
      `tier ${t.number}` === norm
    );
  }

  return tiers;
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formats the 10 sdlc macro phases into a canonical deterministic text block
 * verbose: produces identical human-readable output for both the cli and mastra agent tools.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - formatted (string): canonical phases listing
 * 
 * section: example
 * const text = format_sdlc_phases_catalog();
 */
export function format_sdlc_phases_catalog() {
  const phases = list_sdlc_phases();
  const lines = [`sdlc macro phases (${phases.length}):`];
  for (let i = 0; i < phases.length; i += 1) {
    const p = phases[i];
    const gate_str = p.gate ? ` [gate: ${p.gate}]` : '';
    lines.push(`  ${p.order}. ${p.id} (${p.name}): ${p.description}${gate_str}`);
  }
  return lines.join('\n');
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formats the 5 formal review gates into a canonical deterministic text block
 * verbose: produces identical human-readable output for both the cli and mastra agent tools.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - formatted (string): canonical gates listing
 * 
 * section: example
 * const text = format_review_gates_catalog();
 */
export function format_review_gates_catalog() {
  const gates = list_review_gates();
  const lines = [`formal review gates (${gates.length}):`];
  for (let i = 0; i < gates.length; i += 1) {
    const g = gates[i];
    lines.push(
      `  - ${g.id} (${g.name}): ${g.description} [evaluates: ${g.evaluates.join(', ')}] [invariants: ${g.invariants.join('; ')}]`
    );
  }
  return lines.join('\n');
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formats the 7 tactical work-item pathways into a canonical deterministic text block
 * verbose: produces identical human-readable output for both the cli and mastra agent tools.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - formatted (string): canonical work-item types listing
 * 
 * section: example
 * const text = format_work_item_types_catalog();
 */
export function format_work_item_types_catalog() {
  const items = list_work_item_types();
  const lines = [`supported work-item pathways (${items.length}):`];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    lines.push(`  - ${item.id} (${item.name}): ${item.description} [stages: ${item.stages.join(' -> ')}]`);
  }
  return lines.join('\n');
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formats the tier 1 and tier 2 entity and verb architecture into a canonical text block
 * verbose: produces identical human-readable output for both the cli and mastra agent tools.
 * 
 * section: arguments
 * - tier_filter (string|number, optional): optional tier filter
 * 
 * section: return value
 * - formatted (string): canonical tier architecture listing
 * 
 * section: example
 * const text = format_tier_architecture_catalog();
 */
export function format_tier_architecture_catalog(tier_filter = null) {
  const tiers = list_tier_architecture(tier_filter);
  const lines = [`coupled dual-engine sdlc tier architecture (${tiers.length} tiers):`];
  for (let i = 0; i < tiers.length; i += 1) {
    const t = tiers[i];
    lines.push(`\n${t.name} [${t.id}]:`);
    lines.push(`  engine: ${t.engine}`);
    lines.push(`  summary: ${t.description}`);
    lines.push(`  entities (${t.entities.length}):`);
    for (let j = 0; j < t.entities.length; j += 1) {
      const e = t.entities[j];
      lines.push(
        `    - ${e.id} [verbs: ${e.verbs.join(', ')}] [tools: ${e.tools.join(', ')}]: ${e.description}`
      );
    }
  }
  return lines.join('\n');
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formats the 25 governed high-level sdlc processes into a canonical text block
 * verbose: produces identical human-readable output for both the cli and mastra agent tools.
 * 
 * section: arguments
 * - domain_filter (string, optional): optional domain filter
 * 
 * section: return value
 * - formatted (string): canonical high-level processes listing
 * 
 * section: example
 * const text = format_high_level_processes_catalog();
 */
export function format_high_level_processes_catalog(domain_filter = null) {
  const procs = list_high_level_processes(domain_filter);
  const lines = [`governed high-level processes (${procs.length}):`];
  for (let i = 0; i < procs.length; i += 1) {
    const p = procs[i];
    lines.push(`  - ${p.id} [${p.commit_type}] (${p.domain} -> ${p.work_item_type}): ${p.description}`);
  }
  return lines.join('\n');
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: returns the 9 canonical xstate v5 statechart machines in the dual-engine harness
 * verbose: enumerates the sovereign project lifecycle machine, the 10-phase macro lifecycle
 * statechart, and the 7 tactical work-item pathway statecharts defined in MacroStatechartEngine.js.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - statecharts (array): list of statechart descriptor objects
 * 
 * section: example
 * const statecharts = list_sdlc_statecharts();
 */
export function list_sdlc_statecharts() {
  return [
    {
      id: 'project-sovereign-lifecycle',
      name: 'sovereign project lifecycle statechart',
      scope: 'sovereign_project',
      tier: 'tier_1',
      initial: 'active_development',
      states: [
        'uninitialised',
        'project_inception',
        'active_development',
        'maintenance_mode',
        'deprecation',
        'project_retirement',
        'archived'
      ],
      gates: ['gate_0_inception', 'gate_retirement'],
      description: 'governs the top-level sovereign operating mode of the workspace from inception through retirement'
    },
    {
      id: 'sdlc-macro-lifecycle',
      name: '10-phase sdlc macro lifecycle statechart',
      scope: 'macro_lifecycle',
      tier: 'tier_1',
      initial: 'phase_00_inception',
      states: [
        'idle',
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
        'gate_blocked'
      ],
      gates: ['gate_1_planning', 'gate_2_implementation', 'gate_3_qa_security', 'gate_4_release'],
      description: 'enforces the 10 sequential agile macro phases and 4 formal review gate evaluation states'
    },
    {
      id: 'feature-lifecycle',
      name: 'feature work-item statechart',
      scope: 'work_item',
      work_item_type: 'feature',
      tier: 'tier_1',
      initial: 'inception',
      states: [
        'inception',
        'specification',
        'architecture',
        'gate_1_evaluating',
        'tdd_red',
        'tdd_green',
        'refactor',
        'gate_2_evaluating',
        'security_qa',
        'gate_3_evaluating',
        'release',
        'gate_4_evaluating',
        'continuous_learning',
        'completed'
      ],
      gates: ['gate_1_planning', 'gate_2_implementation', 'gate_3_qa_security', 'gate_4_release'],
      description: 'full 10-phase tactical work-item statechart for new feature delivery'
    },
    {
      id: 'fix-lifecycle',
      name: 'defect fix work-item statechart',
      scope: 'work_item',
      work_item_type: 'fix',
      tier: 'tier_1',
      initial: 'defect_intake',
      states: [
        'defect_intake',
        'reproduction_test',
        'patch_implementation',
        'regression_suite',
        'gate_2_evaluating',
        'release',
        'completed'
      ],
      gates: ['gate_2_implementation'],
      description: 'tactical defect remediation statechart enforcing failing reproduction test before patch implementation'
    },
    {
      id: 'hotfix-lifecycle',
      name: 'emergency hotfix work-item statechart',
      scope: 'work_item',
      work_item_type: 'hotfix',
      tier: 'tier_1',
      initial: 'incident_triage',
      states: [
        'incident_triage',
        'reproduction',
        'emergency_patch',
        'smoke_test',
        'emergency_gate',
        'release',
        'mandatory_post_mortem',
        'completed'
      ],
      gates: ['emergency_gate'],
      description: 'expedited production hotfix statechart with mandatory post-mortem phase'
    },
    {
      id: 'refactor-lifecycle',
      name: 'structural refactor work-item statechart',
      scope: 'work_item',
      work_item_type: 'refactor',
      tier: 'tier_1',
      initial: 'baseline_audit',
      states: [
        'baseline_audit',
        'immutability_lock',
        'transformation',
        'verification',
        'metrics_check',
        'gate_2_evaluating',
        'completed'
      ],
      gates: ['gate_2_implementation'],
      description: 'behaviour-preserving refactoring statechart enforcing strict test immutability lock'
    },
    {
      id: 'security-patch-lifecycle',
      name: 'security patch work-item statechart',
      scope: 'work_item',
      work_item_type: 'security_patch',
      tier: 'tier_1',
      initial: 'vulnerability_analysis',
      states: [
        'vulnerability_analysis',
        'cve_reproduction',
        'patch',
        'security_scan',
        'gate_3_evaluating',
        'release',
        'completed'
      ],
      gates: ['gate_3_qa_security'],
      description: 'cve and stride vulnerability remediation statechart gated by gate_3_qa_security'
    },
    {
      id: 'dependency-upgrade-lifecycle',
      name: 'dependency upgrade work-item statechart',
      scope: 'work_item',
      work_item_type: 'dependency_upgrade',
      tier: 'tier_1',
      initial: 'dependency_scan',
      states: [
        'dependency_scan',
        'version_bump',
        'compatibility_test',
        'gate_2_evaluating',
        'release',
        'completed'
      ],
      gates: ['gate_2_implementation'],
      description: 'dependency upgrade and compatibility verification statechart'
    },
    {
      id: 'ingest-lifecycle',
      name: 'legacy codebase ingestion statechart',
      scope: 'work_item',
      work_item_type: 'ingest',
      tier: 'tier_1',
      initial: 'discovery',
      states: [
        'discovery',
        'audit',
        'baseline_lock',
        'gate_ingest_evaluating',
        'completed'
      ],
      gates: ['gate_ingest'],
      description: 'brownfield codebase ingestion and baseline lock statechart gated by gate_ingest'
    }
  ];
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formats the 9 canonical xstate v5 statecharts into a deterministic text block
 * verbose: produces identical human-readable output for both the cli and mastra agent tools,
 * optionally including active runtime actor state from the current workspace session.
 * 
 * section: arguments
 * - runtime_state (object, optional): { sovereign_state, macro_phase, work_items }
 * 
 * section: return value
 * - formatted (string): canonical statecharts listing
 * 
 * section: example
 * const text = format_sdlc_statecharts_catalog();
 */
export function format_sdlc_statecharts_catalog(runtime_state = null) {
  const charts = list_sdlc_statecharts();
  const lines = [`xstate v5 governance statecharts (${charts.length}):`];
  for (let i = 0; i < charts.length; i += 1) {
    const c = charts[i];
    const type_tag = c.work_item_type ? ` [work_type: ${c.work_item_type}]` : ` [scope: ${c.scope}]`;
    lines.push(
      `  ${i + 1}. ${c.id} (${c.name})${type_tag}: ${c.description}\n` +
      `     states (${c.states.length}): ${c.states.join(' -> ')}`
    );
  }
  if (runtime_state && typeof runtime_state === 'object') {
    const sov = runtime_state.sovereign_state || 'active_development';
    const macro = runtime_state.macro_phase || 'idle';
    const items = Array.isArray(runtime_state.work_items) ? runtime_state.work_items : [];
    lines.push('');
    lines.push(`active statechart actor instances in workspace:`);
    lines.push(`  - project-sovereign-lifecycle : ${sov}`);
    lines.push(`  - sdlc-macro-lifecycle        : ${macro}`);
    if (items.length > 0) {
      for (let j = 0; j < items.length; j += 1) {
        const w = items[j];
        const focus_mark = w.focused ? ' *focused*' : '';
        lines.push(`  - work-item '${w.name}' (${w.type}-lifecycle): ${w.phase || w.state || 'active'}${focus_mark}`);
      }
    } else {
      lines.push('  - spawned work-item actors    : (none active)');
    }
  }
  return lines.join('\n');
}
