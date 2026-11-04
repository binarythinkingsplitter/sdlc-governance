/**
 * =========================================================================
 * module: CliStatusBarLayout
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: modern multi-window terminal layout with pinned status bar, visual phase/gate pipeline, and treeview menus
 * verbose: implements the cli-chat-status-bar-layout specification for @thing/sdlc-dual_engine_harness,
 * providing a pinned top telemetry banner, function-key window switching (f1-f5), a colourised
 * 10-phase and 4-gate visual execution tracker with icons, and interactive expandable treeview
 * menus for browsing the document entity store and selecting top-level sdlc items.
 *
 * section: arguments
 * - options (object, optional): layout configuration options
 *
 * section: return value
 * - module exports (object): factory functions and ansi formatting utilities
 *
 * section: example
 * import { create_cli_status_bar_layout } from './CliStatusBarLayout.js';
 * const layout = create_cli_status_bar_layout({ harness });
 * process.stdout.write(layout.render_status_bar() + '\n');
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { DocumentEntityTypes } from './DocumentEntitiesSchema.js';
import { migrate_all_documents } from './DocumentMigrator.js';
import {
  list_sdlc_phases,
  list_review_gates,
  list_high_level_processes
} from './HarnessCatalog.js';
import { GOVERNANCE_SKILLS } from './HarnessSkills.js';
import {
  create_multiline_scrollable_chat_input,
  resolve_chat_input_config,
  sanitize_chat_paste_payload
} from './multiline-scrollable-chat-input.js';
import {
  create_dual_window_chat_live_pipeline_panel,
  is_pipeline_telemetry_entry
} from './dual-window-chat-live-pipeline-panel.js';

const ANSI = Object.freeze({
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',
  cyan: '\x1b[38;5;51m',
  bright_blue: '\x1b[38;5;39m',
  emerald: '\x1b[38;5;48m',
  amber: '\x1b[38;5;214m',
  crimson: '\x1b[38;5;196m',
  magenta: '\x1b[38;5;207m',
  lavender: '\x1b[38;5;141m',
  slate: '\x1b[38;5;245m',
  white: '\x1b[38;5;255m',
  bg_header: '\x1b[48;5;235m',
  bg_active_tab: '\x1b[48;5;24m\x1b[38;5;255m\x1b[1m',
  bg_inactive_tab: '\x1b[48;5;236m\x1b[38;5;250m',
  bg_selected_row: '\x1b[48;5;24m\x1b[38;5;255m\x1b[1m'
});

export const CLI_WINDOWS = Object.freeze([
  { id: 'chat', key: 'f1', label: 'f1 💬 chat & live pipeline', short_label: 'f1:chat' },
  { id: 'pipeline', key: 'f2', label: 'f2 🏛️ phases & gates', short_label: 'f2:phases' },
  { id: 'doc_store', key: 'f3', label: 'f3 🌳 doc store tree', short_label: 'f3:docs' },
  { id: 'top_level_items', key: 'f4', label: 'f4 📋 top-level items tree', short_label: 'f4:items' },
  { id: 'memory', key: 'f5', label: 'f5 🧠 memory & knowledge', short_label: 'f5:mem' }
]);

const PHASE_VISUALS = Object.freeze([
  {
    id: 'phase_00_inception',
    short_id: 'inception',
    num: '00',
    name: 'inception',
    icon: '🌱',
    ticket_suffixes: ['prd'],
    description: 'vision framing & problem discovery'
  },
  {
    id: 'phase_01_specification',
    short_id: 'specification',
    num: '01',
    name: 'specification',
    icon: '📋',
    ticket_suffixes: ['prd', 'stories'],
    description: 'prd & bdd user story slicing'
  },
  {
    id: 'phase_02_architecture',
    short_id: 'architecture',
    num: '02',
    name: 'architecture',
    icon: '🏛️',
    ticket_suffixes: ['adr', 'interface'],
    description: 'adr & interface contracts',
    gate_after: {
      id: 'gate_1_planning',
      num: '1',
      name: 'gate 1: planning & architecture',
      invariants: 'approved prd + adr + interface contract'
    }
  },
  {
    id: 'phase_03_tdd_red',
    short_id: 'tdd_red',
    num: '03',
    name: 'tdd red',
    icon: '🔴',
    ticket_suffixes: ['impl'],
    description: 'author failing unit & bdd tests'
  },
  {
    id: 'phase_04_tdd_green',
    short_id: 'tdd_green',
    num: '04',
    name: 'tdd green',
    icon: '🟢',
    ticket_suffixes: ['impl'],
    description: 'pure factory implementation'
  },
  {
    id: 'phase_05_refactor',
    short_id: 'refactor',
    num: '05',
    name: 'refactor',
    icon: '🔧',
    ticket_suffixes: ['impl'],
    description: 'ast syntax & rubric verification',
    gate_after: {
      id: 'gate_2_implementation',
      num: '2',
      name: 'gate 2: tdd & immutability',
      invariants: 'tests green + zero immutability violations'
    }
  },
  {
    id: 'phase_06_security_review',
    short_id: 'security_qa',
    num: '06',
    name: 'security review',
    icon: '🔒',
    ticket_suffixes: ['sec'],
    description: 'stride threat model & owasp audit'
  },
  {
    id: 'phase_07_qa_verification',
    short_id: 'qa_verification',
    num: '07',
    name: 'qa verification',
    icon: '🧪',
    ticket_suffixes: ['qa'],
    description: 'regression suite & bdd verification',
    gate_after: {
      id: 'gate_3_qa_security',
      num: '3',
      name: 'gate 3: security & qa',
      invariants: 'stride mitigated + qa regression pass'
    }
  },
  {
    id: 'phase_08_release',
    short_id: 'release',
    num: '08',
    name: 'release',
    icon: '🚀',
    ticket_suffixes: ['release'],
    description: 'semantic release & cryptographic receipt',
    gate_after: {
      id: 'gate_4_release',
      num: '4',
      name: 'gate 4: release governance',
      invariants: 'signed receipt + clean git tree + pr merged'
    }
  },
  {
    id: 'phase_09_continuous_learning',
    short_id: 'continuous_learning',
    num: '09',
    name: 'continuous learning',
    icon: '🧠',
    ticket_suffixes: ['retro'],
    description: 'blameless retrospective & knowledge sync'
  }
]);

const WORK_PHASE_ORDER = Object.freeze([
  'inception',
  'specification',
  'architecture',
  'gate_1_evaluating',
  'tdd_red',
  'tdd_green',
  'refactor',
  'gate_2_evaluating',
  'security_qa',
  'qa_verification',
  'gate_3_evaluating',
  'release',
  'gate_4_evaluating',
  'continuous_learning',
  'completed'
]);

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: strips ansi escape sequences from a string
 * verbose: removes all sgr and cursor control escape sequences to compute visible character lengths.
 *
 * section: arguments
 * - text (string): input string potentially containing ansi codes
 *
 * section: return value
 * - plain (string): plain text without ansi sequences
 *
 * section: example
 * const plain = strip_ansi('\x1b[32mhello\x1b[0m');
 */
export function strip_ansi(text = '') {
  return String(text || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]|\x1b[78]/g, '');
}

function codepoint_display_width(cp) {
  if (
    cp === 0x200d ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0x0300 && cp <= 0x036f)
  ) {
    return 0;
  }
  if (
    cp >= 0x1f000 ||
    cp === 0x26a1 ||
    cp === 0x2b50 ||
    cp === 0x23f8 ||
    (cp >= 0x4e00 && cp <= 0x9fff)
  ) {
    return 2;
  }
  return 1;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: returns the visible terminal column width of a string excluding ansi codes
 * verbose: strips ansi control sequences and sums terminal cell widths across unicode code points,
 * accounting for wide emoji glyphs and zero-width variation selectors.
 *
 * section: arguments
 * - text (string): input text
 *
 * section: return value
 * - length (number): visible terminal column width
 *
 * section: example
 * const len = visible_length('\x1b[1mstatus\x1b[0m');
 */
export function visible_length(text = '') {
  const plain = strip_ansi(text);
  let cols = 0;
  for (const ch of plain) {
    cols += codepoint_display_width(ch.codePointAt(0));
  }
  return cols;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: applies an ansi style sequence when colour mode is enabled
 * verbose: wraps text in the given ansi prefix and reset code if enabled is truthy.
 *
 * section: arguments
 * - text (string): text to style
 * - style (string): ansi escape sequence prefix
 * - enabled (boolean, optional): whether colour output is enabled
 *
 * section: return value
 * - styled (string): ansi-styled or plain string
 *
 * section: example
 * const green = colourise('passed', '\x1b[32m', true);
 */
export function colourise(text, style, enabled = true) {
  if (!enabled || !style) {
    return String(text ?? '');
  }
  return `${style}${String(text ?? '')}${ANSI.reset}`;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: truncates a string to a maximum visible width without splitting surrogate pairs
 * verbose: iterates by unicode code points so astral-plane emojis are never sliced into lone
 * surrogates and appends an ellipsis if truncated.
 *
 * section: arguments
 * - text (string): input text
 * - max_cols (number): maximum allowed visible terminal columns
 * - ellipsis (string, optional): truncation suffix
 *
 * section: return value
 * - truncated (string): width-bounded string
 *
 * section: example
 * const short = truncate_visible('very long text', 8);
 */
export function truncate_visible(text = '', max_cols = 80, ellipsis = '…') {
  const plain = strip_ansi(text);
  if (max_cols <= 0) return '';
  const total_width = visible_length(plain);
  if (total_width <= max_cols) {
    return plain;
  }
  const ellipsis_width = visible_length(ellipsis);
  const target_width = Math.max(0, max_cols - ellipsis_width);
  let acc_width = 0;
  let out = '';
  for (const ch of plain) {
    const w = codepoint_display_width(ch.codePointAt(0));
    if (acc_width + w > target_width) {
      break;
    }
    out += ch;
    acc_width += w;
  }
  if (max_cols <= ellipsis_width) {
    return out;
  }
  return `${out}${ellipsis}`;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: pads a string with trailing characters to match a target visible column width
 * verbose: measures visible length and appends fill characters up to target_cols.
 *
 * section: arguments
 * - text (string): input text
 * - target_cols (number): desired visible width
 * - fill (string, optional): padding character
 *
 * section: return value
 * - padded (string): padded string
 *
 * section: example
 * const row = pad_visible('item', 12);
 */
export function pad_visible(text = '', target_cols = 80, fill = ' ') {
  const len = visible_length(text);
  if (len >= target_cols) {
    return String(text);
  }
  return `${String(text)}${fill.repeat(target_cols - len)}`;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: formats a visual unicode progress bar with completion ratio
 * verbose: renders filled and empty block characters representing completed vs total items.
 *
 * section: arguments
 * - completed (number): completed count
 * - total (number): total count
 * - width (number, optional): bar character width
 * - colour (boolean, optional): enable ansi colouring
 *
 * section: return value
 * - bar (string): formatted progress bar string
 *
 * section: example
 * const bar = format_progress_bar(6, 9, 8, true);
 */
export function format_progress_bar(completed = 0, total = 0, width = 8, colour = true) {
  const safe_total = Math.max(0, Number(total) || 0);
  const safe_done = Math.min(safe_total, Math.max(0, Number(completed) || 0));
  const ratio = safe_total > 0 ? safe_done / safe_total : 0;
  const filled = Math.round(ratio * width);
  const empty = Math.max(0, width - filled);
  const filled_str = colourise('█'.repeat(filled), safe_done === safe_total && safe_total > 0 ? ANSI.emerald : ANSI.cyan, colour);
  const empty_str = colourise('░'.repeat(empty), ANSI.slate, colour);
  return `[${filled_str}${empty_str}] ${safe_done}/${safe_total}`;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: maps a status string to its visual icon, label, and ansi colour
 * verbose: normalises ticket, phase, and gate statuses into consistent icons and palette colours.
 *
 * section: arguments
 * - status (string): raw status identifier
 * - colour (boolean, optional): whether ansi colour is enabled
 *
 * section: return value
 * - badge (object): { icon, label, ansi, formatted }
 *
 * section: example
 * const b = resolve_status_badge('completed', true);
 */
export function resolve_status_badge(status = 'pending', colour = true) {
  const norm = String(status || 'pending').toLowerCase();
  if (norm === 'completed' || norm === 'passed' || norm === 'approved' || norm === 'accepted' || norm === 'merged') {
    return {
      icon: '✔',
      label: norm,
      ansi: ANSI.emerald,
      formatted: colourise(`✔ ${norm}`, ANSI.emerald, colour)
    };
  }
  if (norm === 'active' || norm === 'running' || norm === 'in_progress' || norm === 'claimed' || norm === 'evaluating' || norm === 'active_development') {
    return {
      icon: '⚡',
      label: norm,
      ansi: ANSI.cyan,
      formatted: colourise(`⚡ ${norm}`, `${ANSI.bold}${ANSI.cyan}`, colour)
    };
  }
  if (norm === 'awaiting_input' || norm === 'paused' || norm === 'clarification') {
    return {
      icon: '⏸',
      label: norm,
      ansi: ANSI.amber,
      formatted: colourise(`⏸ ${norm}`, ANSI.amber, colour)
    };
  }
  if (norm === 'failed' || norm === 'blocked' || norm === 'rejected' || norm === 'remediation_required') {
    return {
      icon: '✖',
      label: norm,
      ansi: ANSI.crimson,
      formatted: colourise(`✖ ${norm}`, ANSI.crimson, colour)
    };
  }
  return {
    icon: '○',
    label: norm,
    ansi: ANSI.slate,
    formatted: colourise(`○ ${norm}`, ANSI.slate, colour)
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: renders a single live process execution event line with icons and phase context
 * verbose: formats ticket_started, workflow_step_started, ticket_completed, and gate events
 * with role icons, ansi colours, and a mini phase progress indicator during top-level process runs.
 *
 * section: arguments
 * - ev (object): progress event payload from worker pool or supervisor
 * - options (object, optional): { colour, harness }
 *
 * section: return value
 * - line (string): formatted terminal line
 *
 * section: example
 * const line = render_process_execution_step({ event: 'ticket_started', role: 'product-manager', ticket_id: 'demo:prd' });
 */
export function render_process_execution_step(ev = {}, options = {}) {
  const colour = options.colour !== false;
  const role_icons = {
    'sdlc-supervisor': '🧭',
    'product-manager': '📋',
    'system-architect': '🏛️',
    'software-engineer': '⚙️',
    'security-engineer': '🔒',
    'qa-engineer': '🧪',
    'devops-engineer': '🚀',
    'autonomous-engineer': '🛠️'
  };
  const role_icon = role_icons[ev.role] || '🤖';
  const role_tag = colourise(`[${role_icon} ${ev.role || 'agent'}]`, ANSI.lavender, colour);

  if (ev.event === 'ticket_started') {
    const phase_label = ev.phase || 'active';
    const phase_meta = PHASE_VISUALS.find((p) => p.short_id === phase_label || p.id === phase_label);
    const p_icon = phase_meta ? phase_meta.icon : '⚡';
    return (
      `  ${colourise('╭──', ANSI.cyan, colour)} ${colourise('⚡', ANSI.cyan, colour)} ${role_tag} ` +
      `claimed ${colourise(ev.ticket_id || 'ticket', ANSI.bold, colour)} — ${ev.title || ''} ` +
      `${colourise(`[${p_icon} phase: ${phase_label} • workflow: ${ev.workflow_id || 'role'}]`, ANSI.bright_blue, colour)}`
    );
  }

  if (ev.event === 'workflow_step_started') {
    return (
      `  ${colourise('│  ↳', ANSI.cyan, colour)} ${colourise(`step:${ev.step_id || 'exec'}`, ANSI.amber, colour)} ` +
      `${colourise(ev.description || 'executing workflow step', ANSI.slate, colour)}`
    );
  }

  if (ev.event === 'ticket_completed') {
    const ok = ev.approved !== false;
    const badge = ok
      ? colourise('✔ review approved', ANSI.emerald, colour)
      : colourise('✖ review rejected', ANSI.crimson, colour);
    return (
      `  ${colourise('╰──', ok ? ANSI.emerald : ANSI.crimson, colour)} ${badge} ${role_tag} ` +
      `completed ${colourise(ev.ticket_id || 'ticket', ANSI.bold, colour)}`
    );
  }

  if (ev.event === 'gate_evaluated') {
    const passed = ev.decision === 'passed';
    const g_badge = passed
      ? colourise('🛡️  gate passed ✔', `${ANSI.bold}${ANSI.emerald}`, colour)
      : colourise('🛡️  gate blocked ✖', `${ANSI.bold}${ANSI.crimson}`, colour);
    return `  ${g_badge} — ${colourise(ev.gate_id || 'review_gate', ANSI.amber, colour)}`;
  }

  return `  ${colourise('•', ANSI.cyan, colour)} ${role_tag} ${ev.description || ev.event || 'progress'}`;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates the cli status bar layout, phase/gate pipeline visualiser, and treeview menu controller
 * verbose: manages the active terminal window (f1 chat, f2 phases & gates, f3 doc store tree,
 * f4 top-level items tree, f5 memory & knowledge), builds hierarchical trees from .sdlc/store
 * and harness catalogues, and renders responsive ansi frames for any terminal width.
 *
 * section: arguments
 * - options (object, optional): { harness, active_agent, colour, columns, rows, project_slug, on_select_agent, on_select_work_item, on_select_process, on_window_change }
 *
 * section: return value
 * - layout (object): status bar and multi-window tui controller
 *
 * section: example
 * const layout = create_cli_status_bar_layout({ harness });
 */
export function create_cli_status_bar_layout(options = {}) {
  let active_window = options.initial_window || 'chat';
  let active_agent = options.active_agent || 'product-manager';
  const colour_enabled = options.colour !== undefined
    ? Boolean(options.colour)
    : Boolean(process.stdout && process.stdout.isTTY);

  // treeview state per tree window ('doc_store' and 'top_level_items')
  const tree_state = {
    doc_store: {
      cursor: 0,
      collapsed_ids: []
    },
    top_level_items: {
      cursor: 0,
      collapsed_ids: []
    }
  };

  // scrollable chat log, live pipeline log, dual-pane controller, and multi-line input box state
  const chat_messages = [];
  const pipeline_messages = [];
  let chat_scroll_offset = 0;
  let pipeline_log_scroll_offset = 0;
  let pipeline_scroll_offset = 0;
  let active_chat_pane = 'chat';
  const input_config = resolve_chat_input_config(options.input_config || {}, options.env || process.env);
  const multiline_input = create_multiline_scrollable_chat_input({
    ...input_config,
    env: options.env || process.env
  });
  const dual_pane_panel = create_dual_window_chat_live_pipeline_panel({
    split_ratio: options.split_ratio !== undefined ? options.split_ratio : 0.6,
    env: options.env || process.env
  });
  const input_state = {
    prompt: options.input_prompt || 'you> ',
    text: '',
    cursor: 0,
    scroll_offset: 0,
    viewport_rows: input_config.default_rows,
    total_visual_rows: 1
  };

  function get_harness() {
    if (typeof options.get_harness === 'function') {
      return options.get_harness();
    }
    return options.harness || null;
  }

  function get_columns(override_cols) {
    if (typeof override_cols === 'number' && override_cols > 0) {
      return override_cols;
    }
    if (typeof options.columns === 'number' && options.columns > 0) {
      return options.columns;
    }
    if (process.stdout && typeof process.stdout.columns === 'number' && process.stdout.columns > 0) {
      return process.stdout.columns;
    }
    return 100;
  }

  function get_rows(override_rows) {
    if (typeof override_rows === 'number' && override_rows > 0) {
      return override_rows;
    }
    if (typeof options.rows === 'number' && options.rows > 0) {
      return options.rows;
    }
    if (process.stdout && typeof process.stdout.rows === 'number' && process.stdout.rows > 0) {
      return process.stdout.rows;
    }
    return 28;
  }

  function resolve_telemetry_snapshot() {
    const harness = get_harness();
    const workspace_root = options.workspace_root || (harness && harness.workspace_root) || process.cwd();
    const project_slug = options.project_slug || path.basename(workspace_root) || 'dual-engine-harness';
    const sovereign_state = harness && typeof harness.get_project_state === 'function'
      ? harness.get_project_state()
      : 'active_development';
    const macro_phase = harness && typeof harness.get_macro_phase === 'function'
      ? harness.get_macro_phase()
      : 'idle';
    const active_gate = harness && typeof harness.get_active_gate === 'function'
      ? harness.get_active_gate()
      : null;
    const active_item = harness && typeof harness.get_active_work_item === 'function'
      ? harness.get_active_work_item()
      : null;
    const all_work = harness && typeof harness.list_work_items === 'function'
      ? harness.list_work_items()
      : [];
    const board = harness && typeof harness.get_work_board === 'function'
      ? harness.get_work_board()
      : null;

    const target_epic = active_item ? active_item.name : null;
    const summary = board
      ? board.get_board_summary(target_epic || undefined)
      : { counts: { completed: 0, total: 0, ready: 0, awaiting_input: 0 } };

    const effective_phase = (active_item && active_item.phase) || macro_phase || 'idle';
    const phase_visual = PHASE_VISUALS.find(
      (p) => p.id === effective_phase || p.short_id === effective_phase
    ) || {
      id: effective_phase,
      short_id: effective_phase,
      num: '00',
      name: effective_phase === 'completed' ? 'completed' : (effective_phase === 'idle' ? 'idle' : effective_phase),
      icon: effective_phase === 'completed' ? '✔' : '⚡'
    };

    return {
      project_slug,
      active_agent,
      sovereign_state,
      macro_phase,
      effective_phase,
      phase_visual,
      active_gate,
      active_item,
      all_work,
      counts: summary.counts || { completed: 0, total: 0, ready: 0, awaiting_input: 0 }
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: renders the pinned top status bar with responsive terminal truncation
   * verbose: formats the top border, telemetry row (project, agent, phase, active work item,
   * ticket progress bar), function-key tab bar (f1-f5), and bottom border within the column budget.
   *
   * section: arguments
   * - render_opts (object, optional): { columns, colour }
   *
   * section: return value
   * - banner (string): multi-line status bar string
   *
   * section: example
   * const bar = layout.render_status_bar({ columns: 100 });
   */
  function render_status_bar(render_opts = {}) {
    const cols = Math.max(24, get_columns(render_opts.columns));
    const col = render_opts.colour !== undefined ? Boolean(render_opts.colour) : colour_enabled;
    const snap = resolve_telemetry_snapshot();
    const inner_cols = Math.max(20, cols - 4);

    const work_name = snap.active_item ? snap.active_item.name : 'none';
    const work_label = snap.active_item
      ? `${snap.active_item.name} [${snap.active_item.type || 'feature'}]`
      : 'none';
    const phase_str = `${snap.phase_visual.icon} ${snap.phase_visual.name}`;

    // responsive truncation for narrow (< 80 cols), standard (80..135), and wide (> 135) viewports
    let row1_plain;
    if (cols < 80) {
      row1_plain = truncate_visible(
        `🧭 ${snap.project_slug} │ 🤖 ${snap.active_agent} │ ${phase_str} │ 🎯 ${work_name} (${snap.counts.completed}/${snap.counts.total})`,
        inner_cols
      );
    } else if (cols < 136) {
      const filled_blocks = Math.round((snap.counts.total > 0 ? snap.counts.completed / snap.counts.total : 0) * 5);
      const prog_mini = `[${'█'.repeat(filled_blocks)}${'░'.repeat(5 - filled_blocks)}] ${snap.counts.completed}/${snap.counts.total}`;
      row1_plain = truncate_visible(
        `🧭 ${snap.project_slug} │ 🤖 ${snap.active_agent} │ ⚡ ${phase_str} │ 🎯 ${work_label} ${prog_mini}`,
        inner_cols
      );
    } else {
      const filled_blocks = Math.round((snap.counts.total > 0 ? snap.counts.completed / snap.counts.total : 0) * 6);
      const prog_plain = `[${'█'.repeat(filled_blocks)}${'░'.repeat(6 - filled_blocks)}] ${snap.counts.completed}/${snap.counts.total}`;
      row1_plain = truncate_visible(
        `🧭 project: ${snap.project_slug} │ 🤖 agent: ${snap.active_agent} │ 🏛️ ${snap.sovereign_state} │ ⚡ phase: ${phase_str} │ 🎯 work: ${work_label} ${prog_plain}`,
        inner_cols
      );
    }

    const padded_row1 = pad_visible(row1_plain, inner_cols);
    const styled_row1 = colourise(padded_row1, `${ANSI.bold}${ANSI.cyan}`, col);

    // row 2: function key window tabs (f1 - f5)
    const total_long_len = CLI_WINDOWS.reduce((acc, w, idx) => acc + w.label.length + 2 + (idx > 0 ? 1 : 0), 0);
    const use_short_tabs = inner_cols < total_long_len;
    const tab_tokens = [];
    for (let i = 0; i < CLI_WINDOWS.length; i += 1) {
      const win = CLI_WINDOWS[i];
      const text = use_short_tabs ? ` ${win.short_label} ` : ` ${win.label} `;
      tab_tokens.push({
        id: win.id,
        raw: text,
        active: win.id === active_window
      });
    }

    let acc_len = 0;
    const fitted_tabs = [];
    for (let i = 0; i < tab_tokens.length; i += 1) {
      const t = tab_tokens[i];
      const sep = fitted_tabs.length > 0 ? ' ' : '';
      if (acc_len + sep.length + t.raw.length <= inner_cols) {
        if (sep) fitted_tabs.push(sep);
        fitted_tabs.push(
          colourise(t.raw, t.active ? ANSI.bg_active_tab : ANSI.bg_inactive_tab, col)
        );
        acc_len += sep.length + t.raw.length;
      }
    }
    const tab_padding = ' '.repeat(Math.max(0, inner_cols - acc_len));
    const row2_content = `${fitted_tabs.join('')}${tab_padding}`;

    const top_border = colourise(`╭─${'─'.repeat(inner_cols)}─╮`, ANSI.bright_blue, col);
    const mid_line1 = `${colourise('│ ', ANSI.bright_blue, col)}${styled_row1}${colourise(' │', ANSI.bright_blue, col)}`;
    const mid_line2 = `${colourise('│ ', ANSI.bright_blue, col)}${row2_content}${colourise(' │', ANSI.bright_blue, col)}`;
    const bot_border = colourise(`╰─${'─'.repeat(inner_cols)}─╯`, ANSI.bright_blue, col);

    return [top_border, mid_line1, mid_line2, bot_border].join('\n');
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: renders the visual 10-phase and 4-gate pipeline board with icons and statuses
   * verbose: inspects the active or specified work item, its work board tickets, and review gate
   * evaluations to render a colourised pipeline of all 10 sdlc phases and 4 formal review gates.
   *
   * section: arguments
   * - pipeline_opts (object, optional): { epic_id, columns, colour }
   *
   * section: return value
   * - view (string): formatted multi-line phase and gate pipeline board
   *
   * section: example
   * const board_str = layout.render_phase_gate_pipeline({ epic_id: 'auth-feature' });
   */
  function render_phase_gate_pipeline(pipeline_opts = {}) {
    const cols = Math.max(60, get_columns(pipeline_opts.columns));
    const col = pipeline_opts.colour !== undefined ? Boolean(pipeline_opts.colour) : colour_enabled;
    const inner_cols = Math.max(54, cols - 4);
    const harness = get_harness();
    const board = harness && typeof harness.get_work_board === 'function' ? harness.get_work_board() : null;
    const gatekeeper = harness && typeof harness.get_gatekeeper === 'function' ? harness.get_gatekeeper() : null;

    const target_name = pipeline_opts.epic_id
      || (harness && typeof harness.get_active_work_item === 'function' && harness.get_active_work_item()?.name)
      || null;
    const work_item = target_name && harness && typeof harness.get_work_item === 'function'
      ? harness.get_work_item(target_name)
      : (harness && typeof harness.get_active_work_item === 'function' ? harness.get_active_work_item() : null);

    const epic_id = work_item?.name || target_name || 'workspace';
    const current_work_phase = work_item?.phase || (harness ? harness.get_macro_phase() : 'idle');
    const current_phase_idx = WORK_PHASE_ORDER.indexOf(current_work_phase);

    const tickets = board ? board.list_tickets(target_name ? { epic_id: target_name } : {}) : [];
    const summary = board
      ? board.get_board_summary(target_name || undefined)
      : { counts: { completed: 0, total: 0 } };
    const receipts = gatekeeper && typeof gatekeeper.get_receipts === 'function'
      ? gatekeeper.get_receipts()
      : [];

    const lines = [];
    const border_col = ANSI.bright_blue;
    lines.push(colourise(`╭─${'─'.repeat(inner_cols)}─╮`, border_col, col));

    const header_title = `🏛️  sdlc 10-phase & 4-gate execution pipeline — epic: ${epic_id} (${work_item?.type || 'feature'})`;
    lines.push(
      `${colourise('│ ', border_col, col)}${colourise(pad_visible(truncate_visible(header_title, inner_cols), inner_cols), `${ANSI.bold}${ANSI.cyan}`, col)}${colourise(' │', border_col, col)}`
    );

    const prog_bar = format_progress_bar(summary.counts.completed, summary.counts.total, 14, col);
    const sub_header = `⚡ current phase: ${current_work_phase}   •   tickets: ${prog_bar}`;
    lines.push(
      `${colourise('│ ', border_col, col)}${pad_visible(sub_header, inner_cols)}${colourise(' │', border_col, col)}`
    );
    lines.push(colourise(`├─${'─'.repeat(inner_cols)}─┤`, border_col, col));

    for (let i = 0; i < PHASE_VISUALS.length; i += 1) {
      const p = PHASE_VISUALS[i];
      const p_order_idx = WORK_PHASE_ORDER.indexOf(p.short_id);
      const matching_tickets = tickets.filter((t) =>
        p.ticket_suffixes.some((sfx) => t.id.endsWith(`:${sfx}`))
      );

      let phase_status = 'pending';
      if (current_work_phase === 'completed') {
        phase_status = 'completed';
      } else if (matching_tickets.length > 0 && matching_tickets.every((t) => t.status === 'completed')) {
        phase_status = 'completed';
      } else if (matching_tickets.some((t) => t.status === 'awaiting_input')) {
        phase_status = 'awaiting_input';
      } else if (matching_tickets.some((t) => t.status === 'in_progress' || t.status === 'claimed')) {
        phase_status = 'active';
      } else if (current_work_phase === p.short_id || current_work_phase === p.id) {
        phase_status = 'active';
      } else if (current_phase_idx > p_order_idx && p_order_idx !== -1) {
        phase_status = 'completed';
      }

      const badge = resolve_status_badge(phase_status, col);
      const ticket_tags = matching_tickets.length > 0
        ? matching_tickets
          .map((t) => {
            const short_t = t.id.includes(':') ? `:${t.id.split(':').pop()}` : t.id;
            const tb = resolve_status_badge(t.status, false);
            return `${tb.icon} ${short_t}`;
          })
          .join(', ')
        : p.description;

      const left_col = `${badge.icon} phase ${p.num} │ ${p.icon} ${p.name.padEnd(19, ' ')}`;
      const mid_col = `[${badge.label.padEnd(10, ' ')}]`;
      const raw_line = truncate_visible(`${left_col} ${mid_col}  ${ticket_tags}`, inner_cols);
      const padded_line = pad_visible(raw_line, inner_cols);
      const row_style = phase_status === 'completed'
        ? ANSI.emerald
        : (phase_status === 'active' ? `${ANSI.bold}${ANSI.cyan}` : (phase_status === 'awaiting_input' ? ANSI.amber : ANSI.slate));

      lines.push(`${colourise('│ ', border_col, col)}${colourise(padded_line, row_style, col)}${colourise(' │', border_col, col)}`);

      if (p.gate_after) {
        const g = p.gate_after;
        const gate_phase_name = `gate_${g.num}_evaluating`;
        const gate_order_idx = WORK_PHASE_ORDER.indexOf(gate_phase_name);
        const has_receipt = receipts.some((r) => r.gate_id === g.id && r.status === 'passed');

        let gate_status = 'pending';
        if (current_work_phase === 'completed' || has_receipt || (current_phase_idx > gate_order_idx && gate_order_idx !== -1)) {
          gate_status = 'passed';
        } else if (current_work_phase === gate_phase_name) {
          gate_status = 'evaluating';
        } else if (phase_status === 'completed') {
          gate_status = 'passed';
        }

        const g_badge = resolve_status_badge(gate_status, col);
        const gate_raw = truncate_visible(
          `  ╰─➤ 🛡️  ${g.name.padEnd(32, ' ')} [${g_badge.icon} ${gate_status.padEnd(8, ' ')}]  (${g.invariants})`,
          inner_cols
        );
        const gate_padded = pad_visible(gate_raw, inner_cols);
        const gate_style = gate_status === 'passed'
          ? `${ANSI.bold}${ANSI.amber}`
          : (gate_status === 'evaluating' ? `${ANSI.bold}${ANSI.cyan}` : ANSI.slate);

        lines.push(`${colourise('│ ', border_col, col)}${colourise(gate_padded, gate_style, col)}${colourise(' │', border_col, col)}`);
      }
    }

    lines.push(colourise(`╰─${'─'.repeat(inner_cols)}─╯`, border_col, col));
    return lines.join('\n');
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: builds the hierarchical tree model for browsing .sdlc/store entities
   * verbose: groups prds, user stories, adrs, interface contracts, threat models, qa reports,
   * release manifests, retrospectives, and work board tickets into an expandable tree structure.
   *
   * section: arguments
   * none
   *
   * section: return value
   * - nodes (array): flattened list of visible tree nodes with depth and metadata
   *
   * section: example
   * const nodes = layout.build_doc_store_tree();
   */
  function build_doc_store_tree() {
    const harness = get_harness();
    const store = harness && typeof harness.get_store === 'function' ? harness.get_store() : null;
    const board = harness && typeof harness.get_work_board === 'function' ? harness.get_work_board() : null;
    const collapsed = tree_state.doc_store.collapsed_ids;

    if (store && typeof store.list_entities === 'function') {
      const existing_prds = store.list_entities(DocumentEntityTypes.PRD);
      if (existing_prds.length === 0) {
        try {
          const adapter = typeof store.get_adapter === 'function' ? store.get_adapter() : null;
          const store_root = adapter && typeof adapter.get_store_root === 'function' ? adapter.get_store_root() : '';
          const docs_candidate = store_root ? path.resolve(store_root, '..', '..', 'docs') : '';
          if (docs_candidate && fs.existsSync(path.join(docs_candidate, '01-product'))) {
            migrate_all_documents(docs_candidate, store);
          }
        } catch (_err) {
          // ignore auto-hydration errors
        }
      }
    }

    const categories = [
      {
        id: 'cat:prd',
        icon: '📁',
        label: '01-product — product requirements (prds)',
        entities: store ? store.list_entities(DocumentEntityTypes.PRD) : [],
        child_icon: '📄',
        type: 'prd'
      },
      {
        id: 'cat:user_story',
        icon: '📁',
        label: '01-product — user stories & bdd criteria',
        entities: store ? store.list_entities(DocumentEntityTypes.USER_STORY) : [],
        child_icon: '📝',
        type: 'user_story'
      },
      {
        id: 'cat:adr',
        icon: '📁',
        label: '02-architecture — architectural decision records (adrs)',
        entities: store ? store.list_entities(DocumentEntityTypes.ADR) : [],
        child_icon: '🏛️',
        type: 'adr'
      },
      {
        id: 'cat:interface_contract',
        icon: '📁',
        label: '04-interfaces — interface contracts',
        entities: store ? store.list_entities(DocumentEntityTypes.INTERFACE_CONTRACT) : [],
        child_icon: '🔌',
        type: 'interface_contract'
      },
      {
        id: 'cat:threat_model',
        icon: '📁',
        label: '07-security — stride threat models',
        entities: store ? store.list_entities(DocumentEntityTypes.THREAT_MODEL) : [],
        child_icon: '🔒',
        type: 'threat_model'
      },
      {
        id: 'cat:test_report',
        icon: '📁',
        label: '09-qa-testing — qa regression test reports',
        entities: store ? store.list_entities(DocumentEntityTypes.TEST_REPORT) : [],
        child_icon: '🧪',
        type: 'test_report'
      },
      {
        id: 'cat:release_manifest',
        icon: '📁',
        label: '08-operations — release manifests & retrospectives',
        entities: [
          ...(store ? store.list_entities(DocumentEntityTypes.RELEASE_MANIFEST) : []),
          ...(store ? store.list_entities(DocumentEntityTypes.RETROSPECTIVE) : [])
        ],
        child_icon: '🚀',
        type: 'release_manifest'
      },
      {
        id: 'cat:tickets',
        icon: '📁',
        label: 'work board — governed execution tickets',
        entities: board ? board.list_tickets() : [],
        child_icon: '🎫',
        type: 'ticket'
      }
    ];

    const flat = [];
    for (let c = 0; c < categories.length; c += 1) {
      const cat = categories[c];
      const is_collapsed = collapsed.includes(cat.id);
      flat.push({
        id: cat.id,
        depth: 0,
        is_branch: true,
        expanded: !is_collapsed,
        icon: cat.icon,
        label: `${cat.label} (${cat.entities.length})`,
        summary: `contains ${cat.entities.length} ${cat.type} record(s) in .sdlc/store`,
        entity: null
      });

      if (!is_collapsed) {
        for (let e = 0; e < cat.entities.length; e += 1) {
          const ent = cat.entities[e];
          const status_str = ent.status || ent.gate_verdict || (ent.version ? `v${ent.version}` : 'stored');
          const badge = resolve_status_badge(status_str, false);
          const title_str = ent.title || ent.component || ent.milestone || ent.slug || ent.id;
          const detail_lines = [
            `id          : ${ent.id}`,
            `type        : ${cat.type}`,
            `title       : ${title_str}`,
            `status      : ${badge.icon} ${status_str}`,
            ent.linked_prd_id ? `linked prd  : ${ent.linked_prd_id}` : '',
            ent.executive_summary?.problem ? `problem     : ${ent.executive_summary.problem}` : '',
            ent.decision ? `decision    : ${ent.decision}` : '',
            ent.context ? `context     : ${ent.context}` : '',
            Array.isArray(ent.functional_requirements) && ent.functional_requirements.length > 0
              ? `requirements: ${ent.functional_requirements.map((r) => r.title || r).slice(0, 3).join('; ')}`
              : ''
          ].filter(Boolean);

          flat.push({
            id: `doc:${ent.id}`,
            depth: 1,
            is_branch: false,
            expanded: false,
            icon: cat.child_icon,
            label: `${ent.id} — ${title_str} [${badge.icon} ${status_str}]`,
            summary: detail_lines.join('\n'),
            entity: ent,
            entity_type: cat.type
          });
        }
      }
    }

    return flat;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: builds the hierarchical tree model for browsing and selecting top-level sdlc items
   * verbose: organises concurrent work items, 7 mastra specialist agents, 25 governed high-level
   * processes, and 15 governance skills into an interactive selection treeview.
   *
   * section: arguments
   * none
   *
   * section: return value
   * - nodes (array): flattened list of visible tree nodes for top-level items
   *
   * section: example
   * const nodes = layout.build_top_level_items_tree();
   */
  function build_top_level_items_tree() {
    const harness = get_harness();
    const collapsed = tree_state.top_level_items.collapsed_ids;
    const work_items = harness && typeof harness.list_work_items === 'function' ? harness.list_work_items() : [];
    const processes = list_high_level_processes();
    const phases = list_sdlc_phases();
    const gates = list_review_gates();
    const skills = Object.entries(GOVERNANCE_SKILLS);

    const agent_items = [
      { id: 'product-manager', title: 'product manager specialist (default)', focus: 'collaborative product discovery, feature suggestions, prds, user stories, and pr merge sign-off' },
      { id: 'autonomous-engineer', title: 'untethered autonomous engineer & sdlc consumer', focus: 'independent defect diagnostics and direct workspace patching without phase-lock restrictions, plus full capability to consume governed sdlc processes' },
      { id: 'system-architect', title: 'system architect specialist', focus: 'authors adrs, modular boundaries, and interface contracts' },
      { id: 'software-engineer', title: 'software engineer specialist', focus: 'executes tdd red-green-refactor cycles and patches defects' },
      { id: 'security-engineer', title: 'security engineer specialist', focus: 'conducts stride threat modelling and owasp security audits' },
      { id: 'qa-engineer', title: 'quality assurance specialist', focus: 'executes regression suites and verifies test immutability' },
      { id: 'devops-engineer', title: 'devops & release specialist', focus: 'manages semantic releases, receipts, and retrospectives' },
      { id: 'sdlc-supervisor', title: 'tier 1 supervisory governor (agent-mediated)', focus: 'internal orchestrator operating xstate statechart, work board, review gatekeeper, and entity store on behalf of specialist agents' }
    ];

    const groups = [
      {
        id: 'group:work_items',
        icon: '🎯',
        label: `concurrent work items (${work_items.length})`,
        children: work_items.map((wi) => {
          const counts = wi.board_summary?.counts || { completed: 0, total: 0 };
          const badge = resolve_status_badge(wi.status || wi.phase, false);
          return {
            id: `work:${wi.name}`,
            action_type: 'work_item',
            target_id: wi.name,
            icon: wi.focused ? '⭐' : '🎯',
            label: `${wi.name} [${wi.type}] — phase: ${wi.phase} (${counts.completed}/${counts.total}) ${wi.focused ? '*focused*' : ''}`,
            summary: `work item   : ${wi.name}\npathway     : ${wi.type}\nphase       : ${wi.phase}\nstatus      : ${badge.icon} ${wi.status}\ntickets     : ${counts.completed}/${counts.total} completed\naction      : press enter (or /tree select work:${wi.name}) to focus this work item`
          };
        })
      },
      {
        id: 'group:agents',
        icon: '🤖',
        label: `mastra conversational & role agents (${agent_items.length})`,
        children: agent_items.map((ag) => ({
          id: `agent:${ag.id}`,
          action_type: 'agent',
          target_id: ag.id,
          icon: ag.id === active_agent ? '🟢' : '🤖',
          label: `${ag.id} (${ag.title}) ${ag.id === active_agent ? '*active*' : ''}`,
          summary: `agent id    : ${ag.id}\nrole title  : ${ag.title}\nfocus       : ${ag.focus}\naction      : press enter (or /tree select agent:${ag.id}) to switch active chat agent`
        }))
      },
      {
        id: 'group:processes',
        icon: '⚙️',
        label: `governed high-level processes (${processes.length})`,
        children: processes.map((p) => ({
          id: `process:${p.id}`,
          action_type: 'process',
          target_id: p.id,
          icon: '⚡',
          label: `${p.id} [${p.domain}] — ${p.description}`,
          summary: `process id  : ${p.id}\ndomain      : ${p.domain}\ncommit type : ${p.commit_type}\ndescription : ${p.description}\naction      : press enter (or /tree select process:${p.id}) to select process profile`
        }))
      },
      {
        id: 'group:phases_gates',
        icon: '🏛️',
        label: `sdlc macro phases (${phases.length}) & review gates (${gates.length})`,
        children: [
          ...phases.map((ph) => ({
            id: `phase:${ph.id}`,
            action_type: 'phase',
            target_id: ph.id,
            icon: '🔹',
            label: `${ph.id} (${ph.name})${ph.gate ? ` ➔ 🛡️ ${ph.gate}` : ''}`,
            summary: `phase id    : ${ph.id}\nname        : ${ph.name}\ndescription : ${ph.description}\nreview gate : ${ph.gate || 'none'}`
          })),
          ...gates.map((gt) => ({
            id: `gate:${gt.id}`,
            action_type: 'gate',
            target_id: gt.id,
            icon: '🛡️',
            label: `${gt.id} (${gt.name})`,
            summary: `gate id     : ${gt.id}\nname        : ${gt.name}\nevaluates   : ${gt.evaluates.join(', ')}\ninvariants  : ${gt.invariants.join('; ')}`
          }))
        ]
      },
      {
        id: 'group:skills',
        icon: '📚',
        label: `compiled 7-tier governance skills (${skills.length})`,
        children: skills.map(([key, sk]) => ({
          id: `skill:${key}`,
          action_type: 'skill',
          target_id: key,
          icon: '📘',
          label: `${key} — ${sk.description}`,
          summary: `skill id    : ${key}\ndescription : ${sk.description}`
        }))
      }
    ];

    const flat = [];
    for (let g = 0; g < groups.length; g += 1) {
      const grp = groups[g];
      const is_collapsed = collapsed.includes(grp.id);
      flat.push({
        id: grp.id,
        depth: 0,
        is_branch: true,
        expanded: !is_collapsed,
        icon: grp.icon,
        label: grp.label,
        summary: `category group containing ${grp.children.length} selectable item(s). press left/right or enter to expand/collapse.`
      });

      if (!is_collapsed) {
        for (let c = 0; c < grp.children.length; c += 1) {
          const ch = grp.children[c];
          flat.push({
            ...ch,
            depth: 1,
            is_branch: false,
            expanded: false
          });
        }
      }
    }

    return flat;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: renders an interactive treeview window with node list and inspector preview pane
   * verbose: renders either the doc_store tree (f3) or top_level_items tree (f4) with selection
   * cursor highlighting, expand/collapse glyphs, and a bottom inspector panel for the active node.
   *
   * section: arguments
   * - tree_kind (string): 'doc_store' or 'top_level_items'
   * - render_opts (object, optional): { columns, colour, max_rows }
   *
   * section: return value
   * - view (string): formatted multi-line treeview window
   *
   * section: example
   * const tree_str = layout.render_treeview_window('doc_store');
   */
  function render_treeview_window(tree_kind = 'doc_store', render_opts = {}) {
    const cols = Math.max(60, get_columns(render_opts.columns));
    const col = render_opts.colour !== undefined ? Boolean(render_opts.colour) : colour_enabled;
    const inner_cols = Math.max(54, cols - 4);
    const max_rows = render_opts.max_rows || 18;

    const is_docs = tree_kind === 'doc_store';
    const nodes = is_docs ? build_doc_store_tree() : build_top_level_items_tree();
    const state = is_docs ? tree_state.doc_store : tree_state.top_level_items;

    if (state.cursor >= nodes.length) {
      state.cursor = Math.max(0, nodes.length - 1);
    }

    const title = is_docs
      ? '🌳 doc store treeview browser (.sdlc/store & docs/) — keys: ↑/↓ navigate • ←/→ fold • enter inspect • f1 chat'
      : '📋 top-level items treeview selector — keys: ↑/↓ navigate • ←/→ fold • enter activate/focus • f1 chat';

    const lines = [];
    const border_col = ANSI.bright_blue;
    lines.push(colourise(`╭─${'─'.repeat(inner_cols)}─╮`, border_col, col));
    lines.push(
      `${colourise('│ ', border_col, col)}${colourise(pad_visible(truncate_visible(title, inner_cols), inner_cols), `${ANSI.bold}${ANSI.cyan}`, col)}${colourise(' │', border_col, col)}`
    );
    lines.push(colourise(`├─${'─'.repeat(inner_cols)}─┤`, border_col, col));

    const half = Math.floor(max_rows / 2);
    let start_idx = Math.max(0, state.cursor - half);
    const end_idx = Math.min(nodes.length, start_idx + max_rows);
    if (end_idx - start_idx < max_rows) {
      start_idx = Math.max(0, end_idx - max_rows);
    }

    for (let i = start_idx; i < end_idx; i += 1) {
      const node = nodes[i];
      const is_selected = i === state.cursor;
      const indent = node.depth > 0 ? '  ├─ ' : '';
      const branch_glyph = node.is_branch ? (node.expanded ? '▾ ' : '▸ ') : '';
      const cursor_glyph = is_selected ? '❯ ' : '  ';
      const raw_row = truncate_visible(
        `${cursor_glyph}${indent}${branch_glyph}${node.icon} ${node.label}`,
        inner_cols
      );
      const padded_row = pad_visible(raw_row, inner_cols);
      const row_styled = is_selected
        ? colourise(padded_row, ANSI.bg_selected_row, col)
        : colourise(padded_row, node.is_branch ? `${ANSI.bold}${ANSI.amber}` : ANSI.white, col);
      lines.push(`${colourise('│ ', border_col, col)}${row_styled}${colourise(' │', border_col, col)}`);
    }

    // inspector preview panel at bottom of treeview window
    const selected_node = nodes[state.cursor] || null;
    lines.push(colourise(`├─${'─'.repeat(inner_cols)}─┤`, border_col, col));
    const inspector_header = selected_node
      ? `🔎 inspector preview — ${selected_node.id}`
      : '🔎 inspector preview — (no node selected)';
    lines.push(
      `${colourise('│ ', border_col, col)}${colourise(pad_visible(truncate_visible(inspector_header, inner_cols), inner_cols), `${ANSI.bold}${ANSI.magenta}`, col)}${colourise(' │', border_col, col)}`
    );

    const summary_lines = selected_node && selected_node.summary
      ? String(selected_node.summary).split('\n')
      : ['select an item above to view its metadata or trigger an action.'];
    for (let s = 0; s < summary_lines.length; s += 1) {
      const s_line = pad_visible(truncate_visible(`  ${summary_lines[s]}`, inner_cols), inner_cols);
      lines.push(`${colourise('│ ', border_col, col)}${colourise(s_line, ANSI.slate, col)}${colourise(' │', border_col, col)}`);
    }

    lines.push(colourise(`╰─${'─'.repeat(inner_cols)}─╯`, border_col, col));
    return lines.join('\n');
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: renders the memory and knowledge graph inspection window (f5)
   * verbose: displays persistent working memory state, observational memory configuration,
   * and indexed rag / knowledge graph counts from the harness.
   *
   * section: arguments
   * - render_opts (object, optional): { columns, colour }
   *
   * section: return value
   * - view (string): formatted memory and knowledge inspection window
   *
   * section: example
   * const mem_view = layout.render_memory_knowledge_window();
   */
  function render_memory_knowledge_window(render_opts = {}) {
    const cols = Math.max(60, get_columns(render_opts.columns));
    const col = render_opts.colour !== undefined ? Boolean(render_opts.colour) : colour_enabled;
    const inner_cols = Math.max(54, cols - 4);
    const harness = get_harness();
    const store = harness && typeof harness.get_store === 'function' ? harness.get_store() : null;

    const prd_count = store ? store.list_entities(DocumentEntityTypes.PRD).length : 0;
    const adr_count = store ? store.list_entities(DocumentEntityTypes.ADR).length : 0;
    const story_count = store ? store.list_entities(DocumentEntityTypes.USER_STORY).length : 0;

    const lines = [];
    const border_col = ANSI.bright_blue;
    lines.push(colourise(`╭─${'─'.repeat(inner_cols)}─╮`, border_col, col));
    lines.push(
      `${colourise('│ ', border_col, col)}${colourise(pad_visible(truncate_visible('🧠 mastra persistent memory, knowledge graph & hybrid rag telemetry (f5)', inner_cols), inner_cols), `${ANSI.bold}${ANSI.cyan}`, col)}${colourise(' │', border_col, col)}`
    );
    lines.push(colourise(`├─${'─'.repeat(inner_cols)}─┤`, border_col, col));

    const body_rows = [
      `🟢 working memory       : enabled (scope: resource + thread, persistent json file adapter)`,
      `🟢 observational memory : enabled (observer + reflector agents active across long threads)`,
      `🟢 knowledge graph      : scoped @mastra/core/knowledge domain with wikilinks [[prd]] ➔ [[adr]]`,
      `🟢 hybrid doc store rag : dense 64-dim embeddings + bm25 lexical scoring + rrf fusion`,
      `📊 indexed store corpus : ${prd_count} prds • ${story_count} user stories • ${adr_count} adrs`,
      `🔧 equipped rag tools   : harness-doc-rag-search, harness-knowledge-graph`
    ];
    for (let i = 0; i < body_rows.length; i += 1) {
      const row = pad_visible(truncate_visible(body_rows[i], inner_cols), inner_cols);
      lines.push(`${colourise('│ ', border_col, col)}${colourise(row, ANSI.white, col)}${colourise(' │', border_col, col)}`);
    }

    lines.push(colourise(`╰─${'─'.repeat(inner_cols)}─╯`, border_col, col));
    return lines.join('\n');
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: activates or toggles a node in the specified treeview
   * verbose: expands/collapses branch nodes or executes the selection callback (switching active
   * agent, focusing a concurrent work item, or selecting a high-level process) for leaf nodes.
   *
   * section: arguments
   * - tree_kind (string): 'doc_store' or 'top_level_items'
   * - node (object): tree node descriptor
   *
   * section: return value
   * - result (object): { selected, toggled, action_type, target_id, node }
   *
   * section: example
   * const res = activate_tree_node('top_level_items', node);
   */
  function activate_tree_node(tree_kind, node) {
    if (!node) {
      return { selected: false, toggled: false, node: null };
    }
    const state = tree_kind === 'doc_store' ? tree_state.doc_store : tree_state.top_level_items;
    if (node.is_branch) {
      const idx = state.collapsed_ids.indexOf(node.id);
      if (idx === -1) {
        state.collapsed_ids.push(node.id);
      } else {
        state.collapsed_ids.splice(idx, 1);
      }
      return { selected: false, toggled: true, node };
    }

    const harness = get_harness();
    if (node.action_type === 'agent' && node.target_id) {
      active_agent = node.target_id;
      if (typeof options.on_select_agent === 'function') {
        options.on_select_agent(node.target_id);
      }
    } else if (node.action_type === 'work_item' && node.target_id) {
      if (harness && typeof harness.switch_work_item === 'function') {
        try {
          harness.switch_work_item(node.target_id);
        } catch (_err) {
          // ignore if work item not switchable
        }
      }
      if (typeof options.on_select_work_item === 'function') {
        options.on_select_work_item(node.target_id);
      }
    } else if (node.action_type === 'process' && node.target_id) {
      if (typeof options.on_select_process === 'function') {
        options.on_select_process(node.target_id);
      }
    }

    return {
      selected: true,
      toggled: false,
      action_type: node.action_type || 'inspect',
      target_id: node.target_id || node.id,
      node
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: appends a message or multi-line block to the scrollable chat log viewport
   * verbose: stores the message in chat_messages and resets chat_scroll_offset to 0 so the
   * chat window auto-scrolls to the latest entry.
   *
   * section: arguments
   * - text (string): message text (single or multi-line)
   * - meta (object, optional): { speaker, role }
   *
   * section: return value
   * - count (number): total stored chat message blocks
   *
   * section: example
   * layout.append_chat_message('sdlc-supervisor> ready to assist.');
   */
  function append_chat_message(text = '', meta = {}) {
    const raw = String(text ?? '');
    if (!raw.trim() && raw.length === 0) {
      return chat_messages.length;
    }
    if (meta && meta.is_pipeline === true) {
      return append_pipeline_message(raw, meta);
    }
    chat_messages.push({
      text: raw,
      speaker: meta.speaker || null,
      run_id: meta.run_id || null,
      turn_id: meta.turn_id || null,
      timestamp: Date.now()
    });
    dual_pane_panel.append_chat_message(raw, meta);
    if (meta.preserve_scroll !== true) {
      chat_scroll_offset = 0;
    }
    return chat_messages.length;
  }

  function append_pipeline_message(text = '', meta = {}) {
    const raw = String(text ?? '');
    if (!raw.trim() && raw.length === 0) {
      return pipeline_messages.length;
    }
    pipeline_messages.push({
      text: raw,
      event: meta.event || null,
      run_id: meta.run_id || null,
      turn_id: meta.turn_id || null,
      timestamp: Date.now()
    });
    dual_pane_panel.append_pipeline_message(raw, meta);
    if (meta.preserve_scroll !== true) {
      pipeline_log_scroll_offset = 0;
    }
    return pipeline_messages.length;
  }

  function clear_chat_messages() {
    chat_messages.length = 0;
    pipeline_messages.length = 0;
    chat_scroll_offset = 0;
    pipeline_log_scroll_offset = 0;
  }

  function set_input_buffer(text = '', cursor = null) {
    const sanitized = sanitize_chat_paste_payload(String(text ?? ''), input_config.buffer_limit);
    const str = sanitized.text;
    const clamped_cur = typeof cursor === 'number'
      ? Math.max(0, Math.min(str.length, cursor))
      : str.length;
    const ml_state = multiline_input.set_value(str, clamped_cur);
    input_state.text = str;
    input_state.cursor = ml_state.cursor_index;
    input_state.scroll_offset = ml_state.scroll_offset;
    input_state.viewport_rows = ml_state.viewport_rows;
    input_state.total_visual_rows = ml_state.total_visual_rows;
    return input_state;
  }

  function set_input_prompt(prompt_str = 'you> ') {
    input_state.prompt = String(prompt_str || 'you> ');
    return input_state.prompt;
  }

  function wrap_single_plain_line(plain_line = '', max_width = 76) {
    const safe_width = Math.max(16, max_width);
    if (!plain_line) {
      return [''];
    }
    if (plain_line.length <= safe_width) {
      return [plain_line];
    }
    const words = plain_line.split(/(\s+)/);
    const wrapped = [];
    let current = '';
    const cont_indent = '  ';

    for (let i = 0; i < words.length; i += 1) {
      const token = words[i];
      if (!token) continue;
      if ((current + token).length <= safe_width) {
        current += token;
      } else if (token.trim().length === 0) {
        if (current.length > 0) {
          wrapped.push(current);
          current = cont_indent;
        }
      } else if (token.length > safe_width - cont_indent.length) {
        if (current.trim().length > 0) {
          wrapped.push(current);
          current = cont_indent;
        }
        let rem = token;
        while (rem.length > 0) {
          const chunk_cap = Math.max(8, safe_width - current.length);
          wrapped.push(current + rem.slice(0, chunk_cap));
          rem = rem.slice(chunk_cap);
          current = cont_indent;
        }
        current = '';
      } else {
        if (current.trim().length > 0) {
          wrapped.push(current);
        }
        current = cont_indent + token;
      }
    }
    if (current.trim().length > 0 || wrapped.length === 0) {
      wrapped.push(current);
    }
    return wrapped;
  }

  function style_chat_wrapped_line(plain_line = '', is_first_line = true, speaker_hint = null, col = true) {
    if (!col) {
      return plain_line;
    }
    if (/^[=─━-]{8,}$/.test(plain_line.trim())) {
      return colourise(plain_line, ANSI.slate, col);
    }
    if (is_first_line) {
      const user_match = plain_line.match(/^(you>\s*)(.*)$/i);
      if (user_match) {
        return `${colourise(`👤 ${user_match[1]}`, `${ANSI.bold}${ANSI.emerald}`, col)}${colourise(user_match[2], ANSI.white, col)}`;
      }
      const agent_match = plain_line.match(/^([a-z0-9_-]+>\s*)(.*)$/i);
      if (agent_match) {
        return `${colourise(`🤖 ${agent_match[1]}`, `${ANSI.bold}${ANSI.cyan}`, col)}${colourise(agent_match[2], ANSI.white, col)}`;
      }
    }
    if (speaker_hint === 'user') {
      return colourise(plain_line, ANSI.emerald, col);
    }
    if (speaker_hint === 'system') {
      return colourise(plain_line, ANSI.slate, col);
    }
    return colourise(plain_line, ANSI.white, col);
  }

  function build_wrapped_chat_lines(content_width = 76, col = true) {
    const safe_width = Math.max(20, content_width);
    const out = [];

    for (let m = 0; m < chat_messages.length; m += 1) {
      const entry = chat_messages[m];
      const raw_lines = String(entry.text || '').split(/\r?\n/);

      for (let r = 0; r < raw_lines.length; r += 1) {
        const raw_line = raw_lines[r];
        const has_ansi = /\x1b\[/.test(raw_line);
        if (has_ansi) {
          const vlen = visible_length(raw_line);
          if (vlen <= safe_width) {
            out.push(pad_visible(raw_line, safe_width));
          } else {
            const truncated = truncate_visible(raw_line, safe_width);
            out.push(colourise(pad_visible(truncated, safe_width), ANSI.cyan, col));
          }
          continue;
        }

        let speaker_prefix_extra = 0;
        if (/^(you>|[a-z0-9_-]+>)\s*/i.test(raw_line)) {
          speaker_prefix_extra = 3; // space for 👤 or 🤖 icon
        }
        const pieces = wrap_single_plain_line(raw_line, Math.max(16, safe_width - speaker_prefix_extra));
        for (let p = 0; p < pieces.length; p += 1) {
          const styled = style_chat_wrapped_line(pieces[p], p === 0, entry.speaker, col);
          const bounded = visible_length(styled) > safe_width
            ? truncate_visible(styled, safe_width)
            : styled;
          out.push(pad_visible(bounded, safe_width));
        }
      }
    }

    return out;
  }

  function build_wrapped_pipeline_lines(content_width = 36, col = true) {
    const safe_width = Math.max(12, content_width);
    const out = [];
    const snap = resolve_telemetry_snapshot();
    const active_item_label = snap.active_item
      ? `${snap.active_item.name} [${snap.active_item.type || 'feature'}]`
      : 'idle';
    const prog_str = `${snap.counts.completed}/${snap.counts.total} tickets`;

    // pinned live telemetry ribbon at the top of the right-hand pipeline pane
    const ribbon_line1 = truncate_visible(
      `🎯 ${active_item_label} (${prog_str})`,
      safe_width
    );
    const ribbon_line2 = truncate_visible(
      `${snap.phase_visual.icon} ${snap.phase_visual.name} │ 🛡️ ${snap.active_gate || 'gates ready'}`,
      safe_width
    );
    out.push(colourise(pad_visible(ribbon_line1, safe_width), `${ANSI.bold}${ANSI.amber}`, col));
    out.push(colourise(pad_visible(ribbon_line2, safe_width), ANSI.cyan, col));
    out.push(colourise('─'.repeat(safe_width), ANSI.slate, col));

    const effective_entries = [...pipeline_messages];
    for (let m = 0; m < chat_messages.length; m += 1) {
      if (is_pipeline_telemetry_entry(chat_messages[m].text)) {
        effective_entries.push(chat_messages[m]);
      }
    }

    if (effective_entries.length === 0) {
      const default_lines = [
        '⚡ live sdlc pipeline stream ready',
        '• phase 00..09 & gate 1..4 events',
        '• xstate transitions & ticket logs',
        '• tab/ctrl+w toggles pane scroll'
      ];
      for (let d = 0; d < default_lines.length; d += 1) {
        const dl = truncate_visible(default_lines[d], safe_width);
        out.push(colourise(pad_visible(dl, safe_width), ANSI.slate, col));
      }
      return out;
    }

    for (let i = 0; i < effective_entries.length; i += 1) {
      const entry = effective_entries[i];
      const raw_lines = String(entry.text || '').split(/\r?\n/);
      for (let r = 0; r < raw_lines.length; r += 1) {
        const raw_line = raw_lines[r];
        const has_ansi = /\x1b\[/.test(raw_line);
        if (has_ansi) {
          const vlen = visible_length(raw_line);
          if (vlen <= safe_width) {
            out.push(pad_visible(raw_line, safe_width));
          } else {
            const truncated = truncate_visible(raw_line, safe_width);
            out.push(colourise(pad_visible(truncated, safe_width), ANSI.cyan, col));
          }
          continue;
        }
        const pieces = wrap_single_plain_line(raw_line, safe_width);
        for (let p = 0; p < pieces.length; p += 1) {
          const bounded = visible_length(pieces[p]) > safe_width
            ? truncate_visible(pieces[p], safe_width)
            : pieces[p];
          out.push(colourise(pad_visible(bounded, safe_width), ANSI.lavender, col));
        }
      }
    }
    return out;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: renders the dual-pane split-view chat and live pipeline viewport window (f1)
   * verbose: displays conversational agentic chat messages in the left pane and live sdlc
   * pipeline progression logs and telemetry in the right pane inside a unified bordered split
   * window of height viewport_rows, with independent scrolling and visual scrollbars.
   *
   * section: arguments
   * - render_opts (object, optional): { columns, rows, viewport_rows, colour, single_pane }
   *
   * section: return value
   * - view (string): formatted multi-line bordered dual-pane chat and live pipeline window
   *
   * section: example
   * const chat_win = layout.render_chat_viewport_window({ columns: 100, viewport_rows: 18 });
   */
  function render_chat_viewport_window(render_opts = {}) {
    const cols = Math.max(40, get_columns(render_opts.columns));
    const col = render_opts.colour !== undefined ? Boolean(render_opts.colour) : colour_enabled;
    const inner_cols = Math.max(34, cols - 4);
    const total_win_rows = Math.max(8, render_opts.viewport_rows || (get_rows(render_opts.rows) - 7));
    const body_rows = Math.max(4, total_win_rows - 4);
    const border_col = ANSI.bright_blue;

    // use dual-pane split layout whenever terminal width >= 68 columns (unless single_pane explicitly requested)
    if (cols >= 68 && render_opts.single_pane !== true) {
      const ratio = dual_pane_panel.get_split_ratio();
      const usable_split_cols = Math.max(30, inner_cols - 3);
      const left_total = Math.max(20, Math.min(usable_split_cols - 16, Math.floor(usable_split_cols * ratio)));
      const right_total = Math.max(16, usable_split_cols - left_total);
      const left_content_width = Math.max(14, left_total - 2);
      const right_content_width = Math.max(12, right_total - 2);

      const wrapped_chat = build_wrapped_chat_lines(left_content_width, col);
      const max_chat_scroll = Math.max(0, wrapped_chat.length - body_rows);
      if (chat_scroll_offset > max_chat_scroll) {
        chat_scroll_offset = max_chat_scroll;
      }
      if (chat_scroll_offset < 0) {
        chat_scroll_offset = 0;
      }
      const chat_start = Math.max(0, wrapped_chat.length - body_rows - chat_scroll_offset);
      const chat_end = Math.min(wrapped_chat.length, chat_start + body_rows);
      const visible_chat = wrapped_chat.slice(chat_start, chat_end);

      const wrapped_pipe = build_wrapped_pipeline_lines(right_content_width, col);
      const max_pipe_scroll = Math.max(0, wrapped_pipe.length - body_rows);
      if (pipeline_log_scroll_offset > max_pipe_scroll) {
        pipeline_log_scroll_offset = max_pipe_scroll;
      }
      if (pipeline_log_scroll_offset < 0) {
        pipeline_log_scroll_offset = 0;
      }
      const pipe_start = Math.max(0, wrapped_pipe.length - body_rows - pipeline_log_scroll_offset);
      const pipe_end = Math.min(wrapped_pipe.length, pipe_start + body_rows);
      const visible_pipe = wrapped_pipe.slice(pipe_start, pipe_end);

      const chat_focus_dot = active_chat_pane === 'chat' ? '●' : '○';
      const pipe_focus_dot = active_chat_pane === 'pipeline' ? '●' : '○';

      const chat_scroll_badge = chat_scroll_offset > 0
        ? `📜 scrolled -${chat_scroll_offset} lines`
        : `📜 ${wrapped_chat.length > 0 ? chat_start + 1 : 0}–${chat_end}/${wrapped_chat.length}`;
      const pipe_scroll_badge = pipeline_log_scroll_offset > 0
        ? `📜 scrolled -${pipeline_log_scroll_offset}`
        : `📜 live (${pipeline_messages.length})`;

      const left_header_text = `${chat_focus_dot} 💬 chat (${active_agent}) │ ${chat_scroll_badge}`;
      const right_header_text = `${pipe_focus_dot} ⚡ live sdlc pipeline │ ${pipe_scroll_badge}`;

      const lines = [];
      lines.push(
        colourise(`╭─${'─'.repeat(left_total)}─┬─${'─'.repeat(right_total)}─╮`, border_col, col)
      );
      lines.push(
        `${colourise('│ ', border_col, col)}` +
        `${colourise(pad_visible(truncate_visible(left_header_text, left_total), left_total), `${ANSI.bold}${ANSI.cyan}`, col)}` +
        `${colourise(' │ ', border_col, col)}` +
        `${colourise(pad_visible(truncate_visible(right_header_text, right_total), right_total), `${ANSI.bold}${ANSI.magenta}`, col)}` +
        `${colourise(' │', border_col, col)}`
      );
      lines.push(
        colourise(`├─${'─'.repeat(left_total)}─┼─${'─'.repeat(right_total)}─┤`, border_col, col)
      );

      const chat_thumb_row = max_chat_scroll > 0
        ? Math.min(body_rows - 1, Math.max(0, Math.round((chat_start / max_chat_scroll) * (body_rows - 1))))
        : body_rows - 1;
      const pipe_thumb_row = max_pipe_scroll > 0
        ? Math.min(body_rows - 1, Math.max(0, Math.round((pipe_start / max_pipe_scroll) * (body_rows - 1))))
        : body_rows - 1;

      for (let r = 0; r < body_rows; r += 1) {
        const left_msg = r < visible_chat.length
          ? visible_chat[r]
          : ' '.repeat(left_content_width);
        const left_padded = pad_visible(left_msg, left_content_width);
        const left_track = wrapped_chat.length > body_rows
          ? (r === chat_thumb_row ? colourise('█', ANSI.cyan, col) : colourise('│', ANSI.slate, col))
          : ' ';

        const right_msg = r < visible_pipe.length
          ? visible_pipe[r]
          : ' '.repeat(right_content_width);
        const right_padded = pad_visible(right_msg, right_content_width);
        const right_track = wrapped_pipe.length > body_rows
          ? (r === pipe_thumb_row ? colourise('█', ANSI.magenta, col) : colourise('│', ANSI.slate, col))
          : ' ';

        lines.push(
          `${colourise('│ ', border_col, col)}${left_padded} ${left_track}${colourise(' │ ', border_col, col)}${right_padded} ${right_track}${colourise(' │', border_col, col)}`
        );
      }

      lines.push(
        colourise(`╰─${'─'.repeat(left_total)}─┴─${'─'.repeat(right_total)}─╯`, border_col, col)
      );
      return lines.join('\n');
    }

    const content_width = Math.max(20, inner_cols - 2);
    const wrapped = build_wrapped_chat_lines(content_width, col);
    const max_scroll = Math.max(0, wrapped.length - body_rows);
    if (chat_scroll_offset > max_scroll) {
      chat_scroll_offset = max_scroll;
    }
    if (chat_scroll_offset < 0) {
      chat_scroll_offset = 0;
    }

    const start_idx = Math.max(0, wrapped.length - body_rows - chat_scroll_offset);
    const end_idx = Math.min(wrapped.length, start_idx + body_rows);
    const visible_slice = wrapped.slice(start_idx, end_idx);

    const scroll_badge = chat_scroll_offset > 0
      ? `📜 scrolled -${chat_scroll_offset} lines (↑/↓/pgup/pgdn • esc latest)`
      : `📜 lines ${wrapped.length > 0 ? start_idx + 1 : 0}–${end_idx} of ${wrapped.length} (↑/↓ scroll)`;
    const header_text = `💬 mastra agentic chat & live pipeline — 🤖 ${active_agent} │ ${scroll_badge}`;

    const lines = [];
    lines.push(colourise(`╭─${'─'.repeat(inner_cols)}─╮`, border_col, col));
    lines.push(
      `${colourise('│ ', border_col, col)}${colourise(pad_visible(truncate_visible(header_text, inner_cols), inner_cols), `${ANSI.bold}${ANSI.cyan}`, col)}${colourise(' │', border_col, col)}`
    );
    lines.push(colourise(`├─${'─'.repeat(inner_cols)}─┤`, border_col, col));

    const thumb_row = max_scroll > 0
      ? Math.min(body_rows - 1, Math.max(0, Math.round((start_idx / max_scroll) * (body_rows - 1))))
      : body_rows - 1;

    for (let r = 0; r < body_rows; r += 1) {
      const msg_line = r < visible_slice.length
        ? visible_slice[r]
        : ' '.repeat(content_width);
      const padded_msg = pad_visible(msg_line, content_width);
      const track_char = wrapped.length > body_rows
        ? (r === thumb_row ? colourise('█', ANSI.cyan, col) : colourise('│', ANSI.slate, col))
        : ' ';
      lines.push(
        `${colourise('│ ', border_col, col)}${padded_msg} ${track_char}${colourise(' │', border_col, col)}`
      );
    }

    lines.push(colourise(`╰─${'─'.repeat(inner_cols)}─╯`, border_col, col));
    return lines.join('\n');
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: renders the pinned bottom bordered multi-line scrollable chat input window
   * verbose: draws a dynamically resizing rounded border box at the bottom of the screen
   * supporting multi-line text entry, vertical scrolling (CHAT_INPUT_MAX_HEIGHT,
   * CHAT_INPUT_DEFAULT_ROWS, CHAT_INPUT_SCROLL_STEP, CHAT_INPUT_BUFFER_LIMIT), and cursor tracking.
   *
   * section: arguments
   * - render_opts (object, optional): { columns, colour, prompt, input_text, input_cursor }
   *
   * section: return value
   * - input_box (object): { text, lines, cursor_col, cursor_row_offset, viewport_rows, total_visual_rows, scroll_offset, is_scrollable }
   *
   * section: example
   * const box = layout.render_chat_input_window({ columns: 100 });
   */
  function render_chat_input_window(render_opts = {}) {
    const cols = Math.max(40, get_columns(render_opts.columns));
    const col = render_opts.colour !== undefined ? Boolean(render_opts.colour) : colour_enabled;
    const inner_cols = Math.max(34, cols - 4);

    const prompt_str = render_opts.prompt !== undefined ? String(render_opts.prompt) : input_state.prompt;
    const raw_input = render_opts.input_text !== undefined ? String(render_opts.input_text) : input_state.text;
    const raw_cursor = render_opts.input_cursor !== undefined
      ? Number(render_opts.input_cursor)
      : input_state.cursor;
    const clamped_cursor = Math.max(0, Math.min(raw_input.length, raw_cursor));

    const max_input_cols = Math.max(10, inner_cols - prompt_str.length);
    if (multiline_input.get_value() !== raw_input || multiline_input.get_state(max_input_cols).cursor_index !== clamped_cursor) {
      multiline_input.set_value(raw_input, clamped_cursor);
    }
    const ml_state = multiline_input.get_state(max_input_cols);
    const viewport_rows = ml_state.viewport_rows;
    const visible_rows = ml_state.visual_lines.slice(
      ml_state.scroll_offset,
      ml_state.scroll_offset + viewport_rows
    );

    const scroll_meta = ml_state.is_scrollable
      ? `rows ${ml_state.scroll_offset + 1}-${Math.min(ml_state.total_visual_rows, ml_state.scroll_offset + viewport_rows)}/${ml_state.total_visual_rows} •`
      : ml_state.total_visual_rows > 1
        ? `${ml_state.total_visual_rows} lines •`
        : '';
    const title_hint = ` 💬 chat input (🤖 ${active_agent}) ── ${scroll_meta} f1-f5 windows • alt+enter newline • enter send `;
    const trimmed_title = truncate_visible(title_hint, Math.max(12, inner_cols - 2));
    const remaining_dashes = Math.max(0, inner_cols - visible_length(trimmed_title));

    const border_col = ANSI.bright_blue;
    const top_line =
      colourise('╭─', border_col, col) +
      colourise(trimmed_title, `${ANSI.bold}${ANSI.cyan}`, col) +
      colourise(`${'─'.repeat(remaining_dashes)}─╮`, border_col, col);

    const continuation_prompt = `${' '.repeat(Math.max(0, prompt_str.length - 2))}· `;
    const mid_lines = [];
    const thumb_row = ml_state.max_scroll_offset > 0
      ? Math.round((ml_state.scroll_offset / ml_state.max_scroll_offset) * Math.max(0, viewport_rows - 1))
      : 0;

    for (let r = 0; r < viewport_rows; r += 1) {
      const global_row = ml_state.scroll_offset + r;
      const row_obj = visible_rows[r] || { text: '' };
      const is_first = global_row === 0;
      const prefix_raw = is_first ? prompt_str : continuation_prompt;
      const prefix_styled = is_first
        ? colourise(prompt_str, `${ANSI.bold}${ANSI.emerald}`, col)
        : colourise(continuation_prompt, ANSI.slate, col);
      const row_text = row_obj.text || '';
      const row_styled = colourise(row_text, ANSI.white, col);

      if (ml_state.is_scrollable) {
        const track_char = r === thumb_row
          ? colourise('█', ANSI.cyan, col)
          : colourise('│', ANSI.slate, col);
        const pad_len = Math.max(0, inner_cols - prefix_raw.length - visible_length(row_text) - 2);
        mid_lines.push(
          `${colourise('│ ', border_col, col)}${prefix_styled}${row_styled}${' '.repeat(pad_len)} ${track_char}${colourise(' │', border_col, col)}`
        );
      } else {
        const pad_len = Math.max(0, inner_cols - prefix_raw.length - visible_length(row_text));
        mid_lines.push(
          `${colourise('│ ', border_col, col)}${prefix_styled}${row_styled}${' '.repeat(pad_len)}${colourise(' │', border_col, col)}`
        );
      }
    }

    const bot_line = colourise(`╰─${'─'.repeat(inner_cols)}─╯`, border_col, col);

    const cursor_row_in_viewport = Math.max(0, Math.min(viewport_rows - 1, ml_state.cursor_row - ml_state.scroll_offset));
    const cursor_col = 3 + prompt_str.length + ml_state.cursor_col;
    const lines = [top_line, ...mid_lines, bot_line];
    return {
      text: lines.join('\n'),
      lines,
      cursor_col,
      cursor_row_offset: 1 + cursor_row_in_viewport,
      viewport_rows,
      total_visual_rows: ml_state.total_visual_rows,
      scroll_offset: ml_state.scroll_offset,
      max_scroll_offset: ml_state.max_scroll_offset,
      is_scrollable: ml_state.is_scrollable
    };
  }

  function fit_bordered_window_rows(window_str, target_rows, scroll_offset = 0, cols = 100, col = true) {
    const raw_lines = String(window_str || '').split('\n');
    if (!target_rows || target_rows < 6 || raw_lines.length === target_rows) {
      return raw_lines;
    }
    const inner_cols = Math.max(20, cols - 4);
    const border_col = ANSI.bright_blue;

    if (raw_lines.length < target_rows) {
      const top_part = raw_lines.slice(0, raw_lines.length - 1);
      const bottom_border = raw_lines[raw_lines.length - 1];
      const pad_count = target_rows - raw_lines.length;
      const blank_row = `${colourise('│ ', border_col, col)}${' '.repeat(inner_cols)}${colourise(' │', border_col, col)}`;
      const padded = [...top_part];
      for (let i = 0; i < pad_count; i += 1) {
        padded.push(blank_row);
      }
      padded.push(bottom_border);
      return padded;
    }

    // raw_lines.length > target_rows: keep top 3 header/border rows and bottom border row, slice interior
    const header_part = raw_lines.slice(0, 3);
    const bottom_border = raw_lines[raw_lines.length - 1];
    const interior = raw_lines.slice(3, raw_lines.length - 1);
    const body_cap = Math.max(2, target_rows - 4);
    const max_off = Math.max(0, interior.length - body_cap);
    const clamped_off = Math.max(0, Math.min(max_off, scroll_offset));
    const sliced = interior.slice(clamped_off, clamped_off + body_cap);
    return [...header_part, ...sliced, bottom_border];
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: renders the currently active window alongside the pinned top status bar
   * verbose: combines the top status bar with the active window body (chat + mini pipeline,
   * full 10-phase/4-gate board, doc store treeview, top-level items treeview, or memory view).
   *
   * section: arguments
   * - render_opts (object, optional): { columns, rows, viewport_rows, colour, include_status_bar, include_input_box }
   *
   * section: return value
   * - frame (string): rendered terminal window string
   *
   * section: example
   * const screen = layout.render_active_window();
   */
  function render_active_window(render_opts = {}) {
    const parts = [];
    if (render_opts.include_status_bar !== false) {
      parts.push(render_status_bar(render_opts));
    }

    if (active_window === 'chat') {
      if (render_opts.show_pipeline_when_empty === true && chat_messages.length === 0 && pipeline_messages.length === 0) {
        parts.push(render_phase_gate_pipeline(render_opts));
      } else {
        parts.push(render_chat_viewport_window(render_opts));
      }
    } else if (active_window === 'pipeline') {
      parts.push(render_phase_gate_pipeline(render_opts));
    } else if (active_window === 'doc_store') {
      parts.push(render_treeview_window('doc_store', render_opts));
    } else if (active_window === 'top_level_items') {
      parts.push(render_treeview_window('top_level_items', render_opts));
    } else if (active_window === 'memory') {
      parts.push(render_memory_knowledge_window(render_opts));
    } else {
      parts.push(render_phase_gate_pipeline(render_opts));
    }

    if (render_opts.include_input_box) {
      parts.push(render_chat_input_window(render_opts).text);
    }

    return parts.join('\n');
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: renders the complete 3-pane full-screen tui frame (status bar + active viewport + bordered input box)
   * verbose: calculates exact row geometry so switching between f1-f5 updates the active viewport
   * window in-place while keeping the top status bar and bottom bordered chat input box anchored.
   *
   * section: arguments
   * - render_opts (object, optional): { columns, rows, colour, prompt, input_text, input_cursor }
   *
   * section: return value
   * - frame_info (object): { frame, lines, total_rows, cursor_row, cursor_col, active_window }
   *
   * section: example
   * const tui = layout.render_tui_frame({ columns: 100, rows: 28 });
   */
  function render_tui_frame(render_opts = {}) {
    const cols = Math.max(40, get_columns(render_opts.columns));
    const rows = Math.max(16, get_rows(render_opts.rows));
    const col = render_opts.colour !== undefined ? Boolean(render_opts.colour) : colour_enabled;

    const status_lines = render_status_bar({ ...render_opts, columns: cols, colour: col }).split('\n');
    const input_box = render_chat_input_window({ ...render_opts, columns: cols, colour: col });
    const viewport_rows = Math.max(8, rows - status_lines.length - input_box.lines.length);

    let viewport_lines;
    if (active_window === 'chat') {
      viewport_lines = render_chat_viewport_window({
        ...render_opts,
        columns: cols,
        viewport_rows,
        colour: col
      }).split('\n');
    } else if (active_window === 'pipeline') {
      const raw_pipe = render_phase_gate_pipeline({ ...render_opts, columns: cols, colour: col });
      viewport_lines = fit_bordered_window_rows(raw_pipe, viewport_rows, pipeline_scroll_offset, cols, col);
    } else if (active_window === 'doc_store') {
      const max_tree_rows = Math.max(4, viewport_rows - 10);
      const raw_tree = render_treeview_window('doc_store', {
        ...render_opts,
        columns: cols,
        max_rows: max_tree_rows,
        colour: col
      });
      viewport_lines = fit_bordered_window_rows(raw_tree, viewport_rows, 0, cols, col);
    } else if (active_window === 'top_level_items') {
      const max_tree_rows = Math.max(4, viewport_rows - 10);
      const raw_tree = render_treeview_window('top_level_items', {
        ...render_opts,
        columns: cols,
        max_rows: max_tree_rows,
        colour: col
      });
      viewport_lines = fit_bordered_window_rows(raw_tree, viewport_rows, 0, cols, col);
    } else {
      const raw_mem = render_memory_knowledge_window({ ...render_opts, columns: cols, colour: col });
      viewport_lines = fit_bordered_window_rows(raw_mem, viewport_rows, 0, cols, col);
    }

    const all_lines = [...status_lines, ...viewport_lines, ...input_box.lines];
    const cursor_row = status_lines.length + viewport_lines.length + (input_box.cursor_row_offset || 1) + 1;
    const cursor_col = input_box.cursor_col;

    return {
      frame: all_lines.join('\n'),
      lines: all_lines,
      total_rows: all_lines.length,
      cursor_row,
      cursor_col,
      active_window
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: generates an in-place ansi redraw payload that updates the terminal without scrolling
   * verbose: positions the cursor at top-left (\x1b[H), overwrites every line with \x1b[2K, clears
   * any leftover rows below (\x1b[J), and places the cursor inside the bordered bottom chat input box.
   *
   * section: arguments
   * - render_opts (object, optional): { columns, rows, colour, prompt, input_text, input_cursor }
   *
   * section: return value
   * - ansi_payload (string): complete ansi escape sequence for in-place screen update
   *
   * section: example
   * process.stdout.write(layout.render_in_place_ansi());
   */
  function render_in_place_ansi(render_opts = {}) {
    const tui = render_tui_frame(render_opts);
    const positioned_lines = tui.lines
      .map((line, idx) => `\x1b[${idx + 1};1H\x1b[2K${line}`)
      .join('');
    return `\x1b[?25l\x1b[?7l\x1b[H${positioned_lines}\x1b[J\x1b[${tui.cursor_row};${tui.cursor_col}H\x1b[?7h\x1b[?25h`;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: processes function keys (f1-f5), chat scroll keys, and treeview navigation keys
   * verbose: updates active_window when f1-f5 is pressed, scrolls the chat log in f1 or pipeline
   * in f2 with up/down/pageup/pagedown, and navigates the active treeview in f3 or f4.
   *
   * section: arguments
   * - str (string): raw keypress string
   * - key (object): readline key object { name, ctrl, meta, shift }
   * - context (object, optional): { input_buffer }
   *
   * section: return value
   * - outcome (object): { handled, window_changed, active_window, tree_action, scroll_action }
   *
   * section: example
   * const res = layout.handle_keypress('', { name: 'f2' });
   */
  function handle_keypress(_str = '', key = {}, context = {}) {
    const kname = String(key?.name || '').toLowerCase();
    const prev_window = active_window;

    if (kname === 'f1') {
      active_window = 'chat';
    } else if (kname === 'f2') {
      active_window = 'pipeline';
    } else if (kname === 'f3') {
      active_window = 'doc_store';
    } else if (kname === 'f4') {
      active_window = 'top_level_items';
    } else if (kname === 'f5') {
      active_window = 'memory';
    } else if (kname === 'escape') {
      if (active_window !== 'chat') {
        active_window = 'chat';
      } else if (chat_scroll_offset > 0 || pipeline_log_scroll_offset > 0) {
        chat_scroll_offset = 0;
        pipeline_log_scroll_offset = 0;
        return {
          handled: true,
          window_changed: false,
          active_window,
          tree_action: null,
          scroll_action: 'scroll_bottom'
        };
      }
    }

    if (active_window !== prev_window) {
      if (typeof options.on_window_change === 'function') {
        options.on_window_change(active_window, prev_window);
      }
      return {
        handled: true,
        window_changed: true,
        active_window,
        tree_action: null,
        scroll_action: null
      };
    }

    if (active_window === 'chat') {
      if (key && key.ctrl && kname === 'w') {
        active_chat_pane = active_chat_pane === 'chat' ? 'pipeline' : 'chat';
        dual_pane_panel.set_active_pane(active_chat_pane);
        return {
          handled: true,
          window_changed: false,
          active_window,
          active_chat_pane,
          tree_action: null,
          scroll_action: 'toggle_pane_focus'
        };
      }
      if (kname === 'up' || kname === 'pageup') {
        const step = kname === 'pageup' ? 8 : 1;
        if (active_chat_pane === 'pipeline') {
          pipeline_log_scroll_offset += step;
          dual_pane_panel.set_pipeline_scroll_offset(pipeline_log_scroll_offset);
          return {
            handled: true,
            window_changed: false,
            active_window,
            tree_action: null,
            scroll_action: 'pipeline_pane_scroll_up'
          };
        }
        chat_scroll_offset += step;
        dual_pane_panel.set_chat_scroll_offset(chat_scroll_offset);
        return {
          handled: true,
          window_changed: false,
          active_window,
          tree_action: null,
          scroll_action: 'scroll_up'
        };
      }
      if (kname === 'down' || kname === 'pagedown') {
        const step = kname === 'pagedown' ? 8 : 1;
        if (active_chat_pane === 'pipeline') {
          pipeline_log_scroll_offset = Math.max(0, pipeline_log_scroll_offset - step);
          dual_pane_panel.set_pipeline_scroll_offset(pipeline_log_scroll_offset);
          return {
            handled: true,
            window_changed: false,
            active_window,
            tree_action: null,
            scroll_action: 'pipeline_pane_scroll_down'
          };
        }
        chat_scroll_offset = Math.max(0, chat_scroll_offset - step);
        dual_pane_panel.set_chat_scroll_offset(chat_scroll_offset);
        return {
          handled: true,
          window_changed: false,
          active_window,
          tree_action: null,
          scroll_action: 'scroll_down'
        };
      }
    }

    if (active_window === 'pipeline') {
      if (kname === 'up' || kname === 'pageup') {
        pipeline_scroll_offset = Math.max(0, pipeline_scroll_offset - (kname === 'pageup' ? 5 : 1));
        return {
          handled: true,
          window_changed: false,
          active_window,
          tree_action: null,
          scroll_action: 'pipeline_scroll_up'
        };
      }
      if (kname === 'down' || kname === 'pagedown') {
        pipeline_scroll_offset += (kname === 'pagedown' ? 5 : 1);
        return {
          handled: true,
          window_changed: false,
          active_window,
          tree_action: null,
          scroll_action: 'pipeline_scroll_down'
        };
      }
    }

    if (active_window === 'doc_store' || active_window === 'top_level_items') {
      const nodes = active_window === 'doc_store' ? build_doc_store_tree() : build_top_level_items_tree();
      const state = active_window === 'doc_store' ? tree_state.doc_store : tree_state.top_level_items;
      const has_typed_input = Boolean(context.input_buffer && String(context.input_buffer).length > 0);

      if (kname === 'down' || kname === 'pagedown' || (!has_typed_input && kname === 'j')) {
        const step = kname === 'pagedown' ? 5 : 1;
        state.cursor = Math.min(Math.max(0, nodes.length - 1), state.cursor + step);
        return { handled: true, window_changed: false, active_window, tree_action: 'cursor_down' };
      }
      if (kname === 'up' || kname === 'pageup' || (!has_typed_input && kname === 'k')) {
        const step = kname === 'pageup' ? 5 : 1;
        state.cursor = Math.max(0, state.cursor - step);
        return { handled: true, window_changed: false, active_window, tree_action: 'cursor_up' };
      }
      if (!has_typed_input && (kname === 'left' || kname === 'h')) {
        const cur = nodes[state.cursor];
        if (cur && cur.is_branch && cur.expanded) {
          state.collapsed_ids.push(cur.id);
        }
        return { handled: true, window_changed: false, active_window, tree_action: 'collapse' };
      }
      if (!has_typed_input && (kname === 'right' || kname === 'l')) {
        const cur = nodes[state.cursor];
        if (cur && cur.is_branch && !cur.expanded) {
          const idx = state.collapsed_ids.indexOf(cur.id);
          if (idx !== -1) state.collapsed_ids.splice(idx, 1);
        }
        return { handled: true, window_changed: false, active_window, tree_action: 'expand' };
      }
      if (!has_typed_input && (kname === 'return' || kname === 'enter' || kname === 'space')) {
        const cur = nodes[state.cursor];
        const act = activate_tree_node(active_window, cur);
        return { handled: true, window_changed: false, active_window, tree_action: act };
      }
    }

    return {
      handled: false,
      window_changed: false,
      active_window,
      tree_action: null,
      scroll_action: null
    };
  }

  function get_selected_tree_node(tree_kind = active_window) {
    const kind = tree_kind === 'top_level_items' ? 'top_level_items' : 'doc_store';
    const nodes = kind === 'doc_store' ? build_doc_store_tree() : build_top_level_items_tree();
    const state = kind === 'doc_store' ? tree_state.doc_store : tree_state.top_level_items;
    return nodes[state.cursor] || nodes[0] || null;
  }

  function select_tree_item_by_id(tree_kind = 'top_level_items', item_id = '') {
    const kind = tree_kind === 'doc_store' ? 'doc_store' : 'top_level_items';
    const nodes = kind === 'doc_store' ? build_doc_store_tree() : build_top_level_items_tree();
    const state = kind === 'doc_store' ? tree_state.doc_store : tree_state.top_level_items;
    const norm = String(item_id || '').trim().toLowerCase();

    const idx = nodes.findIndex(
      (n) => String(n.id).toLowerCase() === norm || String(n.target_id || '').toLowerCase() === norm
    );
    if (idx === -1) {
      return { selected: false, error: `tree item '${item_id}' not found in ${kind}` };
    }
    state.cursor = idx;
    return activate_tree_node(kind, nodes[idx]);
  }

  return {
    name: 'cli-chat-status-bar-layout',
    status: 'active',
    get_active_window: () => active_window,
    set_active_window: (win_id) => {
      active_window = win_id;
      return active_window;
    },
    get_active_agent: () => active_agent,
    set_active_agent: (agent_id) => {
      active_agent = agent_id;
      return active_agent;
    },
    append_chat_message,
    append_pipeline_message,
    clear_chat_messages,
    get_chat_messages: () => chat_messages.slice(),
    get_pipeline_messages: () => pipeline_messages.slice(),
    get_chat_scroll_offset: () => chat_scroll_offset,
    get_pipeline_log_scroll_offset: () => pipeline_log_scroll_offset,
    scroll_chat: (delta = 0) => {
      chat_scroll_offset = Math.max(0, chat_scroll_offset + Number(delta || 0));
      dual_pane_panel.set_chat_scroll_offset(chat_scroll_offset);
      return chat_scroll_offset;
    },
    scroll_pipeline_pane: (delta = 0) => {
      pipeline_log_scroll_offset = Math.max(0, pipeline_log_scroll_offset + Number(delta || 0));
      dual_pane_panel.set_pipeline_scroll_offset(pipeline_log_scroll_offset);
      return pipeline_log_scroll_offset;
    },
    get_active_chat_pane: () => active_chat_pane,
    set_active_chat_pane: (pane = 'chat') => {
      active_chat_pane = pane === 'pipeline' ? 'pipeline' : 'chat';
      dual_pane_panel.set_active_pane(active_chat_pane);
      return active_chat_pane;
    },
    toggle_active_chat_pane: () => {
      active_chat_pane = active_chat_pane === 'chat' ? 'pipeline' : 'chat';
      dual_pane_panel.set_active_pane(active_chat_pane);
      return active_chat_pane;
    },
    get_state: () => ({
      active_window,
      active_agent,
      active_f1_pane: active_chat_pane,
      chat_scroll_offset,
      pipeline_log_scroll_offset,
      chat_message_count: chat_messages.length,
      pipeline_message_count: pipeline_messages.length
    }),
    get_multiline_input: () => multiline_input,
    get_dual_pane_panel: () => dual_pane_panel,
    set_input_buffer,
    get_input_buffer: () => ({ ...input_state }),
    set_input_prompt,
    resolve_telemetry_snapshot,
    render_status_bar,
    render_chat_viewport_window,
    render_chat_input_window,
    render_phase_gate_pipeline,
    render_process_execution_step,
    build_doc_store_tree,
    build_top_level_items_tree,
    render_treeview_window,
    render_memory_knowledge_window,
    render_active_window,
    render_tui_frame,
    render_in_place_ansi,
    handle_keypress,
    get_selected_tree_node,
    select_tree_item_by_id
  };
}

export const create_cli_chat_status_bar_layout = create_cli_status_bar_layout;
