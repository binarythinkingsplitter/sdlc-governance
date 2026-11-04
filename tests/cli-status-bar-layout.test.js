/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: unit and integration tests for cli status bar layout, phase/gate visualiser, and treeview menus
 * verbose: verifies the se-feature-implementation esm syntax validator fix, pinned top status bar
 * rendering, responsive terminal truncation, visual 10-phase and 4-gate pipeline display with icons
 * and ansi colours, function-key window switching (f1-f5), and interactive treeview menus for
 * browsing the document store and selecting top-level items.
 *
 * section: arguments
 * - none
 *
 * section: return value
 * - test suite execution results
 *
 * section: example
 * npx vitest run tests/cli-status-bar-layout.test.js
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  create_dual_engine_harness,
  create_role_workflows,
  create_cli_status_bar_layout,
  create_cli_chat_status_bar_layout,
  create_multiline_scrollable_chat_input,
  resolve_chat_input_config,
  sanitize_chat_paste_payload,
  create_dual_window_chat_live_pipeline_panel,
  strip_ansi,
  visible_length,
  DocumentEntityTypes
} from '../src/index.js';

describe('cli-chat-status-bar-layout & multi-window tui', () => {
  let tmp_dir;
  let harness;

  beforeEach(() => {
    tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-cli-layout-'));
    harness = create_dual_engine_harness({
      workspace_root: tmp_dir,
      base_dir: tmp_dir,
      store_root: path.join(tmp_dir, '.sdlc', 'store'),
      state_dir: path.join(tmp_dir, '.sdlc', 'state'),
      log_file: path.join(tmp_dir, '.sdlc', 'logs', 'test.log'),
      auto_persist: false,
      restore_session: false
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp_dir, { recursive: true, force: true });
    } catch (_err) {
      // ignore cleanup error
    }
  });

  it('validates es module syntax in se-feature-implementation without throwing illegal return statement', async () => {
    const roles = create_role_workflows();
    const se_wf = roles['se-feature-implementation'] || roles.software_engineer?.['se-feature-implementation'];
    const run = await se_wf.createRun();
    const res = await run.start({
      inputData: {
        feature_name: 'cli-chat-status-bar-layout',
        pure_execution: true,
        persist_artefacts: false
      }
    });

    expect(['completed', 'success']).toContain(res.status);
    const step_map = {};
    for (let i = 0; i < (res.history || []).length; i += 1) {
      step_map[res.history[i].stepId] = res.history[i].output;
    }
    const verify_out = step_map.verifyCodeSyntax || res.steps?.verifyCodeSyntax?.output;
    const rubric_out = step_map.evaluateCodeQuality || res.steps?.evaluateCodeQuality?.output || res.result;

    expect(verify_out.syntax_valid).toBe(true);
    expect(verify_out.error).toBeNull();
    expect(rubric_out.status).toBe('success');
    expect(rubric_out.rubric_score).toBeGreaterThanOrEqual(0.8);
  });

  it('renders pinned top status bar with project metadata, active phase, work item progress, and f1-f5 tabs', () => {
    harness.initiate_process('develop-feature', {
      name: 'status-bar-demo',
      problem_statement: 'render live status bar and phase pipeline'
    });

    const layout = create_cli_status_bar_layout({
      harness,
      active_agent: 'sdlc-supervisor',
      colour: true,
      columns: 120
    });

    const bar = layout.render_status_bar();
    const plain = strip_ansi(bar);

    expect(plain).toContain('sdlc-supervisor');
    expect(plain).toContain('status-bar-demo');
    expect(plain).toContain('inception');
    expect(plain).toContain('f1');
    expect(plain).toContain('f2');
    expect(plain).toContain('f3');
    expect(plain).toContain('f4');
    expect(plain).toContain('f5');
    // verify ansi colour codes are present when colour: true
    expect(bar).toContain('\x1b[');
  });

  it('truncates status bar cleanly when terminal width is below 80 columns (ac-05)', () => {
    harness.initiate_process('develop-feature', {
      name: 'narrow-viewport-feature'
    });

    const layout = create_cli_chat_status_bar_layout({
      harness,
      active_agent: 'sdlc-supervisor',
      colour: true,
      columns: 64
    });

    const bar = layout.render_status_bar({ columns: 64 });
    const lines = bar.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const visible = strip_ansi(lines[i]);
      expect(visible.length).toBeLessThanOrEqual(64);
    }
  });

  it('renders visual 10-phase and 4-gate pipeline with icons and statuses', async () => {
    await harness.run_process('develop-feature', {
      name: 'visual-pipeline-epic',
      problem_statement: 'visualise phases and review gates with icons and colours'
    });

    const layout = create_cli_status_bar_layout({
      harness,
      colour: true,
      columns: 110
    });

    const pipeline_view = layout.render_phase_gate_pipeline({ epic_id: 'visual-pipeline-epic' });
    const plain = strip_ansi(pipeline_view);

    // verify all 10 phases and 4 formal review gates appear
    expect(plain).toContain('phase 00');
    expect(plain).toContain('inception');
    expect(plain).toContain('phase 01');
    expect(plain).toContain('specification');
    expect(plain).toContain('phase 02');
    expect(plain).toContain('architecture');
    expect(plain).toContain('gate 1');
    expect(plain).toContain('phase 03');
    expect(plain).toContain('tdd red');
    expect(plain).toContain('phase 04');
    expect(plain).toContain('tdd green');
    expect(plain).toContain('phase 05');
    expect(plain).toContain('refactor');
    expect(plain).toContain('gate 2');
    expect(plain).toContain('phase 06');
    expect(plain).toContain('security');
    expect(plain).toContain('phase 07');
    expect(plain).toContain('qa');
    expect(plain).toContain('gate 3');
    expect(plain).toContain('phase 08');
    expect(plain).toContain('release');
    expect(plain).toContain('gate 4');
    expect(plain).toContain('phase 09');
    expect(plain).toContain('continuous learning');
    // verify completion icons are present
    expect(plain).toContain('✔');
    expect(plain).toContain('🛡️');
  });

  it('switches windows with function keys (f1-f5) and navigates doc store & top-level items treeviews', () => {
    const store = harness.get_store();
    store.save_entity(DocumentEntityTypes.PRD, {
      id: 'prd-tree_demo',
      slug: 'tree_demo',
      title: 'product requirements document: tree demo',
      status: 'approved',
      executive_summary: {
        problem: 'browse doc store with a treeview menu',
        strategic_context: 'cli operators',
        primary_objectives: ['render hierarchical tree']
      }
    });
    store.save_entity(DocumentEntityTypes.ADR, {
      id: 'adr-tree_demo',
      slug: 'tree_demo',
      title: 'adr for tree demo',
      linked_prd_id: 'prd-tree_demo',
      status: 'accepted',
      context: 'terminal ui context',
      decision: 'use expandable treeview with preview pane'
    });

    harness.initiate_process('develop-feature', {
      name: 'tree-work-item',
      problem_statement: 'test work item selection from treeview'
    });

    let switched_agent = null;
    const layout = create_cli_status_bar_layout({
      harness,
      active_agent: 'sdlc-supervisor',
      on_select_agent: (agent_id) => {
        switched_agent = agent_id;
      }
    });

    expect(layout.get_active_window()).toBe('chat');

    // press f2 -> phases & gates window
    layout.handle_keypress('', { name: 'f2' });
    expect(layout.get_active_window()).toBe('pipeline');
    const f2_view = strip_ansi(layout.render_active_window());
    expect(f2_view).toContain('gate 1');

    // press f3 -> doc store treeview window
    layout.handle_keypress('', { name: 'f3' });
    expect(layout.get_active_window()).toBe('doc_store');
    const f3_view = strip_ansi(layout.render_active_window());
    expect(f3_view).toContain('prd-tree_demo');
    expect(f3_view).toContain('adr-tree_demo');

    // navigate down in doc store tree and inspect selection
    layout.handle_keypress('', { name: 'down' });
    const selected_doc_node = layout.get_selected_tree_node('doc_store');
    expect(selected_doc_node).toBeDefined();

    // press f4 -> top-level items treeview window
    layout.handle_keypress('', { name: 'f4' });
    expect(layout.get_active_window()).toBe('top_level_items');
    const f4_view = strip_ansi(layout.render_active_window());
    expect(f4_view).toContain('tree-work-item');
    expect(f4_view).toContain('system-architect');

    // select an agent node in top_level_items tree
    const action_res = layout.select_tree_item_by_id('top_level_items', 'agent:system-architect');
    expect(action_res.selected).toBe(true);
    expect(switched_agent).toBe('system-architect');

    // press f5 -> memory & knowledge window
    layout.handle_keypress('', { name: 'f5' });
    expect(layout.get_active_window()).toBe('memory');
    const f5_view = strip_ansi(layout.render_active_window());
    expect(f5_view).toContain('memory');

    // press f1 -> return to chat window
    layout.handle_keypress('', { name: 'f1' });
    expect(layout.get_active_window()).toBe('chat');
  });

  it('supports /f2, /f3, /f4, /pipeline, and /tree slash commands inside interactive chat', async () => {
    harness.initiate_process('develop-feature', {
      name: 'chat-tui-feature',
      problem_statement: 'test slash commands for tui windows in chat'
    });

    const session = await harness.run_agentic_chat({
      responses: ['/f2', '/f3', '/f4', '/f1', '/exit'],
      silent: true
    });

    const combined = strip_ansi(session.output_lines.join('\n'));
    expect(combined).toContain('phase 00');
    expect(combined).toContain('gate 1');
    expect(combined).toContain('doc store tree');
    expect(combined).toContain('top-level items tree');
  });

  it('renders bordered chat input box, scrollable chat viewport, and in-place ansi tui frames across f1-f5', () => {
    const layout = create_cli_status_bar_layout({
      harness,
      columns: 100,
      rows: 26,
      colour: true
    });

    for (let i = 1; i <= 25; i += 1) {
      layout.append_chat_message(
        i % 2 === 1
          ? `you> user turn message number ${i} discussing piumarta vtable dispatch`
          : `sdlc-supervisor> agent response number ${i} confirming phase progress`
      );
    }

    // verify bordered chat viewport scrolls up and down in f1
    const bottom_view = strip_ansi(layout.render_chat_viewport_window({ columns: 100, viewport_rows: 12 }));
    expect(bottom_view).toContain('agent response number 24');
    expect(bottom_view).toContain('user turn message number 25');

    layout.handle_keypress('', { name: 'up' });
    layout.handle_keypress('', { name: 'pageup' });
    expect(layout.get_chat_scroll_offset()).toBeGreaterThan(0);
    const scrolled_view = strip_ansi(layout.render_chat_viewport_window({ columns: 100, viewport_rows: 12 }));
    expect(scrolled_view).toContain('scrolled -');

    layout.handle_keypress('', { name: 'escape' });
    expect(layout.get_chat_scroll_offset()).toBe(0);

    // verify bordered chat input window
    layout.set_input_buffer('build a rate limiter', 8);
    const input_box = layout.render_chat_input_window({ columns: 100 });
    expect(input_box.lines.length).toBe(3);
    const plain_input = strip_ansi(input_box.text);
    expect(plain_input).toContain('╭─');
    expect(plain_input).toContain('chat input');
    expect(plain_input).toContain('│ you> build a rate limiter');
    expect(plain_input).toContain('╰─');
    expect(input_box.cursor_col).toBe(3 + 'you> '.length + 8);

    // verify 3-pane tui frame keeps identical total row count across f1-f5 and emits in-place ansi
    const win_keys = ['f1', 'f2', 'f3', 'f4', 'f5'];
    for (let k = 0; k < win_keys.length; k += 1) {
      layout.handle_keypress('', { name: win_keys[k] });
      const tui = layout.render_tui_frame({ columns: 100, rows: 26 });
      expect(tui.total_rows).toBe(26);
      expect(tui.cursor_row).toBe(25);
      const ansi_frame = layout.render_in_place_ansi({ columns: 100, rows: 26 });
      expect(ansi_frame).toContain('\x1b[H');
      expect(ansi_frame).toContain('\x1b[2K');
      expect(ansi_frame).toContain(`\x1b[${tui.cursor_row};${tui.cursor_col}H`);
    }
  });

  it('synchronises prd from code and code from prd without crashing when asked in chat', async () => {
    const src_dir = path.join(tmp_dir, 'src');
    fs.mkdirSync(src_dir, { recursive: true });
    fs.writeFileSync(
      path.join(src_dir, 'cli-chat-status-bar-layout.js'),
      [
        '/**',
        ' * section: version number',
        ' * version: 0.1.0',
        ' * section: documentation',
        ' * tldr: modern multi-window terminal layout with pinned status bar and treeview',
        ' */',
        'export function create_cli_chat_status_bar_layout() { return { ok: true }; }',
        ''
      ].join('\n'),
      'utf-8'
    );

    const store = harness.get_store();
    store.save_entity(DocumentEntityTypes.PRD, {
      id: 'prd-cli_chat_status_bar_layout',
      slug: 'cli_chat_status_bar_layout',
      title: 'product requirements document: cli-chat-status-bar-layout',
      status: 'approved',
      executive_summary: {
        vision: '',
        problem: 'deliver cli-chat-status-bar-layout with verified specifications and tests',
        strategic_context: 'terminal ui layout',
        primary_objectives: ['verify cli-chat-status-bar-layout']
      },
      functional_requirements: [
        {
          id: 'fr-01',
          title: 'render pinned status bar',
          description: 'render pinned status bar at top of terminal',
          priority: 'must_have',
          status: 'approved'
        }
      ]
    });

    store.save_entity(DocumentEntityTypes.PRD, {
      id: 'prd-admin_dashboard',
      slug: 'admin_dashboard',
      title: 'product requirements document: admin-dashboard',
      status: 'approved',
      executive_summary: {
        vision: 'centralised monitoring dashboard',
        problem: 'system administrators need a centralised dashboard to monitor health',
        strategic_context: 'admin telemetry',
        primary_objectives: ['monitor health and audit logs']
      },
      functional_requirements: [
        {
          id: 'fr-01',
          title: 'monitor system health and error logs',
          description: 'display real-time health and error log metrics',
          priority: 'must_have',
          status: 'approved'
        }
      ]
    });

    const session = await harness.run_agentic_chat({
      responses: [
        'update the prd from the code and the code from the prd, maybe creating a sync sdlc process',
        '/exit'
      ],
      silent: true
    });

    expect(session.cancelled).toBe(false);
    const sync_call = session.tool_calls.find((tc) => tc.tool === 'sync_prd_and_code');
    expect(sync_call).toBeDefined();
    expect(sync_call.output.synced).toBe(true);

    // verify code -> prd updated prd-cli_chat_status_bar_layout with source exports and vision
    const updated_layout_prd = store.get_entity(DocumentEntityTypes.PRD, 'prd-cli_chat_status_bar_layout');
    expect(updated_layout_prd.executive_summary.vision).toContain('modern multi-window terminal layout');
    expect(updated_layout_prd.functional_requirements.length).toBeGreaterThanOrEqual(2);

    // verify prd -> code generated src/admin-dashboard.js from prd-admin_dashboard
    const generated_admin_code_path = path.join(src_dir, 'admin-dashboard.js');
    expect(sync_call.output.code_updated_from_prd).toEqual(
      expect.arrayContaining([expect.objectContaining({ feature: 'admin-dashboard' })])
    );
    expect(fs.existsSync(generated_admin_code_path)).toBe(true);
    const generated_code = fs.readFileSync(generated_admin_code_path, 'utf-8');
    expect(generated_code).toContain('create_admin_dashboard');
  });

  it('prevents raw-mode line staircasing, lone surrogate corruption, and bogus workspace-sync stubs', async () => {
    const layout = create_cli_status_bar_layout({
      harness,
      columns: 90,
      rows: 24,
      colour: true
    });

    layout.append_chat_message(
      'sdlc-supervisor> 🚀 🏛️ 🧭 🤖 💬 🌳 📜 👤 synchronised all 10 prds and verified phase gates without wrapping!'
    );

    const win_keys = ['f1', 'f2', 'f3', 'f4', 'f5'];
    for (let k = 0; k < win_keys.length; k += 1) {
      layout.handle_keypress('', { name: win_keys[k] });
      const frame = layout.render_tui_frame({ columns: 90, rows: 24 });
      for (let r = 0; r < frame.lines.length; r += 1) {
        const line = frame.lines[r];
        // verify exact display column width never exceeds 90 cells
        expect(visible_length(line)).toBeLessThanOrEqual(90);
        // verify no lone utf-16 surrogates (\uD800-\uDFFF) exist in truncated output
        expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(line)).toBe(false);
      }

      const ansi = layout.render_in_place_ansi({ columns: 90, rows: 24 });
      // raw mode in-place ansi must never emit raw newline characters that staircase the cursor
      expect(ansi.includes('\n')).toBe(false);
      expect(ansi).toContain('\x1b[?7l');
      expect(ansi).toContain('\x1b[?7h');
      expect(ansi).toContain('\x1b[1;1H\x1b[2K');
      expect(ansi).toContain('\x1b[24;1H\x1b[2K');
    }

    // verify empty .sdlc/store auto-hydrates from docs/01-product and never creates workspace-sync.js
    const src_dir = path.join(tmp_dir, 'src');
    const docs_prd_dir = path.join(tmp_dir, 'docs', '01-product');
    fs.mkdirSync(src_dir, { recursive: true });
    fs.mkdirSync(docs_prd_dir, { recursive: true });
    fs.writeFileSync(
      path.join(src_dir, 'CliStatusBarLayout.js'),
      '/**\n * tldr: multi-window terminal layout\n */\nexport function create_cli_status_bar_layout() {}\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(docs_prd_dir, 'prd-cli-chat-status-bar-layout.md'),
      '# prd: cli-chat-status-bar-layout\n\n## 1. executive summary\npinned status bar and multi-window tui.\n\n## 2. functional requirements\n- **fr-01**: render status bar\n',
      'utf-8'
    );

    const session = await harness.run_agentic_chat({
      responses: ['sync prd and code', '/exit'],
      silent: true
    });
    const sync_call = session.tool_calls.find((tc) => tc.tool === 'sync_prd_and_code');
    expect(sync_call).toBeDefined();
    expect(sync_call.output.synced).toBe(true);
    expect(fs.existsSync(path.join(src_dir, 'workspace-sync.js'))).toBe(false);
  });

  it('defaults chat to product-manager, discusses free-form ideas with feature suggestions without creating a prd, and mediates sdlc-supervisor via agents', async () => {
    const store = harness.get_store();

    // 1. default active agent in layout and chat is product-manager (not sdlc-supervisor)
    const default_layout = create_cli_status_bar_layout({ harness });
    expect(default_layout.get_active_agent()).toBe('product-manager');

    // 2. free-form prompt to product-manager discusses and suggests features without creating a prd or running sdlc process
    const freeform_prompt =
      'i want to build a real-time notification and alerting system for our workspace so operators know when builds fail or review gates block, and maybe align our prd and code implementation later. i just want to discuss it with you first and get suggestions for new features we would need to implement.';

    const discovery_session = await harness.run_agentic_chat({
      responses: [
        freeform_prompt,
        'switch to sdlc-supervisor',
        'ask sdlc-supervisor to check readiness for alert-engine',
        'submit to sdlc-supervisor to build feature alert-engine real-time gate and build alerting',
        '/exit'
      ],
      silent: true
    });

    expect(discovery_session.cancelled).toBe(false);
    // greeting + turn 1 must be handled by product-manager
    expect(discovery_session.transcript[0].speaker).toBe('product-manager');
    expect(discovery_session.transcript[2].speaker).toBe('product-manager');

    // turn 1 (free-form discussion) must invoke suggest_features and must NOT have created a prd before turn 4
    const suggest_call = discovery_session.tool_calls.find((tc) => tc.tool === 'suggest_features');
    expect(suggest_call).toBeDefined();
    expect(suggest_call.output.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(discovery_session.transcript[2].text).toContain('suggested features');

    // turn 2: attempting to switch directly to sdlc-supervisor in normal mode stays on product-manager
    const switch_call = discovery_session.tool_calls.find((tc) => tc.tool === 'switch_active_agent');
    expect(switch_call).toBeDefined();
    expect(switch_call.output.switched).toBe(false);
    expect(switch_call.output.active_agent).toBe('product-manager');
    expect(discovery_session.active_agent).toBe('product-manager');

    // verify free-form only session leaves .sdlc/store completely empty of prds and process_result null
    const only_discussion_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-discuss-only-'));
    try {
      const discuss_harness = create_dual_engine_harness({
        workspace_root: only_discussion_dir,
        base_dir: only_discussion_dir,
        store_root: path.join(only_discussion_dir, '.sdlc', 'store'),
        state_dir: path.join(only_discussion_dir, '.sdlc', 'state'),
        log_file: path.join(only_discussion_dir, '.sdlc', 'logs', 'test.log'),
        auto_persist: false,
        restore_session: false
      });
      const discuss_only = await discuss_harness.run_agentic_chat({
        responses: [freeform_prompt, '/exit'],
        silent: true
      });
      expect(discuss_only.active_agent).toBe('product-manager');
      expect(discuss_only.process_result).toBeNull();
      expect(discuss_only.tool_calls.some((tc) => tc.tool === 'execute_sdlc_process')).toBe(false);
      expect(discuss_only.tool_calls.some((tc) => tc.tool === 'sync_prd_and_code')).toBe(false);
      expect(discuss_harness.get_store().list_entities(DocumentEntityTypes.PRD).length).toBe(0);
    } finally {
      fs.rmSync(only_discussion_dir, { recursive: true, force: true });
    }

    // turn 3 & 4: product-manager interacts with sdlc-supervisor via request_sdlc_supervisor and executes alert-engine
    const sup_calls = discovery_session.tool_calls.filter((tc) => tc.tool === 'request_sdlc_supervisor');
    expect(sup_calls.length).toBeGreaterThanOrEqual(2);
    expect(sup_calls[0].output.mediated_by).toBe('sdlc-supervisor');
    expect(sup_calls[0].output.from_agent).toBe('product-manager');

    const sup_log = harness.get_supervisor().get_agent_request_log();
    expect(sup_log.length).toBeGreaterThanOrEqual(2);
    expect(sup_log[0].from_agent).toBe('product-manager');

    const created_prd = store.get_entity(DocumentEntityTypes.PRD, 'prd-alert_engine');
    expect(created_prd).toBeDefined();
  });

  it('configures multiline-scrollable-chat-input via env vars, expands/contracts dynamically, and scrolls vertically', () => {
    const cfg = resolve_chat_input_config({}, {
      CHAT_INPUT_MAX_HEIGHT: '4',
      CHAT_INPUT_DEFAULT_ROWS: '2',
      CHAT_INPUT_SCROLL_STEP: '2',
      CHAT_INPUT_BUFFER_LIMIT: '120'
    });
    expect(cfg.max_height).toBe(4);
    expect(cfg.default_rows).toBe(2);
    expect(cfg.scroll_step).toBe(2);
    expect(cfg.buffer_limit).toBe(120);

    const sanitized = sanitize_chat_paste_payload('line1\r\nline2\t\x07\uD800end', 64);
    expect(sanitized.text).toBe('line1\nline2  \uFFFDend');

    const ml = create_multiline_scrollable_chat_input({
      env: {
        CHAT_INPUT_MAX_HEIGHT: '3',
        CHAT_INPUT_DEFAULT_ROWS: '1',
        CHAT_INPUT_SCROLL_STEP: '1',
        CHAT_INPUT_BUFFER_LIMIT: '500'
      },
      line_width: 40
    });

    // initial single-row height
    expect(ml.get_state(40).viewport_rows).toBe(1);

    // insert 5 lines -> expands up to max_height (3) and becomes vertically scrollable
    ml.set_value('row-1\nrow-2\nrow-3\nrow-4\nrow-5');
    const expanded = ml.get_state(40);
    expect(expanded.total_visual_rows).toBe(5);
    expect(expanded.viewport_rows).toBe(3);
    expect(expanded.is_scrollable).toBe(true);
    expect(expanded.scroll_offset).toBe(2); // auto-scrolled to keep cursor on row 5 visible

    // scroll up and down inside the input box
    ml.scroll_up(2, 40);
    expect(ml.get_state(40).scroll_offset).toBe(0);
    ml.scroll_down(1, 40);
    expect(ml.get_state(40).scroll_offset).toBe(1);

    // clear -> contracts back to default_rows (1)
    ml.clear();
    expect(ml.get_state(40).viewport_rows).toBe(1);
    expect(ml.get_state(40).scroll_offset).toBe(0);

    // verify integration inside create_cli_status_bar_layout
    const layout = create_cli_status_bar_layout({
      supervisor: harness.get_supervisor(),
      store: harness.get_store(),
      columns: 100,
      rows: 28,
      colour: false,
      env: { CHAT_INPUT_MAX_HEIGHT: '4', CHAT_INPUT_DEFAULT_ROWS: '1' }
    });
    layout.set_input_buffer('alpha\nbeta\ngamma\ndelta\nepsilon');
    const box = layout.render_chat_input_window({ columns: 100, colour: false });
    expect(box.viewport_rows).toBe(4);
    expect(box.total_visual_rows).toBe(5);
    expect(box.is_scrollable).toBe(true);
    expect(box.text).toContain('rows ');
  });

  it('renders dual-window-chat-live-pipeline-panel in f1 with separate chat and pipeline panes and independent scrolling', () => {
    const dual = create_dual_window_chat_live_pipeline_panel({ columns: 110, colour: false });
    const turn_id = 'turn-01';
    dual.append_chat_message('user: please build the feature', { turn_id });
    dual.append_pipeline_message('  [status] Starting governed SDLC execution: develop-feature', {
      turn_id,
      run_id: 'run-99',
      phase_id: 'phase_00_inception'
    });
    dual.correlate_turn_with_run(turn_id, 'run-99');

    expect(dual.get_correlated_run('turn-01')).toBe('run-99');

    const rendered_dual = dual.render_dual_pane_window({ columns: 110, viewport_rows: 8, colour: false });
    expect(rendered_dual).toContain('💬 mastra agentic chat');
    expect(rendered_dual).toContain('⚡ live sdlc pipeline');
    expect(rendered_dual).toContain('please build the feature');
    expect(rendered_dual).toContain('Starting governed SDLC');

    // verify integration in CliStatusBarLayout f1 viewport
    const layout = create_cli_status_bar_layout({
      supervisor: harness.get_supervisor(),
      store: harness.get_store(),
      columns: 110,
      rows: 26,
      colour: false
    });

    for (let i = 1; i <= 14; i++) {
      layout.append_chat_message(`chat line ${i}`);
      layout.append_pipeline_message(`[pipeline] phase event ${i}`);
    }

    layout.scroll_chat(3);
    layout.scroll_pipeline_pane(2);
    expect(layout.get_state().chat_scroll_offset).toBe(3);
    expect(layout.get_state().pipeline_log_scroll_offset).toBe(2);

    // toggle focus to pipeline pane and scroll via handle_keypress
    layout.handle_keypress('', { ctrl: true, name: 'w' });
    expect(layout.get_state().active_f1_pane).toBe('pipeline');
    layout.handle_keypress('', { name: 'pageup', shift: true });
    expect(layout.get_state().pipeline_log_scroll_offset).toBeGreaterThan(2);

    const f1_view = strip_ansi(layout.render_active_window({ columns: 110, rows: 26, colour: false }));
    expect(f1_view).toContain('💬 chat');
    expect(f1_view).toContain('⚡ live sdlc pipeline');
  });

  it('executes fix-defect through sdlc with real tdd patch generation, populates prd, and persists code artefacts', async () => {
    const store = harness.get_store();
    const board = harness.get_work_board();

    const fix_res = await harness.run_process('fix-defect', {
      name: 'chat-scroll-clamp-bug',
      defectId: 'chat-scroll-clamp-bug',
      featureName: 'chat-scroll-clamp-bug',
      summary: 'fix scroll offset clamping when terminal resizes narrower than 80 columns',
      persist_code_artefacts: true
    });

    expect(fix_res.board_summary.all_completed).toBe(true);
    const patch_ticket = board.get_ticket('chat-scroll-clamp-bug:patch');
    expect(patch_ticket).toBeDefined();
    expect(patch_ticket.status).toBe('completed');
    expect(patch_ticket.output.result.code).toContain('create_chat_scroll_clamp_bug_patch');
    expect(patch_ticket.output.result.tests).toContain('reproduces and verifies the defect fix for chat-scroll-clamp-bug');

    const stored_prd = store.get_entity(DocumentEntityTypes.PRD, 'prd-chat_scroll_clamp_bug');
    expect(stored_prd).toBeDefined();
    expect(stored_prd.executive_summary.problem).toContain('fix scroll offset clamping');

    const persisted_code = path.join(tmp_dir, 'src', 'chat-scroll-clamp-bug.js');
    const persisted_test = path.join(tmp_dir, 'tests', 'chat-scroll-clamp-bug.test.js');
    expect(fs.existsSync(persisted_code)).toBe(true);
    expect(fs.existsSync(persisted_test)).toBe(true);
  });

  it('provides untethered autonomous-engineer agent that can apply direct fixes or consume sdlc on demand', async () => {
    const session = await harness.run_agentic_chat({
      initial_agent: 'autonomous-engineer',
      responses: [
        'fix broken helper in src/custom-scroll-helper.js directly without sdlc',
        '/exit'
      ],
      silent: true
    });

    expect(session.active_agent).toBe('autonomous-engineer');
    const direct_fix_call = session.tool_calls.find((tc) => tc.tool === 'apply_direct_code_fix');
    expect(direct_fix_call).toBeDefined();
    expect(direct_fix_call.output.ok).toBe(true);
    expect(direct_fix_call.output.untethered).toBe(true);
    expect(direct_fix_call.output.consumed_sdlc).toBe(false);
    expect(fs.existsSync(path.join(tmp_dir, 'src', 'custom-scroll-helper.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmp_dir, 'tests', 'custom-scroll-helper.test.js'))).toBe(true);

    // verify autonomous-engineer can also consume governed sdlc when requested
    const sdlc_session = await harness.run_agentic_chat({
      initial_agent: 'autonomous-engineer',
      responses: [
        'run fix-defect workflow for scroll-jitter-defect',
        '/exit'
      ],
      silent: true
    });
    const consumed_call = sdlc_session.tool_calls.find(
      (tc) => tc.tool === 'apply_direct_code_fix' || tc.tool === 'execute_sdlc_process'
    );
    expect(consumed_call).toBeDefined();
  });
});
