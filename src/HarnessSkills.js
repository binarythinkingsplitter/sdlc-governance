/**
 * =========================================================================
 * module: HarnessSkills.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: native mastra skills, governance rules, and role-based agent definitions
 * verbose: compiles first-class mastra skills using @mastra/core/skills and equips
 * specialized role-based agents (product manager, system architect, software engineer,
 * security engineer, qa engineer, devops engineer) with domain skills, imported 7-tier
 * governance rules, and harness tools.
 * 
 * section: arguments
 * - options (object, optional): configuration options including custom skills and tools
 * 
 * section: return value
 * - skills (object): dictionary of compiled mastra skills
 * 
 * section: example
 * import { create_harness_skills, create_role_agents } from './HarnessSkills.js';
 * const skills = create_harness_skills();
 * const agents = create_role_agents();
 * =========================================================================
 */

import { createSkill } from '@mastra/core/skills';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { createCodingAgent } from '@mastra/core/coding-agent';
import { resolve_harness_model } from './HarnessModel.js';
import { resolve_harness_memory } from './MastraMemoryStorage.js';
import { create_harness_tools, create_harness_workspace } from './HarnessTools.js';
import { create_sdlc_processor_suite, SupervisorRequestContextSchema } from './HarnessProcessors.js';

// =============================================================================
// section: static pre-compiled governance skills (imported once from 7-tier library)
// =============================================================================

const gov_tier_00_core = createSkill({
  name: 'gov-tier-00-core',
  description: 'core communication, strictly lowercase british english, and banner jsdoc governance',
  instructions: 'use strictly lowercase british english across all prose, documentation, headings, and comments. every exported function must contain structured banner jsdoc comments. route all work through the formal sdlc orchestrator.',
  references: {
    'british-english.md': 'mandatory lowercase british english spelling and grammar rules',
    'jsdoc-guide.md': 'structured 5-part banner comment documentation standard',
    'mandatory-sdlc-orchestrator-governance.md': 'all tasks must route through the 10-phase sdlc orchestrator'
  }
});

const gov_tier_01_lifecycle = createSkill({
  name: 'gov-tier-01-lifecycle',
  description: 'agile 10-phase sdlc lifecycle, mandatory task governance, and conventional commit traceability',
  instructions: 'strictly advance tasks through the 10-phase sequence: inception, specification, work breakdown, tdd red, tdd green, refactor, verification, release, operations, continuous learning. never jump directly to source code in src without approved prd, stories, and adrs.',
  references: {
    'agile-workflow.md': '10-phase iterative sdlc lifecycle governance',
    'mandatory-sdlc-task-governance.md': 'task decomposition, sequential numbers, and gating invariants',
    'commit-traceability-standards.md': 'conventional commits with semantic scope tags'
  }
});

const gov_tier_02_architecture = createSkill({
  name: 'gov-tier-02-architecture',
  description: 'clean modular architecture, clean-room documentation, and fail-closed interfaces',
  instructions: 'enforce modular software architecture, loose coupling, single responsibility, and explicit schema contracts. maintain the 10-tier numbered clean-room documentation hierarchy.',
  references: {
    'architecture-standards.md': 'modular architecture and explicit component contracts',
    'project-documentation-requirements.md': '10-tier numbered clean-room documentation directory structure',
    'interface-and-api-standards.md': 'fail-closed interface schemas and type boundaries'
  }
});

const gov_tier_03_code_engineering = createSkill({
  name: 'gov-tier-03-code-engineering',
  description: 'modern esm standards, clean code, object calisthenics, and pristine refactoring',
  instructions: 'write modern, modular javascript with strict named esm imports and exports. practice object calisthenics, low indentation depth, and clean refactoring.',
  references: {
    'modern-javascript-esm-standards.md': 'strict esm named imports and exports',
    'object-calisthenics.md': 'zero indentation depth and single responsibility functions',
    'refactoring-techniques.md': 'pristine refactoring without behavioural alteration'
  }
});

const gov_tier_04_testing = createSkill({
  name: 'gov-tier-04-testing',
  description: 'absolute test immutability, node:test runner, and mutation test verification',
  instructions: 'author failing red unit tests before writing source code. never delete, weaken, or skip existing test assertions. verify test immutability on every change.',
  references: {
    'node-native-testing-standards.md': 'use node:test and node:assert/strict natively',
    'qa-and-testing-standards.md': 'strict test immutability enforcement and assertion counting'
  }
});

const gov_tier_05_security = createSkill({
  name: 'gov-tier-05-security',
  description: 'stride threat vector auditing, owasp top 10 standards, and path sanitisation',
  instructions: 'systematically evaluate spoofing, tampering, repudiation, information disclosure, denial of service, and elevation of privilege. strictly sanitise all file paths and prevent directory traversal.',
  references: {
    'security-and-capability-governance.md': 'stride threat model analysis and capability bounds',
    'owasp-top-10-standards.md': 'path traversal prevention and injection defense'
  }
});

const gov_tier_06_operations = createSkill({
  name: 'gov-tier-06-operations',
  description: 'semantic release packaging, changelog generation, and cryptographic gate receipts',
  instructions: 'calculate semantic versioning increments based on conventional commits. generate changelogs, build artifacts, and seal tamper-evident cryptographic json gate receipts.',
  references: {
    'devops-core-principles.md': 'immutable build artifacts and verifiable gate receipts',
    'gitlab-ci-cd-best-practices.md': 'automated ci verification and deployment pipelines'
  }
});

const gov_agents_master = createSkill({
  name: 'gov-agents-master',
  description: 'workspace master guidelines: clean-room documentation, lowercase british english, and banner jsdoc',
  instructions: 'enforce clean-room numbered documentation, strictly lowercase british english, structured banner jsdoc documentation, and tdd discipline.',
  references: {
    'AGENTS.md': 'workspace master governance and architectural directives'
  }
});

const gov_british_english = createSkill({
  name: 'gov-british-english',
  description: 'enforces lowercase british english spelling, grammar, and zero uppercase characters',
  instructions: 'use strictly lowercase characters across all prose, comments, headings, bullet points, and commit messages. strictly use british english spelling (-ise, -our, -re, doubled consonants).',
  references: {
    '00-core/british-english.md': 'british english and lowercase prose requirements'
  }
});

const gov_jsdoc_guide = createSkill({
  name: 'gov-jsdoc-guide',
  description: 'enforces 5-part structured banner jsdoc documentation on all exported functions',
  instructions: 'every exported function must contain structured banner jsdoc comments with version number (0.1.0+), documentation (tldr, verbose), arguments, return value, and example.',
  references: {
    '00-core/jsdoc-guide.md': 'banner jsdoc documentation specification'
  }
});

const gov_mandatory_orchestrator = createSkill({
  name: 'gov-mandatory-sdlc-orchestrator-governance',
  description: 'mandates sequential execution of the 10-phase sdlc state machine',
  instructions: 'every prompt and change must route sequentially through the 10-phase sdlc orchestrator. never bypass review gates or write unapproved code in src.',
  references: {
    '00-core/mandatory-sdlc-orchestrator-governance.md': 'sdlc orchestrator governance mandate'
  }
});

const gov_zero_host_collections = createSkill({
  name: 'gov-zero-host-collections',
  description: 'modern es6 collections enabled: take full advantage of native Map, Set, and ES6 classes',
  instructions: 'modern es6 constructs including native Map, Set, and classes with inheritance are fully enabled across the sdlc runtime.',
  references: {
    '03-code-engineering/modern-javascript-esm-standards.md': 'modern javascript es6 standards'
  }
});

const gov_test_immutability = createSkill({
  name: 'gov-test-immutability',
  description: 'prohibits decreasing assertion counts, skipping tests, or weakening existing assertions',
  instructions: 'test immutability is absolute. never delete or weaken assertions in existing test files. only add new assertions or new test files.',
  references: {
    '04-testing-verification/qa-and-testing-standards.md': 'test immutability verification rules'
  }
});

export const GOVERNANCE_SKILLS = {
  'gov-tier-00-core': gov_tier_00_core,
  'gov-tier-01-lifecycle': gov_tier_01_lifecycle,
  'gov-tier-02-architecture': gov_tier_02_architecture,
  'gov-tier-03-code-engineering': gov_tier_03_code_engineering,
  'gov-tier-04-testing': gov_tier_04_testing,
  'gov-tier-05-security': gov_tier_05_security,
  'gov-tier-06-operations': gov_tier_06_operations,
  'gov-agents-master': gov_agents_master,
  'gov-british-english': gov_british_english,
  'gov-jsdoc-guide': gov_jsdoc_guide,
  'gov-mandatory-sdlc-orchestrator-governance': gov_mandatory_orchestrator,
  'gov-zero-host-collections': gov_zero_host_collections,
  'gov-test-immutability': gov_test_immutability
};

/**
 * =========================================================================
 * function: resolve_role_governance_skills
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: resolves domain-specific pre-compiled governance skills for a designated agent role
 * verbose: returns a static array of pre-compiled mastra skills tailored for each specialized
 * agent role without performing runtime filesystem operations.
 * 
 * section: arguments
 * - role (string): agent role name (e.g. software-engineer, system-architect)
 * 
 * section: return value
 * - skills (Array<Skill>): array of pre-compiled mastra skill instances
 * 
 * section: example
 * const skills = resolve_role_governance_skills('software-engineer');
 * =========================================================================
 */
export function resolve_role_governance_skills(role) {
  const core = GOVERNANCE_SKILLS['gov-tier-00-core'];
  const master = GOVERNANCE_SKILLS['gov-agents-master'];

  const role_map = {
    'product-manager': [core, GOVERNANCE_SKILLS['gov-tier-01-lifecycle']],
    'system-architect': [core, GOVERNANCE_SKILLS['gov-tier-02-architecture'], GOVERNANCE_SKILLS['gov-tier-05-security']],
    'software-engineer': [
      core,
      GOVERNANCE_SKILLS['gov-tier-01-lifecycle'],
      GOVERNANCE_SKILLS['gov-tier-03-code-engineering'],
      GOVERNANCE_SKILLS['gov-tier-04-testing'],
      GOVERNANCE_SKILLS['gov-test-immutability']
    ],
    'security-engineer': [core, GOVERNANCE_SKILLS['gov-tier-05-security']],
    'qa-engineer': [core, GOVERNANCE_SKILLS['gov-tier-04-testing'], GOVERNANCE_SKILLS['gov-test-immutability']],
    'devops-engineer': [core, GOVERNANCE_SKILLS['gov-tier-06-operations']],
    'autonomous-engineer': [
      core,
      GOVERNANCE_SKILLS['gov-tier-03-code-engineering'],
      GOVERNANCE_SKILLS['gov-tier-04-testing'],
      GOVERNANCE_SKILLS['gov-test-immutability']
    ]
  };

  const selected = role_map[role] || [core, master];
  return selected.filter(Boolean);
}

/**
 * =========================================================================
 * function: create_harness_skills
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: compiles core mastra skills for sdlc lifecycle engineering
 * verbose: creates native mastra skills encapsulating tdd red-green
 * protocols, stride security auditing, banner documentation, and release engineering.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - skills (object): dictionary of compiled mastra skill instances
 * 
 * section: example
 * const skills = create_harness_skills();
 * const tdd = skills['tdd-lifecycle'];
 * =========================================================================
 */
export function create_harness_skills(options = {}) {
  const tdd_lifecycle = createSkill({
    name: 'tdd-lifecycle',
    description: 'executes strict red-green-refactor test driven development protocol',
    instructions: 'always author failing red tests before authoring green source code. verify test immutability and never delete or weaken existing test assertions.',
    references: {
      'immutability-rules.md': 'test immutability verification rules and assertion counting'
    }
  });

  const stride_security = createSkill({
    name: 'stride-security-analysis',
    description: 'evaluates spoofing, tampering, repudiation, information disclosure, denial of service, and elevation of privilege',
    instructions: 'systematically audit architecture contracts, session snapshots, and api interfaces against all six stride threat vectors.',
    references: {
      'threat-model.md': 'system threat model and rbac matrix'
    }
  });

  const banner_documentation = createSkill({
    name: 'banner-documentation',
    description: 'enforces banner-style jsdoc structured documentation on all exported functions',
    instructions: 'every exported function must contain structured banner comments with five required sections: version number, documentation (tldr, verbose), arguments, return value, and example.',
    references: {
      'style-guide.md': 'banner documentation specification'
    }
  });

  const release_engineering = createSkill({
    name: 'release-engineering',
    description: 'governs semantic versioning, changelog generation, and canonical gate receipts',
    instructions: 'calculate semver increments based on conventional commit messages, generate changelog entries, and seal tamper-evident cryptographic json gate receipts.',
    references: {
      'semver-spec.md': 'semantic release rules and receipt schemas'
    }
  });

  const governance_skills = options.load_governance === true ? GOVERNANCE_SKILLS : {};

  return {
    'tdd-lifecycle': tdd_lifecycle,
    'stride-security-analysis': stride_security,
    'banner-documentation': banner_documentation,
    'release-engineering': release_engineering,
    ...governance_skills,
    ...(options.custom_skills || {})
  };
}

/**
 * =========================================================================
 * function: create_role_agents
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates role-based mastra agents equipped with domain skills
 * verbose: instantiates specialized mastra agents for each sdlc role, binding them
 * with their relevant skills and harness tools.
 * 
 * section: arguments
 * - options (object, optional): configuration options including skills, tools, and model
 * 
 * section: return value
 * - agents (object): dictionary of configured mastra Agent instances
 * 
 * section: example
 * import { create_role_agents } from './HarnessSkills.js';
 * const agents = create_role_agents();
 * const coder = agents['software-engineer'];
 * =========================================================================
 */
export function create_role_agents(options = {}) {
  const skills = options.skills || create_harness_skills(options);
  const tools = options.tools || {};
  const agent_model = resolve_harness_model(options);
  const workspace = options.workspace || create_harness_workspace({
    base_path: options.workspace_root || options.base_dir || process.cwd(),
    enable_sandbox: options.enable_sandbox ?? true
  });
  const processor_suite = options.processor_suite || create_sdlc_processor_suite({
    verify_token: options.verify_token || null,
    require_token: options.require_supervisor_token ?? false,
    max_processor_retries: options.max_processor_retries ?? 3
  });

  const resolve_memory_for_role = (role) => {
    if (options.enable_memory === true || options.storage) {
      return resolve_harness_memory({
        name: `${role}-memory`,
        storage: options.storage,
        working_memory: true
      });
    }
    return undefined;
  };

  const get_gov = (role) => {
    if (options.enable_governance_skills === true || options.load_governance === true) {
      return resolve_role_governance_skills(role);
    }
    return [];
  };

  const shared_specialist_config = {
    inputProcessors: processor_suite.specialist_input_processors,
    outputProcessors: processor_suite.specialist_output_processors,
    maxProcessorRetries: processor_suite.max_processor_retries,
    requestContextSchema: options.require_supervisor_token ? SupervisorRequestContextSchema : undefined,
    workspace,
    ...(options.enable_goal_judge === true
      ? {
          goal: {
            judge: {
              model: agent_model,
              instructions: 'verify that the specialist agent produced a complete, lowercase british english, schema-valid sdlc deliverable without accessing .sdlc/store directly.'
            },
            maxRuns: 3
          }
        }
      : {})
  };

  const product_manager = new Agent({
    id: 'product-manager',
    name: 'product-manager',
    instructions:
      'collaborate with the user as a product discovery partner: discuss free-form ideas conversationally, inspect existing capabilities, brainstorm and suggest candidate new features to implement via suggest_features, refine user stories and acceptance criteria, and only submit work to the internal sdlc-supervisor via request_sdlc_supervisor when the user explicitly confirms.',
    model: agent_model,
    memory: resolve_memory_for_role('product-manager'),
    skills: [skills['banner-documentation'], ...get_gov('product-manager')],
    tools: Object.values(tools),
    ...shared_specialist_config
  });

  const system_architect = new Agent({
    id: 'system-architect',
    name: 'system-architect',
    instructions: 'design architectural blueprints, sequence diagrams, interface schemas, and architectural decision records adhering to modularity and quality standards.',
    model: agent_model,
    memory: resolve_memory_for_role('system-architect'),
    skills: [
      skills['stride-security-analysis'],
      skills['banner-documentation'],
      ...get_gov('system-architect')
    ].filter(Boolean),
    tools: Object.values(tools),
    ...shared_specialist_config
  });

  const software_engineer = createCodingAgent({
    id: 'software-engineer',
    name: 'software-engineer',
    instructions: 'implement production-grade source modules following test-driven development red-green-refactor cycles with clean modular design.',
    model: agent_model,
    memory: resolve_memory_for_role('software-engineer'),
    skills: [
      skills['tdd-lifecycle'],
      skills['banner-documentation'],
      ...get_gov('software-engineer')
    ].filter(Boolean),
    tools: Object.values(tools),
    ...shared_specialist_config
  });

  const security_engineer = new Agent({
    id: 'security-engineer',
    name: 'security-engineer',
    instructions: 'conduct stride threat audits, evaluate rbac policies, verify path sanitisation, and sign off security review gates.',
    model: agent_model,
    memory: resolve_memory_for_role('security-engineer'),
    skills: [
      skills['stride-security-analysis'],
      skills['banner-documentation'],
      ...get_gov('security-engineer')
    ],
    tools: Object.values(tools),
    ...shared_specialist_config
  });

  const qa_engineer = new Agent({
    id: 'qa-engineer',
    name: 'qa-engineer',
    instructions: 'execute regression suites, verify test immutability, evaluate mutation coverage thresholds, and sign off quality gates.',
    model: agent_model,
    memory: resolve_memory_for_role('qa-engineer'),
    skills: [
      skills['tdd-lifecycle'],
      skills['banner-documentation'],
      ...get_gov('qa-engineer')
    ],
    tools: Object.values(tools),
    ...shared_specialist_config
  });

  const devops_engineer = new Agent({
    id: 'devops-engineer',
    name: 'devops-engineer',
    instructions: 'calculate semantic versioning increments, generate changelogs, build distribution bundles, and seal formal cryptographic gate receipts.',
    model: agent_model,
    memory: resolve_memory_for_role('devops-engineer'),
    skills: [
      skills['release-engineering'],
      skills['banner-documentation'],
      ...get_gov('devops-engineer')
    ],
    tools: Object.values(tools),
    ...shared_specialist_config
  });

  // untethered autonomous engineer: built with createCodingAgent without specialist_input_processors or supervisor token lock
  const autonomous_engineer = createCodingAgent({
    id: 'autonomous-engineer',
    name: 'autonomous-engineer',
    instructions:
      'operate as an untethered autonomous engineer: diagnose and repair broken behaviours, author direct workspace code and test fixes without phase-lock restrictions via apply_direct_code_fix, or consume the governed sdlc process (develop-feature, fix-defect, sync_prd_and_code, request_sdlc_supervisor) when structured lifecycle execution is desired.',
    model: agent_model,
    memory: resolve_memory_for_role('autonomous-engineer'),
    skills: [
      skills['tdd-lifecycle'],
      skills['banner-documentation'],
      skills['release-engineering'],
      ...get_gov('autonomous-engineer')
    ].filter(Boolean),
    tools: Object.values(tools),
    inputProcessors: [],
    outputProcessors: [],
    workspace
  });

  const raw_agents = {
    'product-manager': product_manager,
    'system-architect': system_architect,
    'software-engineer': software_engineer,
    'security-engineer': security_engineer,
    'qa-engineer': qa_engineer,
    'devops-engineer': devops_engineer,
    'autonomous-engineer': autonomous_engineer
  };

  if (options.durable_agents) {
    const durable_map = {};
    for (const [role, agent] of Object.entries(raw_agents)) {
      durable_map[role] = createDurableAgent({
        agent,
        cache: processor_suite.cache
      });
    }
    return durable_map;
  }

  return raw_agents;
}

/**
 * =========================================================================
 * function: create_coding_agent
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a governed coding agent using @mastra/core/coding-agent createCodingAgent
 * verbose: wraps Mastra's createCodingAgent factory with the dual-engine harness model router,
 * sandboxed workspace (blocking direct .sdlc/store writes), tdd and banner documentation skills,
 * TaskSignalProvider when memory is enabled, and stream stability error processors.
 *
 * section: arguments
 * - options (object, optional): coding agent configuration options
 *
 * section: return value
 * - coding_agent (Agent): configured Mastra coding agent instance
 *
 * section: example
 * import { create_coding_agent } from './HarnessSkills.js';
 * const coder = create_coding_agent({ id: 'sdlc-coder' });
 * =========================================================================
 */
export function create_coding_agent(options = {}) {
  const id = options.id || 'sdlc-coding-agent';
  const name = options.name || id;
  const model = options.model || resolve_harness_model(options);
  const workspace = options.workspace || create_harness_workspace({
    base_path: options.workspace_root || options.base_dir || process.cwd(),
    enable_sandbox: options.enable_sandbox ?? true
  });
  const skills_dict = options.skills_dict || create_harness_skills(options);
  const tools_dict = options.tools_dict || create_harness_tools(options);
  const memory = options.memory || (
    options.enable_memory || options.storage
      ? resolve_harness_memory({
          name: `${id}-memory`,
          storage: options.storage,
          working_memory: true
        })
      : undefined
  );

  return createCodingAgent({
    id,
    name,
    instructions:
      options.instructions ||
      'implement modular, test-driven code solutions in the sandboxed workspace while preserving test immutability and banner-style jsdoc documentation.',
    model,
    workspace,
    memory,
    skills: options.skills || [
      skills_dict['tdd-lifecycle'],
      skills_dict['banner-documentation']
    ].filter(Boolean),
    tools: options.tools || Object.values(tools_dict),
    ...(options.inputProcessors ? { inputProcessors: options.inputProcessors } : {}),
    ...(options.outputProcessors ? { outputProcessors: options.outputProcessors } : {}),
    ...(options.goal ? { goal: options.goal } : {})
  });
}
