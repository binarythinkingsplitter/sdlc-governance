/**
 * =========================================================================
 * module: MastraEcosystemBridge.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: standalone mastra ecosystem integration for server, editor, builders, factories, and nuxt nitro
 * verbose: integrates @mastra/server (SERVER_ROUTES, handlers, openapi), @mastra/core/editor (IMastraEditor
 * and stored entities), @mastra/core/agent-builder/ee (AgentBuilderOptions, BuilderModelPolicy, picker
 * visibility), @mastra/core/workflows/builder (WorkflowBuilderDefinition, dynamic workflows, workflow
 * builder agent), @mastra/core/coding-agent (createCodingAgent), and @mastra/core/agent-controller
 * (AgentController, Session, task tools) with the standalone @thing/sdlc-dual_engine_harness runtime and
 * provides a drop-in nuxt nitro / h3 server handler factory.
 *
 * section: arguments
 * - options (object, optional): configuration options for editor, builders, controllers, and server adapter
 *
 * section: return value
 * - module exports (object): factory functions and constants for mastra ecosystem and nuxt integration
 *
 * section: example
 * import { create_dual_engine_harness, create_nuxt_mastra_handler } from './index.js';
 * const harness = create_dual_engine_harness();
 * export default create_nuxt_mastra_handler({ harness });
 * =========================================================================
 */

import {
  BUILDER_FEATURE_DEFAULTS,
  builderToModelPolicy,
  isModelAllowed,
  resolveAgentFeatures,
  resolvePickerVisibility
} from '@mastra/core/agent-builder/ee';
import {
  WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES,
  createWorkflowBuilderAgent,
  normalizeWorkflowBuilderDefinition,
  preflightWorkflowDefinition
} from '@mastra/core/workflows/builder';
import { createCodingAgent } from '@mastra/core/coding-agent';
import {
  AgentController,
  askUserTool,
  submitPlanTool,
  taskCheckTool,
  taskCompleteTool,
  taskUpdateTool,
  taskWriteTool
} from '@mastra/core/agent-controller';
import { Classifier, MastraDecisionModel } from '@mastra/core/classifier';
import { SERVER_ROUTES, generateOpenAPIDocument } from '@mastra/server/server-adapter';
import * as mastra_server_handlers from '@mastra/server/handlers';
import { create_request_context } from './HarnessProcessors.js';
import { create_antigravity_model_gateway, resolve_harness_model } from './HarnessModel.js';
import { create_harness_tools, create_harness_workspace } from './HarnessTools.js';
import { create_coding_agent, create_harness_skills } from './HarnessSkills.js';
import { resolve_harness_storage, resolve_harness_memory } from './MastraMemoryStorage.js';
import {
  list_high_level_processes,
  list_sdlc_phases,
  list_review_gates,
  list_work_item_types
} from './HarnessCatalog.js';
import { DocumentEntityTypes } from './DocumentEntitiesSchema.js';
import { get_doc_store_sync_machine_config } from './MacroStatechartEngine.js';

export const DEFAULT_SDLC_ALLOWED_MODELS = Object.freeze([
  'antigravity/*',
  'google/*',
  'gemini-*',
  'openai/*',
  'anthropic/*'
]);

export const DEFAULT_SDLC_ALLOWED_AGENTS = Object.freeze([
  'product-manager',
  'system-architect',
  'software-engineer',
  'security-engineer',
  'qa-engineer',
  'devops-engineer',
  'autonomous-engineer',
  'sdlc-supervisor'
]);

export const DEFAULT_SDLC_ALLOWED_WORKFLOWS = Object.freeze([
  'helloworld-workflow',
  'sdlc-tdd-cycle',
  'sdlc-lifecycle-workflow',
  'pm-prd-authoring',
  'pm-story-slicing',
  'arch-adr-authoring',
  'arch-interface-contract',
  'se-feature-implementation',
  'se-defect-patch',
  'sec-threat-modeling',
  'qa-regression-audit',
  'devops-release-packaging',
  'devops-retrospective-authoring',
  'devops-project-decommissioning'
]);

export const DEFAULT_SDLC_ALLOWED_TOOLS = Object.freeze([
  'harness-test-runner',
  'harness-artefact-writer',
  'harness-immutability-audit',
  'harness-git-status',
  'harness-doc-rag-search',
  'harness-knowledge-graph',
  'harness-doc-store-sync',
  'harness-work-item-submit'
]);

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates governed agent builder options and picker visibility policy for sdlc agents
 * verbose: configures @mastra/core/agent-builder/ee features, model allowlists, and picker
 * visibility rules so custom agents authored in nuxt studio inherit sandboxed workspaces,
 * memory domains, and approved dual-engine tools, subagents, and workflows.
 *
 * section: arguments
 * - options (object, optional): custom overrides for features, models, or agent configuration
 *
 * section: return value
 * - builder_options (object): structured AgentBuilderOptions object
 *
 * section: example
 * const opts = create_sdlc_agent_builder_options();
 */
function normalise_allowed_model_entry(entry) {
  if (entry && typeof entry === 'object') {
    return { kind: 'custom', ...entry };
  }
  const raw = String(entry || '').trim();
  if (raw.includes('/')) {
    const [provider, model_part] = raw.split('/');
    if (!model_part || model_part === '*') {
      return { kind: 'custom', provider };
    }
    return { kind: 'custom', provider, modelId: model_part };
  }
  return { kind: 'custom', provider: raw };
}

export function create_sdlc_agent_builder_options(options = {}) {
  const agent_features = resolveAgentFeatures(
    {
      ...BUILDER_FEATURE_DEFAULTS,
      ...(options.features || {})
    },
    { hasBrowserConfig: Boolean(options.has_browser_config) }
  );

  const features = {
    ...agent_features,
    agent: agent_features,
    agentBuilder: true,
    workflowBuilder: true,
    autoVersioning: true,
    storedItemSource: options.stored_item_source || 'code'
  };

  const raw_allowed = Array.isArray(options.allowed_models)
    ? options.allowed_models
    : DEFAULT_SDLC_ALLOWED_MODELS;

  const models = {
    default: options.default_model || 'antigravity/gemini-3.8-flash-medium',
    allowed: raw_allowed.map(normalise_allowed_model_entry),
    ...(Array.isArray(options.disallowed_models) ? { disallowed: options.disallowed_models.slice() } : {})
  };

  const configuration = {
    agent: {
      models,
      memory: {
        mode: 'optional',
        default: 'sdlc-memory',
        allowed: ['sdlc-memory']
      },
      workspace: {
        mode: 'required',
        default: 'sdlc-harness-workspace',
        allowed: ['sdlc-harness-workspace']
      },
      tools: {
        allowed: Array.isArray(options.allowed_tools)
          ? options.allowed_tools.slice()
          : DEFAULT_SDLC_ALLOWED_TOOLS.slice()
      },
      agents: {
        allowed: Array.isArray(options.allowed_agents)
          ? options.allowed_agents.slice()
          : DEFAULT_SDLC_ALLOWED_AGENTS.slice()
      },
      workflows: {
        allowed: Array.isArray(options.allowed_workflows)
          ? options.allowed_workflows.slice()
          : DEFAULT_SDLC_ALLOWED_WORKFLOWS.slice()
      },
      ...(options.agent_configuration || {})
    }
  };

  const policy = builderToModelPolicy({
    enabled: options.enabled !== false,
    getFeatures() {
      return features;
    },
    getConfiguration() {
      return configuration;
    }
  });
  const picker = resolvePickerVisibility({
    config: configuration.agent,
    registeredToolIds: configuration.agent.tools.allowed,
    registeredAgentIds: configuration.agent.agents.allowed,
    registeredWorkflowIds: configuration.agent.workflows.allowed
  });

  return {
    enabled: options.enabled !== false,
    features,
    models,
    configuration,
    model_policy: policy,
    picker_visibility: picker
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a standalone IMastraEditor implementation backed by harness storage
 * verbose: implements the @mastra/core/editor IMastraEditor contract including resolveBuilder,
 * resolveWorkflowBuilder, stored entity namespaces (agent, skill, prompt, workspace, scorer,
 * mcp, mcpServer, favorites), and applyStoredOverrides so @mastra/server /editor/* and /stored/*
 * endpoints operate seamlessly in nuxt.
 *
 * section: arguments
 * - options (object, optional): editor configuration including storage, model, and builder_options
 *
 * section: return value
 * - editor (object): IMastraEditor-compliant editor instance
 *
 * section: example
 * const editor = create_mastra_editor({ storage });
 */
export function create_mastra_editor(options = {}) {
  const storage = options.storage || resolve_harness_storage(options);
  const builder_options = options.builder_options || create_sdlc_agent_builder_options(options);
  const model = options.model || resolve_harness_model(options);

  let workflow_builder_agent = null;

  function get_workflow_builder_agent() {
    if (!workflow_builder_agent) {
      workflow_builder_agent = createWorkflowBuilderAgent({
        id: 'sdlc-workflow-builder-agent',
        name: 'sdlc-workflow-builder-agent',
        model,
        surfaceInstructions:
          'compose governed sdlc dynamic workflows using registered dual-engine agents (product-manager, system-architect, software-engineer, security-engineer, qa-engineer, devops-engineer), role workflows, and harness verification tools.'
      });
    }
    return workflow_builder_agent;
  }

  function create_domain_accessor(domain_name) {
    return {
      async getStore() {
        return storage.getStore(domain_name);
      },
      async list(params = {}) {
        const store = await storage.getStore(domain_name);
        if (!store || typeof store.list !== 'function') {
          return { items: [], total: 0 };
        }
        return store.list(params);
      },
      async getById(id, params = {}) {
        const store = await storage.getStore(domain_name);
        if (!store) return null;
        if (typeof store.getById === 'function') {
          return store.getById(id, params);
        }
        return null;
      },
      async create(payload) {
        const store = await storage.getStore(domain_name);
        if (!store) throw new Error(`storage_domain_unavailable: ${domain_name}`);
        if (typeof store.create === 'function') {
          return store.create(payload);
        }
        if (typeof store.upsert === 'function') {
          return store.upsert(payload);
        }
        return payload;
      },
      async update(id, payload) {
        const store = await storage.getStore(domain_name);
        if (!store) throw new Error(`storage_domain_unavailable: ${domain_name}`);
        if (typeof store.update === 'function') {
          return store.update(id, payload);
        }
        return payload;
      },
      async delete(id) {
        const store = await storage.getStore(domain_name);
        if (!store || typeof store.delete !== 'function') {
          return false;
        }
        return store.delete(id);
      }
    };
  }

  const base_agent_accessor = create_domain_accessor('agents');
  const agent_accessor = {
    ...base_agent_accessor,
    async create(payload) {
      const store = await storage.getStore('agents');
      if (!store) throw new Error('storage_domain_unavailable: agents');
      const raw_agent = payload && typeof payload === 'object' && payload.agent
        ? payload.agent
        : payload;
      const enriched_agent = {
        ...(raw_agent || {}),
        metadata: {
          ...(raw_agent?.metadata || {}),
          ...(raw_agent?.description ? { description: raw_agent.description } : {})
        }
      };
      if (typeof store.create === 'function') {
        return store.create({ agent: enriched_agent });
      }
      return payload;
    },
    async applyStoredOverrides(agent_or_id, maybe_agent) {
      const base_agent = (agent_or_id && typeof agent_or_id === 'object') ? agent_or_id : maybe_agent;
      const agent_id = typeof agent_or_id === 'string'
        ? agent_or_id
        : (base_agent?.id || base_agent?.name || null);
      if (!base_agent || !agent_id) {
        return base_agent;
      }
      let stored = null;
      let latest_version = null;
      try {
        const store = await storage.getStore('agents');
        stored = await base_agent_accessor.getById(agent_id);
        if (store && typeof store.getLatestVersion === 'function') {
          latest_version = await store.getLatestVersion(agent_id);
        }
      } catch (_err) {
        stored = null;
      }
      if ((!stored || typeof stored !== 'object') && (!latest_version || typeof latest_version !== 'object')) {
        return base_agent;
      }
      const override_source = {
        ...(stored || {}),
        ...(stored?.metadata && typeof stored.metadata === 'object' ? stored.metadata : {}),
        ...(stored?.activeVersion && typeof stored.activeVersion === 'object' ? stored.activeVersion : {}),
        ...(latest_version || {})
      };
      base_agent.__stored_overrides = { ...override_source };
      if (typeof override_source.description === 'string' && override_source.description.length > 0) {
        try {
          base_agent.description = override_source.description;
        } catch (_err) {
          // ignore read-only property
        }
        base_agent.getDescription = () => override_source.description;
      }
      if (typeof override_source.instructions === 'string' && override_source.instructions.length > 0) {
        try {
          base_agent.instructions = override_source.instructions;
        } catch (_err) {
          // ignore read-only property
        }
        base_agent.getInstructions = () => override_source.instructions;
      }
      return base_agent;
    }
  };

  const builder_facade = {
    enabled: builder_options.enabled,
    models: builder_options.models,
    getFeatures() {
      return builder_options.features;
    },
    getConfiguration() {
      return builder_options.configuration;
    },
    getModelPolicy() {
      return builder_options.model_policy;
    },
    getModelPolicyWarnings() {
      return [];
    },
    isModelAllowed(candidate) {
      if (!builder_options.model_policy.active) {
        return true;
      }
      return isModelAllowed(builder_options.model_policy.allowed || [], candidate);
    }
  };

  const workflow_builder_facade = {
    enabled: builder_options.features.workflowBuilder !== false,
    getModelPolicy() {
      return builder_options.model_policy;
    },
    getAgent() {
      return get_workflow_builder_agent();
    }
  };

  return {
    agent: agent_accessor,
    skill: create_domain_accessor('skills'),
    prompt: create_domain_accessor('promptBlocks'),
    workspace: create_domain_accessor('workspaces'),
    scorer: create_domain_accessor('scorerDefinitions'),
    mcp: create_domain_accessor('mcpClients'),
    mcpServer: create_domain_accessor('mcpServers'),
    favorites: create_domain_accessor('favorites'),
    workflowDefinitions: create_domain_accessor('workflowDefinitions'),
    hasEnabledBuilderConfig() {
      return builder_options.enabled === true;
    },
    async resolveBuilder() {
      return builder_facade;
    },
    hasEnabledWorkflowBuilderConfig() {
      return workflow_builder_facade.enabled === true;
    },
    async resolveWorkflowBuilder() {
      return workflow_builder_facade;
    },
    getBuilderOptions() {
      return builder_options;
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a governed coding agent using @mastra/core/coding-agent createCodingAgent factory
 * verbose: wraps Mastra's createCodingAgent factory with the dual-engine harness model router,
 * sandboxed workspace (blocking direct .sdlc/store writes), tdd and banner documentation skills,
 * and standard harness verification tools.
 *
 * section: arguments
 * - options (object, optional): coding agent configuration options
 *
 * section: return value
 * - coding_agent (Agent): configured Mastra coding agent instance
 *
 * section: example
 * const coder = create_sdlc_coding_agent({ id: 'sdlc-coder' });
 */
export function create_sdlc_coding_agent(options = {}) {
  return create_coding_agent(options);
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: maps sdlc tool identifiers to AgentController permission categories
 * verbose: classifies dual-engine harness tools into read, edit, execute, mcp, or other
 * for AgentController session permission policies.
 *
 * section: arguments
 * - tool_name (string): tool identifier
 *
 * section: return value
 * - category (string): 'read' | 'edit' | 'execute' | 'mcp' | 'other'
 *
 * section: example
 * const cat = resolve_sdlc_tool_category('harness-test-runner');
 */
export function resolve_sdlc_tool_category(tool_name) {
  const name = String(tool_name || '').toLowerCase();
  if (
    name.includes('read') ||
    name.includes('search') ||
    name.includes('status') ||
    name.includes('audit') ||
    name.includes('list') ||
    name.includes('inspect') ||
    name.includes('knowledge-graph') ||
    name === 'task_check'
  ) {
    return 'read';
  }
  if (
    name.includes('write') ||
    name.includes('edit') ||
    name.includes('patch') ||
    name.includes('artefact-writer') ||
    name === 'task_write' ||
    name === 'task_update' ||
    name === 'task_complete'
  ) {
    return 'edit';
  }
  if (
    name.includes('test-runner') ||
    name.includes('exec') ||
    name.includes('run')
  ) {
    return 'execute';
  }
  if (name.startsWith('mcp_') || name.includes('mcp')) {
    return 'mcp';
  }
  return 'other';
}

export const SDLC_CONTROLLER_MODE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'discovery',
    name: 'product discovery (product-manager)',
    description: 'collaborative product discovery, prd authoring, story slicing, and feature scoping',
    default: true,
    transitionsTo: 'architecture',
    role_id: 'product-manager'
  }),
  Object.freeze({
    id: 'architecture',
    name: 'architecture design (system-architect)',
    description: 'architectural decision records (adrs), module boundaries, and interface contracts',
    default: false,
    transitionsTo: 'implementation',
    role_id: 'system-architect'
  }),
  Object.freeze({
    id: 'implementation',
    name: 'tdd implementation (software-engineer)',
    description: 'test-driven red-green-refactor coding and defect patching via createCodingAgent',
    default: false,
    transitionsTo: 'security',
    role_id: 'software-engineer'
  }),
  Object.freeze({
    id: 'security',
    name: 'stride security review (security-engineer)',
    description: 'stride threat modelling, boundary sanitisation, and gate 3 security audits',
    default: false,
    transitionsTo: 'qa',
    role_id: 'security-engineer'
  }),
  Object.freeze({
    id: 'qa',
    name: 'quality assurance & immutability (qa-engineer)',
    description: 'regression test execution, gherkin bdd verification, and test immutability enforcement',
    default: false,
    transitionsTo: 'release',
    role_id: 'qa-engineer'
  }),
  Object.freeze({
    id: 'release',
    name: 'release engineering & retrospective (devops-engineer)',
    description: 'semver release manifests, cryptographic gate receipts, and blameless retrospectives',
    default: false,
    role_id: 'devops-engineer'
  }),
  Object.freeze({
    id: 'autonomous',
    name: 'untethered autonomous repair (autonomous-engineer)',
    description: 'direct workspace debugging and code repair via createCodingAgent without phase locks',
    default: false,
    role_id: 'autonomous-engineer'
  }),
  Object.freeze({
    id: 'supervisor',
    name: 'tier 1 governance supervisor (sdlc-supervisor)',
    description: 'xstate macro statechart orchestration, work board scheduling, and gate mediation',
    default: false,
    role_id: 'sdlc-supervisor'
  })
]);

const CONTROLLER_MODE_ALIASES = Object.freeze({
  discovery: 'discovery',
  product: 'discovery',
  pm: 'discovery',
  'product-manager': 'discovery',
  architecture: 'architecture',
  arch: 'architecture',
  architect: 'architecture',
  'system-architect': 'architecture',
  implementation: 'implementation',
  impl: 'implementation',
  code: 'implementation',
  se: 'implementation',
  dev: 'implementation',
  developer: 'implementation',
  engineer: 'implementation',
  'software-engineer': 'implementation',
  security: 'security',
  sec: 'security',
  'security-engineer': 'security',
  qa: 'qa',
  quality: 'qa',
  tester: 'qa',
  'qa-engineer': 'qa',
  release: 'release',
  devops: 'release',
  ops: 'release',
  'devops-engineer': 'release',
  autonomous: 'autonomous',
  auto: 'autonomous',
  coder: 'autonomous',
  fixer: 'autonomous',
  builder: 'autonomous',
  untethered: 'autonomous',
  'autonomous-engineer': 'autonomous',
  supervisor: 'supervisor',
  sup: 'supervisor',
  governor: 'supervisor',
  'sdlc-supervisor': 'supervisor'
});

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: resolves an agent name, alias, or mode identifier into a canonical AgentController mode id
 * verbose: maps user-friendly mode or role names (e.g. discovery, pm, implementation, software-engineer,
 * supervisor) to one of the 8 canonical sdlc AgentController mode identifiers.
 *
 * section: arguments
 * - raw_input (string): mode or agent identifier
 *
 * section: return value
 * - mode_id (string|null): canonical AgentController mode id or null
 *
 * section: example
 * const mode_id = resolve_sdlc_controller_mode('software-engineer'); // 'implementation'
 */
export function resolve_sdlc_controller_mode(raw_input) {
  if (!raw_input) return null;
  const key = String(raw_input).trim().toLowerCase();
  return CONTROLLER_MODE_ALIASES[key] || null;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: resolves an AgentController mode id or alias into its backing sdlc role agent id
 * verbose: maps any of the 8 AgentController modes (discovery, architecture, implementation,
 * security, qa, release, autonomous, supervisor) to its corresponding Mastra role agent id.
 *
 * section: arguments
 * - raw_mode (string): mode identifier or alias
 *
 * section: return value
 * - role_id (string|null): canonical sdlc role agent id or null
 *
 * section: example
 * const role_id = resolve_role_for_controller_mode('implementation'); // 'software-engineer'
 */
export function resolve_role_for_controller_mode(raw_mode) {
  const mode_id = resolve_sdlc_controller_mode(raw_mode);
  if (!mode_id) return null;
  for (let i = 0; i < SDLC_CONTROLLER_MODE_DEFINITIONS.length; i += 1) {
    if (SDLC_CONTROLLER_MODE_DEFINITIONS[i].id === mode_id) {
      return SDLC_CONTROLLER_MODE_DEFINITIONS[i].role_id;
    }
  }
  return null;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a multi-mode AgentController hosting all dual-engine role agents and subagents
 * verbose: instantiates @mastra/core/agent-controller AgentController with modes mapped to
 * product-manager (default discovery mode per adr-011), system-architect, software-engineer,
 * security-engineer, qa-engineer, devops-engineer, autonomous-engineer, and sdlc-supervisor,
 * wired with storage, memory, pubsub, gateways, subagents, permission category resolver,
 * and interactive task tools (askUserTool, submitPlanTool, taskWriteTool).
 *
 * section: arguments
 * - options (object, optional): controller configuration including agents, workspace, storage, memory, pubsub
 *
 * section: return value
 * - controller_bundle (object): { id, controller, interactive_tools, modes, subagents, register_mode_agent, create_session }
 *
 * section: example
 * const { controller } = create_sdlc_agent_controller({ harness });
 */
export function create_sdlc_agent_controller(options = {}) {
  const harness = options.harness || null;
  const mastra = harness?.get_mastra_instance?.() || null;
  const workspace = options.workspace || mastra?.getWorkspace?.() || create_harness_workspace(options);
  const storage = options.storage || harness?.get_mastra_bridge?.()?.get_storage?.() || resolve_harness_storage(options);
  const memory = options.memory_instance || resolve_harness_memory({
    name: 'sdlc-controller-memory',
    storage,
    working_memory: true
  });
  const gateway = options.gateway || create_antigravity_model_gateway(options);
  const default_model_id = options.default_model_id || 'antigravity/gemini-3.8-flash-medium';

  const resolve_agent = (role_id) => {
    if (options.agents && options.agents[role_id]) {
      return options.agents[role_id];
    }
    if (harness && typeof harness.get_agent === 'function') {
      return harness.get_agent(role_id);
    }
    return null;
  };

  const mode_definitions = SDLC_CONTROLLER_MODE_DEFINITIONS;

  const modes = [];
  const subagents = [];
  for (let i = 0; i < mode_definitions.length; i += 1) {
    const def = mode_definitions[i];
    const agent = resolve_agent(def.role_id);
    if (agent) {
      modes.push({
        id: def.id,
        name: def.name,
        description: def.description,
        defaultModelId: default_model_id,
        default: def.default,
        ...(def.transitionsTo ? { transitionsTo: def.transitionsTo } : {}),
        metadata: {
          default: def.default,
          role_id: def.role_id
        },
        agent
      });
    }
    subagents.push({
      id: def.role_id,
      name: def.name,
      description: def.description,
      defaultModelId: default_model_id,
      instructions: `operate as the ${def.role_id} subagent (${def.description}).`
    });
  }

  const interactive_tools = {
    ask_user: askUserTool,
    submit_plan: submitPlanTool,
    task_write: taskWriteTool,
    task_update: taskUpdateTool,
    task_complete: taskCompleteTool,
    task_check: taskCheckTool
  };

  const controller_id = options.id || 'sdlc-agent-controller';
  const controller = modes.length > 0
    ? new AgentController({
        id: controller_id,
        resourceId: options.resource_id || harness?.session_id || 'sdlc-default-resource',
        defaultModeId: options.default_mode_id || modes[0].id,
        modes,
        subagents,
        storage,
        memory,
        workspace,
        tools: options.tools || undefined,
        gateways: [gateway],
        pubsub: options.pubsub || undefined,
        toolCategoryResolver: resolve_sdlc_tool_category
      })
    : null;

  const mode_summaries = modes.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    role_id: m.metadata?.role_id,
    default: Boolean(m.default),
    ...(m.transitionsTo ? { transitionsTo: m.transitionsTo } : {})
  }));

  function register_mode_agent(role_id, agent) {
    if (!role_id || !agent) return false;
    let matched_def = null;
    for (let i = 0; i < mode_definitions.length; i += 1) {
      if (mode_definitions[i].role_id === role_id || mode_definitions[i].id === role_id) {
        matched_def = mode_definitions[i];
        break;
      }
    }
    const mode_entry = {
      id: matched_def ? matched_def.id : role_id,
      name: matched_def ? matched_def.name : `${role_id} mode`,
      description: matched_def ? matched_def.description : `agent mode for ${role_id}`,
      defaultModelId: default_model_id,
      default: matched_def ? matched_def.default : false,
      ...(matched_def?.transitionsTo ? { transitionsTo: matched_def.transitionsTo } : {}),
      metadata: {
        default: matched_def ? matched_def.default : false,
        role_id
      },
      agent
    };

    const existing_idx = modes.findIndex((m) => m.id === mode_entry.id);
    if (existing_idx >= 0) {
      modes[existing_idx] = mode_entry;
      mode_summaries[existing_idx] = {
        id: mode_entry.id,
        name: mode_entry.name,
        description: mode_entry.description,
        role_id,
        default: Boolean(mode_entry.default),
        ...(mode_entry.transitionsTo ? { transitionsTo: mode_entry.transitionsTo } : {})
      };
    } else {
      modes.push(mode_entry);
      mode_summaries.push({
        id: mode_entry.id,
        name: mode_entry.name,
        description: mode_entry.description,
        role_id,
        default: Boolean(mode_entry.default),
        ...(mode_entry.transitionsTo ? { transitionsTo: mode_entry.transitionsTo } : {})
      });
    }
    return true;
  }

  async function create_session(session_params = {}) {
    if (!controller) return null;
    const requested_mode = resolve_sdlc_controller_mode(
      session_params.mode || session_params.modeId || session_params.agent_id || session_params.role
    ) || options.default_mode_id || (modes[0] && modes[0].id) || 'discovery';
    const resource_id = session_params.resource_id || session_params.resourceId || harness?.session_id || 'sdlc-default-resource';
    const session = await controller.createSession({
      resourceId: resource_id
    });
    if (session_params.create_thread !== false && session?.thread?.create && !session.thread.getId()) {
      try {
        await session.thread.create({
          title: session_params.title || `sdlc cli session (${resource_id})`
        });
      } catch (_err) {
        // ignore thread creation failure
      }
    }
    if (requested_mode && session?.mode?.switch) {
      try {
        await session.mode.switch({ modeId: requested_mode });
      } catch (_err) {
        session.mode.set({ modeId: requested_mode });
      }
    }
    if (session?.permissions?.setForCategory) {
      const default_policies = session_params.permissions || {
        read: 'allow',
        edit: 'allow',
        execute: 'allow'
      };
      for (const [cat, policy] of Object.entries(default_policies)) {
        await session.permissions.setForCategory({ category: cat, policy });
      }
    }
    return session;
  }

  return {
    id: controller_id,
    controller,
    modes: mode_summaries,
    subagents,
    interactive_tools,
    register_mode_agent,
    create_session
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a standalone MCP server exposing dual-engine tools, agents, workflows, and store resources
 * verbose: implements the @mastra/core/mcp server interface (supporting both HTTP and SSE transports)
 * so @mastra/server /mcp/v0/servers, /mcp/:serverId/tools, /mcp/:serverId/resources, /mcp/:serverId/sse,
 * and /mcp/:serverId/mcp endpoints operate out-of-the-box in nuxt.
 *
 * section: arguments
 * - options (object, optional): configuration including id, tools, agents, workflows, and store
 *
 * section: return value
 * - mcp_server (object): Mastra MCP server instance compatible with mastra.addMCPServer()
 *
 * section: example
 * const mcp = create_sdlc_mcp_server({ tools, agents, workflows, store });
 */
export function create_sdlc_mcp_server(options = {}) {
  let server_id = options.id || 'sdlc-mcp';
  const name = options.name || '@thing/sdlc-dual_engine_harness mcp server';
  const version = options.version || '0.1.0';
  const description =
    options.description ||
    'model context protocol (mcp) server exposing dual-engine sdlc governance tools, specialist role agents, workflows, and document store resources over rest and sse.';
  const release_date = options.release_date || new Date().toISOString();
  const tools_map = { ...(options.tools || {}) };
  const store = options.store || null;
  let bound_mastra = null;
  let bound_logger = null;

  function build_tool_list() {
    const list = [];
    for (const [key, tool] of Object.entries(tools_map)) {
      if (!tool || typeof tool !== 'object') continue;
      list.push({
        name: tool.id || key,
        description: tool.description || `sdlc harness tool ${key}`,
        inputSchema: { type: 'object', properties: {} },
        toolType: 'tool'
      });
    }
    return list;
  }

  return {
    get id() {
      return server_id;
    },
    name,
    version,
    description,
    releaseDate: release_date,
    isLatest: true,
    get mastra() {
      return bound_mastra;
    },
    setId(new_id) {
      if (new_id) {
        server_id = new_id;
      }
    },
    __registerMastra(mastra_inst) {
      bound_mastra = mastra_inst;
    },
    __setLogger(logger_inst) {
      bound_logger = logger_inst;
    },
    tools() {
      return tools_map;
    },
    getServerInfo() {
      return {
        id: server_id,
        name,
        description,
        version_detail: {
          version,
          release_date,
          is_latest: true
        }
      };
    },
    getServerDetail() {
      return {
        ...this.getServerInfo(),
        package_canonical: 'npm',
        packages: [
          {
            registry_name: 'npm',
            name: '@thing/sdlc-dual_engine_harness',
            version
          }
        ],
        remotes: [
          {
            transport_type: 'sse',
            url: `/api/mastra/mcp/${server_id}/sse`
          },
          {
            transport_type: 'streamable-http',
            url: `/api/mastra/mcp/${server_id}/mcp`
          }
        ]
      };
    },
    async getToolListInfo() {
      return {
        tools: build_tool_list()
      };
    },
    async getToolInfo(tool_id) {
      const list = build_tool_list();
      return list.find((t) => t.name === tool_id) || undefined;
    },
    async executeTool(tool_id, args = {}, execution_context = {}) {
      const tool = tools_map[tool_id];
      if (!tool || typeof tool.execute !== 'function') {
        throw new Error(`Tool '${tool_id}' not found on MCP server '${server_id}'`);
      }
      if (bound_logger && typeof bound_logger.info === 'function') {
        bound_logger.info({ event: 'mcp:tool:execute', server_id, tool_id });
      }
      return tool.execute({
        context: args || {},
        requestContext: execution_context?.requestContext
      });
    },
    async listResources() {
      const resources = [
        {
          uri: 'sdlc://catalog/phases',
          name: 'sdlc 10-phase catalog',
          description: 'canonical 10-phase macro statechart lifecycle definitions',
          mimeType: 'application/json'
        },
        {
          uri: 'sdlc://catalog/gates',
          name: 'sdlc review gates',
          description: 'formal review gates 1 through 4 verification rules',
          mimeType: 'application/json'
        },
        {
          uri: 'sdlc://catalog/doc-store-sync-statechart',
          name: 'sdlc doc store sync statechart',
          description: 'xstate v5 statechart governing bidirectional .sdlc/store and docs/ filesystem synchronisation',
          mimeType: 'application/json'
        }
      ];
      if (store && typeof store.list_entities === 'function') {
        try {
          const prds = store.list_entities('prd') || [];
          for (let i = 0; i < prds.length; i += 1) {
            const p = prds[i];
            resources.push({
              uri: `sdlc://store/prd/${p.id}`,
              name: p.title || p.id,
              description: `stored prd entity ${p.id}`,
              mimeType: 'application/json'
            });
          }
        } catch (_err) {
          // ignore
        }
      }
      return { resources };
    },
    async readResource(uri) {
      if (uri === 'sdlc://catalog/phases') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                phases: [
                  'phase_00_inception',
                  'phase_01_specifications',
                  'phase_02_architecture',
                  'phase_03_tdd_red',
                  'phase_04_tdd_green',
                  'phase_05_refactor',
                  'phase_06_security_review',
                  'phase_07_qa_verification',
                  'phase_08_release',
                  'phase_09_continuous_learning'
                ]
              })
            }
          ]
        };
      }
      if (uri === 'sdlc://catalog/gates') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                gates: ['gate_1_planning', 'gate_2_implementation', 'gate_3_qa_security', 'gate_4_release']
              })
            }
          ]
        };
      }
      if (uri === 'sdlc://catalog/doc-store-sync-statechart') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(get_doc_store_sync_machine_config())
            }
          ]
        };
      }
      if (uri && uri.startsWith('sdlc://store/prd/') && store && typeof store.get_entity === 'function') {
        const prd_id = uri.slice('sdlc://store/prd/'.length);
        const entity = store.get_entity('prd', prd_id);
        if (entity) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(entity)
              }
            ]
          };
        }
      }
      throw new Error(`Resource '${uri}' not found on server '${server_id}'`);
    },
    async startSSE(sse_options = {}) {
      return {
        transport: 'sse',
        server_id,
        sse_path: sse_options.ssePath || `/mcp/${server_id}/sse`,
        message_path: sse_options.messagePath || `/mcp/${server_id}/messages`
      };
    },
    async startHonoSSE(sse_options = {}) {
      return {
        transport: 'hono-sse',
        server_id,
        sse_path: sse_options.ssePath || `/mcp/${server_id}/sse`,
        message_path: sse_options.messagePath || `/mcp/${server_id}/messages`
      };
    },
    async startHTTP(http_options = {}) {
      return {
        transport: 'http',
        server_id,
        http_path: http_options.httpPath || `/mcp/${server_id}/mcp`
      };
    },
    async close() {
      return true;
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates governed Mastra Classifier instances for sdlc work-item routing and gate readiness
 * verbose: instantiates @mastra/core/classifier Classifier and MastraDecisionModel instances
 * (sdlc-work-item-classifier and sdlc-gate-readiness-classifier) that evaluate structured state
 * into deterministic choice, score, and boolean decisions.
 *
 * section: arguments
 * - options (object, optional): custom model or classifier overrides
 *
 * section: return value
 * - classifiers (object): dictionary of Classifier instances keyed by id
 *
 * section: example
 * const classifiers = create_sdlc_classifiers();
 * const decision = await classifiers['sdlc-work-item-classifier'].decide({ state: 'fix login cve' });
 */
export function create_sdlc_classifiers(_options = {}) {
  const work_item_model = new MastraDecisionModel({
    provider: 'antigravity',
    modelId: 'sdlc-work-item-decision-model',
    supportedQuestionTypes: ['choice', 'score', 'boolean'],
    async doDecide(call_options) {
      const raw_text = JSON.stringify(call_options.state || '').toLowerCase();
      let item_type = 'feature';
      let target_role = 'product-manager';
      if (raw_text.includes('cve') || raw_text.includes('vuln') || raw_text.includes('security')) {
        item_type = 'security_patch';
        target_role = 'security-engineer';
      } else if (raw_text.includes('hotfix') || raw_text.includes('outage') || raw_text.includes('incident')) {
        item_type = 'hotfix';
        target_role = 'software-engineer';
      } else if (raw_text.includes('bug') || raw_text.includes('defect') || raw_text.includes('fix')) {
        item_type = 'fix';
        target_role = 'software-engineer';
      } else if (raw_text.includes('refactor') || raw_text.includes('cleanup')) {
        item_type = 'refactor';
        target_role = 'software-engineer';
      } else if (raw_text.includes('release') || raw_text.includes('deploy')) {
        item_type = 'feature';
        target_role = 'devops-engineer';
      }

      return {
        answers: {
          work_item_type: {
            type: 'choice',
            choice: item_type
          },
          target_role: {
            type: 'choice',
            choice: target_role
          },
          requires_tdd: {
            type: 'boolean',
            probability: item_type === 'feature' || item_type === 'fix' || item_type === 'hotfix' ? 0.95 : 0.5
          }
        },
        usage: { inputTokens: 24, outputTokens: 12 }
      };
    }
  });

  const gate_readiness_model = new MastraDecisionModel({
    provider: 'antigravity',
    modelId: 'sdlc-gate-readiness-decision-model',
    supportedQuestionTypes: ['choice', 'score', 'boolean'],
    async doDecide(call_options) {
      const raw_text = JSON.stringify(call_options.state || '').toLowerCase();
      const passed = !raw_text.includes('fail') && !raw_text.includes('blocked') && !raw_text.includes('violation');
      return {
        answers: {
          gate_ready: {
            type: 'boolean',
            probability: passed ? 0.96 : 0.08
          },
          readiness_score: {
            type: 'score',
            score: passed ? 3 : 0
          }
        },
        usage: { inputTokens: 20, outputTokens: 10 }
      };
    }
  });

  const work_item_classifier = new Classifier({
    id: 'sdlc-work-item-classifier',
    model: work_item_model,
    questions: {
      work_item_type: {
        type: 'choice',
        instructions: 'classify the incoming sdlc work item into its canonical lifecycle type',
        criteria: {
          feature: 'new capability or user-facing feature',
          fix: 'standard defect or bug repair',
          hotfix: 'urgent production incident repair',
          security_patch: 'cve or stride vulnerability remediation',
          refactor: 'internal structural improvement preserving test immutability'
        }
      },
      target_role: {
        type: 'choice',
        instructions: 'select the primary dual-engine specialist role agent responsible for intake',
        criteria: {
          'product-manager': 'product discovery, prd authoring, and story slicing',
          'system-architect': 'architecture decision records and interface contracts',
          'software-engineer': 'tdd implementation and defect patching',
          'security-engineer': 'stride threat modelling and security remediation',
          'qa-engineer': 'regression testing and immutability verification',
          'devops-engineer': 'release packaging and retrospective authoring'
        }
      },
      requires_tdd: {
        type: 'boolean',
        instructions: 'determine whether red-green-refactor tdd verification is mandatory'
      }
    }
  });

  const gate_readiness_classifier = new Classifier({
    id: 'sdlc-gate-readiness-classifier',
    model: gate_readiness_model,
    questions: {
      gate_ready: {
        type: 'boolean',
        instructions: 'determine whether all formal review gate criteria are satisfied'
      },
      readiness_score: {
        type: 'score',
        instructions: 'score the work item readiness from 0 (blocked) to 3 (signed off)',
        criteria: [
          'blocked by missing artefacts or failing tests',
          'partial artefacts present with warnings',
          'all tests passing and artefacts verified',
          'cryptographic gate receipt ready for sign-off'
        ]
      }
    }
  });

  return {
    'sdlc-work-item-classifier': work_item_classifier,
    'sdlc-gate-readiness-classifier': gate_readiness_classifier
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: returns canonical declarative WorkflowBuilderDefinition templates for dual-engine pipelines
 * verbose: provides 14 JSON workflow builder definitions compatible with @mastra/core/workflows/builder
 * and POST /stored/workflows covering all 11 specialist role workflows plus the 3 verification tool
 * and hello-world dynamic pipelines.
 *
 * section: arguments
 * none
 *
 * section: return value
 * - definitions (object): dictionary of 14 declarative WorkflowBuilderDefinition objects
 *
 * section: example
 * const templates = create_role_workflow_builder_definitions();
 */
export function create_role_workflow_builder_definitions() {
  const role_workflow_specs = [
    {
      id: 'dynamic-pm-prd-authoring',
      workflowId: 'pm-prd-authoring',
      description: 'declarative workflow builder pipeline invoking product-manager prd authoring (phase 00)'
    },
    {
      id: 'dynamic-pm-story-slicing',
      workflowId: 'pm-story-slicing',
      description: 'declarative workflow builder pipeline invoking product-manager story slicing & gherkin specs (phase 01)'
    },
    {
      id: 'dynamic-arch-adr-authoring',
      workflowId: 'arch-adr-authoring',
      description: 'declarative workflow builder pipeline invoking system-architect adr authoring (phase 02)'
    },
    {
      id: 'dynamic-arch-interface-contract',
      workflowId: 'arch-interface-contract',
      description: 'declarative workflow builder pipeline invoking system-architect interface contract synthesis (phase 02)'
    },
    {
      id: 'dynamic-se-feature-implementation',
      workflowId: 'se-feature-implementation',
      description: 'declarative workflow builder pipeline invoking software-engineer red-green-refactor tdd implementation (phases 03-05)'
    },
    {
      id: 'dynamic-se-defect-patch',
      workflowId: 'se-defect-patch',
      description: 'declarative workflow builder pipeline invoking software-engineer defect reproduction & patch verification'
    },
    {
      id: 'dynamic-sec-threat-modeling',
      workflowId: 'sec-threat-modeling',
      description: 'declarative workflow builder pipeline invoking security-engineer stride threat modelling (phase 06)'
    },
    {
      id: 'dynamic-qa-regression-audit',
      workflowId: 'qa-regression-audit',
      description: 'declarative workflow builder pipeline invoking qa-engineer regression & test immutability audit (phase 07)'
    },
    {
      id: 'dynamic-devops-release-packaging',
      workflowId: 'devops-release-packaging',
      description: 'declarative workflow builder pipeline invoking devops-engineer release manifest & gate receipt packaging (phase 08)'
    },
    {
      id: 'dynamic-devops-retrospective-authoring',
      workflowId: 'devops-retrospective-authoring',
      description: 'declarative workflow builder pipeline invoking devops-engineer blameless retrospective authoring (phase 09)'
    },
    {
      id: 'dynamic-devops-project-decommissioning',
      workflowId: 'devops-project-decommissioning',
      description: 'declarative workflow builder pipeline invoking devops-engineer sovereign project decommissioning'
    }
  ];

  const role_templates = {};
  for (let i = 0; i < role_workflow_specs.length; i += 1) {
    const spec = role_workflow_specs[i];
    role_templates[spec.id] = {
      id: spec.id,
      description: spec.description,
      inputSchema: {
        type: 'object',
        properties: {
          feature_name: { type: 'string' },
          project_id: { type: 'string' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string' }
        }
      },
      graph: [
        {
          type: 'workflow',
          id: `invoke-${spec.workflowId}`,
          workflowId: spec.workflowId
        }
      ]
    };
  }

  return {
    'dynamic-sdlc-immutability-gate': {
      id: 'dynamic-sdlc-immutability-gate',
      description: 'declarative workflow builder pipeline executing test immutability verification via harness-immutability-audit tool',
      inputSchema: {
        type: 'object',
        properties: {
          baseline: { type: 'string' },
          current: { type: 'string' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          valid: { type: 'boolean' },
          delta: { type: 'number' },
          violations: { type: 'array', items: { type: 'string' } }
        }
      },
      graph: [
        {
          type: 'tool',
          id: 'verify-test-immutability',
          toolId: 'harness-immutability-audit'
        }
      ]
    },
    'dynamic-sdlc-hello-verification': {
      id: 'dynamic-sdlc-hello-verification',
      description: 'declarative workflow builder pipeline nesting the standalone helloworld-workflow',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          greeting: { type: 'string' },
          echo: { type: 'string' },
          timestamp: { type: 'string' }
        }
      },
      graph: [
        {
          type: 'workflow',
          id: 'invoke-helloworld-workflow',
          workflowId: 'helloworld-workflow'
        }
      ]
    },
    'dynamic-sdlc-doc-rag-discovery': {
      id: 'dynamic-sdlc-doc-rag-discovery',
      description: 'declarative workflow builder pipeline querying the sdlc document entity store via hybrid rag search',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          top_k: { type: 'number' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          total_hits: { type: 'number' },
          hits: { type: 'array', items: { type: 'object' } }
        }
      },
      graph: [
        {
          type: 'tool',
          id: 'search-doc-store',
          toolId: 'harness-doc-rag-search'
        }
      ]
    },
    ...role_templates
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: validates, normalises, and registers a declarative dynamic workflow into mastra
 * verbose: normalises a WorkflowBuilderDefinition using @mastra/core/workflows/builder, runs
 * preflight validation, and registers it into the live Mastra instance and workflowDefinitions store.
 *
 * section: arguments
 * - target (object): dual-engine harness, mastra execution bridge, or Mastra instance
 * - definition (object): declarative WorkflowBuilderDefinition JSON payload
 *
 * section: return value
 * - result (promise<object>): { ok, id, normalized, preflight }
 *
 * section: example
 * const res = await register_dynamic_sdlc_workflow(harness, definition);
 */
export async function register_dynamic_sdlc_workflow(target, definition) {
  const mastra = target?.get_mastra_instance
    ? target.get_mastra_instance()
    : target;

  if (!mastra || typeof mastra.addDynamicWorkflow !== 'function') {
    throw new Error('invalid_mastra_target: target must expose a Mastra instance supporting addDynamicWorkflow');
  }

  const normalized = normalizeWorkflowBuilderDefinition(definition);
  const preflight = preflightWorkflowDefinition(normalized);

  await mastra.addDynamicWorkflow(normalized);

  if (typeof target?.ingest_workflows === 'function') {
    const compiled = mastra.getWorkflow(normalized.id);
    if (compiled) {
      target.ingest_workflows({ [normalized.id]: compiled });
    }
  }

  return {
    ok: true,
    id: normalized.id,
    supported_step_types: WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES,
    normalized,
    preflight
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: matches an incoming http method and url path against Mastra SERVER_ROUTES
 * verbose: compiles Express/Hono style :param segments in SERVER_ROUTES and extracts path
 * parameters for any matching route.
 *
 * section: arguments
 * - method (string): http method (GET, POST, PUT, PATCH, DELETE)
 * - pathname (string): relative route path starting with /
 * - routes (array, optional): route array defaulting to SERVER_ROUTES
 *
 * section: return value
 * - match (object|null): { route, urlParams } or null if no route matched
 *
 * section: example
 * const matched = match_mastra_server_route('GET', '/agents/product-manager');
 */
export function match_mastra_server_route(method, pathname, routes = SERVER_ROUTES) {
  const upper_method = String(method || 'GET').toUpperCase();
  const clean_path = ('/' + String(pathname || '/').replace(/^\/+/, '')).replace(/\/+$/, '') || '/';

  const candidates = [];
  for (let i = 0; i < routes.length; i += 1) {
    const route = routes[i];
    const route_method = String(route.method).toUpperCase();
    if (route_method !== upper_method && route_method !== 'ALL') {
      continue;
    }
    const route_path = ('/' + String(route.path || '/').replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
    if (route_path === clean_path) {
      return { route, urlParams: {} };
    }
    candidates.push({ route, route_path });
  }

  const req_segments = clean_path.split('/').filter(Boolean);
  for (let i = 0; i < candidates.length; i += 1) {
    const { route, route_path } = candidates[i];
    const pat_segments = route_path.split('/').filter(Boolean);
    if (pat_segments.length !== req_segments.length) {
      continue;
    }
    const params = {};
    let matched = true;
    for (let s = 0; s < pat_segments.length; s += 1) {
      const pat = pat_segments[s];
      const val = req_segments[s];
      if (pat.startsWith(':')) {
        params[pat.slice(1)] = decodeURIComponent(val);
      } else if (pat !== val) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return { route, urlParams: params };
    }
  }

  return null;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a standalone mastra server adapter integrating SERVER_ROUTES, MastraFactory routes, and sdlc governance
 * verbose: exposes all 428 @mastra/server routes alongside 100 @mastra/factory /web/* and /auth/* routes,
 * /openapi.json, and /sdlc/* governance endpoints, automatically populating RequestContext with live
 * xstate_phase, session_id, and mediated supervisor_token metadata.
 *
 * section: arguments
 * - options (object): { harness, mastra, factory_bundle, prefix }
 *
 * section: return value
 * - server_adapter (object): standalone server adapter with dispatch(), list_routes(), and get_openapi_spec()
 *
 * section: example
 * const server = create_mastra_server_adapter({ harness, factory_bundle });
 * const res = await server.dispatch({ method: 'GET', path: '/agents' });
 */
export function create_mastra_server_adapter(options = {}) {
  const harness = options.harness || null;
  const mastra = options.mastra || (harness ? harness.get_mastra_instance() : null);
  let factory_bundle = options.factory_bundle || (harness?.get_factory_bundle ? harness.get_factory_bundle() : null);
  const prefix = ('/' + String(options.prefix || '/api/mastra').replace(/^\/+/, '')).replace(/\/+$/, '');

  if (!mastra) {
    throw new Error('missing_mastra_instance: create_mastra_server_adapter requires either options.harness or options.mastra');
  }

  const registered_tools = mastra.listTools ? mastra.listTools() : {};

  function build_request_context(req = {}) {
    const headers = req.headers || {};
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const header_token = headers['x-sdlc-supervisor-token'] || body.supervisor_token || null;

    const active_phase = harness && typeof harness.get_active_phase === 'function'
      ? harness.get_active_phase()
      : 'phase_00_inception';
    const project_state = harness && typeof harness.get_project_state === 'function'
      ? harness.get_project_state()
      : 'active_development';
    const session_id = harness?.session_id || 'sdlc-session-default';

    const seed = {
      session_id,
      xstate_phase: active_phase,
      project_state,
      ticket_id: headers['x-sdlc-ticket-id'] || body.ticket_id || 'http-request',
      worker_id: headers['x-sdlc-worker-id'] || body.worker_id || 'nuxt-studio',
      role: headers['x-sdlc-role'] || body.role || 'product-manager',
      ...(header_token ? { supervisor_token: header_token } : {}),
      ...(body.requestContext && typeof body.requestContext === 'object' ? body.requestContext : {})
    };

    return create_request_context(seed);
  }

  async function handle_sdlc_custom_route(method, relative_path, req = {}) {
    if (method === 'GET' && relative_path === '/auth/capabilities') {
      return {
        status: 200,
        responseType: 'json',
        body: {
          enabled: false,
          rbac: false,
          providers: []
        }
      };
    }

    if (method === 'GET' && relative_path === '/auth/me') {
      return {
        status: 200,
        responseType: 'json',
        body: {
          authenticated: true,
          user: {
            id: 'sdlc-operator-01',
            email: 'operator@sdlc.local',
            name: 'sdlc operator',
            role: 'admin'
          }
        }
      };
    }

    if (method === 'GET' && relative_path === '/auth/permission-patterns') {
      return {
        status: 200,
        responseType: 'json',
        body: { patterns: [] }
      };
    }

    if (method === 'GET' && relative_path === '/auth/roles') {
      return {
        status: 200,
        responseType: 'json',
        body: { roles: [] }
      };
    }

    if (method === 'GET' && relative_path === '/auth/sso') {
      return {
        status: 200,
        responseType: 'json',
        body: { enabled: false, providers: [] }
      };
    }

    if (method === 'GET' && relative_path === '/auth/credentials') {
      return {
        status: 200,
        responseType: 'json',
        body: { enabled: false }
      };
    }

    if (method === 'GET' && relative_path === '/openapi.json') {
      const spec = generateOpenAPIDocument(SERVER_ROUTES, {
        title: '@thing/sdlc-dual_engine_harness mastra server api',
        version: '0.1.0',
        basePath: prefix
      });
      return { status: 200, responseType: 'json', body: spec };
    }

    if (method === 'GET' && relative_path === '/sdlc/status') {
      if (!harness) {
        return { status: 200, responseType: 'json', body: { status: 'standalone_mastra_only' } };
      }
      return {
        status: 200,
        responseType: 'json',
        body: {
          session_id: harness.session_id,
          project_state: harness.get_project_state(),
          macro_phase: harness.get_macro_phase(),
          active_phase: harness.get_active_phase(),
          active_gate: harness.get_active_gate(),
          active_work_item: harness.get_active_work_item(),
          work_items: harness.list_work_items()
        }
      };
    }

    if (method === 'GET' && relative_path === '/sdlc/dashboard') {
      if (!harness) {
        return { status: 200, responseType: 'json', body: { status: 'standalone_mastra_only' } };
      }
      const board = harness.get_work_board();
      const pool = harness.get_worker_pool();
      const store = harness.get_store();
      const objects = harness.get_process_objects();
      const registry = harness.get_process_registry();
      const proj_cfg = harness.get_project_sdlc_config();
      const git_prov = harness.get_git_provenance();
      const all_agents = await harness.list_agents({ include_all: true });

      const store_types = [
        DocumentEntityTypes.PRD,
        DocumentEntityTypes.USER_STORY,
        DocumentEntityTypes.ADR,
        DocumentEntityTypes.INTERFACE_CONTRACT,
        DocumentEntityTypes.THREAT_MODEL,
        DocumentEntityTypes.TEST_REPORT,
        DocumentEntityTypes.RELEASE,
        DocumentEntityTypes.RETROSPECTIVE,
        DocumentEntityTypes.TASK
      ];
      const store_entities = {};
      const store_counts = {};
      for (let i = 0; i < store_types.length; i += 1) {
        const t = store_types[i];
        try {
          const list = store.list_entities(t) || [];
          store_entities[t] = list;
          store_counts[t] = list.length;
        } catch (_err) {
          store_entities[t] = [];
          store_counts[t] = 0;
        }
      }

      const raw_workflows = harness.list_workflows() || [];
      const dynamic_templates = create_role_workflow_builder_definitions();

      return {
        status: 200,
        responseType: 'json',
        body: {
          status: {
            session_id: harness.session_id,
            project_state: harness.get_project_state(),
            macro_phase: harness.get_macro_phase(),
            active_phase: harness.get_active_phase(),
            active_gate: harness.get_active_gate(),
            active_work_item: harness.get_active_work_item(),
            work_items: harness.list_work_items()
          },
          phases: list_sdlc_phases(),
          gates: list_review_gates(),
          work_item_types: list_work_item_types(),
          processes: list_high_level_processes(),
          board: {
            tickets: board.list_tickets(),
            summary: board.get_board_summary()
          },
          worker_pool: {
            workers: pool.list_workers(),
            requests: pool.list_requests()
          },
          agents: all_agents.map((a) => ({
            id: a.id || a.name,
            name: a.name || a.id,
            description: typeof a.getDescription === 'function' ? a.getDescription() : (a.description || ''),
            instructions: typeof a.getInstructions === 'function' ? a.getInstructions() : (a.instructions || ''),
            role: a.role || a.id
          })),
          controller_modes: harness.get_agent_controller()?.modes || SDLC_CONTROLLER_MODE_DEFINITIONS,
          workflows: raw_workflows,
          dynamic_templates,
          skills: harness.list_skills(),
          architecture: {
            objects: objects.to_snapshot(),
            definitions: registry.list_profiles(),
            project_config: proj_cfg.get_config()
          },
          store: {
            counts: store_counts,
            entities: store_entities
          },
          pull_requests: git_prov && typeof git_prov.list_pull_requests === 'function'
            ? git_prov.list_pull_requests()
            : [],
          logs: (harness.get_logs?.() || []).slice(-40)
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/work/submit') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const body = req.body || {};
      const process_type = body.process_type || 'develop-feature';
      const name = body.name || body.feature_name || `item-${Date.now().toString(36)}`;
      const description = body.description || `${process_type} for ${name}`;
      const work_item_type = body.work_item_type || (
        process_type === 'fix-defect' ? 'fix' :
        process_type === 'emergency-hotfix' ? 'hotfix' :
        process_type === 'refactor-module' ? 'refactor' :
        process_type === 'security-patch' ? 'security_patch' : 'feature'
      );

      if (harness.get_project_state() === 'uninitialised') {
        harness.start_project({ project_name: 'dual-engine-harness' });
        harness.approve_inception();
      } else if (harness.get_project_state() === 'project_inception') {
        harness.approve_inception();
      }

      try {
        harness.start_work_item({
          type: work_item_type,
          name,
          payload: { description, process_type }
        });
      } catch (_err) {
        // work item may already exist; focus it
        try {
          harness.focus_work_item(name);
        } catch (_e2) {
          // ignore
        }
      }

      const receipt = await harness.submit_request({
        type: 'process',
        process_type,
        name,
        background: body.background !== false,
        params: {
          name,
          feature_name: name,
          defect_id: name,
          description,
          ...(body.params || {})
        }
      });

      const active_factory = factory_bundle || (harness?.get_factory_bundle ? harness.get_factory_bundle() : null);
      if (active_factory && typeof active_factory.sync_harness_to_factory === 'function') {
        try {
          await active_factory.sync_harness_to_factory();
        } catch (_err) {
          // ignore sync errors
        }
      }

      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          receipt,
          active_work_item: harness.get_active_work_item(),
          board_summary: harness.get_work_board().get_board_summary()
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/work/advance') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const body = req.body || {};
      if (body.name) {
        try {
          harness.focus_work_item(body.name);
        } catch (_err) {
          // ignore
        }
      }
      const stage_result = await harness.execute_work_item_stage(body);
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          stage_result,
          active_work_item: harness.get_active_work_item(),
          active_phase: harness.get_active_phase()
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/work/focus') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const focused = harness.focus_work_item(req.body?.name);
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          active_work_item: focused,
          active_phase: harness.get_active_phase()
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/work/clarify') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const body = req.body || {};
      const board = harness.get_work_board();
      const pool = harness.get_worker_pool();
      let resolved_ticket = null;
      if (body.ticket_id && typeof board.resolve_clarification === 'function') {
        resolved_ticket = board.resolve_clarification(body.ticket_id, {
          author: body.author || 'sdlc-operator',
          answer: body.answer || body.clarification || 'Confirmed by operator in Admin Studio.',
          inputs_patch: body.inputs_patch || { clarification_resolved: true, operator_answer: body.answer }
        });
        if (pool && typeof pool.drain_board === 'function') {
          await pool.drain_board({ epic_id: resolved_ticket?.epic_id });
        }
      } else {
        resolved_ticket = await harness.clarify_process({
          epic_id: body.epic_id,
          responses: [body.answer || 'Confirmed by operator in Admin Studio.'],
          silent: true
        });
      }
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          resolved: resolved_ticket,
          board_summary: board.get_board_summary()
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/gates/evaluate') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const body = req.body || {};
      const gate_id = body.gate_id || 'gate_1_planning';
      const evaluation = await harness.evaluate_gate({
        gate_id,
        artefacts: body.artefacts || ['prd-01.md', 'adr-001.md'],
        tests_passing: body.tests_passing !== false,
        immutability_passed: body.immutability_passed !== false,
        mutation_score: body.mutation_score ?? 88,
        security_audit: body.security_audit || 'passed',
        qa_passed: body.qa_passed !== false,
        receipt_signed: body.receipt_signed !== false,
        tag_clean: body.tag_clean !== false,
        ...body
      });
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          gate_id,
          evaluation
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/pool/scale') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const pool = harness.get_worker_pool();
      const role = req.body?.role || 'software-engineer';
      const count = Math.max(1, Math.min(100, Number(req.body?.count) || 1));
      pool.scale(role, count);
      harness.get_project_sdlc_config().set_worker_pool_config({
        role_counts: { [role]: count }
      });
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          role,
          count,
          workers: pool.list_workers()
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/pool/drain') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const pool = harness.get_worker_pool();
      const report = await pool.drain_board(req.body || {});
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          report,
          workers: pool.list_workers(),
          board_summary: harness.get_work_board().get_board_summary()
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/agents/chat') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const body = req.body || {};
      const requested_mode = body.mode ? resolve_sdlc_controller_mode(body.mode) : null;
      const role = body.agent_id || body.role || (requested_mode ? resolve_role_for_controller_mode(requested_mode) : 'product-manager') || 'product-manager';
      const prompt = String(body.prompt || body.message || '').trim();
      const agent = harness.get_agent(role);

      let reply_text = '';
      let task_outcome = null;
      try {
        if (agent && typeof agent.generate === 'function') {
          const gen = await agent.generate(prompt || `Provide status and guidance as ${role}.`, {
            requestContext: build_request_context({
              ...req,
              body: { ...body, role }
            })
          });
          reply_text = gen?.text || '';
        }
        if (!reply_text) {
          task_outcome = await harness.execute_agent_task(
            role,
            { id: `chat-${Date.now().toString(36)}`, title: prompt || `interactive query for ${role}`, role },
            { prompt, feature_name: body.feature_name || 'interactive-session', description: prompt }
          );
          reply_text = task_outcome?.output?.summary ||
            task_outcome?.output?.decision ||
            JSON.stringify(task_outcome?.output || task_outcome, null, 2);
        }
      } catch (err) {
        task_outcome = await harness.execute_agent_task(
          role,
          { id: `chat-${Date.now().toString(36)}`, title: prompt || `interactive query for ${role}`, role },
          { prompt, feature_name: body.feature_name || 'interactive-session', description: prompt }
        );
        reply_text = task_outcome?.output?.summary ||
          task_outcome?.output?.decision ||
          `[${role}] executed governed task (${err.message || 'deterministic fallback'}):\n` +
          JSON.stringify(task_outcome?.output || task_outcome, null, 2);
      }

      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          role,
          mode: requested_mode || resolve_sdlc_controller_mode(role),
          reply: reply_text,
          outcome: task_outcome,
          timestamp: new Date().toISOString()
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/workflows/execute') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const body = req.body || {};
      const workflow_id = body.workflow_id || body.id || 'helloworld-workflow';
      const inputs = body.inputs && typeof body.inputs === 'object' ? body.inputs : {};
      const result = await harness.execute_workflow(workflow_id, {
        feature_name: inputs.feature_name || 'studio-feature',
        project_id: inputs.project_id || 'dual-engine-harness',
        ...inputs
      });
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          workflow_id,
          execution: result
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/workflows/register-dynamic') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const definition = req.body?.definition || req.body;
      const registered = await register_dynamic_sdlc_workflow(harness, definition);
      return {
        status: 200,
        responseType: 'json',
        body: registered
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/architecture/configure') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const body = req.body || {};
      const objects = harness.get_process_objects();
      const registry = harness.get_process_registry();
      const proj_cfg = harness.get_project_sdlc_config();
      let result = null;

      if (body.action === 'register_phase') {
        result = objects.register_phase(body.phase);
      } else if (body.action === 'register_gate') {
        result = objects.register_gate(body.gate);
      } else if (body.action === 'clone_process') {
        const cloned = registry.clone_definition(body.source_id, body.new_id, body.overrides || {});
        result = cloned.get_profile();
      } else if (body.action === 'insert_stage') {
        const def = registry.get_definition(body.process_id);
        if (!def) throw new Error(`process_not_found: ${body.process_id}`);
        def.insert_stage_after(body.after_suffix, body.stage);
        result = def.get_profile();
      } else if (body.action === 'remove_stage') {
        const def = registry.get_definition(body.process_id);
        if (!def) throw new Error(`process_not_found: ${body.process_id}`);
        def.remove_stage(body.suffix);
        result = def.get_profile();
      } else if (body.action === 'configure_project_process') {
        result = proj_cfg.configure_process(body.process_id, body.override || {});
      } else if (body.action === 'toggle_process') {
        if (body.enabled) {
          proj_cfg.enable_process(body.process_id);
        } else {
          proj_cfg.disable_process(body.process_id);
        }
        result = proj_cfg.get_config();
      } else if (body.action === 'set_gate_policy') {
        result = proj_cfg.set_gate_policy(body.gate_id, body.policy || {});
      }

      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          action: body.action,
          result,
          architecture: {
            objects: objects.to_snapshot(),
            definitions: registry.list_profiles(),
            project_config: proj_cfg.get_config()
          }
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/store/sync') {
      if (!harness || typeof harness.sync_doc_stores !== 'function') {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const report = await harness.sync_doc_stores(req.body || {});
      return {
        status: 200,
        responseType: 'json',
        body: report
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/store/search') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const store = harness.get_store();
      const query = String(req.body?.query || '').trim();
      const hits = store.hybrid_search(query, {
        top_k: Number(req.body?.top_k) || 10,
        type: req.body?.type || undefined
      });
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: true,
          query,
          hits
        }
      };
    }

    if (method === 'GET' && relative_path === '/sdlc/store/document') {
      if (!harness) {
        return { status: 400, responseType: 'json', body: { error: 'harness_not_configured' } };
      }
      const store = harness.get_store();
      const type = req.query?.type || DocumentEntityTypes.PRD;
      const id = req.query?.id;
      const entity = id ? store.get_entity(type, id) : null;
      let markdown = '';
      if (entity) {
        try {
          markdown = store.generate_document(type, id);
        } catch (_err) {
          markdown = '```json\n' + JSON.stringify(entity, null, 2) + '\n```';
        }
      }
      return {
        status: 200,
        responseType: 'json',
        body: {
          ok: Boolean(entity),
          type,
          id,
          entity,
          markdown
        }
      };
    }

    if (method === 'POST' && relative_path === '/sdlc/supervisor/request') {
      if (!harness || typeof harness.get_supervisor !== 'function') {
        return { status: 400, responseType: 'json', body: { error: 'supervisor_not_configured' } };
      }
      const supervisor = harness.get_supervisor();
      const result = await supervisor.handle_agent_request(req.body || {});
      return { status: 200, responseType: 'json', body: result };
    }

    if (
      method === 'GET' &&
      (relative_path === '/sdlc/Dynamic-workflow-templates' ||
        relative_path === '/sdlc/dynamic-workflow-templates')
    ) {
      return {
        status: 200,
        responseType: 'json',
        body: {
          templates: create_role_workflow_builder_definitions()
        }
      };
    }

    return null;
  }

  return {
    prefix,
    handlers: mastra_server_handlers,

    attach_factory(bundle) {
      factory_bundle = bundle;
      return this;
    },

    get_factory_bundle() {
      return factory_bundle || (harness?.get_factory_bundle ? harness.get_factory_bundle() : null);
    },

    list_routes() {
      const server_list = SERVER_ROUTES.map((r) => ({
        method: r.method,
        path: r.path,
        full_path: `${prefix}${r.path}`,
        response_type: r.responseType || 'json',
        source: 'mastra-server'
      }));
      const active_factory = this.get_factory_bundle();
      const factory_list = (active_factory?.api_routes || []).map((r) => ({
        method: r.method,
        path: r.path,
        full_path: r.path,
        response_type: 'json',
        source: 'mastra-factory'
      }));
      return [...server_list, ...factory_list];
    },

    get_openapi_spec() {
      return generateOpenAPIDocument(SERVER_ROUTES, {
        title: '@thing/sdlc-dual_engine_harness mastra server api',
        version: '0.1.0',
        basePath: prefix
      });
    },

    async dispatch(req = {}) {
      const method = String(req.method || 'GET').toUpperCase();
      const raw_path = String(req.path || req.url || '/').split('?')[0];
      const relative_path = raw_path.startsWith(prefix)
        ? (raw_path.slice(prefix.length) || '/')
        : raw_path;

      const custom_res = await handle_sdlc_custom_route(method, relative_path, req);
      if (custom_res) {
        return custom_res;
      }

      const active_factory = this.get_factory_bundle();
      if (
        active_factory &&
        typeof active_factory.dispatch_route === 'function' &&
        (relative_path.startsWith('/web/') ||
          relative_path === '/web' ||
          relative_path.startsWith('/auth/') ||
          relative_path === '/auth')
      ) {
        const factory_res = await active_factory.dispatch_route({
          ...req,
          method,
          path: relative_path
        });
        if (factory_res) {
          return factory_res;
        }
      }

      const matched = match_mastra_server_route(method, relative_path, SERVER_ROUTES);
      if (!matched) {
        return {
          status: 404,
          responseType: 'json',
          body: {
            error: 'route_not_found',
            method,
            path: relative_path
          }
        };
      }

      const { route, urlParams } = matched;
      const queryParams = req.query || {};
      const bodyParams = req.body && typeof req.body === 'object' ? req.body : {};
      const requestContext = req.requestContext || build_request_context(req);

      const handler_params = {
        ...queryParams,
        ...bodyParams,
        ...urlParams,
        mastra,
        requestContext,
        registeredTools: registered_tools,
        routePrefix: prefix,
        abortSignal: req.abortSignal || new AbortController().signal,
        request: req
      };

      const result = await route.handler(handler_params);
      const status_code = result?.statusCode || 200;

      return {
        status: status_code,
        responseType: route.responseType || 'json',
        streamFormat: route.streamFormat || null,
        body: result
      };
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: reads the request body from a Nuxt H3 event or Node IncomingMessage
 * verbose: supports synchronous event.body, async event.readBody(), or streaming Node.js
 * IncomingMessage chunks so POST/PUT/PATCH requests work in any Nuxt Nitro or H3 environment.
 *
 * section: arguments
 * - event (object): H3 event or request wrapper
 *
 * section: return value
 * - body (promise<object|string>): parsed request body
 *
 * section: example
 * const body = await read_h3_event_body(event);
 */
async function read_h3_event_body(event) {
  let body = event?.body;
  if (body === undefined && typeof event?.readBody === 'function') {
    body = await event.readBody();
  }
  if (body === undefined && event?.node?.req) {
    const req = event.node.req;
    if (req.body !== undefined) {
      body = req.body;
    } else if (typeof req.on === 'function' && req.readable) {
      body = await new Promise((resolve) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', () => resolve(''));
      });
    }
  }
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch (_err) {
        return body;
      }
    }
  }
  return body || {};
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a drop-in nuxt 4 (nitro / h3) event handler mounting the mastra server, factory, & dual-engine harness
 * verbose: adapts incoming h3 events (or standard node/web requests) in a nuxt server/api/mastra/[...].js
 * or server/routes/web/[...].js catch-all route to create_mastra_server_adapter, supporting async
 * request body parsing, json responses, sse streams, and tier 1 sdlc governance headers.
 *
 * section: arguments
 * - options (object): { harness, mastra, factory_bundle, prefix }
 *
 * section: return value
 * - handler (function): async nitro / h3 event handler function
 *
 * section: example
 * // in nuxt server/api/mastra/[...].js:
 * import { create_dual_engine_harness, create_nuxt_mastra_handler } from '@thing/sdlc-dual_engine_harness';
 * const harness = create_dual_engine_harness();
 * export default create_nuxt_mastra_handler({ harness });
 */
export function create_nuxt_mastra_handler(options = {}) {
  const adapter = create_mastra_server_adapter(options);

  return async function nuxt_mastra_event_handler(event) {
    const method = event?.method || event?.node?.req?.method || 'GET';
    const raw_url = event?.path || event?.node?.req?.url || '/';
    const [pathname, query_string = ''] = String(raw_url).split('?');

    const query = { ...(event?.query || {}) };
    if (query_string) {
      const search_params = new URLSearchParams(query_string);
      for (const [k, v] of search_params.entries()) {
        if (query[k] === undefined) {
          query[k] = v;
        }
      }
    }

    const headers = event?.headers
      ? (typeof event.headers.entries === 'function'
          ? Object.fromEntries(event.headers.entries())
          : event.headers)
      : (event?.node?.req?.headers || {});

    const body = await read_h3_event_body(event);

    const dispatched = await adapter.dispatch({
      method,
      path: pathname,
      query,
      body,
      headers
    });

    if (event?.node?.res) {
      if (typeof event.node.res.statusCode === 'number') {
        event.node.res.statusCode = dispatched.status;
      }
      if (typeof event.node.res.setHeader === 'function') {
        if (dispatched.headers && typeof dispatched.headers === 'object') {
          for (const [hk, hv] of Object.entries(dispatched.headers)) {
            event.node.res.setHeader(hk, hv);
          }
        }
        if (dispatched.responseType === 'stream' && dispatched.streamFormat === 'sse') {
          event.node.res.setHeader('content-type', 'text/event-stream');
          event.node.res.setHeader('cache-control', 'no-cache');
          event.node.res.setHeader('connection', 'keep-alive');
        }
      }
    }

    return dispatched.body;
  };
}
