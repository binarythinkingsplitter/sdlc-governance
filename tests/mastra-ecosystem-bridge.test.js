/**
 * =========================================================================
 * module: mastra-ecosystem-bridge.test.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: integration test suite for standalone mastra ecosystem components and nuxt nitro bridge
 * verbose: verifies integration of @mastra/server (SERVER_ROUTES, handlers, openapi),
 * @mastra/core/editor (IMastraEditor & stored entities), @mastra/core/agent-builder/ee
 * (AgentBuilderOptions, BuilderModelPolicy, picker visibility), @mastra/core/workflows/builder
 * (WorkflowBuilderDefinition & dynamic workflows), @mastra/core/coding-agent (createCodingAgent),
 * and @mastra/core/agent-controller (AgentController & task tools) with the standalone
 * @sdlc/dual-engine-harness runtime and nuxt nitro handler factory.
 *
 * section: arguments
 * none
 *
 * section: return value
 * assertions executed by vitest runner
 *
 * section: example
 * npx vitest run tests/mastra-ecosystem-bridge.test.js
 * =========================================================================
 */

import { test, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  create_dual_engine_harness,
  create_coding_agent,
  create_sdlc_agent_builder_options,
  create_mastra_editor,
  create_sdlc_coding_agent,
  resolve_sdlc_tool_category,
  create_sdlc_agent_controller,
  create_sdlc_mcp_server,
  create_role_workflow_builder_definitions,
  register_dynamic_sdlc_workflow,
  match_mastra_server_route,
  create_mastra_server_adapter,
  create_nuxt_mastra_handler,
  create_sdlc_classifiers,
  SDLC_FACTORY_BOARD_KEY,
  create_filesystem_factory_storage,
  create_sdlc_factory_sandbox,
  create_sdlc_factory_boards,
  create_sdlc_mastra_factory,
  resolve_mastra_ui_directories,
  render_mastra_studio_html,
  render_mastra_factory_html,
  create_nuxt_studio_asset_handler,
  create_nuxt_mastra_module,
  create_sdlc_process_objects,
  create_sdlc_process_definition,
  create_sdlc_process_registry,
  create_project_sdlc_config
} from '../src/index.js';

const test_storage_dir = path.resolve('.sdlc', 'tmp', 'mastra-ecosystem-test');

test('mastra-ecosystem: promotes dual-engine harness primitives into Mastra instance', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-primitives',
    storage_dir: test_storage_dir
  });

  const mastra = harness.get_mastra_instance();
  const bridge = harness.get_mastra_bridge();

  // 1. workspace registered on Mastra
  const ws = mastra.getWorkspace();
  assert.ok(ws);
  assert.equal(ws.id, 'sdlc-harness-workspace');

  // 2. scorers registered on Mastra
  const scorers = mastra.listScorers();
  assert.ok(scorers);
  assert.ok(scorers.gate_1_planning);
  assert.ok(scorers.gate_2_implementation);
  assert.ok(scorers.gate_3_qa_security);
  assert.ok(scorers.gate_4_release);

  // 3. processors registered on Mastra
  const processors = mastra.listProcessors();
  assert.ok(processors);
  assert.ok(processors['supervisor-token-guard']);
  assert.ok(processors['xstate-phase-lock']);
  assert.ok(processors['sdlc-governance-output']);

  // 4. gateways registered on Mastra
  const gateways = mastra.listGateways();
  assert.ok(gateways);
  assert.ok(gateways.antigravity);

  // 5. memory registered on Mastra
  const memory_map = bridge.get_memory();
  assert.ok(memory_map['sdlc-memory']);

  // 6. default list_agents returns 6 specialist roles; include_all returns all 8 (including sdlc-supervisor & autonomous-engineer)
  const default_agents = await harness.list_agents();
  assert.equal(default_agents.length, 6);

  const all_agents = await harness.list_agents({ include_all: true });
  assert.equal(all_agents.length, 8);
  assert.ok(all_agents.some((a) => a.id === 'sdlc-supervisor'));
  assert.ok(all_agents.some((a) => a.id === 'autonomous-engineer'));
});

test('mastra-ecosystem: configures IMastraEditor, AgentBuilderOptions, and WorkflowBuilder', async () => {
  const builder_opts = create_sdlc_agent_builder_options({
    allowed_models: ['antigravity/*', 'google/gemini-2.5-pro']
  });
  assert.equal(builder_opts.enabled, true);
  assert.equal(builder_opts.features.agents, true);
  assert.equal(builder_opts.features.workflows, true);
  assert.equal(builder_opts.features.tools, true);
  assert.equal(builder_opts.model_policy.active, true);
  assert.ok(builder_opts.picker_visibility.visibleTools.includes('harness-test-runner'));
  assert.ok(builder_opts.picker_visibility.visibleAgents.includes('product-manager'));
  assert.ok(builder_opts.picker_visibility.visibleWorkflows.includes('pm-prd-authoring'));

  const editor = create_mastra_editor({
    storage_dir: test_storage_dir,
    builder_options: builder_opts
  });
  assert.equal(editor.hasEnabledBuilderConfig(), true);
  assert.equal(editor.hasEnabledWorkflowBuilderConfig(), true);

  const builder = await editor.resolveBuilder();
  assert.equal(builder.enabled, true);
  assert.equal(builder.isModelAllowed({ provider: 'antigravity', modelId: 'gemini-3.8-flash-medium' }), true);
  assert.equal(builder.isModelAllowed({ provider: 'blocked-vendor', modelId: 'unknown' }), false);

  const wf_builder = await editor.resolveWorkflowBuilder();
  assert.equal(wf_builder.enabled, true);
  const wf_agent = wf_builder.getAgent();
  assert.ok(wf_agent);
  assert.equal(wf_agent.id, 'sdlc-workflow-builder-agent');
});

test('mastra-ecosystem: creates governed coding agent and multi-mode AgentController', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-factories',
    storage_dir: test_storage_dir
  });

  // 1. createCodingAgent factory integration (built into HarnessSkills & MastraEcosystemBridge)
  const se_agent = harness.get_agent('software-engineer');
  const auto_agent = harness.get_agent('autonomous-engineer');
  assert.ok(se_agent);
  assert.ok(auto_agent);
  const se_ws = await se_agent.getWorkspace();
  const auto_ws = await auto_agent.getWorkspace();
  assert.equal(se_ws.id, 'sdlc-harness-workspace');
  assert.equal(auto_ws.id, 'sdlc-harness-workspace');

  const direct_coding_agent = create_coding_agent({
    id: 'sdlc-direct-coder',
    storage_dir: test_storage_dir
  });
  assert.equal(direct_coding_agent.id, 'sdlc-direct-coder');

  const coding_agent = create_sdlc_coding_agent({
    id: 'sdlc-standalone-coder',
    storage_dir: test_storage_dir
  });
  assert.equal(coding_agent.id, 'sdlc-standalone-coder');
  const agent_ws = await coding_agent.getWorkspace();
  assert.ok(agent_ws);
  assert.equal(agent_ws.id, 'sdlc-harness-workspace');

  // 2. AgentController factory integration with all 8 dual-engine roles, transitions, and tool category resolver
  assert.equal(resolve_sdlc_tool_category('harness-test-runner'), 'execute');
  assert.equal(resolve_sdlc_tool_category('harness-artefact-writer'), 'edit');
  assert.equal(resolve_sdlc_tool_category('harness-doc-rag-search'), 'read');

  const ctrl_bundle = create_sdlc_agent_controller({ harness });
  assert.ok(ctrl_bundle.controller);
  assert.equal(ctrl_bundle.modes.length, 8);
  assert.equal(ctrl_bundle.modes[0].id, 'discovery');
  assert.equal(ctrl_bundle.modes[0].default, true);
  assert.equal(ctrl_bundle.modes[0].transitionsTo, 'architecture');
  assert.equal(Object.keys(ctrl_bundle.subagents).length, 8);
  assert.ok(ctrl_bundle.interactive_tools.ask_user);
  assert.ok(ctrl_bundle.interactive_tools.submit_plan);
  assert.ok(ctrl_bundle.interactive_tools.task_write);
});

test('mastra-ecosystem: registers and executes declarative dynamic workflows composing dual-engine tools and workflows', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-dynamic-wf',
    storage_dir: test_storage_dir
  });

  const templates = create_role_workflow_builder_definitions();
  assert.ok(templates['dynamic-sdlc-immutability-gate']);
  assert.ok(templates['dynamic-sdlc-hello-verification']);

  // register and execute tool-based dynamic workflow
  const reg_tool_wf = await register_dynamic_sdlc_workflow(
    harness,
    templates['dynamic-sdlc-immutability-gate']
  );
  assert.equal(reg_tool_wf.ok, true);
  assert.equal(reg_tool_wf.id, 'dynamic-sdlc-immutability-gate');

  const immut_run = await harness.execute_workflow('dynamic-sdlc-immutability-gate', {
    baseline: 'assert.equal(1, 1);',
    current: 'assert.equal(1, 1); assert.equal(2, 2);'
  });
  assert.equal(immut_run.status, 'completed');
  assert.equal(immut_run.result.valid, true);
  assert.equal(immut_run.result.delta, 1);

  // register and execute nested-workflow dynamic workflow
  const reg_nested_wf = await harness.register_dynamic_workflow(
    templates['dynamic-sdlc-hello-verification']
  );
  assert.equal(reg_nested_wf.ok, true);

  const hello_run = await harness.execute_workflow('dynamic-sdlc-hello-verification', {
    message: 'hello-from-dynamic-builder'
  });
  assert.equal(hello_run.status, 'completed');
  assert.equal(hello_run.result.echo, 'hello-from-dynamic-builder');
});

test('mastra-ecosystem: dispatches @mastra/server routes and Nuxt H3 handler with Tier 1 governance context', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-nuxt-server',
    storage_dir: test_storage_dir
  });

  const adapter = harness.create_server_adapter({ prefix: '/api/mastra' });
  const routes = adapter.list_routes();
  assert.ok(routes.length >= 400);

  // 1. route matcher resolves parameterized routes
  const matched = match_mastra_server_route('GET', '/agents/product-manager');
  assert.ok(matched);
  assert.equal(matched.urlParams.agentId, 'product-manager');

  // 2. GET /agents returns all 8 registered dual-engine agents
  const agents_res = await adapter.dispatch({ method: 'GET', path: '/api/mastra/agents' });
  assert.equal(agents_res.status, 200);
  assert.ok(agents_res.body['product-manager']);
  assert.ok(agents_res.body['sdlc-supervisor']);
  assert.ok(agents_res.body['software-engineer']);

  // 3. GET /editor/builder/settings returns enabled builder settings & picker allowlists
  const builder_res = await adapter.dispatch({ method: 'GET', path: '/api/mastra/editor/builder/settings' });
  assert.equal(builder_res.status, 200);
  assert.equal(builder_res.body.enabled, true);
  assert.equal(builder_res.body.modelPolicy.active, true);
  assert.ok(builder_res.body.picker.visibleAgents.includes('product-manager'));
  assert.ok(builder_res.body.picker.visibleTools.includes('harness-test-runner'));

  // 4. GET /editor/workflow-builder/settings returns enabled workflow builder settings
  const wf_builder_res = await adapter.dispatch({ method: 'GET', path: '/api/mastra/editor/workflow-builder/settings' });
  assert.equal(wf_builder_res.status, 200);
  assert.equal(wf_builder_res.body.enabled, true);

  // 5. POST /stored/workflows & GET /stored/workflows via Nuxt handler
  const nuxt_handler = create_nuxt_mastra_handler({ harness, prefix: '/api/mastra' });

  const upsert_body = await nuxt_handler({
    method: 'POST',
    path: '/api/mastra/stored/workflows',
    body: {
      id: 'nuxt-dynamic-hello-wf',
      description: 'created via nuxt mastra handler POST /stored/workflows',
      inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { greeting: { type: 'string' }, echo: { type: 'string' } } },
      graph: [
        {
          type: 'workflow',
          id: 'step-hello',
          workflowId: 'helloworld-workflow'
        }
      ]
    }
  });
  assert.equal(upsert_body.ok, true);
  assert.equal(upsert_body.id, 'nuxt-dynamic-hello-wf');

  const list_stored_wf = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/stored/workflows'
  });
  assert.ok(Array.isArray(list_stored_wf.workflows));
  assert.ok(list_stored_wf.workflows.some((w) => w.id === 'nuxt-dynamic-hello-wf'));

  // 6. GET /sdlc/status via Nuxt handler returns live Tier 1 XState governance state
  const sdlc_status = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/sdlc/status'
  });
  assert.equal(sdlc_status.session_id, 'test-eco-nuxt-server');
  assert.equal(sdlc_status.active_phase, 'phase_00_inception');

  // 7. GET /openapi.json returns OpenAPI 3.1 specification
  const openapi_doc = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/openapi.json'
  });
  assert.ok(openapi_doc.openapi);
  assert.ok(openapi_doc.paths);

  // 8. /agent-controller/* endpoints via Nuxt handler (controllers, modes, sessions, permissions)
  const controllers_list = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/agent-controller'
  });
  assert.ok(Array.isArray(controllers_list.agentControllers));
  assert.ok(controllers_list.agentControllers.some((c) => c.id === 'sdlc-agent-controller'));

  const controller_modes = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/agent-controller/sdlc-agent-controller/modes'
  });
  assert.ok(Array.isArray(controller_modes.modes));
  assert.equal(controller_modes.modes.length, 8);
  assert.ok(controller_modes.modes.some((m) => m.id === 'supervisor'));
  assert.ok(controller_modes.modes.some((m) => m.id === 'implementation'));

  const created_session = await nuxt_handler({
    method: 'POST',
    path: '/api/mastra/agent-controller/sdlc-agent-controller/sessions',
    body: { mode: 'implementation' }
  });
  assert.equal(created_session.controllerId, 'sdlc-agent-controller');
  assert.ok(created_session.sessionId);
  assert.ok(created_session.threadId);

  const session_perms = await nuxt_handler({
    method: 'GET',
    path: `/api/mastra/agent-controller/sdlc-agent-controller/sessions/${created_session.sessionId}/permissions`
  });
  assert.ok(session_perms);

  // 9. /mcp/* REST & SSE endpoints via Nuxt handler
  const mcp_servers_res = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/mcp/v0/servers'
  });
  assert.ok(Array.isArray(mcp_servers_res.servers));
  assert.ok(mcp_servers_res.servers.some((s) => s.id === 'sdlc-mcp'));

  const mcp_tools_res = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/mcp/sdlc-mcp/tools'
  });
  assert.ok(Array.isArray(mcp_tools_res.tools));
  assert.ok(mcp_tools_res.tools.some((t) => t.name === 'harness-immutability-audit'));

  const mcp_exec_res = await nuxt_handler({
    method: 'POST',
    path: '/api/mastra/mcp/sdlc-mcp/tools/harness-immutability-audit/execute',
    body: {
      data: {
        baseline: 'assert.equal(1, 1);',
        current: 'assert.equal(1, 1); assert.equal(2, 2);'
      }
    }
  });
  assert.equal(mcp_exec_res.result.valid, true);
  assert.equal(mcp_exec_res.result.delta, 1);

  const mcp_resources_res = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/mcp/sdlc-mcp/resources'
  });
  assert.ok(Array.isArray(mcp_resources_res.resources));
  assert.ok(mcp_resources_res.resources.some((r) => r.uri === 'sdlc://catalog/phases'));

  const mcp_sse_res = await nuxt_handler({
    method: 'GET',
    path: '/api/mastra/mcp/sdlc-mcp/sse'
  });
  assert.equal(mcp_sse_res.ssePath, '/mcp/sdlc-mcp/sse');
  assert.equal(mcp_sse_res.messagePath, '/mcp/sdlc-mcp/messages');
  assert.ok(mcp_sse_res.server);
});

test('mastra-ecosystem: integrates AgentController directly into CLI interactive chat REPL', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-cli-controller',
    storage_dir: test_storage_dir
  });

  const chat_res = await harness.run_agentic_chat({
    controller_mode: 'discovery',
    silent: true,
    responses: [
      '/modes',
      '/mode implementation',
      '/transition',
      '/permissions edit ask',
      '/session',
      '/thread new feature-auth-thread',
      '/exit'
    ]
  });

  assert.equal(chat_res.cancelled, false);
  // started in discovery, switched to implementation (software-engineer), then /transition -> security (security-engineer)
  assert.equal(chat_res.active_mode, 'security');
  assert.equal(chat_res.active_agent, 'security-engineer');
  assert.ok(chat_res.controller_session);
  assert.equal(chat_res.controller_session.controller_id, 'sdlc-agent-controller');
  assert.equal(chat_res.controller_session.mode, 'security');
  assert.equal(chat_res.controller_session.transitions_to, 'qa');
  assert.equal(chat_res.controller_session.permissions.categories.edit, 'ask');
  assert.equal(chat_res.controller_session.permissions.categories.read, 'allow');
  assert.ok(chat_res.controller_session.thread_id);

  const output_joined = chat_res.output_lines.join('\n');
  assert.ok(output_joined.includes('agent controller modes (8)'));
  assert.ok(output_joined.includes('switched agent controller mode: discovery -> implementation'));
  assert.ok(output_joined.includes('transitioned agent controller mode: implementation -> security'));
  assert.ok(output_joined.includes('agent controller session [sdlc-agent-controller]'));
});

test('mastra-ecosystem: registers Classifier instances, applies stored agent overrides, and exposes all 14 dynamic workflow templates', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-classifiers-overrides',
    storage_dir: test_storage_dir
  });

  // 1. Classifiers registered on Mastra instance
  const mastra = harness.get_mastra_instance();
  const classifiers = mastra.listClassifiers();
  assert.ok(classifiers['sdlc-work-item-classifier']);
  assert.ok(classifiers['sdlc-gate-readiness-classifier']);

  const direct_classifiers = create_sdlc_classifiers();
  const sec_decision = await direct_classifiers['sdlc-work-item-classifier'].decide({
    state: 'critical cve vulnerability in token parser'
  });
  assert.equal(sec_decision.answers.work_item_type.choice, 'security_patch');
  assert.equal(sec_decision.answers.target_role.choice, 'security-engineer');

  const gate_decision = await direct_classifiers['sdlc-gate-readiness-classifier'].decide({
    state: { tests_passing: true, status: 'all verified' }
  });
  assert.equal(gate_decision.answers.gate_ready.type, 'boolean');
  assert.ok(gate_decision.answers.gate_ready.probability > 0.9);
  assert.equal(gate_decision.answers.readiness_score.score, 3);

  // 2. editor.agent.applyStoredOverrides merges stored instructions & description onto live agent
  const editor = harness.get_editor();
  await editor.agent.create({
    id: 'product-manager',
    name: 'product-manager',
    description: 'overridden product-manager description from studio',
    instructions: 'custom studio instructions for product-manager'
  });

  const pm_agent = harness.get_agent('product-manager');
  const overridden_pm = await editor.agent.applyStoredOverrides('product-manager', pm_agent);
  assert.ok(overridden_pm.__stored_overrides);
  assert.equal(overridden_pm.getDescription(), 'overridden product-manager description from studio');
  assert.equal(overridden_pm.getInstructions(), 'custom studio instructions for product-manager');

  // 3. All 14 dynamic workflow templates (11 role workflows + 3 tool/hello pipelines)
  const all_templates = create_role_workflow_builder_definitions();
  const template_keys = Object.keys(all_templates);
  assert.equal(template_keys.length, 14);
  assert.ok(all_templates['dynamic-pm-prd-authoring']);
  assert.ok(all_templates['dynamic-arch-adr-authoring']);
  assert.ok(all_templates['dynamic-se-feature-implementation']);
  assert.ok(all_templates['dynamic-sec-threat-modeling']);
  assert.ok(all_templates['dynamic-qa-regression-audit']);
  assert.ok(all_templates['dynamic-devops-release-packaging']);
});

test('mastra-ecosystem: integrates @mastra/factory (MastraFactory, FactoryStorage, FactorySandbox, sdlc_dual_engine board, /web/* routes, and bidirectional work-item sync)', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-software-factory',
    storage_dir: test_storage_dir
  });

  // 1. FactoryStorage, FactorySandbox, and Boards
  const factory_storage = create_filesystem_factory_storage({
    storage_dir: test_storage_dir,
    in_memory: true
  });
  await factory_storage.init();
  const inserted = await factory_storage.insert('test_items', { id: 'item-1', count: 1 });
  assert.equal(inserted.id, 'item-1');
  const incremented = await factory_storage.incrementColumn('test_items', { id: 'item-1' }, 'count', 4);
  assert.equal(incremented, 5);

  const sandbox = create_sdlc_factory_sandbox({
    sandbox_root: path.join(test_storage_dir, 'sandboxes')
  });
  assert.ok(sandbox);

  const boards_bundle = create_sdlc_factory_boards();
  assert.equal(boards_bundle.sdlc_board.id, SDLC_FACTORY_BOARD_KEY);
  assert.equal(boards_bundle.boards.length, 3);
  assert.ok(boards_bundle.registry.get(SDLC_FACTORY_BOARD_KEY));

  // 2. Initialize full MastraFactory via harness.create_factory()
  const factory_bundle = await harness.create_factory({
    factory_storage,
    sandbox,
    boards_bundle
  });
  assert.ok(factory_bundle.factory);
  assert.equal(factory_bundle.api_routes.length, 100);
  assert.ok(factory_bundle.agent_controllers.code);

  // 3. Dispatch /web/* and /auth/* routes through create_nuxt_mastra_handler
  const nuxt_handler = harness.create_nuxt_handler({
    factory_bundle,
    prefix: '/api/mastra'
  });

  const features_res = await nuxt_handler({
    method: 'GET',
    path: '/web/config/features'
  });
  assert.equal(typeof features_res.knowledge, 'boolean');

  const skills_res = await nuxt_handler({
    method: 'GET',
    path: '/web/factory/skills'
  });
  assert.ok(Array.isArray(skills_res.skills));
  assert.ok(skills_res.skills.some((s) => s.name === 'tdd-lifecycle'));
  assert.ok(skills_res.skills.some((s) => s.name === 'stride-security-analysis'));

  const created_proj_res = await nuxt_handler({
    method: 'POST',
    path: '/web/factory/projects',
    body: {
      name: 'nuxt-sdlc-factory-proj',
      description: 'software factory project created via nuxt h3 handler'
    }
  });
  const created_proj = created_proj_res.project || created_proj_res;
  assert.ok(created_proj.id);
  assert.equal(created_proj.name, 'nuxt-sdlc-factory-proj');

  const proj_boards = await nuxt_handler({
    method: 'GET',
    path: `/web/factory/projects/${created_proj.id}/boards`
  });
  assert.ok(Array.isArray(proj_boards.boards));
  assert.ok(proj_boards.boards.some((b) => b.key === 'sdlc_dual_engine' || b.id === 'sdlc_dual_engine'));

  const created_wi_res = await nuxt_handler({
    method: 'POST',
    path: `/web/factory/projects/${created_proj.id}/work-items`,
    body: {
      title: 'oauth-token-rotation',
      description: 'implement oauth2 refresh token rotation with red-green-refactor tdd',
      board: SDLC_FACTORY_BOARD_KEY
    }
  });
  const created_wi = created_wi_res.workItem || created_wi_res;
  assert.ok(created_wi.id);
  assert.equal(created_wi.board, SDLC_FACTORY_BOARD_KEY);
  assert.equal(created_wi.stages[0], 'inception');

  // 4. Bidirectional sync between MastraFactory and Tier 1 Statechart
  const import_report = await factory_bundle.sync_factory_to_harness({
    project_id: created_proj.id
  });
  assert.equal(import_report.imported_count, 1);
  assert.ok(harness.list_work_items().some((w) => w.name === 'oauth-token-rotation'));

  harness.start_work_item({
    type: 'feature',
    name: 'audit-log-export',
    payload: { description: 'cryptographic audit log export' }
  });
  const export_report = await factory_bundle.sync_harness_to_factory({
    project_id: created_proj.id
  });
  assert.equal(export_report.synced_count, 2);
  assert.ok(export_report.items.some((i) => i.title === 'audit-log-export'));
});

test('mastra-ecosystem: serves Mastra Studio SPA, Mastra Software Factory SPA, and Nuxt 4 module configuration', async () => {
  const dirs = resolve_mastra_ui_directories();
  assert.equal(dirs.studio_exists, true);
  assert.equal(dirs.factory_exists, true);
  assert.ok(dirs.studio_manifest);
  assert.ok(dirs.factory_manifest);

  const studio_html = render_mastra_studio_html({
    studio_base_path: '/_studio',
    api_prefix: '/api/mastra',
    host: 'localhost',
    port: 3100
  });
  assert.ok(!studio_html.includes('%%MASTRA_'));
  assert.ok(studio_html.includes("window.MASTRA_API_PREFIX = '/api/mastra'"));
  assert.ok(studio_html.includes("window.MASTRA_STUDIO_BASE_PATH = '/_studio'"));

  const factory_html = render_mastra_factory_html({
    factory_base_path: '/_factory',
    api_prefix: '/api/mastra'
  });
  assert.ok(factory_html.includes("window.MASTRA_FACTORY_BASE_PATH = '/_factory'"));
  assert.ok(factory_html.includes('src="/_factory/assets/'));

  const asset_handler = create_nuxt_studio_asset_handler({
    studio_base_path: '/_studio',
    factory_base_path: '/_factory'
  });

  const studio_res = asset_handler.serve_request({ path: '/_studio' });
  assert.equal(studio_res.status, 200);
  assert.ok(studio_res.headers['content-type'].includes('text/html'));

  const sse_res = asset_handler.serve_request({ path: '/_studio/refresh-events' });
  assert.equal(sse_res.status, 200);
  assert.equal(sse_res.headers['content-type'], 'text/event-stream');
  assert.ok(sse_res.body.includes('data: connected'));

  const factory_res = asset_handler.serve_request({ path: '/_factory/factories' });
  assert.equal(factory_res.status, 200);
  assert.ok(factory_res.headers['content-type'].includes('text/html'));

  const nuxt_mod = create_nuxt_mastra_module();
  const mock_nuxt = {
    options: {
      runtimeConfig: {},
      serverHandlers: []
    },
    tabs: [],
    hook(name, cb) {
      if (name === 'devtools:customTabs') {
        cb(this.tabs);
      }
    }
  };
  const mod_result = nuxt_mod({}, mock_nuxt);
  assert.equal(mod_result.meta.configKey, 'mastra');
  assert.ok(mock_nuxt.options.serverHandlers.some((h) => h.route === '/api/mastra/**'));
  assert.ok(mock_nuxt.options.serverHandlers.some((h) => h.route === '/web/**'));
  assert.ok(mock_nuxt.options.serverHandlers.some((h) => h.route === '/_studio/**'));
  assert.ok(mock_nuxt.options.serverHandlers.some((h) => h.route === '/_factory/**'));
  assert.equal(mock_nuxt.tabs.length, 2);
});

test('mastra-ecosystem: manipulates all 3 SDLC architecture levels (process objects, process definitions, and project sdlc configuration)', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-3-level-sdlc',
    storage_dir: test_storage_dir
  });

  // Level 1: SDLC Process Objects (phases, gates, roles, workflows, work_item_types, artefact_types)
  const objects = harness.get_process_objects();
  assert.equal(objects.level, 'sdlc_process_objects');
  assert.equal(objects.list_phases().length, 10);
  assert.equal(objects.list_gates().length, 5);
  assert.equal(objects.list_roles().length, 8);

  const custom_phase = objects.register_phase({
    id: 'compliance_audit',
    macro_id: 'phase_06b_compliance',
    name: 'compliance audit',
    primary_role: 'security-engineer'
  });
  assert.equal(custom_phase.id, 'compliance_audit');
  assert.equal(objects.list_phases().length, 11);

  const custom_gate = objects.register_gate({
    id: 'gate_compliance',
    name: 'compliance sign-off gate',
    phase_before: 'compliance_audit',
    phase_after: 'release',
    invariants: ['soc2_controls_verified']
  });
  assert.equal(custom_gate.id, 'gate_compliance');
  assert.equal(objects.list_gates().length, 6);

  // Level 2: SDLC Process Definitions (stage graphs, dependency rewiring, gate binding, cloning, validation)
  const registry = harness.get_process_registry();
  assert.equal(registry.level, 'sdlc_process_registry');
  const cloned_def = registry.clone_definition('develop-feature', 'develop-regulated-feature', {
    title: 'develop regulated feature'
  });
  assert.equal(cloned_def.get_id(), 'develop-regulated-feature');

  cloned_def.insert_stage_after('sec', {
    suffix: 'compliance-check',
    title: 'run compliance check',
    role: 'security-engineer',
    workflow_id: 'sec-threat-modeling',
    phase: 'compliance_audit',
    gate_after: 'gate_compliance'
  });
  assert.ok(cloned_def.get_stage('compliance-check'));
  const val_res = cloned_def.validate(objects);
  assert.equal(val_res.valid, true);

  // Removing an intermediate stage rewires downstream dependencies automatically
  cloned_def.remove_stage('retro');
  assert.equal(cloned_def.get_stage('retro'), null);

  // Level 3: Project SDLC Configuration (enabling/disabling processes, stage overrides, effective process resolution)
  const proj_cfg = harness.get_project_sdlc_config();
  assert.equal(proj_cfg.level, 'project_sdlc_config');
  proj_cfg.configure_process('develop-feature', {
    remove_stages: ['retro'],
    max_workers: 4
  });

  const effective_feature = proj_cfg.resolve_effective_process('develop-feature');
  assert.equal(effective_feature.max_workers, 4);
  assert.equal(effective_feature.stages.some((s) => s.suffix === 'retro'), false);

  // Supervisor resolves the project's overridden process definition when initiating a process
  const initiated = harness.initiate_process('develop-feature', {
    name: 'regulated-vault',
    description: 'regulated vault feature'
  });
  assert.equal(initiated.tickets.some((t) => t.id.endsWith('-retro')), false);
});

test('mastra-ecosystem: routes all submitted requests through WorkerPoolDaemon while keeping Product Manager interactive in chat', async () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-eco-worker-pool-routing',
    storage_dir: test_storage_dir
  });
  const pool = harness.get_worker_pool();

  // 1. Direct background request submission to worker pool
  const bg_receipt = await harness.submit_request({
    type: 'process',
    process_type: 'fix-defect',
    name: 'pool-bg-fix',
    background: true,
    params: {
      name: 'pool-bg-fix',
      description: 'background defect fix routed via worker pool'
    }
  });
  assert.equal(bg_receipt.routed_via, 'worker_pool');
  assert.equal(bg_receipt.background, true);
  assert.ok(bg_receipt.request_id);

  // Wait for background request completion
  const bg_completed = await harness.wait_for_request(bg_receipt.request_id);
  assert.equal(bg_completed.routed_via, 'worker_pool');
  assert.equal(bg_completed.board_summary.all_completed, true);

  // 2. Interactive chat with Product Manager: submit background work via /submit, continue chatting, inspect /requests
  const chat_res = await harness.run_agentic_chat({
    agent_id: 'product-manager',
    silent: true,
    responses: [
      '/submit fix-defect chat-bg-defect resolve race condition in token cache',
      '/requests',
      '/sdlc-config objects',
      '/draft',
      '/exit'
    ]
  });

  assert.equal(chat_res.cancelled, false);
  assert.equal(chat_res.active_agent, 'product-manager');
  const out_text = chat_res.output_lines.join('\n');
  assert.ok(out_text.includes('worker pool submitted requests'));
  assert.ok(out_text.includes('sdlc architecture [sdlc_process_objects]'));
  assert.ok(out_text.includes('working specification draft'));

  const all_reqs = pool.list_requests();
  assert.ok(all_reqs.length >= 2);
  for (const r of all_reqs) {
    await pool.wait_for_request(r.id);
  }
});

afterAll(() => {
  if (fs.existsSync(test_storage_dir)) {
    try {
      fs.rmSync(test_storage_dir, { recursive: true, force: true });
    } catch (_err) {
      // ignore cleanup error
    }
  }
});
