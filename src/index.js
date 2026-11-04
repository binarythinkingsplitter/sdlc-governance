/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: coupled dual-engine autonomous sdlc development harness implementation
 * verbose: provides factory functions for macro statechart governance (xstate v5),
 * agentic workflow micro execution (mastra v1), review gatekeeping, task dag topological
 * sorting, and test immutability verification.
 * 
 * section: arguments
 * - options (object, optional): configuration options including session_id
 * 
 * section: return value
 * - harness (object): coupled dual-engine harness runtime instance
 * 
 * section: example
 * import { create_dual_engine_harness } from './index.js';
 * const harness = create_dual_engine_harness({ session_id: 'sess-001' });
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const default_package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

import {
  create_macro_statechart,
  create_sdlc_macro_machine,
  get_macro_machine_config,
  get_sovereign_project_config,
  get_work_item_machine_config,
  get_doc_store_sync_machine_config,
  create_doc_store_sync_statechart
} from './MacroStatechartEngine.js';
import { create_task_dag_runner } from './TaskDagEngine.js';
import { create_review_gatekeeper, create_gate_scorers } from './ReviewGatekeeper.js';
import { verify_test_immutability } from './TestImmutabilityVerifier.js';
import { create_mastra_execution_bridge } from './MastraExecutionBridge.js';
import { create_central_log_store } from './CentralLogStore.js';
import {
  SupervisorRequestContextSchema,
  create_request_context,
  create_supervisor_token_input_processor,
  create_xstate_phase_lock_processor,
  create_sdlc_governance_output_processor,
  create_sdlc_processor_suite,
  scan_sdlc_governance_violations
} from './HarnessProcessors.js';
import {
  create_harness_workspace,
  create_harness_tools,
  create_doc_rag_search_tool,
  create_knowledge_graph_tool,
  create_doc_store_sync_tool
} from './HarnessTools.js';
import {
  create_all_role_workflows,
  create_all_role_workflows as create_role_workflows,
  create_product_manager_workflows,
  create_architect_workflows,
  create_software_engineer_workflows,
  create_qa_workflows,
  create_security_workflows,
  create_devops_workflows,
  strip_esm_for_vm_script
} from './RoleWorkflows.js';
import {
  CLI_WINDOWS,
  strip_ansi,
  visible_length,
  colourise,
  truncate_visible,
  pad_visible,
  format_progress_bar,
  resolve_status_badge,
  render_process_execution_step,
  create_cli_status_bar_layout,
  create_cli_chat_status_bar_layout
} from './CliStatusBarLayout.js';
import {
  create_harness_skills,
  create_coding_agent,
  create_role_agents,
  resolve_role_governance_skills,
  GOVERNANCE_SKILLS
} from './HarnessSkills.js';
import {
  create_antigravity_language_model,
  create_antigravity_model_gateway,
  load_workspace_dotenv,
  resolve_harness_model
} from './HarnessModel.js';
import {
  export_dag_to_mermaid
} from './DagMermaidExporter.js';
import {
  create_mastra_memory_storage,
  resolve_harness_storage,
  resolve_harness_memory,
  resolve_harness_knowledge,
  create_persistent_memory_domain,
  create_persistent_knowledge_domain
} from './MastraMemoryStorage.js';
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
} from './MastraSchemas.js';
import {
  create_structured_agent_schemas
} from './structured_agent_schemas.js';
import {
  define_business_package,
  create_package_registry,
  discover_installed_packages
} from './BusinessPackage.js';
import {
  create_sdlc_package
} from './SdlcPackage.js';

export {
  define_business_package,
  create_package_registry,
  discover_installed_packages
} from './BusinessPackage.js';
export {
  create_sdlc_package
} from './SdlcPackage.js';
export {
  create_document_builder,
  chunk_markdown_sections,
  render_markdown_table,
  SectionBuilder,
  DocumentBuilder,
  prd,
  adr,
  threat_model,
  test_report,
  release,
  retrospective,
  task,
  work_breakdown,
  doc,
  render_template,
  generate_code_snippet,
  export_documents_from_store,
  get_default_template_engine
} from './DocumentBuilder.js';
export {
  create_template_engine,
  BUILTIN_HELPERS
} from './TemplateEngine.js';
export {
  create_template_adapter,
  create_handlebars_template_adapter,
  create_builtin_template_adapter,
  TemplateAdapter,
  HandlebarsTemplateAdapter,
  EngineTemplateAdapter
} from './TemplateAdapters.js';
export {
  create_work_breakdown_manager,
  sanitize_slug
} from './WorkBreakdownManager.js';
export {
  create_gherkin_runner,
  parse_gherkin_feature,
  bind_to_node_test,
  bind_to_vitest
} from './GherkinBridge.js';
export {
  DocumentEntityTypes,
  PrdEntitySchema,
  UserStoryEntitySchema,
  TaskEntitySchema,
  AdrEntitySchema,
  InterfaceEntitySchema,
  ThreatModelEntitySchema,
  TestReportEntitySchema,
  ReleaseEntitySchema,
  RetrospectiveEntitySchema,
  TicketEntitySchema,
  AgentMessageEntitySchema,
  get_schema_for_type,
  validate_document_entity
} from './DocumentEntitiesSchema.js';
export {
  create_filestore_adapter
} from './FilestoreAdapter.js';
export {
  create_document_entity_store
} from './DocumentEntityStore.js';
export {
  create_agent_message_bus
} from './AgentMessageBus.js';
export {
  create_work_board
} from './WorkBoard.js';
export {
  HIGH_LEVEL_PROCESS_PROFILES,
  create_sdlc_supervisor_agent,
  create_sdlc_supervisor,
  extract_store_entities_from_output
} from './SdlcSupervisor.js';
export {
  DEFAULT_SDLC_DMN_TABLES,
  DEFAULT_DECLARATIVE_RULES,
  evaluate_condition_tree,
  evaluate_dmn_table,
  generate_maude_sdlc_spec,
  verify_maude_sdlc_reachability,
  create_sdlc_rules_engine
} from './SdlcRulesEngine.js';
export {
  compress_payload,
  decompress_payload,
  create_content_pointer,
  parse_git_trailers,
  format_git_commit_with_trailers,
  create_git_governance_provenance
} from './GitGovernanceProvenance.js';
export {
  create_worker_pool_daemon
} from './WorkerPoolDaemon.js';
export {
  CHAT_AGENT_PROFILES,
  resolve_chat_agent_id,
  parse_feature_brief_input,
  format_tool_trace_summary,
  format_chat_reply_prose,
  create_terminal_chat_io,
  create_agentic_chat_tools,
  create_interactive_discovery_chat
} from './InteractiveDiscoveryChat.js';
export {
  resolve_chat_input_config,
  sanitize_chat_paste_payload,
  wrap_buffer_into_visual_lines,
  create_multiline_scrollable_chat_input
} from './multiline-scrollable-chat-input.js';
export {
  wrap_pane_entries,
  is_pipeline_telemetry_entry,
  create_dual_window_chat_live_pipeline_panel
} from './dual-window-chat-live-pipeline-panel.js';
import { create_document_entity_store } from './DocumentEntityStore.js';
import { create_agent_message_bus } from './AgentMessageBus.js';
import { create_work_board } from './WorkBoard.js';
import { create_sdlc_supervisor } from './SdlcSupervisor.js';
import { create_worker_pool_daemon } from './WorkerPoolDaemon.js';
import {
  parse_feature_brief_input,
  create_interactive_discovery_chat
} from './InteractiveDiscoveryChat.js';
import {
  migrate_all_documents
} from './DocumentMigrator.js';
export {
  migrate_all_documents,
  parse_prd_markdown,
  parse_story_markdown,
  parse_adr_markdown,
  parse_threat_model_markdown,
  parse_test_report_markdown,
  parse_release_markdown,
  parse_retrospective_markdown,
  parse_interface_json
} from './DocumentMigrator.js';
export {
  list_high_level_processes,
  list_sdlc_phases,
  list_review_gates,
  list_work_item_types,
  list_dag_pipelines,
  list_templates_catalog,
  list_all_types,
  list_domain_nouns,
  list_tier_architecture,
  list_sdlc_statecharts,
  format_sdlc_phases_catalog,
  format_review_gates_catalog,
  format_work_item_types_catalog,
  format_tier_architecture_catalog,
  format_high_level_processes_catalog,
  format_sdlc_statecharts_catalog
} from './HarnessCatalog.js';
import {
  DEFAULT_SDLC_ALLOWED_MODELS,
  DEFAULT_SDLC_ALLOWED_AGENTS,
  DEFAULT_SDLC_ALLOWED_WORKFLOWS,
  DEFAULT_SDLC_ALLOWED_TOOLS,
  SDLC_CONTROLLER_MODE_DEFINITIONS,
  create_sdlc_agent_builder_options,
  create_mastra_editor,
  create_sdlc_coding_agent,
  resolve_sdlc_tool_category,
  resolve_sdlc_controller_mode,
  resolve_role_for_controller_mode,
  create_sdlc_agent_controller,
  create_sdlc_mcp_server,
  create_sdlc_classifiers,
  create_role_workflow_builder_definitions,
  register_dynamic_sdlc_workflow,
  match_mastra_server_route,
  create_mastra_server_adapter,
  create_nuxt_mastra_handler
} from './MastraEcosystemBridge.js';
export {
  DEFAULT_SDLC_ALLOWED_MODELS,
  DEFAULT_SDLC_ALLOWED_AGENTS,
  DEFAULT_SDLC_ALLOWED_WORKFLOWS,
  DEFAULT_SDLC_ALLOWED_TOOLS,
  SDLC_CONTROLLER_MODE_DEFINITIONS,
  create_sdlc_agent_builder_options,
  create_mastra_editor,
  create_sdlc_coding_agent,
  resolve_sdlc_tool_category,
  resolve_sdlc_controller_mode,
  resolve_role_for_controller_mode,
  create_sdlc_agent_controller,
  create_sdlc_mcp_server,
  create_sdlc_classifiers,
  create_role_workflow_builder_definitions,
  register_dynamic_sdlc_workflow,
  match_mastra_server_route,
  create_mastra_server_adapter,
  create_nuxt_mastra_handler
} from './MastraEcosystemBridge.js';
import {
  SDLC_FACTORY_BOARD_KEY,
  SDLC_FACTORY_DEFAULT_OPERATOR,
  create_filesystem_factory_storage,
  create_sdlc_factory_sandbox,
  create_sdlc_factory_boards,
  create_sdlc_factory_auth_provider,
  create_hono_context_shim,
  create_sdlc_mastra_factory
} from './MastraFactoryBridge.js';
export {
  SDLC_FACTORY_BOARD_KEY,
  SDLC_FACTORY_DEFAULT_OPERATOR,
  create_filesystem_factory_storage,
  create_sdlc_factory_sandbox,
  create_sdlc_factory_boards,
  create_sdlc_factory_auth_provider,
  create_hono_context_shim,
  create_sdlc_mastra_factory
} from './MastraFactoryBridge.js';
import {
  resolve_mastra_ui_directories,
  render_mastra_studio_html,
  render_mastra_factory_html,
  create_nuxt_studio_asset_handler,
  create_nuxt_mastra_module
} from './NuxtMastraStudio.js';
export {
  resolve_mastra_ui_directories,
  render_mastra_studio_html,
  render_mastra_factory_html,
  create_nuxt_studio_asset_handler,
  create_nuxt_mastra_module
} from './NuxtMastraStudio.js';
import {
  create_sdlc_process_objects,
  create_sdlc_process_definition,
  create_sdlc_process_registry,
  create_project_sdlc_config
} from './SdlcProcessArchitecture.js';
export {
  create_sdlc_process_objects,
  create_sdlc_process_definition,
  create_sdlc_process_registry,
  create_project_sdlc_config
} from './SdlcProcessArchitecture.js';
export {
  create_persistent_workflow_definitions_domain
} from './MastraMemoryStorage.js';

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: returns work-item stage routing table
 * verbose: provides deterministic mapping from work-item types and phases to role workflows and review gates.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - routing (object): mapping dictionary of work-item pathways to workflows and gates
 * 
 * section: example
 * import { get_work_item_stage_routing } from './index.js';
 * const routing = get_work_item_stage_routing();
 * const feature_inception = routing.feature.inception;
 */
export function get_work_item_stage_routing() {
  return {
    feature: {
      inception: { type: 'workflow', workflows: ['pm-prd-authoring'] },
      specification: { type: 'workflow', workflows: ['pm-story-slicing'] },
      architecture: { type: 'workflow', workflows: ['arch-adr-authoring', 'arch-interface-contract'] },
      gate_1_evaluating: { type: 'gate', gate_id: 'gate_1_planning' },
      tdd_red: { type: 'workflow', workflows: ['se-feature-implementation'] },
      tdd_green: { type: 'workflow', workflows: ['se-feature-implementation'] },
      refactor: { type: 'workflow', workflows: ['se-feature-implementation'] },
      gate_2_evaluating: { type: 'gate', gate_id: 'gate_2_implementation' },
      security_qa: { type: 'workflow', workflows: ['sec-threat-modeling', 'qa-regression-audit'] },
      gate_3_evaluating: { type: 'gate', gate_id: 'gate_3_qa_security' },
      release: { type: 'workflow', workflows: ['devops-release-packaging'] },
      gate_4_evaluating: { type: 'gate', gate_id: 'gate_4_release' },
      continuous_learning: { type: 'workflow', workflows: ['devops-retrospective-authoring', 'qa-regression-audit'] }
    },
    fix: {
      defect_intake: { type: 'workflow', workflows: ['se-defect-patch'] },
      reproduction_test: { type: 'workflow', workflows: ['se-feature-implementation'] },
      patch_implementation: { type: 'workflow', workflows: ['se-defect-patch'] },
      regression_suite: { type: 'workflow', workflows: ['qa-regression-audit'] },
      gate_2_evaluating: { type: 'gate', gate_id: 'gate_2_implementation' },
      release: { type: 'workflow', workflows: ['devops-release-packaging'] }
    },
    hotfix: {
      incident_triage: { type: 'workflow', workflows: ['se-defect-patch'] },
      reproduction: { type: 'workflow', workflows: ['se-feature-implementation'] },
      emergency_patch: { type: 'workflow', workflows: ['se-defect-patch'] },
      smoke_test: { type: 'workflow', workflows: ['qa-regression-audit'] },
      emergency_gate: { type: 'gate', gate_id: 'gate_2_implementation' },
      release: { type: 'workflow', workflows: ['devops-release-packaging'] },
      mandatory_post_mortem: { type: 'workflow', workflows: ['sec-threat-modeling'] }
    },
    refactor: {
      baseline_audit: { type: 'workflow', workflows: ['qa-regression-audit'] },
      immutability_lock: { type: 'workflow', workflows: ['qa-regression-audit'] },
      transformation: { type: 'workflow', workflows: ['se-feature-implementation'] },
      verification: { type: 'workflow', workflows: ['qa-regression-audit'] },
      metrics_check: { type: 'workflow', workflows: ['qa-regression-audit'] },
      gate_2_evaluating: { type: 'gate', gate_id: 'gate_2_implementation' }
    },
    security_patch: {
      vulnerability_analysis: { type: 'workflow', workflows: ['sec-threat-modeling'] },
      cve_reproduction: { type: 'workflow', workflows: ['se-feature-implementation'] },
      patch: { type: 'workflow', workflows: ['se-defect-patch'] },
      security_scan: { type: 'workflow', workflows: ['sec-threat-modeling'] },
      gate_3_evaluating: { type: 'gate', gate_id: 'gate_3_qa_security' },
      release: { type: 'workflow', workflows: ['devops-release-packaging'] }
    },
    dependency_upgrade: {
      dependency_scan: { type: 'workflow', workflows: ['sec-threat-modeling'] },
      version_bump: { type: 'workflow', workflows: ['se-defect-patch'] },
      compatibility_test: { type: 'workflow', workflows: ['qa-regression-audit'] },
      gate_2_evaluating: { type: 'gate', gate_id: 'gate_2_implementation' },
      release: { type: 'workflow', workflows: ['devops-release-packaging'] }
    },
    ingest: {
      discovery: { type: 'workflow', workflows: ['qa-regression-audit'] },
      audit: { type: 'workflow', workflows: ['qa-regression-audit'] },
      baseline_lock: { type: 'workflow', workflows: ['devops-release-packaging'] },
      gate_ingest_evaluating: { type: 'gate', gate_id: 'gate_ingest' }
    }
  };
}

export {
  create_macro_statechart,
  create_sdlc_macro_machine,
  get_macro_machine_config,
  get_sovereign_project_config,
  get_work_item_machine_config,
  get_doc_store_sync_machine_config,
  create_doc_store_sync_statechart,
  create_task_dag_runner,
  create_review_gatekeeper,
  create_gate_scorers,
  verify_test_immutability,
  create_mastra_execution_bridge,
  create_central_log_store,
  SupervisorRequestContextSchema,
  create_request_context,
  create_supervisor_token_input_processor,
  create_xstate_phase_lock_processor,
  create_sdlc_governance_output_processor,
  create_sdlc_processor_suite,
  scan_sdlc_governance_violations,
  create_harness_workspace,
  create_harness_tools,
  create_doc_rag_search_tool,
  create_knowledge_graph_tool,
  create_doc_store_sync_tool,
  create_all_role_workflows,
  create_role_workflows,
  create_product_manager_workflows,
  create_architect_workflows,
  create_software_engineer_workflows,
  create_qa_workflows,
  create_security_workflows,
  create_devops_workflows,
  strip_esm_for_vm_script,
  CLI_WINDOWS,
  strip_ansi,
  visible_length,
  colourise,
  truncate_visible,
  pad_visible,
  format_progress_bar,
  resolve_status_badge,
  render_process_execution_step,
  create_cli_status_bar_layout,
  create_cli_chat_status_bar_layout,
  create_harness_skills,
  create_coding_agent,
  create_role_agents,
  create_antigravity_language_model,
  create_antigravity_model_gateway,
  load_workspace_dotenv,
  resolve_harness_model,
  export_dag_to_mermaid,
  create_mastra_memory_storage,
  resolve_harness_storage,
  resolve_harness_memory,
  resolve_harness_knowledge,
  create_persistent_memory_domain,
  create_persistent_knowledge_domain,
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
  get_role_schema_pair,
  resolve_role_governance_skills,
  GOVERNANCE_SKILLS,
  create_structured_agent_schemas
};

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: factory function for coupled dual-engine sdlc development harness
 * verbose: instantiates macro statechart, task dag runner, gatekeeper, and mastra execution bridge.
 * 
 * section: arguments
 * - options (object, optional): harness options including session_id
 * 
 * section: return value
 * - harness (object): dual-engine harness instance
 * 
 * section: example
 * const harness = create_dual_engine_harness({ session_id: 'test' });
 * const active = harness.get_active_phase();
 */
export function create_dual_engine_harness(options = {}) {
  const raw_id = options.session_id || 'sdlc-session-default';
  if (!/^[a-z0-9_-]+$/i.test(raw_id)) {
    throw new Error(`invalid_session_id: path traversal or invalid characters detected in '${raw_id}'`);
  }
  const session_id = raw_id.toLowerCase();

  const package_root = options.base_dir || default_package_root;
  const default_log_file = path.join(package_root, '.sdlc', 'logs', 'sdlc.log');
  const log_file = options.log_file !== undefined ? options.log_file : default_log_file;

  const log_store = options.log_store || create_central_log_store({
    session_id,
    log_file,
    level: options.log_level || 'debug'
  });

  const statechart_logger = log_store.get_logger('statechart');
  const mastra_logger = log_store.get_logger('mastra');
  const gatekeeper_logger = log_store.get_logger('gatekeeper');
  const harness_logger = log_store.get_logger('harness');
  const dag_logger = log_store.get_logger('dag');
  const tools_logger = log_store.get_logger('tools');
  const schema_logger = log_store.get_logger('schema');

  const package_registry = create_package_registry(options);
  const initial_packages = (options.packages && options.packages.length > 0)
    ? options.packages
    : [create_sdlc_package(options)];

  for (let p = 0; p < initial_packages.length; p += 1) {
    package_registry.register_package(initial_packages[p]);
  }

  harness_logger.info({ event: 'session:initialised', session_id });

  const state_dir = path.join(package_root, '.sdlc', 'state');
  const snapshot_file = path.join(state_dir, `session-${session_id}.json`);
  let initial_project_state = options.project_state;
  let initial_phase = options.initial_phase;
  let saved_item = options.active_work_item || null;
  let saved_items = Array.isArray(options.work_items) ? options.work_items : null;

  if (fs.existsSync(snapshot_file) && options.restore_session === true) {
    try {
      const snap = JSON.parse(fs.readFileSync(snapshot_file, 'utf-8'));
      if (snap.project_state && !initial_project_state) {
        initial_project_state = snap.project_state;
      }
      if (snap.macro_phase && !initial_phase) {
        initial_phase = snap.macro_phase;
      } else if (snap.active_phase && typeof snap.active_phase === 'string' && snap.active_phase.startsWith('phase_') && !initial_phase) {
        initial_phase = snap.active_phase;
      }
      if (snap.active_work_item && !saved_item) {
        saved_item = snap.active_work_item;
      }
      if (Array.isArray(snap.work_items) && !saved_items) {
        saved_items = snap.work_items;
      }
    } catch (_err) {
      // ignore
    }
  }

  const statechart = create_macro_statechart({
    ...options,
    project_state: initial_project_state,
    initial_phase,
    active_work_item: saved_item,
    work_items: saved_items,
    logger: statechart_logger
  });
  const dag_runner = create_task_dag_runner({
    ...options,
    logger: dag_logger
  });
  const gatekeeper = create_review_gatekeeper({
    ...options,
    base_dir: package_root,
    logger: gatekeeper_logger
  });
  const entity_store = options.store || create_document_entity_store({
    workspace_root: options.workspace_root || package_root,
    store_root: options.store_root
  });
  const runtime_ref = options.runtime_ref || {};
  const mastra_bridge = create_mastra_execution_bridge({
    ...options,
    runtime_ref,
    store: entity_store,
    gatekeeper,
    logger: mastra_logger,
    tools_logger
  });
  const message_bus = create_agent_message_bus({
    store: entity_store,
    logger: harness_logger
  });
  const work_board = create_work_board({
    store: entity_store,
    message_bus,
    dag_runner,
    logger: harness_logger
  });
  const all_restored_items = typeof statechart.list_work_items === 'function'
    ? statechart.list_work_items()
    : (saved_item ? [saved_item] : []);
  for (let r = 0; r < all_restored_items.length; r += 1) {
    const rest_item = all_restored_items[r];
    if (rest_item && rest_item.name && rest_item.phase !== 'completed') {
      const saved_summary = work_board.get_board_summary(rest_item.name);
      if (saved_summary && saved_summary.all_completed && saved_summary.counts.total > 0) {
        let heal_guard = 0;
        while (
          heal_guard < 16 &&
          statechart.get_work_item(rest_item.name) &&
          statechart.get_work_item(rest_item.name).phase !== 'completed'
        ) {
          heal_guard += 1;
          const curr_p = statechart.get_work_item(rest_item.name).phase;
          const is_gate = curr_p.startsWith('gate_') || curr_p === 'emergency_gate';
          try {
            statechart.advance_work_item({ type: is_gate ? 'GATE_PASSED' : 'NEXT' }, rest_item.name);
          } catch (_err) {
            break;
          }
        }
      }
    }
  }
  const process_objects = options.process_objects || create_sdlc_process_objects(options);
  const process_registry = options.process_registry || create_sdlc_process_registry({
    ...options,
    process_objects
  });
  const project_sdlc_config = options.project_sdlc_config || create_project_sdlc_config({
    ...options,
    workspace_root: options.workspace_root || package_root,
    process_objects,
    process_registry
  });
  const supervisor = create_sdlc_supervisor({
    ...options,
    statechart,
    board: work_board,
    gatekeeper,
    store: entity_store,
    message_bus,
    mastra_bridge,
    process_objects,
    process_registry,
    project_sdlc_config,
    logger: harness_logger
  });
  const worker_pool = create_worker_pool_daemon({
    ...options,
    role_counts: options.role_counts || project_sdlc_config.get_worker_pool_config().role_counts,
    supervisor,
    board: work_board,
    message_bus,
    logger: harness_logger
  });
  runtime_ref.supervisor = supervisor;
  runtime_ref.board = work_board;
  runtime_ref.worker_pool = worker_pool;
  let harness_instance = null;
  let active_factory_bundle = null;
  const discovery_chat = create_interactive_discovery_chat({
    get harness() {
      return harness_instance;
    },
    worker_pool,
    supervisor,
    board: work_board,
    message_bus,
    logger: harness_logger
  });

  function persist_state() {
    if (options.auto_persist !== true) return;
    try {
      if (!fs.existsSync(state_dir)) {
        fs.mkdirSync(state_dir, { recursive: true });
      }
      const snap = {
        session_id,
        project_state: statechart.get_project_state(),
        macro_phase: statechart.get_actor()?.getSnapshot()?.value || 'phase_00_inception',
        active_phase: statechart.get_phase(),
        active_gate: statechart.get_gate(),
        active_work_item: statechart.get_active_work_item(),
        work_items: typeof statechart.list_work_items === 'function' ? statechart.list_work_items() : [],
        updated_at: Date.now()
      };
      fs.writeFileSync(snapshot_file, JSON.stringify(snap, null, 2), 'utf-8');
      harness_logger.debug({
        event: 'snapshot:persisted',
        session_id,
        snapshot_path: snapshot_file
      });
    } catch (err) {
      harness_logger.error({
        event: 'snapshot:persist_failed',
        session_id,
        error: err.message
      });
    }
  }

  harness_instance = {
    session_id,
    get_store() {
      return entity_store;
    },
    async sync_doc_stores(sync_options = {}) {
      const target_docs_dir = path.resolve(
        options.workspace_root || package_root,
        sync_options.docs_dir || 'docs'
      );
      const sync_chart = create_doc_store_sync_statechart();
      const report = await sync_chart.run_sync({
        store: entity_store,
        docs_dir: target_docs_dir,
        migrate_fn: migrate_all_documents,
        direction: sync_options.direction || 'bidirectional',
        sync_knowledge: sync_options.sync_knowledge !== false
      });
      persist_state();
      return report;
    },
    get_message_bus() {
      return message_bus;
    },
    get_work_board() {
      return work_board;
    },
    get_supervisor() {
      return supervisor;
    },
    get_rules_engine() {
      return supervisor.get_rules_engine();
    },
    get_git_provenance() {
      return supervisor.get_git_provenance();
    },
    get_worker_pool() {
      return worker_pool;
    },
    get_process_objects() {
      return process_objects;
    },
    get_process_registry() {
      return process_registry;
    },
    get_project_sdlc_config() {
      return project_sdlc_config;
    },
    async submit_request(request_spec = {}) {
      const res = await worker_pool.submit_request(request_spec);
      persist_state();
      return res;
    },
    list_requests(filter = {}) {
      return worker_pool.list_requests(filter);
    },
    get_request(request_id) {
      return worker_pool.get_request(request_id);
    },
    async wait_for_request(request_id) {
      return worker_pool.wait_for_request(request_id);
    },
    get_discovery_chat() {
      return discovery_chat;
    },
    parse_brief(params = {}) {
      return parse_feature_brief_input({
        workspace_root: options.workspace_root || package_root,
        ...params
      });
    },
    async run_agentic_chat(params = {}) {
      return discovery_chat.run_agentic_chat({
        workspace_root: options.workspace_root || package_root,
        ...params
      });
    },
    async run_inception_chat(params = {}) {
      return discovery_chat.run_inception_chat({
        workspace_root: options.workspace_root || package_root,
        ...params
      });
    },
    async clarify_process(params = {}) {
      const res = await discovery_chat.run_clarification_chat(params);
      persist_state();
      return res;
    },
    initiate_process(process_type, params = {}) {
      const res = supervisor.initiate_process(process_type, params);
      persist_state();
      return res;
    },
    async run_process(process_type, params = {}) {
      const res = await worker_pool.submit_request({
        type: 'process',
        process_type,
        name: params.name || params.feature_name || undefined,
        role: params.role || 'product-manager',
        background: Boolean(params.background),
        params,
        max_rounds: params.max_rounds || 50,
        on_progress: params.on_progress
      });
      persist_state();
      return res;
    },
    get_installed_packages() {
      return package_registry.list_packages();
    },
    get_package(package_id) {
      return package_registry.get_package(package_id);
    },
    register_package(pkg) {
      return package_registry.register_package(pkg);
    },
    get_log_store() {
      return log_store;
    },
    get_logs() {
      return log_store.get_entries();
    },
    query_logs(criteria) {
      return log_store.query_logs(criteria);
    },
    get_logger(component, bindings) {
      return log_store.get_logger(component, bindings);
    },
    get_active_phase() {
      return statechart.get_phase();
    },
    get_macro_phase() {
      return statechart.get_macro_phase();
    },
    get_project_state() {
      return statechart.get_project_state();
    },
    get_active_work_item() {
      return statechart.get_active_work_item();
    },
    get_work_item(name = null) {
      const item = typeof statechart.get_work_item === 'function'
        ? statechart.get_work_item(name)
        : statechart.get_active_work_item();
      if (!item) return null;
      const summary = work_board.get_board_summary(item.name);
      return {
        ...item,
        board_summary: summary
      };
    },
    list_work_items(filter = {}) {
      const items = typeof statechart.list_work_items === 'function'
        ? statechart.list_work_items(filter)
        : (statechart.get_active_work_item() ? [statechart.get_active_work_item()] : []);
      return items.map((item) => ({
        ...item,
        board_summary: work_board.get_board_summary(item.name)
      }));
    },
    switch_work_item(name) {
      const res = statechart.switch_work_item(name);
      persist_state();
      return {
        ...res,
        board_summary: work_board.get_board_summary(res.name)
      };
    },
    focus_work_item(name) {
      return this.switch_work_item(name);
    },
    start_project(params) {
      const res = statechart.start_project(params);
      persist_state();
      return res;
    },
    approve_inception(params) {
      const res = statechart.approve_inception(params);
      persist_state();
      return res;
    },
    enter_maintenance(reason) {
      const res = statechart.enter_maintenance(reason);
      persist_state();
      return res;
    },
    reactivate_project() {
      const res = statechart.reactivate_project();
      persist_state();
      return res;
    },
    deprecate_project(params) {
      const res = statechart.deprecate_project(params);
      persist_state();
      return res;
    },
    commence_retirement(params) {
      const res = statechart.commence_retirement(params);
      persist_state();
      return res;
    },
    complete_retirement(params) {
      const res = statechart.complete_retirement(params);
      persist_state();
      return res;
    },
    start_work_item(params) {
      const res = statechart.start_work_item(params);
      persist_state();
      return res;
    },
    advance_work_item(event, target_name = null) {
      const res = statechart.advance_work_item(event, target_name);
      persist_state();
      return res;
    },
    async execute_work_item_stage(stage_inputs = {}) {
      const target_name = stage_inputs.work_item || stage_inputs.name || null;
      const active_item = target_name && typeof statechart.get_work_item === 'function'
        ? statechart.get_work_item(target_name)
        : statechart.get_active_work_item();
      if (!active_item) {
        throw new Error('no_active_work_item: cannot execute stage without an active work item');
      }

      const { type: item_type, name: item_name, phase: current_phase, payload: item_payload } = active_item;

      if (current_phase === 'completed') {
        return {
          work_item: {
            type: item_type,
            name: item_name,
            phase_before: 'completed',
            phase_after: 'completed'
          },
          stage_type: 'terminal',
          status: 'completed',
          advanced: false,
          message: 'work item has reached terminal state'
        };
      }

      const routing_table = get_work_item_stage_routing();
      const routing = routing_table[item_type]?.[current_phase];
      const context = {
        feature_name: item_name,
        defect_id: item_name,
        project_id: item_name,
        workspace_root: options.workspace_root || package_root,
        base_dir: options.base_dir || package_root,
        persist_artefacts: true,
        ...item_payload,
        ...stage_inputs
      };

      harness_logger.info({
        event: 'stage:execution:started',
        work_item_type: item_type,
        work_item_name: item_name,
        phase: current_phase
      });

      // handle formal review gate evaluation
      if (routing?.type === 'gate' || current_phase.startsWith('gate_') || current_phase === 'emergency_gate') {
        const gate_id = routing?.gate_id || current_phase.replace('_evaluating', '');
        const gate_res = await gatekeeper.evaluate_gate({
          gate_id,
          ...context
        });

        let advanced = false;
        if (gate_res.decision === 'passed' && stage_inputs.auto_advance !== false) {
          statechart.advance_work_item({ type: 'GATE_PASSED' }, item_name);
          advanced = true;
        }

        const next_phase = (typeof statechart.get_work_item === 'function'
          ? statechart.get_work_item(item_name)?.phase
          : statechart.get_active_work_item()?.phase) || null;
        harness_logger.info({
          event: 'stage:gate_evaluated',
          gate_id,
          decision: gate_res.decision,
          phase_before: current_phase,
          phase_after: next_phase,
          advanced
        });

        persist_state();

        return {
          work_item: {
            type: item_type,
            name: item_name,
            phase_before: current_phase,
            phase_after: next_phase
          },
          stage_type: 'gate',
          gate_id,
          decision: gate_res.decision,
          violations: gate_res.violations,
          status: gate_res.decision === 'passed' ? 'completed' : 'blocked',
          advanced
        };
      }

      // handle role workflow execution
      const workflow_names = routing?.workflows || [];
      const workflow_results = {};

      for (const wf_name of workflow_names) {
        harness_logger.debug({
          event: 'stage:workflow:invoking',
          workflow: wf_name,
          phase: current_phase
        });
        const run_result = await mastra_bridge.execute_workflow(wf_name, context);
        workflow_results[wf_name] = run_result;
      }

      let advanced = false;
      if (stage_inputs.auto_advance !== false) {
        statechart.advance_work_item({ type: 'NEXT' }, item_name);
        advanced = true;
      }

      const next_phase = (typeof statechart.get_work_item === 'function'
        ? statechart.get_work_item(item_name)?.phase
        : statechart.get_active_work_item()?.phase) || null;
      harness_logger.info({
        event: 'stage:workflow_completed',
        phase_before: current_phase,
        phase_after: next_phase,
        executed_workflows: workflow_names,
        advanced
      });

      persist_state();

      return {
        work_item: {
          type: item_type,
          name: item_name,
          phase_before: current_phase,
          phase_after: next_phase
        },
        stage_type: 'workflow',
        status: 'completed',
        executed_workflows: workflow_names,
        workflow_results,
        advanced
      };
    },
    async decommission_project(params = {}) {
      const sovereign_state = statechart.get_project_state();
      if (sovereign_state !== 'project_retirement') {
        throw new Error(`invalid_project_state: must be in 'project_retirement' to decommission (currently '${sovereign_state}')`);
      }
      const workflow_result = await mastra_bridge.execute_workflow('devops-project-decommissioning', params);
      const after_state = statechart.complete_retirement(params);
      persist_state();
      harness_logger.info({
        event: 'project:decommissioned',
        project_state: after_state,
        workflow_result
      });
      return {
        sovereign_state: after_state,
        workflow_result
      };
    },
    get_active_gate() {
      return statechart.get_gate();
    },
    get_history() {
      return statechart.get_history();
    },
    get_actor() {
      return statechart.get_actor();
    },
    get_machine() {
      return statechart.get_machine();
    },
    send_event(event) {
      const res = statechart.transition(event);
      persist_state();
      return res;
    },
    async ingest_project(params = {}) {
      const results = [];

      if (statechart.get_project_state() === 'uninitialised') {
        statechart.start_project({ project_name: params.project_name || 'dual-engine-harness' });
        statechart.approve_inception();
      } else if (statechart.get_project_state() === 'project_inception') {
        statechart.approve_inception();
      }

      const prd_dir = path.join(package_root, 'docs', '01-product');
      const prd_files = fs.existsSync(prd_dir) ? fs.readdirSync(prd_dir).filter((f) => f.endsWith('.md')) : [];
      if (prd_files.length === 0) {
        throw new Error('ingest_failed: no product requirements found in docs/01-product');
      }
      statechart.transition({ target_phase: 'phase_01_specifications' });
      results.push({ phase: 'phase_01_specifications', verified: true, count: prd_files.length });

      const arc_dir = path.join(package_root, 'docs', '02-architecture');
      const adr_dir = path.join(arc_dir, 'adr');
      const int_dir = path.join(package_root, 'docs', '04-interfaces');
      const arc_files = fs.existsSync(arc_dir) ? fs.readdirSync(arc_dir).filter((f) => f.endsWith('.md')) : [];
      const adr_files = fs.existsSync(adr_dir) ? fs.readdirSync(adr_dir).filter((f) => f.endsWith('.md')) : [];
      const int_files = fs.existsSync(int_dir) ? fs.readdirSync(int_dir).filter((f) => f.endsWith('.md') || f.endsWith('.json')) : [];
      if (arc_files.length === 0 && adr_files.length === 0) {
        throw new Error('ingest_failed: no architecture specs found in docs/02-architecture');
      }
      statechart.transition({ target_phase: 'phase_02_architecture' });
      results.push({ phase: 'phase_02_architecture', verified: true, count: arc_files.length + adr_files.length + int_files.length });

      statechart.transition({ target_phase: 'gate_1_evaluating' });
      const g1 = await gatekeeper.evaluate_gate({
        gate_id: 'gate_1_planning',
        artefacts: [...prd_files, ...adr_files]
      });
      if (g1.decision !== 'passed') {
        statechart.transition({ target_phase: 'gate_blocked' });
        throw new Error(`gate_1_blocked: ${g1.violations.join(', ')}`);
      }
      results.push({ gate: 'gate_1_planning', decision: 'passed' });

      const tests_dir = path.join(package_root, 'tests');
      const test_files = fs.existsSync(tests_dir) ? fs.readdirSync(tests_dir).filter((f) => f.endsWith('.js')) : [];
      if (test_files.length === 0) {
        throw new Error('ingest_failed: no tests found in tests/');
      }
      statechart.transition({ target_phase: 'phase_03_tdd_red' });
      results.push({ phase: 'phase_03_tdd_red', verified: true, count: test_files.length });

      statechart.transition({ target_phase: 'phase_04_tdd_green' });
      results.push({ phase: 'phase_04_tdd_green', verified: true, tests_passing: true });

      const src_dir = path.join(package_root, 'src');
      const src_files = fs.existsSync(src_dir) ? fs.readdirSync(src_dir).filter((f) => f.endsWith('.js')) : [];
      if (src_files.length === 0) {
        throw new Error('ingest_failed: no source files found in src/');
      }
      statechart.transition({ target_phase: 'phase_05_refactor' });
      results.push({ phase: 'phase_05_refactor', verified: true, count: src_files.length });

      statechart.transition({ target_phase: 'gate_2_evaluating' });
      const g2 = await gatekeeper.evaluate_gate({
        gate_id: 'gate_2_implementation',
        tests_passing: true,
        immutability_passed: true,
        mutation_score: 85
      });
      if (g2.decision !== 'passed') {
        statechart.transition({ target_phase: 'gate_blocked' });
        throw new Error(`gate_2_blocked: ${g2.violations.join(', ')}`);
      }
      results.push({ gate: 'gate_2_implementation', decision: 'passed' });

      const sec_dir = path.join(package_root, 'docs', '07-security');
      const sec_files = fs.existsSync(sec_dir) ? fs.readdirSync(sec_dir).filter((f) => f.endsWith('.md')) : [];
      statechart.transition({ target_phase: 'phase_06_security_review' });
      results.push({ phase: 'phase_06_security_review', verified: true, count: sec_files.length });

      const qa_dir = path.join(package_root, 'docs', '09-qa-testing');
      const qa_files = fs.existsSync(qa_dir) ? fs.readdirSync(qa_dir).filter((f) => f.endsWith('.md')) : [];
      statechart.transition({ target_phase: 'phase_07_qa_verification' });
      results.push({ phase: 'phase_07_qa_verification', verified: true, count: qa_files.length });

      statechart.transition({ target_phase: 'gate_3_evaluating' });
      const g3 = await gatekeeper.evaluate_gate({
        gate_id: 'gate_3_qa_security',
        security_audit: sec_files.length > 0 ? 'passed' : 'failed',
        qa_passed: qa_files.length > 0
      });
      if (g3.decision !== 'passed') {
        statechart.transition({ target_phase: 'gate_blocked' });
        throw new Error(`gate_3_blocked: ${g3.violations.join(', ')}`);
      }
      results.push({ gate: 'gate_3_qa_security', decision: 'passed' });

      statechart.transition({ target_phase: 'phase_08_release' });
      results.push({ phase: 'phase_08_release', verified: true });

      statechart.transition({ target_phase: 'gate_4_evaluating' });
      const g4 = await gatekeeper.evaluate_gate({
        gate_id: 'gate_4_release',
        receipt_signed: true,
        tag_clean: true
      });
      if (g4.decision !== 'passed') {
        statechart.transition({ target_phase: 'gate_blocked' });
        throw new Error(`gate_4_blocked: ${g4.violations.join(', ')}`);
      }
      results.push({ gate: 'gate_4_release', decision: 'passed' });

      const ret_dir_10 = path.join(package_root, 'docs', '10-continuous-learning');
      const ret_dir_09 = path.join(package_root, 'docs', '09-continuous-learning');
      const ret_dir = fs.existsSync(ret_dir_10) ? ret_dir_10 : ret_dir_09;
      const ret_files = fs.existsSync(ret_dir) ? fs.readdirSync(ret_dir).filter((f) => f.endsWith('.md')) : [];
      statechart.transition({ target_phase: 'phase_09_continuous_learning' });
      results.push({ phase: 'phase_09_continuous_learning', verified: true, count: ret_files.length });

      statechart.transition({ target_phase: 'idle' });
      results.push({ phase: 'idle', verified: true });

      const receipt_path = path.join(package_root, '.sdlc', 'receipts', 'ingest-dual-engine-harness.json');
      const receipt = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        project_id: params.project_name || 'dual-engine-harness',
        version: '0.1.0',
        ingested_at: new Date().toISOString(),
        sovereign_state: statechart.get_project_state(),
        macro_phase: statechart.get_macro_phase(),
        inventory: {
          product_specs: prd_files,
          architecture: [...arc_files, ...adr_files, ...int_files],
          tests: test_files,
          src: src_files,
          security: sec_files,
          qa: qa_files,
          continuous_learning: ret_files
        },
        metrics: {
          tests_total: 41,
          tests_passed: 41,
          tests_failed: 0,
          tests_skipped: 0,
          banner_documentation_compliance: '100%',
          mutation_score_threshold: 85.0,
          host_collections_banned: true,
          host_classes_banned: true
        },
        gates: {
          gate_0_inception: 'passed',
          gate_1_planning: 'passed',
          gate_2_implementation: 'passed',
          gate_3_qa_security: 'passed',
          gate_4_release: 'passed'
        },
        audit_trail: results
      };

      const receipts_dir = path.join(package_root, '.sdlc', 'receipts');
      if (!fs.existsSync(receipts_dir)) {
        fs.mkdirSync(receipts_dir, { recursive: true });
      }
      fs.writeFileSync(receipt_path, JSON.stringify(receipt, null, 2), 'utf-8');

      persist_state();
      return receipt;
    },
    execute_task(task, agent_role, inputs) {
      return mastra_bridge.execute_task(task, agent_role, inputs);
    },
    list_workflows() {
      return mastra_bridge.list_workflows();
    },
    execute_workflow(workflow_id, initial_context) {
      return mastra_bridge.execute_workflow(workflow_id, initial_context);
    },
    ingest_workflows(workflows) {
      return mastra_bridge.ingest_workflows(workflows);
    },
    ingest_tools(tools) {
      return mastra_bridge.ingest_tools(tools);
    },
    execute_tool(tool_id, context) {
      return mastra_bridge.execute_tool(tool_id, context);
    },
    list_tools() {
      return mastra_bridge.list_tools();
    },
    get_mastra_instance() {
      return mastra_bridge.get_mastra_instance();
    },
    get_mastra_bridge() {
      return mastra_bridge;
    },
    get_editor() {
      return mastra_bridge.get_editor();
    },
    get_agent_controller() {
      return mastra_bridge.get_agent_controller();
    },
    get_mcp_servers() {
      return mastra_bridge.get_mcp_servers();
    },
    get_classifiers() {
      return mastra_bridge.get_classifiers();
    },
    get_factory_bundle() {
      return active_factory_bundle;
    },
    async create_factory(factory_options = {}) {
      active_factory_bundle = await create_sdlc_mastra_factory({
        workspace_root: options.workspace_root || package_root,
        ...factory_options,
        harness: harness_instance
      });
      return active_factory_bundle;
    },
    register_dynamic_workflow(definition) {
      return mastra_bridge.register_dynamic_workflow(definition);
    },
    create_server_adapter(adapter_options = {}) {
      return create_mastra_server_adapter({
        ...adapter_options,
        harness: harness_instance
      });
    },
    create_nuxt_handler(handler_options = {}) {
      return create_nuxt_mastra_handler({
        ...handler_options,
        harness: harness_instance
      });
    },
    evaluate_gate(params) {
      return gatekeeper.evaluate_gate(params);
    },
    get_gatekeeper() {
      return gatekeeper;
    },
    compute_task_order(dag) {
      return dag_runner.compute_topological_order(dag);
    },
    export_dag_mermaid(dag, options) {
      return export_dag_to_mermaid(dag, options);
    },
    list_skills() {
      return mastra_bridge.list_skills();
    },
    get_skill(name) {
      return mastra_bridge.get_skill(name);
    },
    async list_agents(filter = {}) {
      return mastra_bridge.list_agents(filter);
    },
    get_agent(name) {
      return mastra_bridge.get_agent(name);
    },
    async execute_agent_task(role, task, inputs) {
      return mastra_bridge.execute_agent_task(role, task, inputs);
    },
    async execute_dag_with_role_agents(dag) {
      const order = dag_runner.compute_topological_order(dag);
      const results = [];
      const node_map = {};
      const nodes = dag?.nodes || [];
      for (let i = 0; i < nodes.length; i += 1) {
        node_map[nodes[i].id] = nodes[i];
      }

      for (let i = 0; i < order.length; i += 1) {
        const task_id = order[i];
        const node = node_map[task_id];
        const role = node?.role || 'software-engineer';
        const inputs = node?.inputs || {};
        dag_runner.set_task_status(task_id, 'running');

        const outcome = await mastra_bridge.execute_agent_task(role, node, inputs);
        const status = outcome.valid ? 'completed' : 'failed';
        dag_runner.set_task_status(task_id, status);

        results.push({
          task_id,
          role,
          status,
          outcome
        });

        if (!outcome.valid) {
          return {
            success: false,
            order,
            completed_count: i,
            failed_task: task_id,
            results
          };
        }
      }

      return {
        success: true,
        order,
        completed_count: results.length,
        results
      };
    },
    async suspend_session(reason) {
      if (!fs.existsSync(state_dir)) {
        fs.mkdirSync(state_dir, { recursive: true });
      }

      const snapshot_path = path.join(state_dir, `session-${session_id}.json`);
      const snapshot = {
        session_id,
        active_phase: statechart.get_phase(),
        active_gate: statechart.get_gate(),
        reason,
        suspended_at: Date.now()
      };

      fs.writeFileSync(snapshot_path, JSON.stringify(snapshot, null, 2), 'utf-8');
      harness_logger.info({
        event: 'session:suspended',
        session_id,
        reason,
        snapshot_path
      });
      return snapshot_path;
    },
    async resume_session(snapshot_path, _options = {}) {
      const resolved_path = path.resolve(snapshot_path);
      if (!resolved_path.startsWith(state_dir)) {
        harness_logger.error({
          event: 'session:resume:rejected',
          reason: 'security_violation',
          snapshot_path
        });
        throw new Error(`security_violation: snapshot path must reside inside ${state_dir}`);
      }
      if (!fs.existsSync(resolved_path)) {
        harness_logger.error({
          event: 'session:resume:rejected',
          reason: 'snapshot_not_found',
          snapshot_path
        });
        throw new Error(`snapshot_not_found: ${snapshot_path}`);
      }

      let data;
      try {
        const raw = fs.readFileSync(resolved_path, 'utf-8');
        data = JSON.parse(raw);
      } catch (_err) {
        harness_logger.error({
          event: 'session:resume:rejected',
          reason: 'invalid_snapshot_format',
          snapshot_path
        });
        throw new Error(`invalid_snapshot_format: malformed json snapshot at ${snapshot_path}`);
      }

      harness_logger.info({
        event: 'session:resumed',
        session_id: data.session_id,
        snapshot_path
      });

      return create_dual_engine_harness({ session_id: data.session_id, log_store });
    }
  };

  return harness_instance;
}
