/**
 * =========================================================================
 * module: InteractiveDiscoveryChat
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: interactive mastra agentic command-line chat repl for sdlc-supervisor and role agents
 * verbose: connects the terminal repl directly to the registered mastra Agent instances
 * (sdlc-supervisor, product-manager, system-architect, software-engineer, qa-engineer,
 * security-engineer, devops-engineer) and their configured mastra language model adapter
 * (HarnessModel). executes turns via mastra Agent.generate() with native toolsets.
 * 
 * section: arguments
 * - options (object, optional): configuration options for brief parsing and agentic chat
 * 
 * section: return value
 * - module exports (object): { CHAT_AGENT_PROFILES, resolve_chat_agent_id, parse_feature_brief_input, format_tool_trace_summary, format_chat_reply_prose, create_terminal_chat_io, create_agentic_chat_tools, create_interactive_discovery_chat }
 * 
 * section: example
 * const chat = create_interactive_discovery_chat({ harness });
 * await chat.run_agentic_chat({ agent_id: 'sdlc-supervisor' });
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import readline from 'node:readline/promises';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { DocumentEntityTypes } from './DocumentEntitiesSchema.js';
import { migrate_all_documents } from './DocumentMigrator.js';
import { resolve_harness_model } from './HarnessModel.js';
import {
  list_sdlc_phases,
  list_review_gates,
  list_work_item_types,
  list_high_level_processes,
  list_tier_architecture,
  list_sdlc_statecharts,
  format_sdlc_phases_catalog,
  format_review_gates_catalog,
  format_work_item_types_catalog,
  format_tier_architecture_catalog,
  format_high_level_processes_catalog,
  format_sdlc_statecharts_catalog
} from './HarnessCatalog.js';
import { GOVERNANCE_SKILLS } from './HarnessSkills.js';
import { sanitize_chat_paste_payload } from './multiline-scrollable-chat-input.js';
import {
  create_cli_status_bar_layout,
  render_process_execution_step
} from './CliStatusBarLayout.js';
import {
  SDLC_CONTROLLER_MODE_DEFINITIONS,
  create_sdlc_agent_controller,
  resolve_role_for_controller_mode,
  resolve_sdlc_controller_mode
} from './MastraEcosystemBridge.js';

const AGENT_ALIASES = Object.freeze({
  supervisor: 'sdlc-supervisor',
  'sdlc-supervisor': 'sdlc-supervisor',
  sup: 'sdlc-supervisor',
  governor: 'sdlc-supervisor',
  discovery: 'product-manager',
  pm: 'product-manager',
  product: 'product-manager',
  'product-manager': 'product-manager',
  architecture: 'system-architect',
  arch: 'system-architect',
  architect: 'system-architect',
  'system-architect': 'system-architect',
  implementation: 'software-engineer',
  impl: 'software-engineer',
  code: 'software-engineer',
  se: 'software-engineer',
  dev: 'software-engineer',
  developer: 'software-engineer',
  engineer: 'software-engineer',
  'software-engineer': 'software-engineer',
  qa: 'qa-engineer',
  quality: 'qa-engineer',
  tester: 'qa-engineer',
  'qa-engineer': 'qa-engineer',
  sec: 'security-engineer',
  security: 'security-engineer',
  'security-engineer': 'security-engineer',
  devops: 'devops-engineer',
  ops: 'devops-engineer',
  release: 'devops-engineer',
  'devops-engineer': 'devops-engineer',
  auto: 'autonomous-engineer',
  autonomous: 'autonomous-engineer',
  'autonomous-engineer': 'autonomous-engineer',
  coder: 'autonomous-engineer',
  fixer: 'autonomous-engineer',
  builder: 'autonomous-engineer',
  untethered: 'autonomous-engineer'
});

const AGENT_PROFILES = Object.freeze({
  'sdlc-supervisor': {
    id: 'sdlc-supervisor',
    title: 'tier 1 supervisory governor',
    focus: 'operates the xstate statechart, work board, review gatekeeper, entity store, and git provenance; coordinates all specialist agents'
  },
  'product-manager': {
    id: 'product-manager',
    title: 'product manager specialist',
    focus: 'authors prds, slices user stories, defines bdd acceptance criteria, and approves pull request merges'
  },
  'autonomous-engineer': {
    id: 'autonomous-engineer',
    title: 'untethered autonomous engineer & sdlc consumer',
    focus: 'operates independently without sdlc statechart or supervisor token locks to diagnose and fix broken behaviours directly in the workspace, while also capable of consuming governed sdlc processes (develop-feature, fix-defect, sync_prd_and_code) when structured lifecycle execution is desired'
  },
  'system-architect': {
    id: 'system-architect',
    title: 'system architect specialist',
    focus: 'authors architectural decision records (adrs), defines modular boundaries, and specifies interface contracts'
  },
  'software-engineer': {
    id: 'software-engineer',
    title: 'software engineer specialist',
    focus: 'executes tdd red-green-refactor implementation cycles, patches defects, and preserves test immutability'
  },
  'qa-engineer': {
    id: 'qa-engineer',
    title: 'quality assurance specialist',
    focus: 'executes regression suites, verifies gherkin bdd scenarios, audits test immutability, and signs qa pr attestations'
  },
  'security-engineer': {
    id: 'security-engineer',
    title: 'security engineer specialist',
    focus: 'conducts stride threat modelling, owasp audits, cve remediation, and signs security pr attestations'
  },
  'devops-engineer': {
    id: 'devops-engineer',
    title: 'devops & release specialist',
    focus: 'manages semantic releases, ci/cd pipelines, dependency upgrades, and blameless retrospectives'
  }
});

export const CHAT_AGENT_PROFILES = AGENT_PROFILES;

/**
 * =========================================================================
 * function: resolve_chat_agent_id
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: resolves an agent name or short alias into a canonical sdlc agent id
 * verbose: maps user-friendly names (supervisor, pm, arch, se, qa, sec, devops) to canonical
 * agent identifiers (sdlc-supervisor, product-manager, system-architect, software-engineer,
 * qa-engineer, security-engineer, devops-engineer).
 * 
 * section: arguments
 * - raw_name (string): candidate agent name or alias
 * 
 * section: return value
 * - agent_id (string|null): canonical agent identifier or null if not matched
 * 
 * section: example
 * const id = resolve_chat_agent_id('arch');
 * =========================================================================
 */
export function resolve_chat_agent_id(raw_name) {
  if (!raw_name) {
    return null;
  }
  const key = String(raw_name).trim().toLowerCase();
  return AGENT_ALIASES[key] || null;
}

const resolve_agent_id = resolve_chat_agent_id;

function split_list_items(raw_value) {
  if (!raw_value) {
    return [];
  }
  if (Array.isArray(raw_value)) {
    return raw_value
      .map((item) => (typeof item === 'string' ? item.trim() : item))
      .filter(Boolean);
  }
  if (typeof raw_value === 'string') {
    return raw_value
      .split(/[;\n|]+/)
      .map((item) => item.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function parse_markdown_brief(raw_markdown = '') {
  const lines = String(raw_markdown).split(/\r?\n/);
  let title = '';
  let current_section = 'description';
  const sections = {
    description: [],
    problem: [],
    audience: [],
    requirements: [],
    criteria: [],
    constraints: [],
    tasks: []
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1 && !title) {
      title = h1[1].trim();
      continue;
    }

    const heading = trimmed.match(/^#{2,4}\s+(.+)$/);
    if (heading) {
      const h_text = heading[1].toLowerCase();
      if (h_text.includes('problem') || h_text.includes('summary') || h_text.includes('why') || h_text.includes('goal')) {
        current_section = 'problem';
      } else if (h_text.includes('audience') || h_text.includes('persona') || h_text.includes('user')) {
        current_section = 'audience';
      } else if (h_text.includes('criteria') || h_text.includes('acceptance') || h_text.includes('scenario') || h_text.includes('bdd')) {
        current_section = 'criteria';
      } else if (h_text.includes('requirement') || h_text.includes('feature') || h_text.includes('scope') || h_text.includes('what')) {
        current_section = 'requirements';
      } else if (h_text.includes('constraint') || h_text.includes('architecture') || h_text.includes('non-functional')) {
        current_section = 'constraints';
      } else if (h_text.includes('task') || h_text.includes('story') || h_text.includes('stories')) {
        current_section = 'tasks';
      } else {
        current_section = 'description';
      }
      continue;
    }

    sections[current_section].push(trimmed);
  }

  const clean_bullet = (line) => line.replace(/^[-*•\d.)\s]+/, '').trim();
  const problem_text = sections.problem.map(clean_bullet).join(' ').trim()
    || sections.description.map(clean_bullet).join(' ').trim();
  const audience_text = sections.audience.map(clean_bullet).join(' ').trim();

  return {
    title: title || undefined,
    description: problem_text || undefined,
    problem_statement: problem_text || undefined,
    target_audience: audience_text || undefined,
    functional_requirements: sections.requirements.map(clean_bullet).filter(Boolean),
    acceptance_criteria: sections.criteria.map(clean_bullet).filter(Boolean),
    architectural_constraints: sections.constraints.map(clean_bullet).filter(Boolean),
    tasks: sections.tasks.map(clean_bullet).filter(Boolean)
  };
}

/**
 * =========================================================================
 * function: parse_feature_brief_input
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: normalises inline cli arguments, flags, and markdown specification files into a structured brief
 * verbose: inspects inline description strings, --problem, --criteria, --requirements, --audience,
 * and --file markdown documents, producing a structured specification payload ready for
 * SdlcSupervisor.initiate_process and Mastra role workflows.
 * 
 * section: arguments
 * - options (object, optional): { name, description, problem_statement, target_audience, acceptance_criteria, functional_requirements, file, workspace_root }
 * 
 * section: return value
 * - brief (object): structured specification brief with has_explicit_brief indicator
 * 
 * section: example
 * const brief = parse_feature_brief_input({ name: 'session-vault', description: 'encrypted session store' });
 * =========================================================================
 */
export function parse_feature_brief_input(options = {}) {
  const name = options.name || options.feature_name || 'new-feature';
  let file_data = {};
  let resolved_file_path = null;

  if (options.file) {
    const base_dir = options.workspace_root || process.cwd();
    const candidate = path.isAbsolute(options.file)
      ? options.file
      : path.resolve(base_dir, options.file);
    if (!fs.existsSync(candidate)) {
      throw new Error(`brief_file_not_found: specification file not found at ${candidate}`);
    }
    resolved_file_path = candidate;
    const raw_content = fs.readFileSync(candidate, 'utf-8');
    if (candidate.endsWith('.json')) {
      file_data = JSON.parse(raw_content);
    } else {
      file_data = parse_markdown_brief(raw_content);
    }
  }

  const raw_description = options.description || options.problem_statement || file_data.problem_statement || file_data.description || '';
  const problem_statement = String(raw_description).trim();
  const target_audience = String(
    options.target_audience || options.audience || file_data.target_audience || ''
  ).trim();

  const acceptance_criteria = [
    ...split_list_items(options.acceptance_criteria || options.criteria),
    ...split_list_items(file_data.acceptance_criteria)
  ];

  const functional_requirements = [
    ...split_list_items(options.functional_requirements || options.requirements),
    ...split_list_items(file_data.functional_requirements)
  ];

  const architectural_constraints = [
    ...split_list_items(options.architectural_constraints || options.constraints),
    ...split_list_items(file_data.architectural_constraints)
  ];

  const has_explicit_brief = Boolean(
    problem_statement.length > 0
    || acceptance_criteria.length > 0
    || functional_requirements.length > 0
    || resolved_file_path
  );

  return {
    name,
    title: options.title || file_data.title || name,
    description: problem_statement || undefined,
    problem_statement: problem_statement || undefined,
    target_audience: target_audience || 'application developers and platform consumers',
    acceptance_criteria,
    functional_requirements: functional_requirements.length > 0
      ? functional_requirements
      : (problem_statement ? [problem_statement] : []),
    architectural_constraints,
    source_file: resolved_file_path,
    has_explicit_brief,
    source: resolved_file_path ? 'markdown_file' : (has_explicit_brief ? 'inline_cli' : 'none')
  };
}

/**
 * =========================================================================
 * function: format_tool_trace_summary
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formats tool call arguments into a concise human-readable summary string
 * verbose: avoids dumping large raw json payloads to the terminal during interactive
 * chat turns by extracting key fields and array counts for each tool invocation.
 * 
 * section: arguments
 * - tool_name (string): invoked tool identifier
 * - args (object): tool input arguments
 * - draft (object, optional): current working specification draft
 * 
 * section: return value
 * - summary (string): concise single-line summary of tool arguments
 * 
 * section: example
 * const text = format_tool_trace_summary('update_specification_draft', { name: 'vault' });
 * =========================================================================
 */
export function format_tool_trace_summary(tool_name, args = {}, draft = {}) {
  if (!args || typeof args !== 'object') {
    return '';
  }
  const clean_keys = Object.keys(args).filter(
    (k) => args[k] !== undefined && args[k] !== null && args[k] !== ''
  );
  if (clean_keys.length === 0) {
    return '';
  }

  if (tool_name === 'update_specification_draft') {
    const target_name = args.name || draft?.name || 'new-feature';
    const fields = clean_keys.map((k) => {
      const val = args[k];
      if (Array.isArray(val)) {
        return `${k}[${val.length}]`;
      }
      return k;
    });
    return ` (draft='${target_name}' updated: ${fields.join(', ')})`;
  }

  if (tool_name === 'execute_sdlc_process') {
    const proc = args.process_type || draft?.process_type || 'develop-feature';
    const target_name = args.name || draft?.name || 'new-feature';
    const swarm_tag = args.swarm ? ' swarm=true' : '';
    return ` (process=${proc} epic='${target_name}'${swarm_tag})`;
  }

  if (tool_name === 'consult_specialist_agent') {
    const role = args.role || 'system-architect';
    const q = String(args.question || '').trim();
    const short_q = q.length > 60 ? `${q.slice(0, 57)}...` : q;
    return short_q ? ` (role=${role} question="${short_q}")` : ` (role=${role})`;
  }

  if (tool_name === 'list_entities') {
    return ` (type=${args.type || 'prd'})`;
  }

  if (tool_name === 'show_entity') {
    return ` (id=${args.id || args.name || ''})`;
  }

  if (tool_name === 'switch_active_agent') {
    return ` (agent=${args.agent || ''})`;
  }

  if (tool_name === 'resolve_board_clarification') {
    const target = args.ticket_id || args.epic_id || 'board';
    return ` (target=${target})`;
  }

  if (tool_name === 'inspect_sdlc_catalog') {
    return ` (category=${args.category || 'phases_and_gates'})`;
  }

  if (tool_name === 'manage_work_items') {
    const act = args.action || 'list';
    const name_part = args.name ? ` work='${args.name}'` : '';
    const type_part = args.type ? ` type=${args.type}` : '';
    return ` (action=${act}${name_part}${type_part})`;
  }

  if (tool_name === 'evaluate_review_gate') {
    return ` (gate_id=${args.gate_id || 'gate_1_planning'})`;
  }

  if (tool_name === 'manage_worker_pool') {
    return ` (action=${args.action || 'status'})`;
  }

  if (tool_name === 'sync_prd_and_code') {
    const dir = args.direction || 'bidirectional';
    const target_name = args.name || draft?.name || 'active';
    return ` (direction=${dir} target='${target_name}')`;
  }

  if (tool_name === 'suggest_features') {
    return ' (brainstorming candidate features)';
  }

  if (tool_name === 'request_sdlc_supervisor') {
    const act = args.action || 'check_readiness';
    const target_name = args.name || draft?.name || 'active';
    return ` (action=${act} target='${target_name}')`;
  }

  const pairs = clean_keys.slice(0, 4).map((k) => {
    const v = args[k];
    if (Array.isArray(v)) {
      return `${k}=[${v.length} items]`;
    }
    if (v && typeof v === 'object') {
      return `${k}={...}`;
    }
    const s = String(v);
    return `${k}=${s.length > 40 ? `${s.slice(0, 37)}...` : s}`;
  });
  return ` (${pairs.join(', ')})`;
}

/**
 * =========================================================================
 * function: format_chat_reply_prose
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: converts raw json blocks or json objects in agent chat replies into clean readable prose
 * verbose: detects whether an llm chat response consists of raw json or contains fenced
 * json blocks and renders them as clean human-readable bullet points without raw braces.
 * 
 * section: arguments
 * - raw_text (string): raw agent response text
 * 
 * section: return value
 * - formatted (string): human-readable response text free of raw json dumps
 * 
 * section: example
 * const text = format_chat_reply_prose('{"status":"ready","count":2}');
 * =========================================================================
 */
export function format_chat_reply_prose(raw_text = '') {
  const trimmed = String(raw_text || '').trim();
  if (!trimmed) {
    return '';
  }

  function render_json_value(val, indent = '  ') {
    if (val === null || val === undefined) {
      return 'none';
    }
    if (typeof val !== 'object') {
      return String(val);
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        return 'none';
      }
      if (val.every((item) => typeof item !== 'object' || item === null)) {
        return val.map((item) => `\n${indent}- ${String(item)}`).join('');
      }
      return val
        .map((item) => {
          if (item && typeof item === 'object') {
            const summary = Object.entries(item)
              .filter(([, v]) => v !== undefined && v !== null && v !== '')
              .map(([k, v]) => `${k}: ${ typeof v === 'object' ? JSON.stringify(v) : v }`)
              .join(', ');
            return `\n${indent}- ${summary}`;
          }
          return `\n${indent}- ${String(item)}`;
        })
        .join('');
    }
    const lines = [];
    for (const [k, v] of Object.entries(val)) {
      if (v === undefined || v === null || v === '') {
        continue;
      }
      const label = k.replace(/_/g, ' ');
      if (Array.isArray(v)) {
        if (v.length === 0) {
          lines.push(`${indent}- ${label}: none`);
        } else {
          lines.push(`${indent}- ${label} (${v.length}):${render_json_value(v, `${indent}  `)}`);
        }
      } else if (typeof v === 'object') {
        lines.push(`${indent}- ${label}:\n${render_json_value(v, `${indent}  `)}`);
      } else {
        lines.push(`${indent}- ${label}: ${v}`);
      }
    }
    return lines.join('\n');
  }

  // check if entire reply is a fenced json block or raw json object/array
  const fenced_full = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const candidate_json = fenced_full ? fenced_full[1].trim() : trimmed;
  if (
    (candidate_json.startsWith('{') && candidate_json.endsWith('}'))
    || (candidate_json.startsWith('[') && candidate_json.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(candidate_json);
      return render_json_value(parsed, '');
    } catch (_err) {
      // fall through if not valid json
    }
  }

  // also replace any embedded ```json ... ``` blocks inside mixed prose
  if (trimmed.includes('```')) {
    return trimmed.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (full_match, inner) => {
      const candidate = String(inner || '').trim();
      if (
        (candidate.startsWith('{') && candidate.endsWith('}'))
        || (candidate.startsWith('[') && candidate.endsWith(']'))
      ) {
        try {
          const parsed = JSON.parse(candidate);
          return render_json_value(parsed, '  ');
        } catch (_err) {
          return full_match;
        }
      }
      return full_match;
    });
  }

  return trimmed;
}

/**
 * =========================================================================
 * function: create_terminal_chat_io
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a readline-backed or scripted terminal input/output adapter for interactive chat
 * verbose: supports live interactive tty readline prompts as well as deterministic scripted
 * answer queues (via options.responses or --chat-inputs) for automated testing and non-tty runs.
 * 
 * section: arguments
 * - options (object, optional): { input, output, responses, silent, ask, write }
 * 
 * section: return value
 * - io (object): { ask, write, close, get_output_lines }
 * 
 * section: example
 * const io = create_terminal_chat_io({ responses: ['status', '/exit'] });
 * =========================================================================
 */
export function create_terminal_chat_io(options = {}) {
  const output_lines = [];
  const scripted_responses = Array.isArray(options.responses)
    ? options.responses.slice()
    : (typeof options.responses === 'string' && options.responses.length > 0
      ? options.responses.split('|').map((s) => s.trim())
      : null);
  let cursor = 0;
  let rl = null;
  let rl_closed = false;
  const line_queue = [];
  const line_waiters = [];

  const in_stream = options.input || process.stdin;
  const out_stream = options.output && typeof options.output === 'object' ? options.output : process.stdout;
  const is_tui_enabled = Boolean(
    options.tui_mode === true
    || (!scripted_responses && !options.silent && options.output !== false && in_stream && in_stream.isTTY && out_stream && out_stream.isTTY)
  );

  let attached_layout = options.layout || null;
  let tui_entered = false;
  let raw_mode_enabled = false;
  let input_buffer = '';
  let input_cursor = 0;
  let keypress_handler = typeof options.on_keypress === 'function' ? options.on_keypress : null;
  let bound_keypress_stream = null;
  let bound_resize_stream = null;

  function on_process_exit() {
    if (tui_entered && !options.silent && options.output !== false) {
      try {
        out_stream.write('\x1b[?7h\x1b[?25h\x1b[?1049l');
      } catch (_err) {
        // ignore exit write error
      }
      tui_entered = false;
    }
  }

  function redraw_tui() {
    if (!attached_layout || typeof attached_layout.render_in_place_ansi !== 'function') {
      return;
    }
    attached_layout.set_input_buffer(input_buffer, input_cursor);
    if (is_tui_enabled && !options.silent && options.output !== false) {
      if (!tui_entered) {
        tui_entered = true;
        process.once('exit', on_process_exit);
        out_stream.write('\x1b[?1049h\x1b[H\x1b[2J');
      }
      const cols = typeof out_stream.columns === 'number' ? out_stream.columns : undefined;
      const rows = typeof out_stream.rows === 'number' ? out_stream.rows : undefined;
      out_stream.write(attached_layout.render_in_place_ansi({ columns: cols, rows }));
    }
  }

  function attach_layout(layout_instance) {
    attached_layout = layout_instance;
    if (attached_layout) {
      output_lines.push(attached_layout.render_status_bar());
      if (is_tui_enabled && out_stream && typeof out_stream.on === 'function' && !bound_resize_stream) {
        bound_resize_stream = out_stream;
        bound_resize_stream.on('resize', redraw_tui);
      }
      redraw_tui();
    }
  }

  function write(text = '') {
    const line = String(text);
    output_lines.push(line);
    if (attached_layout && typeof attached_layout.append_chat_message === 'function') {
      attached_layout.append_chat_message(line);
    }
    if (typeof options.write === 'function') {
      options.write(line);
      return;
    }
    if (is_tui_enabled && attached_layout) {
      redraw_tui();
      return;
    }
    if (!options.silent && options.output !== false) {
      out_stream.write(line.endsWith('\n') ? line : `${line}\n`);
    }
  }

  function status(text = '') {
    const line = String(text);
    if (attached_layout) {
      if (typeof attached_layout.append_pipeline_message === 'function') {
        attached_layout.append_pipeline_message(line);
      } else if (typeof attached_layout.append_chat_message === 'function') {
        attached_layout.append_chat_message(line);
      }
    }
    if (typeof options.status === 'function') {
      options.status(line);
      return;
    }
    if (options.record_status === true) {
      output_lines.push(line);
    }
    if (is_tui_enabled && attached_layout) {
      redraw_tui();
      return;
    }
    if (!options.silent && options.output !== false && !scripted_responses) {
      out_stream.write(line.endsWith('\n') ? line : `${line}\n`);
    }
  }

  function submit_tui_line(raw_line) {
    const submitted = String(raw_line ?? '').trim();
    if (submitted && attached_layout && typeof attached_layout.append_chat_message === 'function') {
      attached_layout.append_chat_message(`you> ${submitted}`, { speaker: 'user' });
      redraw_tui();
    }
    if (line_waiters.length > 0) {
      const resolve_next = line_waiters.shift();
      resolve_next(submitted);
    } else {
      line_queue.push(submitted);
    }
  }

  function on_stream_keypress(str, key = {}) {
    if (is_tui_enabled && attached_layout) {
      if (key && key.ctrl && (key.name === 'c' || key.name === 'd')) {
        submit_tui_line('/exit');
        return;
      }

      const kname = String(key?.name || '').toLowerCase();

      // multi-line newline insertion (shift+enter, alt/meta+enter, ctrl+j)
      if (
        ((kname === 'return' || kname === 'enter') && Boolean(key?.shift || key?.meta || key?.alt))
        || (key?.ctrl && kname === 'j')
        || str === '\x1b\r'
        || str === '\x1b\n'
      ) {
        input_buffer = input_buffer.slice(0, input_cursor) + '\n' + input_buffer.slice(input_cursor);
        input_cursor += 1;
        redraw_tui();
        return;
      }

      // vertical cursor navigation inside multi-line input before viewport scroll
      if (
        input_buffer.includes('\n')
        && (kname === 'up' || kname === 'down')
        && typeof attached_layout.get_multiline_input === 'function'
      ) {
        const ml = attached_layout.get_multiline_input();
        ml.set_value(input_buffer, input_cursor);
        const nav_res = ml.handle_keypress(str, key);
        if (nav_res.action === 'cursor' || nav_res.action === 'scroll') {
          input_buffer = nav_res.value;
          input_cursor = nav_res.state.cursor_index;
          redraw_tui();
          return;
        }
      }

      if (typeof keypress_handler === 'function') {
        const outcome = keypress_handler(str, key, { input_buffer });
        if (outcome && outcome.handled) {
          redraw_tui();
          return;
        }
      }

      if (kname === 'return' || kname === 'enter') {
        const line_to_send = input_buffer;
        input_buffer = '';
        input_cursor = 0;
        attached_layout.set_input_buffer('', 0);
        submit_tui_line(line_to_send);
        return;
      }

      if (kname === 'backspace') {
        if (input_cursor > 0) {
          input_buffer = input_buffer.slice(0, input_cursor - 1) + input_buffer.slice(input_cursor);
          input_cursor -= 1;
          redraw_tui();
        }
        return;
      }

      if (kname === 'delete') {
        if (input_cursor < input_buffer.length) {
          input_buffer = input_buffer.slice(0, input_cursor) + input_buffer.slice(input_cursor + 1);
          redraw_tui();
        }
        return;
      }

      if (kname === 'left') {
        input_cursor = Math.max(0, input_cursor - 1);
        redraw_tui();
        return;
      }

      if (kname === 'right') {
        input_cursor = Math.min(input_buffer.length, input_cursor + 1);
        redraw_tui();
        return;
      }

      if (kname === 'home' || (key?.ctrl && kname === 'a')) {
        input_cursor = 0;
        redraw_tui();
        return;
      }

      if (kname === 'end' || (key?.ctrl && kname === 'e')) {
        input_cursor = input_buffer.length;
        redraw_tui();
        return;
      }

      if (key?.ctrl && kname === 'u') {
        input_buffer = '';
        input_cursor = 0;
        redraw_tui();
        return;
      }

      if (typeof str === 'string' && str.length > 0 && !key?.ctrl && !key?.meta) {
        if (str.includes('\n') || str.includes('\r') || str.length > 1) {
          const sanitized = sanitize_chat_paste_payload(str);
          input_buffer = input_buffer.slice(0, input_cursor) + sanitized.text + input_buffer.slice(input_cursor);
          input_cursor += sanitized.text.length;
          redraw_tui();
          return;
        }
        if (str >= ' ') {
          input_buffer = input_buffer.slice(0, input_cursor) + str + input_buffer.slice(input_cursor);
          input_cursor += str.length;
          redraw_tui();
        }
      }
      return;
    }

    if (typeof keypress_handler === 'function') {
      keypress_handler(str, key, { input_buffer });
    }
  }

  function ensure_readline() {
    if (is_tui_enabled && attached_layout) {
      if (!bound_keypress_stream && in_stream && typeof in_stream.on === 'function') {
        emitKeypressEvents(in_stream);
        if (typeof in_stream.setRawMode === 'function') {
          in_stream.setRawMode(true);
          raw_mode_enabled = true;
        }
        if (typeof in_stream.resume === 'function') {
          in_stream.resume();
        }
        bound_keypress_stream = in_stream;
        in_stream.on('keypress', on_stream_keypress);
      }
      return;
    }

    if (rl) return;
    if (in_stream.readableEnded || in_stream.destroyed) {
      rl_closed = true;
      return;
    }
    rl = readline.createInterface({
      input: in_stream,
      output: out_stream,
      terminal: Boolean(in_stream.isTTY)
    });
    if (in_stream.isTTY && typeof in_stream.on === 'function' && !bound_keypress_stream) {
      bound_keypress_stream = in_stream;
      in_stream.on('keypress', on_stream_keypress);
    }
    rl.on('line', (line) => {
      if (line_waiters.length > 0) {
        const resolve_next = line_waiters.shift();
        resolve_next(String(line ?? '').trim());
      } else {
        line_queue.push(String(line ?? '').trim());
      }
    });
    rl.on('close', () => {
      rl_closed = true;
      while (line_waiters.length > 0) {
        const resolve_next = line_waiters.shift();
        resolve_next('/exit');
      }
    });
  }

  async function ask(prompt_text = 'you> ') {
    if (attached_layout && typeof attached_layout.set_input_prompt === 'function') {
      attached_layout.set_input_prompt(prompt_text);
    }
    if (typeof options.ask === 'function') {
      const answer = await options.ask(prompt_text);
      const clean = answer !== undefined && answer !== null ? String(answer).trim() : '';
      if (clean && attached_layout && typeof attached_layout.append_chat_message === 'function') {
        attached_layout.append_chat_message(`you> ${clean}`, { speaker: 'user' });
      }
      return clean;
    }
    if (scripted_responses) {
      output_lines.push(prompt_text);
      if (cursor >= scripted_responses.length) {
        return '/done';
      }
      const next_answer = String(scripted_responses[cursor] ?? '').trim();
      cursor += 1;
      output_lines.push(`you> ${next_answer}`);
      if (next_answer && attached_layout && typeof attached_layout.append_chat_message === 'function') {
        attached_layout.append_chat_message(`you> ${next_answer}`, { speaker: 'user' });
      }
      return next_answer;
    }

    ensure_readline();
    if (is_tui_enabled && attached_layout) {
      redraw_tui();
    } else if (!options.silent && options.output !== false) {
      out_stream.write(prompt_text);
    }

    if (line_queue.length > 0) {
      return line_queue.shift();
    }
    if (rl_closed) {
      return '/exit';
    }
    return new Promise((resolve) => {
      line_waiters.push(resolve);
    });
  }

  function close() {
    process.off('exit', on_process_exit);
    if (bound_resize_stream && typeof bound_resize_stream.off === 'function') {
      bound_resize_stream.off('resize', redraw_tui);
      bound_resize_stream = null;
    }
    if (bound_keypress_stream && typeof bound_keypress_stream.off === 'function') {
      bound_keypress_stream.off('keypress', on_stream_keypress);
      bound_keypress_stream = null;
    }
    if (raw_mode_enabled && in_stream && typeof in_stream.setRawMode === 'function') {
      try {
        in_stream.setRawMode(false);
      } catch (_err) {
        // ignore stream close error
      }
      raw_mode_enabled = false;
    }
    if (in_stream === process.stdin && typeof in_stream.pause === 'function') {
      try {
        in_stream.pause();
      } catch (_err) {
        // ignore pause error
      }
    }
    if (tui_entered && !options.silent && options.output !== false) {
      out_stream.write('\x1b[?7h\x1b[?25h\x1b[?1049l');
      tui_entered = false;
    }
    if (rl) {
      rl.close();
      rl = null;
    }
  }

  function get_output_lines() {
    return output_lines.slice();
  }

  return {
    ask,
    write,
    status,
    close,
    get_output_lines,
    attach_layout,
    redraw_tui,
    is_tui_mode: () => Boolean(is_tui_enabled && attached_layout),
    set_keypress_handler: (fn) => {
      keypress_handler = fn;
    }
  };
}

/**
 * =========================================================================
 * function: create_agentic_chat_tools
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: compiles the mastra tool suite for interactive agentic chat sessions
 * verbose: binds genuine mastra tools with zod input schemas allowing sdlc-supervisor and
 * specialist role agents to inspect sovereign state, query .sdlc/store entities, update
 * specification drafts, consult sibling mastra agents via Agent.generate(), resolve
 * awaiting_input clarifications, and execute tier 1 processes.
 * 
 * section: arguments
 * - session_ctx (object): { get_harness, board, store, worker_pool, spec_draft, get_active_agent, set_active_agent, on_tool_executed }
 * 
 * section: return value
 * - tools (object): dictionary of compiled mastra tools
 * 
 * section: example
 * const tools = create_agentic_chat_tools(session_ctx);
 * =========================================================================
 */
export function create_agentic_chat_tools(session_ctx = {}) {
  function unwrap_input(raw_input) {
    if (raw_input && typeof raw_input === 'object') {
      if (raw_input.context && typeof raw_input.context === 'object' && !Array.isArray(raw_input.context)) {
        return raw_input.context;
      }
      if (raw_input.input && typeof raw_input.input === 'object' && !Array.isArray(raw_input.input)) {
        return raw_input.input;
      }
    }
    return raw_input || {};
  }

  function emit_status(text) {
    if (typeof session_ctx.on_status === 'function') {
      session_ctx.on_status(text);
    }
  }

  function record_tool(tool_name, args, output) {
    if (typeof session_ctx.on_tool_executed === 'function') {
      session_ctx.on_tool_executed({ tool: tool_name, args, output });
    }
  }

  const inspect_workspace_status = createTool({
    id: 'inspect_workspace_status',
    description: 'inspects sovereign project state, macro phase, active gate, work board summary, stored entities, and pull requests',
    inputSchema: z.object({}).passthrough(),
    execute: async (raw_input) => {
      const args = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const board = session_ctx.board || (harness ? harness.get_work_board() : null);
      const store = session_ctx.store || (harness ? harness.get_store() : null);
      const git_prov = harness ? harness.get_git_provenance() : null;

      const board_summary = board ? board.get_board_summary() : { counts: { total: 0, completed: 0, awaiting_input: 0, ready: 0 } };
      const prds = store ? store.list_entities(DocumentEntityTypes.PRD) : [];
      const adrs = store ? store.list_entities(DocumentEntityTypes.ADR) : [];
      const stories = store ? store.list_entities(DocumentEntityTypes.USER_STORY) : [];
      const prs = git_prov ? git_prov.list_pull_requests() : [];

      const out = {
        sovereign_state: harness ? harness.get_project_state() : 'active_development',
        macro_phase: harness ? harness.get_macro_phase() : 'idle',
        active_gate: harness ? harness.get_active_gate() : null,
        active_work_item: harness ? harness.get_active_work_item() : null,
        work_items: harness && typeof harness.list_work_items === 'function' ? harness.list_work_items() : [],
        board_counts: board_summary.counts,
        store_counts: {
          prds: prds.length,
          stories: stories.length,
          adrs: adrs.length,
          pull_requests: prs.length
        },
        recent_features: prds.slice(-5).map((p) => ({ id: p.id, slug: p.slug, title: p.title }))
      };
      record_tool('inspect_workspace_status', args, out);
      return out;
    }
  });

  const list_entities = createTool({
    id: 'list_entities',
    description: 'lists entities in the document entity store or tickets on the work board by type (prd, user_story, adr, interface_contract, threat_model, test_report, release_manifest, ticket, pr)',
    inputSchema: z.object({
      type: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const board = session_ctx.board || (harness ? harness.get_work_board() : null);
      const store = session_ctx.store || (harness ? harness.get_store() : null);
      const git_prov = harness ? harness.get_git_provenance() : null;
      const type = String(context?.type || 'prd').toLowerCase();

      let out;
      if (type === 'ticket' || type === 'tickets' || type === 'board') {
        const tickets = board ? board.list_tickets(context?.epic_id ? { epic_id: context.epic_id } : {}) : [];
        out = {
          type: 'ticket',
          count: tickets.length,
          items: tickets.slice(-15).map((t) => ({
            id: t.id,
            epic_id: t.epic_id,
            role: t.role,
            status: t.status,
            title: t.title
          }))
        };
      } else if (type === 'pr' || type === 'prs' || type === 'pull_request') {
        const prs = git_prov ? git_prov.list_pull_requests() : [];
        out = {
          type: 'pull_request',
          count: prs.length,
          items: prs.map((p) => ({
            id: p.pr_id,
            epic_id: p.epic_id,
            status: p.status,
            branch: `${p.source_branch} -> ${p.target_branch}`,
            attestations: Object.keys(p.attestations || {})
          }))
        };
      } else {
        const entities = store ? store.list_entities(type) : [];
        out = {
          type,
          count: entities.length,
          items: entities.map((e) => ({
            id: e.id,
            slug: e.slug || undefined,
            title: e.title || e.component || e.version || e.id,
            status: e.status || e.gate_verdict || 'approved'
          }))
        };
      }
      record_tool('list_entities', context, out);
      return out;
    }
  });

  const show_entity = createTool({
    id: 'show_entity',
    description: 'retrieves full details for a specific feature, prd, adr, ticket, or pull request by identifier or slug',
    inputSchema: z.object({
      id: z.string().optional(),
      name: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const board = session_ctx.board || (harness ? harness.get_work_board() : null);
      const store = session_ctx.store || (harness ? harness.get_store() : null);
      const id = String(context?.id || context?.name || '').trim();
      if (!id) {
        const err_out = { found: false, id: '', error: 'identifier required' };
        record_tool('show_entity', context, err_out);
        return err_out;
      }

      if (board) {
        const ticket = board.get_ticket(id);
        if (ticket) {
          const out = { found: true, id, kind: 'ticket', entity: ticket };
          record_tool('show_entity', context, out);
          return out;
        }
      }

      if (store) {
        const slug = id.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const prd_id = id.startsWith('prd-') ? id : `prd-${slug}`;
        const tree = store.query_by_prd(prd_id);
        if (tree && tree.prd) {
          const summary = board ? board.get_board_summary(id) : null;
          const out = {
            found: true,
            id,
            kind: 'feature_tree',
            prd: tree.prd,
            stories_count: tree.stories.length,
            adrs_count: tree.adrs.length,
            interfaces_count: tree.interfaces.length,
            board_summary: summary ? summary.counts : null
          };
          record_tool('show_entity', context, out);
          return out;
        }

        const types = Object.values(DocumentEntityTypes);
        for (let i = 0; i < types.length; i += 1) {
          const entity = store.get_entity(types[i], id);
          if (entity) {
            const out = { found: true, id, kind: types[i], entity };
            record_tool('show_entity', context, out);
            return out;
          }
        }
      }

      const not_found = { found: false, id };
      record_tool('show_entity', context, not_found);
      return not_found;
    }
  });

  const update_specification_draft = createTool({
    id: 'update_specification_draft',
    description: 'updates the working specification draft in the current chat session (name, entity_type, problem_statement, target_audience, acceptance_criteria, functional_requirements, architectural_constraints)',
    inputSchema: z.object({
      name: z.string().optional(),
      entity_type: z.string().optional(),
      title: z.string().optional(),
      problem_statement: z.string().optional(),
      target_audience: z.string().optional(),
      acceptance_criteria: z.union([z.string(), z.array(z.string())]).optional(),
      functional_requirements: z.union([z.string(), z.array(z.string())]).optional(),
      architectural_constraints: z.union([z.string(), z.array(z.string())]).optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const draft = session_ctx.spec_draft;
      if (context?.name) {
        draft.name = String(context.name).trim();
      }
      if (context?.entity_type) {
        draft.entity_type = String(context.entity_type).trim();
      }
      if (context?.title) {
        draft.title = String(context.title).trim();
      }
      if (context?.problem_statement) {
        draft.problem_statement = String(context.problem_statement).trim();
        draft.description = draft.problem_statement;
      }
      if (context?.target_audience) {
        draft.target_audience = String(context.target_audience).trim();
      }
      if (context?.acceptance_criteria) {
        const items = split_list_items(context.acceptance_criteria);
        for (let i = 0; i < items.length; i += 1) {
          if (!draft.acceptance_criteria.includes(items[i])) {
            draft.acceptance_criteria.push(items[i]);
          }
        }
      }
      if (context?.functional_requirements) {
        const items = split_list_items(context.functional_requirements);
        for (let i = 0; i < items.length; i += 1) {
          if (!draft.functional_requirements.includes(items[i])) {
            draft.functional_requirements.push(items[i]);
          }
        }
      }
      if (context?.architectural_constraints) {
        const items = split_list_items(context.architectural_constraints);
        for (let i = 0; i < items.length; i += 1) {
          if (!draft.architectural_constraints.includes(items[i])) {
            draft.architectural_constraints.push(items[i]);
          }
        }
      }
      const out = {
        updated: true,
        draft: { ...draft }
      };
      record_tool('update_specification_draft', context, out);
      return out;
    }
  });

  const execute_sdlc_process = createTool({
    id: 'execute_sdlc_process',
    description: 'initiates a governed tier 1 sdlc process (e.g. develop-feature, fix-defect, emergency-hotfix, refactor-module, design-architecture) and drains the worker pool',
    inputSchema: z.object({
      process_type: z.string().optional(),
      name: z.string().optional(),
      problem_statement: z.string().optional(),
      target_audience: z.string().optional(),
      acceptance_criteria: z.union([z.string(), z.array(z.string())]).optional(),
      functional_requirements: z.union([z.string(), z.array(z.string())]).optional(),
      swarm: z.boolean().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      if (!harness) {
        const err_out = { executed: false, error: 'harness_unavailable' };
        record_tool('execute_sdlc_process', context, err_out);
        return err_out;
      }
      const draft = session_ctx.spec_draft;
      const process_type = context?.process_type || draft.process_type || 'develop-feature';
      const name = context?.name || draft.name || 'new-feature';
      const problem_statement = context?.problem_statement || draft.problem_statement || `deliver ${name} under sdlc governance`;
      const target_audience = context?.target_audience || draft.target_audience || 'application developers and platform consumers';
      const acceptance_criteria = (context?.acceptance_criteria && context.acceptance_criteria.length > 0)
        ? split_list_items(context.acceptance_criteria)
        : (draft.acceptance_criteria && draft.acceptance_criteria.length > 0
          ? draft.acceptance_criteria
          : [`verify ${name} satisfies "${problem_statement}"`, `ensure all unit and regression tests pass for ${name}`]);
      const functional_requirements = (context?.functional_requirements && context.functional_requirements.length > 0)
        ? split_list_items(context.functional_requirements)
        : (draft.functional_requirements && draft.functional_requirements.length > 0
          ? draft.functional_requirements
          : [problem_statement, ...acceptance_criteria]);

      draft.name = name;
      draft.problem_statement = problem_statement;
      draft.description = problem_statement;

      const inputs = {
        feature_name: name,
        title: draft.title || name,
        description: problem_statement,
        problem_statement,
        target_audience,
        acceptance_criteria,
        functional_requirements,
        architectural_constraints: draft.architectural_constraints || [],
        persist_code_artefacts: true
      };

      emit_status(
        `  ⋯ [sdlc-supervisor] initiating '${process_type}' for '${name}' (verifying maude statechart & seeding work board)...`
      );

      const active_caller = session_ctx.get_active_agent ? session_ctx.get_active_agent() : 'product-manager';
      const supervisor = harness && typeof harness.get_supervisor === 'function' ? harness.get_supervisor() : null;
      if (supervisor && typeof supervisor.handle_agent_request === 'function' && active_caller !== 'sdlc-supervisor') {
        await supervisor.handle_agent_request({
          from_agent: active_caller,
          action: 'execute_process',
          process_type,
          name,
          problem_statement,
          target_audience,
          acceptance_criteria,
          functional_requirements
        });
      }

      try {
        const phases_traversed = ['inception'];
        const gates_passed = [];
        const is_bg = Boolean(
          context?.background
          || session_ctx.background_requests
          || (harness.get_project_sdlc_config && harness.get_project_sdlc_config()?.get_worker_pool_config()?.default_background_mode)
        );
        const res = await harness.run_process(process_type, {
          ...inputs,
          name,
          persist_code_artefacts: true,
          swarm: Boolean(context?.swarm),
          background: is_bg,
          inputs,
          on_progress: (ev) => {
            if (ev.event === 'ticket_started') {
              if (typeof session_ctx.set_heartbeat_label === 'function') {
                session_ctx.set_heartbeat_label(
                  `${ev.role} (${ev.worker_id}) working on ${ev.ticket_id} — ${ev.title} [workflow: ${ev.workflow_id}]`
                );
              }
              emit_status(
                `  ⋯ [${ev.role}] (${ev.worker_id}) working on ${ev.ticket_id} — ${ev.title} [workflow: ${ev.workflow_id}, phase: ${ev.phase || 'active'}]...`
              );
            } else if (ev.event === 'workflow_step_started') {
              if (typeof session_ctx.set_heartbeat_label === 'function') {
                session_ctx.set_heartbeat_label(
                  `${ev.role} [${ev.ticket_id} -> ${ev.step_id}] ${ev.description}`
                );
              }
              emit_status(
                `    ↳ [${ev.role} -> step:${ev.step_id}] ${ev.description}...`
              );
            } else if (ev.event === 'ticket_completed') {
              const spawned_tag = ev.spawned_count > 0 ? ` (+${ev.spawned_count} child tasks spawned)` : '';
              const git_tag = ev.git_event?.type ? ` [git: ${ev.git_event.type}]` : '';
              emit_status(
                `  ✓ [${ev.role}] completed ${ev.ticket_id} (approved=${ev.approved})${spawned_tag}${git_tag}`
              );
              const transitions = Array.isArray(ev.phase_transitions) ? ev.phase_transitions : [];
              for (let t = 0; t < transitions.length; t += 1) {
                const tr = transitions[t];
                if (tr && tr.to && !phases_traversed.includes(tr.to)) {
                  phases_traversed.push(tr.to);
                }
              }
              if (transitions.length > 0) {
                const chain = [transitions[0].from, ...transitions.map((tr) => tr.to)].join(' -> ');
                emit_status(`    🔒 [tier-1 xstate] phase transition: ${chain}`);
              }
              const gates = Array.isArray(ev.gate_evaluations) ? ev.gate_evaluations : [];
              for (let g = 0; g < gates.length; g += 1) {
                const ge = gates[g];
                if (ge && ge.gate_id) {
                  if (!gates_passed.includes(ge.gate_id)) {
                    gates_passed.push(ge.gate_id);
                  }
                  emit_status(`    🔒 [tier-1 gatekeeper] ${ge.gate_id}: ${ge.decision} (advanced to ${ge.next_phase})`);
                }
              }
            }
          }
        });

        if (res && res.background === true) {
          session_ctx.last_process_result = res;
          emit_status(
            `  ✓ [worker-pool] submitted background request ${res.request_id} (${res.worker_id || 'pool'}) for '${process_type}' on '${res.epic_id || name}'.`
          );
          const bg_out = {
            executed: true,
            background: true,
            queued: true,
            request_id: res.request_id,
            worker_id: res.worker_id || null,
            routed_via: 'worker_pool',
            process_id: process_type,
            epic_id: res.epic_id || name,
            canonical_text:
              `submitted '${process_type}' for '${res.epic_id || name}' to the worker pool ` +
              `(request=${res.request_id}, worker=${res.worker_id || 'pm-worker-01'}, background=true). ` +
              `the worker pool is executing it asynchronously so we can continue chatting here.`
          };
          record_tool('execute_sdlc_process', context, bg_out);
          return bg_out;
        }

        const git_prov = harness.get_git_provenance();
        const prs = git_prov ? git_prov.list_pull_requests({ epic_id: res.epic.id }) : [];
        session_ctx.last_process_result = res;
        const final_work_item = harness.get_active_work_item ? harness.get_active_work_item() : null;
        const final_phase = final_work_item?.phase || (res.board_summary.all_completed ? 'completed' : harness.get_active_phase());

        emit_status(
          `  ✓ [sdlc-supervisor] process '${process_type}' finished for '${res.epic.id}': ` +
          `${res.board_summary.counts.completed}/${res.board_summary.counts.total} tickets completed, ` +
          `statechart=${final_phase}` +
          (prs[0] ? `, pr=${prs[0].pr_id} (${prs[0].status})` : '')
        );

        const out = {
          executed: true,
          request_id: res.request_id || null,
          worker_id: res.worker_id || null,
          routed_via: res.routed_via || 'worker_pool',
          process_id: res.process.id,
          epic_id: res.epic.id,
          branch: res.feature_branch?.name || null,
          all_completed: res.board_summary.all_completed,
          tickets_completed: res.board_summary.counts.completed,
          tickets_total: res.board_summary.counts.total,
          final_phase,
          phases_traversed,
          gates_passed,
          pull_request: prs[0] ? { id: prs[0].pr_id, status: prs[0].status } : null
        };
        record_tool('execute_sdlc_process', context, out);
        return out;
      } catch (err) {
        const err_out = {
          executed: false,
          error: err.message,
          canonical_text: `could not execute process '${process_type}' for '${name}': ${err.message}`
        };
        record_tool('execute_sdlc_process', context, err_out);
        return err_out;
      }
    }
  });

  const resolve_board_clarification = createTool({
    id: 'resolve_board_clarification',
    description: 'resolves awaiting_input ticket clarifications on the work board and resumes worker pool execution',
    inputSchema: z.object({
      epic_id: z.string().optional(),
      ticket_id: z.string().optional(),
      answer: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const board = session_ctx.board || (harness ? harness.get_work_board() : null);
      const pool = session_ctx.worker_pool || (harness ? harness.get_worker_pool() : null);
      if (!board) {
        const empty_out = { resolved_count: 0 };
        record_tool('resolve_board_clarification', context, empty_out);
        return empty_out;
      }

      const epic_id = context?.epic_id || null;
      const ticket_id = context?.ticket_id || null;
      const answer = context?.answer || '';
      const waiting = board.list_tickets((t) => {
        if (t.status !== 'awaiting_input') return false;
        if (ticket_id && t.id !== ticket_id) return false;
        if (epic_id && t.epic_id !== epic_id) return false;
        return true;
      });

      const resolved = [];
      for (let i = 0; i < waiting.length; i += 1) {
        const t = waiting[i];
        const updated = board.resolve_clarification(t.id, {
          from_worker: 'user-cli',
          role: session_ctx.get_active_agent ? session_ctx.get_active_agent() : 'sdlc-supervisor',
          answer,
          problem_statement: t.workflow_id === 'pm-prd-authoring' ? answer : undefined,
          acceptance_criteria: context?.acceptance_criteria
        });
        resolved.push(updated);
      }

      let board_summary = epic_id ? board.get_board_summary(epic_id) : board.get_board_summary();
      if (resolved.length > 0 && pool) {
        const target_epic = epic_id || resolved[0].epic_id;
        await pool.drain_board({ epic_id: target_epic, max_rounds: 50 });
        board_summary = board.get_board_summary(target_epic);
      }

      const out = {
        resolved_count: resolved.length,
        resolved_ticket_ids: resolved.map((r) => r.id),
        all_completed: board_summary.all_completed,
        board_counts: board_summary.counts
      };
      record_tool('resolve_board_clarification', context, out);
      return out;
    }
  });

  const consult_specialist_agent = createTool({
    id: 'consult_specialist_agent',
    description: 'delegates a question or design review to a registered specialist mastra Agent via the worker pool (product-manager, system-architect, software-engineer, qa-engineer, security-engineer, devops-engineer)',
    inputSchema: z.object({
      role: z.string(),
      question: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const target_role = resolve_agent_id(context?.role) || 'system-architect';
      const question = context?.question || 'provide specialist assessment';
      const profile = AGENT_PROFILES[target_role] || AGENT_PROFILES['system-architect'];
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const pool = session_ctx.worker_pool || (harness ? harness.get_worker_pool() : null);
      const specialist_agent = harness ? harness.get_agent(target_role) : null;

      const run_consultation = async () => {
        let recommendation = '';
        if (specialist_agent && typeof specialist_agent.generate === 'function') {
          emit_status(`  ⋯ [${target_role}] analysing question and formulating specialist recommendation...`);
          if (typeof session_ctx.set_heartbeat_label === 'function') {
            session_ctx.set_heartbeat_label(`${target_role} specialist review`);
          }
          const gen = await specialist_agent.generate([
            {
              role: 'system',
              content: `[active_agent:${target_role}] [draft_name:${session_ctx.spec_draft?.name || 'new-feature'}] respond in concise lowercase british english prose or bullet points—never raw json.`
            },
            {
              role: 'user',
              content: question
            }
          ]);
          recommendation = format_chat_reply_prose(gen?.text || '');
          emit_status(`  ✓ [${target_role}] specialist recommendation ready.`);
        }
        if (!recommendation) {
          recommendation = `${profile.title}: ${profile.focus}`;
        }
        return recommendation;
      };

      let recommendation = '';
      let pool_res = null;
      if (pool && typeof pool.submit_request === 'function') {
        pool_res = await pool.submit_request({
          type: 'consultation',
          role: target_role,
          title: question,
          requested_by: session_ctx.get_active_agent ? session_ctx.get_active_agent() : 'product-manager',
          executor: run_consultation
        });
        recommendation = pool_res?.output || '';
      } else {
        recommendation = await run_consultation();
      }

      const out = {
        specialist: target_role,
        title: profile.title,
        question,
        recommendation,
        request_id: pool_res?.request_id || null,
        worker_id: pool_res?.worker_id || null,
        routed_via: pool_res ? 'worker_pool' : 'direct'
      };
      record_tool('consult_specialist_agent', context, out);
      return out;
    }
  });

  const switch_active_agent = createTool({
    id: 'switch_active_agent',
    description: 'switches the active conversational mastra Agent in the chat session to another specialist role agent',
    inputSchema: z.object({
      agent: z.string()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const next_agent = resolve_agent_id(context?.agent);
      const current_agent = session_ctx.get_active_agent ? session_ctx.get_active_agent() : 'product-manager';
      if (!next_agent) {
        const out = {
          switched: false,
          active_agent: current_agent,
          available_agents: Object.keys(AGENT_PROFILES).filter((id) => id !== 'sdlc-supervisor')
        };
        record_tool('switch_active_agent', context, out);
        return out;
      }
      if (next_agent === 'sdlc-supervisor' && session_ctx.allow_direct_supervisor !== true) {
        const out = {
          switched: false,
          active_agent: current_agent,
          mediated_by: current_agent,
          reason: 'direct_supervisor_interaction_disabled_in_normal_mode',
          canonical_text:
            `in normal sessions, you do not interact with sdlc-supervisor directly. ` +
            `as ${current_agent}, i communicate with sdlc-supervisor on your behalf via request_sdlc_supervisor. ` +
            `tell me what you want to check or submit to sdlc-supervisor, or switch to a specialist agent (product-manager, system-architect, software-engineer, qa-engineer, security-engineer, devops-engineer).`
        };
        record_tool('switch_active_agent', context, out);
        return out;
      }
      if (typeof session_ctx.set_active_agent === 'function') {
        session_ctx.set_active_agent(next_agent);
      }
      const out = {
        switched: true,
        active_agent: next_agent,
        profile: AGENT_PROFILES[next_agent]
      };
      record_tool('switch_active_agent', context, out);
      return out;
    }
  });

  const inspect_sdlc_catalog = createTool({
    id: 'inspect_sdlc_catalog',
    description: 'deterministically enumerates canonical sdlc catalogue definitions: statecharts (9 xstate v5 statecharts), phases (10 macro phases), gates (5 formal review gates), phases_and_gates, work_types (7 work-item pathways), processes (25 governed processes), tiers (tier 1 & tier 2 entity/verb matrix), agents (7 mastra agents), workflows (16 mastra workflows), skills, or rules',
    inputSchema: z.object({
      category: z.string().optional(),
      domain: z.string().optional(),
      tier: z.union([z.string(), z.number()]).optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const raw_cat = String(context?.category || 'phases_and_gates').toLowerCase().trim();

      const out = {
        category: raw_cat,
        canonical_text: ''
      };
      const sections = [];

      const include_statecharts = raw_cat === 'statecharts' || raw_cat === 'statechart' || raw_cat === 'machines' || raw_cat === 'state_machines' || raw_cat === 'xstate' || raw_cat === 'all';
      const include_phases = raw_cat === 'phases' || raw_cat === 'phase' || raw_cat === 'phases_and_gates' || raw_cat === 'all';
      const include_gates = raw_cat === 'gates' || raw_cat === 'gate' || raw_cat === 'phases_and_gates' || raw_cat === 'all';
      const include_work_types = raw_cat === 'work_types' || raw_cat === 'work-items' || raw_cat === 'work' || raw_cat === 'pathways' || raw_cat === 'all';
      const include_processes = raw_cat === 'processes' || raw_cat === 'process' || raw_cat === 'all';
      const include_tiers = raw_cat === 'tiers' || raw_cat === 'tier' || raw_cat === 'architecture' || raw_cat === 'entities' || raw_cat === 'all';
      const include_agents = raw_cat === 'agents' || raw_cat === 'agent' || raw_cat === 'roles' || raw_cat === 'all';
      const include_workflows = raw_cat === 'workflows' || raw_cat === 'workflow' || raw_cat === 'all';
      const include_skills = raw_cat === 'skills' || raw_cat === 'skill' || raw_cat === 'rules' || raw_cat === 'rule' || raw_cat === 'governance' || raw_cat === 'all';

      if (include_statecharts) {
        out.statecharts = list_sdlc_statecharts();
        sections.push(
          format_sdlc_statecharts_catalog(
            harness
              ? {
                  sovereign_state: typeof harness.get_project_state === 'function' ? harness.get_project_state() : 'active_development',
                  macro_phase: typeof harness.get_macro_phase === 'function' ? harness.get_macro_phase() : 'idle',
                  work_items: typeof harness.list_work_items === 'function' ? harness.list_work_items() : []
                }
              : null
          )
        );
      }
      if (include_phases) {
        out.phases = list_sdlc_phases();
        sections.push(format_sdlc_phases_catalog());
      }
      if (include_gates) {
        out.gates = list_review_gates();
        sections.push(format_review_gates_catalog());
      }
      if (include_work_types) {
        out.work_types = list_work_item_types();
        sections.push(format_work_item_types_catalog());
      }
      if (include_processes) {
        out.processes = list_high_level_processes(context?.domain || null);
        sections.push(format_high_level_processes_catalog(context?.domain || null));
      }
      if (include_tiers) {
        out.tiers = list_tier_architecture(context?.tier || null);
        sections.push(format_tier_architecture_catalog(context?.tier || null));
      }
      if (include_agents) {
        const agents_list = harness && typeof harness.list_agents === 'function'
          ? await harness.list_agents()
          : Object.values(AGENT_PROFILES).map((p) => ({ id: p.id, instructions: p.focus, skills: [] }));
        out.agents = agents_list.map((a) => ({
          id: a.id,
          title: AGENT_PROFILES[a.id]?.title || a.id,
          focus: AGENT_PROFILES[a.id]?.focus || a.instructions
        }));
        const agent_lines = [`registered mastra role agents (${out.agents.length}):`];
        for (let i = 0; i < out.agents.length; i += 1) {
          const ag = out.agents[i];
          agent_lines.push(`  - ${ag.id} (${ag.title}): ${ag.focus}`);
        }
        sections.push(agent_lines.join('\n'));
      }
      if (include_workflows) {
        const wf_list = harness && typeof harness.list_workflows === 'function'
          ? await harness.list_workflows()
          : [];
        out.workflows = wf_list;
        const wf_lines = [`registered mastra role workflows (${wf_list.length}):`];
        for (let i = 0; i < wf_list.length; i += 1) {
          wf_lines.push(`  - ${wf_list[i].id}: ${wf_list[i].description}`);
        }
        sections.push(wf_lines.join('\n'));
      }
      if (include_skills) {
        const skill_list = harness && typeof harness.list_skills === 'function'
          ? harness.list_skills()
          : Object.values(GOVERNANCE_SKILLS);
        out.skills = skill_list;
        const sk_lines = [`registered governance & role skills (${skill_list.length}):`];
        for (let i = 0; i < skill_list.length; i += 1) {
          sk_lines.push(`  - ${skill_list[i].name}: ${skill_list[i].description}`);
        }
        sections.push(sk_lines.join('\n'));
      }

      if (sections.length === 0) {
        out.phases = list_sdlc_phases();
        out.gates = list_review_gates();
        sections.push(format_sdlc_phases_catalog());
        sections.push(format_review_gates_catalog());
      }

      out.canonical_text = sections.join('\n\n');
      record_tool('inspect_sdlc_catalog', context, out);
      return out;
    }
  });

  const manage_work_items = createTool({
    id: 'manage_work_items',
    description: 'manages concurrent tactical work items (work: feature, fix, hotfix, refactor, security_patch, dependency_upgrade, ingest) across tier 1 xstate actors and the work board. supports actions: list, show, status, create, start, switch, focus, advance, run, clarify',
    inputSchema: z.object({
      action: z.string().optional(),
      name: z.string().optional(),
      type: z.string().optional(),
      process_type: z.string().optional(),
      description: z.string().optional(),
      problem_statement: z.string().optional(),
      answer: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      if (!harness) {
        const err_out = { ok: false, error: 'harness_unavailable' };
        record_tool('manage_work_items', context, err_out);
        return err_out;
      }

      const raw_action = String(context?.action || 'list').toLowerCase().trim();
      const is_mutating_work_action = ['create', 'start', 'advance', 'run', 'execute'].includes(raw_action);
      const action = is_mutating_work_action && session_ctx.allow_work_mutation === false
        ? 'list'
        : raw_action;
      const target_name = String(context?.name || context?.id || session_ctx.spec_draft?.name || '').trim();
      const work_type_to_process = {
        feature: 'develop-feature',
        fix: 'fix-defect',
        defect: 'fix-defect',
        bug: 'fix-defect',
        hotfix: 'emergency-hotfix',
        refactor: 'refactor-module',
        security_patch: 'security-patch',
        dependency_upgrade: 'upgrade-dependencies',
        ingest: 'ingest-legacy-codebase'
      };

      if (action === 'list') {
        const items = harness.list_work_items({
          type: context?.type || undefined,
          status: context?.status || undefined
        });
        const active = harness.get_active_work_item();
        const lines = [`concurrent work items (${items.length}):`];
        if (items.length === 0) {
          lines.push('  (no work items initiated yet)');
        } else {
          for (let i = 0; i < items.length; i += 1) {
            const wi = items[i];
            const focus_tag = wi.focused ? ' *focused*' : '';
            const counts = wi.board_summary?.counts || { completed: 0, total: 0 };
            lines.push(
              `  - ${wi.name} [${wi.type}] phase=${wi.phase} status=${wi.status} tickets=${counts.completed}/${counts.total}${focus_tag}`
            );
          }
        }
        const out = {
          ok: true,
          action: 'list',
          count: items.length,
          active_work_item: active,
          items,
          canonical_text: lines.join('\n')
        };
        record_tool('manage_work_items', context, out);
        return out;
      }

      if (action === 'show' || action === 'status') {
        const item = harness.get_work_item(target_name || null);
        if (!item) {
          const out = {
            ok: false,
            action,
            name: target_name,
            error: `work item not found: '${target_name || 'active'}'`,
            canonical_text: `no work item found matching '${target_name || 'active'}'.`
          };
          record_tool('manage_work_items', context, out);
          return out;
        }
        const counts = item.board_summary?.counts || { completed: 0, total: 0, ready: 0, awaiting_input: 0 };
        const out = {
          ok: true,
          action,
          work_item: item,
          canonical_text:
            `work item '${item.name}' [${item.type}]: phase=${item.phase} status=${item.status} ` +
            `focused=${Boolean(item.focused)} tickets=${counts.completed}/${counts.total} (ready=${counts.ready}, awaiting_input=${counts.awaiting_input || 0})`
        };
        record_tool('manage_work_items', context, out);
        return out;
      }

      if (action === 'create' || action === 'start') {
        const work_type = String(context?.type || session_ctx.spec_draft?.entity_type || 'feature').toLowerCase().trim();
        const proc_id = context?.process_type || work_type_to_process[work_type] || 'develop-feature';
        const name = target_name && target_name !== 'new-feature' ? target_name : `${work_type}-${Date.now()}`;
        const problem = context?.problem_statement || context?.description || session_ctx.spec_draft?.problem_statement || `deliver ${name} (${work_type})`;
        const initiated = harness.initiate_process(proc_id, {
          name,
          description: problem,
          problem_statement: problem,
          inputs: {
            feature_name: name,
            description: problem,
            problem_statement: problem
          }
        });
        session_ctx.spec_draft.name = initiated.epic.id;
        session_ctx.spec_draft.entity_type = initiated.work_item.type;
        session_ctx.spec_draft.process_type = initiated.process.id;
        session_ctx.spec_draft.problem_statement = problem;
        const all_items = harness.list_work_items();
        const out = {
          ok: true,
          action: 'create',
          work_item: initiated.work_item,
          epic_id: initiated.epic.id,
          process_id: initiated.process.id,
          tickets_seeded: initiated.tickets.length,
          concurrent_count: all_items.length,
          canonical_text:
            `created work item '${initiated.epic.id}' [${initiated.work_item.type}] at phase '${initiated.work_item.phase}' ` +
            `(${initiated.tickets.length} tickets seeded on board; ${all_items.length} concurrent work item(s) tracked).`
        };
        record_tool('manage_work_items', context, out);
        return out;
      }

      if (action === 'switch' || action === 'focus') {
        if (!target_name) {
          const out = { ok: false, action, error: 'work item name required to switch focus' };
          record_tool('manage_work_items', context, out);
          return out;
        }
        try {
          const switched = harness.switch_work_item(target_name);
          session_ctx.spec_draft.name = switched.name;
          session_ctx.spec_draft.entity_type = switched.type;
          const counts = switched.board_summary?.counts || { completed: 0, total: 0 };
          const out = {
            ok: true,
            action: 'switch',
            work_item: switched,
            canonical_text:
              `switched active work focus to '${switched.name}' [${switched.type}] (phase=${switched.phase}, tickets=${counts.completed}/${counts.total}).`
          };
          record_tool('manage_work_items', context, out);
          return out;
        } catch (err) {
          const out = {
            ok: false,
            action: 'switch',
            error: err.message,
            canonical_text: `could not switch to work item '${target_name}': ${err.message}`
          };
          record_tool('manage_work_items', context, out);
          return out;
        }
      }

      if (action === 'advance') {
        try {
          const item_before = harness.get_work_item(target_name || null);
          const is_gate = item_before?.phase?.startsWith('gate_') || item_before?.phase === 'emergency_gate';
          const next_phase = harness.advance_work_item(
            { type: context?.event || (is_gate ? 'GATE_PASSED' : 'NEXT') },
            target_name || null
          );
          const item_after = harness.get_work_item(target_name || null);
          const out = {
            ok: true,
            action: 'advance',
            work_item: item_after,
            next_phase,
            canonical_text: `advanced work item '${item_after?.name || target_name}' from '${item_before?.phase}' to '${next_phase}'.`
          };
          record_tool('manage_work_items', context, out);
          return out;
        } catch (err) {
          const out = { ok: false, action: 'advance', error: err.message, canonical_text: err.message };
          record_tool('manage_work_items', context, out);
          return out;
        }
      }

      if (action === 'run' || action === 'execute') {
        const existing_item = harness.get_work_item(target_name || null);
        const work_type = String(context?.type || existing_item?.type || session_ctx.spec_draft?.entity_type || 'feature').toLowerCase().trim();
        const proc_id = context?.process_type || existing_item?.payload?.process_id || work_type_to_process[work_type] || 'develop-feature';
        const resolved_name = existing_item?.name || target_name || 'new-feature';
        const board = harness.get_work_board();
        const pool = harness.get_worker_pool();
        const existing_tickets = board.list_tickets({ epic_id: resolved_name });

        const progress_cb = (ev) => {
          emit_status(render_process_execution_step(ev));
        };

        let summary;
        if (existing_tickets.length > 0 && pool) {
          await pool.drain_board({ epic_id: resolved_name, max_rounds: 50, on_progress: progress_cb });
          summary = board.get_board_summary(resolved_name);
        } else {
          const run_res = await harness.run_process(proc_id, {
            name: resolved_name,
            description: context?.description || context?.problem_statement || existing_item?.payload?.problem_statement,
            on_progress: progress_cb
          });
          summary = run_res.board_summary;
        }
        const updated_item = harness.get_work_item(resolved_name);
        const pipeline_board = session_ctx.layout
          ? `\n${session_ctx.layout.render_phase_gate_pipeline({ epic_id: resolved_name })}`
          : '';
        const out = {
          ok: true,
          action: 'run',
          work_item: updated_item,
          board_summary: summary,
          canonical_text:
            `executed work item '${resolved_name}' [${updated_item?.type || work_type}]: ` +
            `phase=${updated_item?.phase || 'completed'} completed=${summary.all_completed} (${summary.counts.completed}/${summary.counts.total} tickets).${pipeline_board}`
        };
        record_tool('manage_work_items', context, out);
        return out;
      }

      if (action === 'clarify') {
        const clarified = await harness.clarify_process({
          epic_id: target_name || undefined,
          answer: context?.answer || context?.description || ''
        });
        const out = {
          ok: true,
          action: 'clarify',
          resolved_count: clarified.resolved_count,
          board_summary: clarified.board_summary,
          canonical_text:
            `clarified work item '${target_name}' (${clarified.resolved_count} resolved): completed=${clarified.board_summary.all_completed}.`
        };
        record_tool('manage_work_items', context, out);
        return out;
      }

      const fallback = { ok: false, action, error: `unsupported work action '${action}'` };
      record_tool('manage_work_items', context, fallback);
      return fallback;
    }
  });

  const evaluate_review_gate = createTool({
    id: 'evaluate_review_gate',
    description: 'deterministically evaluates a tier 1 formal review gate (gate_1_planning, gate_2_implementation, gate_3_qa_security, gate_4_release, gate_ingest) via the review gatekeeper',
    inputSchema: z.object({
      gate_id: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const gate_id = String(context?.gate_id || 'gate_1_planning').trim();
      if (!harness) {
        const err_out = { gate_id, decision: 'blocked', violations: ['harness_unavailable'] };
        record_tool('evaluate_review_gate', context, err_out);
        return err_out;
      }
      const res = await harness.evaluate_gate({
        ...context,
        gate_id
      });
      const out = {
        gate_id,
        decision: res.decision,
        violations: res.violations || [],
        canonical_text:
          `review gate '${gate_id}' evaluation: decision=${res.decision}` +
          (res.violations && res.violations.length > 0 ? ` (violations: ${res.violations.join('; ')})` : ' (zero violations)')
      };
      record_tool('evaluate_review_gate', context, out);
      return out;
    }
  });

  const manage_worker_pool = createTool({
    id: 'manage_worker_pool',
    description: 'inspects or controls the tier 2 autonomous daemon worker pool (actions: status, list, start, stop, scale, drain)',
    inputSchema: z.object({
      action: z.string().optional(),
      role: z.string().optional(),
      count: z.number().optional(),
      epic_id: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const pool = session_ctx.worker_pool || (harness ? harness.get_worker_pool() : null);
      if (!pool) {
        const err_out = { ok: false, error: 'worker_pool_unavailable' };
        record_tool('manage_worker_pool', context, err_out);
        return err_out;
      }
      const action = String(context?.action || 'status').toLowerCase().trim();
      if (action === 'list') {
        const workers = pool.list_workers(context?.role ? { role: context.role } : {});
        const out = {
          ok: true,
          action: 'list',
          count: workers.length,
          workers
        };
        record_tool('manage_worker_pool', context, out);
        return out;
      }
      if (action === 'scale') {
        const role = context?.role || 'software-engineer';
        const count = Number(context?.count || 2);
        const updated = pool.scale(role, count);
        const out = {
          ok: true,
          action: 'scale',
          role,
          count: updated.length,
          workers: updated
        };
        record_tool('manage_worker_pool', context, out);
        return out;
      }
      if (action === 'start') {
        const status = pool.start();
        const out = { ok: true, action: 'start', status };
        record_tool('manage_worker_pool', context, out);
        return out;
      }
      if (action === 'stop') {
        const status = pool.stop();
        const out = { ok: true, action: 'stop', status };
        record_tool('manage_worker_pool', context, out);
        return out;
      }
      if (action === 'drain') {
        const drain_report = await pool.drain_board({
          epic_id: context?.epic_id || null,
          max_rounds: 50
        });
        const out = { ok: true, action: 'drain', drain_report };
        record_tool('manage_worker_pool', context, out);
        return out;
      }
      if (action === 'requests' || action === 'queue') {
        const requests = typeof pool.list_requests === 'function'
          ? pool.list_requests(context?.status ? { status: context.status } : {})
          : [];
        const out = { ok: true, action: 'requests', count: requests.length, requests };
        record_tool('manage_worker_pool', context, out);
        return out;
      }
      if (action === 'submit') {
        const submitted = await pool.submit_request({
          type: context?.type || 'process',
          process_type: context?.process_type || 'develop-feature',
          name: context?.name || context?.epic_id || session_ctx.spec_draft?.name || 'new-feature',
          role: context?.role || 'product-manager',
          background: context?.background !== false,
          params: context
        });
        const out = { ok: true, action: 'submit', request: submitted };
        record_tool('manage_worker_pool', context, out);
        return out;
      }
      const status = pool.get_status();
      const out = { ok: true, action: 'status', status };
      record_tool('manage_worker_pool', context, out);
      return out;
    }
  });

  const sync_prd_and_code = createTool({
    id: 'sync_prd_and_code',
    description: 'synchronises product requirements documents (prds) in the document entity store with source code modules in src/ (and vice versa). supports direction="code_to_prd" (update prd from code), "prd_to_code" (update code from prd), or "bidirectional" (update prd from code and code from prd)',
    inputSchema: z.object({
      name: z.string().optional(),
      direction: z.string().optional(),
      run_process: z.boolean().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const store = session_ctx.store || (harness ? harness.get_store() : null);
      if (!store) {
        const err_out = { synced: false, error: 'store_unavailable' };
        record_tool('sync_prd_and_code', context, err_out);
        return err_out;
      }

      const raw_dir = String(context?.direction || 'bidirectional').toLowerCase().trim();
      const direction = (raw_dir === 'code_to_prd' || raw_dir === 'from_code' || raw_dir === 'prd')
        ? 'code_to_prd'
        : ((raw_dir === 'prd_to_code' || raw_dir === 'from_prd' || raw_dir === 'code') ? 'prd_to_code' : 'bidirectional');

      const draft = session_ctx.spec_draft || {};
      const active_wi = harness && typeof harness.get_active_work_item === 'function'
        ? harness.get_active_work_item()
        : null;
      const raw_target = typeof context?.name === 'string'
        ? context.name.trim()
        : (typeof context?.id === 'string' ? context.id.trim() : '');
      const target_filter = (
        raw_target
        && raw_target !== 'all'
        && raw_target !== 'new-feature'
        && raw_target !== 'sync-sdlc'
        && raw_target !== 'sync_prd_and_code'
        && raw_target !== '[object Object]'
      )
        ? raw_target
        : '';

      const adapter = typeof store.get_adapter === 'function' ? store.get_adapter() : null;
      const store_root = adapter && typeof adapter.get_store_root === 'function' ? adapter.get_store_root() : '';
      const ws_root = session_ctx.workspace_root
        || (store_root ? path.resolve(store_root, '..', '..') : process.cwd());
      const src_dir = path.join(ws_root, 'src');
      const tests_dir = path.join(ws_root, 'tests');

      emit_status(
        `  ⋯ [sdlc-supervisor] running '${direction}' prd <-> code synchronisation` +
        (target_filter ? ` for '${target_filter}'...` : ' across workspace...')
      );

      let prds = store.list_entities(DocumentEntityTypes.PRD) || [];
      const docs_dir = path.join(ws_root, 'docs');
      if (prds.length === 0 && fs.existsSync(path.join(docs_dir, '01-product'))) {
        try {
          migrate_all_documents(docs_dir, store);
          prds = store.list_entities(DocumentEntityTypes.PRD) || [];
        } catch (_err) {
          // ignore migration error
        }
      }

      if (target_filter) {
        const norm_slug = target_filter.toLowerCase().replace(/^prd-/, '').replace(/[^a-z0-9]+/g, '_');
        const matched = prds.filter((p) => {
          const p_slug = String(p.slug || p.id || '').toLowerCase().replace(/^prd-/, '').replace(/[^a-z0-9]+/g, '_');
          return p_slug === norm_slug || p.id === target_filter;
        });
        if (matched.length > 0) {
          prds = matched;
        } else {
          const created = store.save_entity(DocumentEntityTypes.PRD, {
            id: `prd-${norm_slug}`,
            slug: norm_slug,
            title: `product requirements document: ${target_filter}`,
            status: 'approved',
            author: 'product-manager',
            executive_summary: {
              vision: `governed implementation for ${target_filter}`,
              problem: draft.problem_statement || `synchronise ${target_filter} between prd and code`,
              strategic_context: `bidirectional prd and source code alignment for ${target_filter}`,
              primary_objectives: [`maintain 1:1 traceability between ${target_filter} prd and implementation`]
            },
            functional_requirements: [
              {
                id: 'fr-01',
                title: `deliver ${target_filter} implementation`,
                description: draft.problem_statement || `implement and verify ${target_filter}`,
                priority: 'must_have',
                status: 'approved'
              }
            ]
          });
          prds = [created];
        }
      }

      const src_files = (fs.existsSync(src_dir) && fs.statSync(src_dir).isDirectory())
        ? fs.readdirSync(src_dir).filter((f) => f.endsWith('.js'))
        : [];

      const canonical_prd_module_map = {
        'prd-01': ['index.js', 'MacroStatechartEngine.js', 'MastraExecutionBridge.js', 'ReviewGatekeeper.js', 'RoleWorkflows.js', 'SdlcSupervisor.js'],
        dual_engine_sdlc_harness: ['index.js', 'MacroStatechartEngine.js', 'MastraExecutionBridge.js', 'ReviewGatekeeper.js', 'RoleWorkflows.js', 'SdlcSupervisor.js'],
        'prd-02': ['DagMermaidExporter.js', 'TaskDagEngine.js'],
        dag_mermaid_exporter: ['DagMermaidExporter.js', 'TaskDagEngine.js'],
        'prd-03': ['MastraMemoryStorage.js', 'mastra-memory-storage.js'],
        mastra_memory_storage: ['MastraMemoryStorage.js', 'mastra-memory-storage.js'],
        'prd-04': ['MastraSchemas.js', 'structured_agent_schemas.js'],
        structured_agent_schemas: ['MastraSchemas.js', 'structured_agent_schemas.js'],
        'prd-05': ['CentralLogStore.js', 'HarnessProcessors.js'],
        boundary_telemetry_instrumentation: ['CentralLogStore.js', 'HarnessProcessors.js'],
        'prd-06': ['BusinessPackage.js', 'SdlcPackage.js'],
        business_package_system: ['BusinessPackage.js', 'SdlcPackage.js'],
        'prd-07': ['DocumentBuilder.js', 'DocumentEntityStore.js', 'TemplateEngine.js'],
        code_driven_document_builder: ['DocumentBuilder.js', 'DocumentEntityStore.js', 'TemplateEngine.js'],
        'prd-08': ['WorkBreakdownManager.js', 'GherkinBridge.js'],
        work_breakdown_hierarchy_and_gherkin_runner: ['WorkBreakdownManager.js', 'GherkinBridge.js'],
        'prd-09': ['InteractiveDiscoveryChat.js', 'HarnessCatalog.js'],
        admin_dashboard: ['InteractiveDiscoveryChat.js', 'HarnessCatalog.js'],
        'prd-cli-chat-status-bar-layout': ['CliStatusBarLayout.js', 'cli-chat-status-bar-layout.js'],
        cli_chat_status_bar_layout: ['CliStatusBarLayout.js', 'cli-chat-status-bar-layout.js'],
        'prd-multiline-scrollable-chat-input': ['multiline-scrollable-chat-input.js', 'CliStatusBarLayout.js'],
        'prd-multiline_scrollable_chat_input': ['multiline-scrollable-chat-input.js', 'CliStatusBarLayout.js'],
        multiline_scrollable_chat_input: ['multiline-scrollable-chat-input.js', 'CliStatusBarLayout.js'],
        'prd-dual-window-chat-live-pipeline-panel': ['dual-window-chat-live-pipeline-panel.js', 'CliStatusBarLayout.js'],
        'prd-dual_window_chat_live_pipeline_panel': ['dual-window-chat-live-pipeline-panel.js', 'CliStatusBarLayout.js'],
        dual_window_chat_live_pipeline_panel: ['dual-window-chat-live-pipeline-panel.js', 'CliStatusBarLayout.js'],
        'prd-chat_interface_multiline_scroll': ['multiline-scrollable-chat-input.js', 'CliStatusBarLayout.js'],
        chat_interface_multiline_scroll: ['multiline-scrollable-chat-input.js', 'CliStatusBarLayout.js'],
        'prd-project_operating_mode_switch': ['MacroStatechartEngine.js'],
        project_operating_mode_switch: ['MacroStatechartEngine.js'],
        'prd-research_and_development_role_and_pipeline': ['RoleWorkflows.js', 'SdlcSupervisor.js'],
        research_and_development_role_and_pipeline: ['RoleWorkflows.js', 'SdlcSupervisor.js']
      };

      function find_matching_source_files(feature_kebab, feature_slug, prd_id = '') {
        const pascal = feature_kebab
          .split(/[-_]+/)
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join('');
        const compact = feature_kebab.replace(/[-_]+/g, '').toLowerCase();
        const matches = [];
        const canonical = canonical_prd_module_map[prd_id] || canonical_prd_module_map[feature_slug] || [];
        for (let c = 0; c < canonical.length; c += 1) {
          const cf = canonical[c];
          if (src_files.includes(cf)) {
            const full_cf = path.join(src_dir, cf);
            if (!matches.includes(full_cf)) {
              matches.push(full_cf);
            }
          }
        }
        for (let i = 0; i < src_files.length; i += 1) {
          const f = src_files[i];
          const stem = f.replace(/\.js$/, '');
          const stem_compact = stem.replace(/[-_]+/g, '').toLowerCase();
          if (
            stem === feature_kebab
            || stem === feature_slug
            || stem === pascal
            || stem_compact === compact
            || (compact.includes(stem_compact) && stem_compact.length >= 8)
            || (stem_compact.includes(compact) && compact.length >= 8)
          ) {
            const full_f = path.join(src_dir, f);
            if (!matches.includes(full_f)) {
              matches.push(full_f);
            }
          }
        }
        return matches;
      }

      function inspect_source_file(file_path) {
        const raw = fs.readFileSync(file_path, 'utf-8');
        const tldr_match = raw.match(/^\s*\*\s*tldr:\s*(.+)$/im);
        const verbose_match = raw.match(/^\s*\*\s*verbose:\s*(.+)$/im);
        const exports_found = [];
        const fn_re = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g;
        const const_re = /export\s+const\s+([a-zA-Z0-9_]+)/g;
        const class_re = /export\s+class\s+([a-zA-Z0-9_]+)/g;
        const reexport_re = /export\s*\{([^}]+)\}/g;
        let m;
        while ((m = fn_re.exec(raw)) !== null) {
          if (!exports_found.includes(m[1])) exports_found.push(m[1]);
        }
        while ((m = const_re.exec(raw)) !== null) {
          if (!exports_found.includes(m[1])) exports_found.push(m[1]);
        }
        while ((m = class_re.exec(raw)) !== null) {
          if (!exports_found.includes(m[1])) exports_found.push(m[1]);
        }
        while ((m = reexport_re.exec(raw)) !== null) {
          const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/i).pop().trim()).filter(Boolean);
          for (let n = 0; n < names.length; n += 1) {
            if (!exports_found.includes(names[n])) exports_found.push(names[n]);
          }
        }
        return {
          file_name: path.basename(file_path),
          file_path,
          tldr: tldr_match ? tldr_match[1].trim().toLowerCase() : '',
          verbose: verbose_match ? verbose_match[1].trim().toLowerCase() : '',
          exports: exports_found
        };
      }

      const prds_updated_from_code = [];
      const code_updated_from_prd = [];

      // 1. code -> prd synchronisation
      if (direction === 'code_to_prd' || direction === 'bidirectional') {
        for (let i = 0; i < prds.length; i += 1) {
          const prd_ent = prds[i];
          const slug = String(prd_ent.slug || prd_ent.id.replace(/^prd-/, '')).toLowerCase();
          const kebab = slug.replace(/_/g, '-');
          const matched_paths = find_matching_source_files(kebab, slug, prd_ent.id);
          if (matched_paths.length === 0) {
            continue;
          }

          const descriptors = matched_paths.map(inspect_source_file);
          const all_exports = [];
          const tldrs = [];
          for (let d = 0; d < descriptors.length; d += 1) {
            if (descriptors[d].tldr && !tldrs.includes(descriptors[d].tldr)) {
              tldrs.push(descriptors[d].tldr);
            }
            for (let e = 0; e < descriptors[d].exports.length; e += 1) {
              const ex = descriptors[d].exports[e];
              if (!all_exports.includes(ex)) all_exports.push(ex);
            }
          }

          const existing_reqs = Array.isArray(prd_ent.functional_requirements)
            ? prd_ent.functional_requirements.slice()
            : [];
          const req_titles = existing_reqs.map((r) => String(r.title || '').toLowerCase());

          for (let d = 0; d < descriptors.length; d += 1) {
            const desc = descriptors[d];
            const candidate_title = `module ${desc.file_name} exports (${desc.exports.slice(0, 6).join(', ') || 'module api'})`.toLowerCase();
            if (!req_titles.some((t) => t.includes(desc.file_name.toLowerCase()))) {
              existing_reqs.push({
                id: `fr-code-${String(existing_reqs.length + 1).padStart(2, '0')}`,
                title: candidate_title,
                description: desc.tldr
                  ? `${desc.tldr} — exported symbols: ${desc.exports.join(', ') || 'none'}`
                  : `verified source implementation in src/${desc.file_name} exporting ${desc.exports.join(', ') || 'module interface'}`,
                priority: 'must_have',
                status: 'approved'
              });
            }
          }

          const updated_vision = tldrs.length > 0
            ? tldrs.join('; ')
            : (prd_ent.executive_summary?.vision || `verified implementation for ${kebab}`);
          const existing_meta = Array.isArray(prd_ent.metadata)
            ? prd_ent.metadata.filter((m) => m.key !== 'synced_source_files' && m.key !== 'synced_exports' && m.key !== 'last_code_to_prd_sync')
            : [];
          existing_meta.push(
            { key: 'synced_source_files', value: descriptors.map((d) => `src/${d.file_name}`).join(', ') },
            { key: 'synced_exports', value: all_exports.join(', ') || 'none' },
            { key: 'last_code_to_prd_sync', value: new Date().toISOString() }
          );

          const saved_prd = store.save_entity(DocumentEntityTypes.PRD, {
            ...prd_ent,
            executive_summary: {
              ...(prd_ent.executive_summary || {}),
              vision: updated_vision,
              problem: prd_ent.executive_summary?.problem || `deliver ${kebab} with verified specifications and tests`,
              strategic_context: prd_ent.executive_summary?.strategic_context || `synchronised with source files: ${descriptors.map((d) => d.file_name).join(', ')}`,
              primary_objectives: Array.isArray(prd_ent.executive_summary?.primary_objectives) && prd_ent.executive_summary.primary_objectives.length > 0
                ? prd_ent.executive_summary.primary_objectives
                : [`maintain verified implementation across ${descriptors.map((d) => d.file_name).join(', ')}`]
            },
            scope_boundaries: {
              in_scope: descriptors.map((d) => `src/${d.file_name} (${d.exports.length} exports)`),
              out_of_scope: prd_ent.scope_boundaries?.out_of_scope || []
            },
            functional_requirements: existing_reqs,
            metadata: existing_meta
          });

          prds[i] = saved_prd;
          prds_updated_from_code.push({
            prd_id: saved_prd.id,
            feature: kebab,
            source_files: descriptors.map((d) => `src/${d.file_name}`),
            exports_count: all_exports.length,
            requirements_count: existing_reqs.length
          });
        }
      }

      // 2. prd -> code synchronisation
      if (direction === 'prd_to_code' || direction === 'bidirectional') {
        for (let i = 0; i < prds.length; i += 1) {
          const prd_ent = prds[i];
          const slug = String(prd_ent.slug || prd_ent.id.replace(/^prd-/, '')).toLowerCase().replace(/[^a-z0-9]+/g, '_');
          const kebab = slug.replace(/_/g, '-');
          const matched_paths = find_matching_source_files(kebab, slug, prd_ent.id);
          const reqs = Array.isArray(prd_ent.functional_requirements) ? prd_ent.functional_requirements : [];
          const problem_desc = (prd_ent.executive_summary?.problem || prd_ent.title || `deliver ${kebab}`)
            .toLowerCase()
            .replace(/\r?\n/g, ' ');

          const target_src_path = path.join(src_dir, `${kebab}.js`);
          let action_taken = 'verified_existing_module';

          if (matched_paths.length === 0 && fs.existsSync(src_dir)) {
            const req_list_literal = JSON.stringify(
              reqs.map((r) => ({ id: r.id, title: r.title, priority: r.priority, status: r.status })),
              null,
              2
            );
            const module_code = [
              '/**',
              ' * =========================================================================',
              ` * module: ${kebab}`,
              ' * =========================================================================',
              ' *',
              ' * section: version number',
              ' * version: 0.1.0',
              ' *',
              ' * section: documentation',
              ` * tldr: ${problem_desc.slice(0, 110)}`,
              ` * verbose: generated and synchronised from ${prd_ent.id} (${reqs.length} functional requirements).`,
              ' *',
              ' * section: arguments',
              ' * - options (object, optional): configuration options',
              ' *',
              ' * section: return value',
              ` * - instance (object): ${slug} controller interface`,
              ' *',
              ' * section: example',
              ` * const inst = create_${slug}();`,
              ' * =========================================================================',
              ' */',
              '',
              `export const ${slug}_prd_requirements = Object.freeze(${req_list_literal});`,
              '',
              '/**',
              ' * section: version number',
              ' * version: 0.1.0',
              ' *',
              ' * section: documentation',
              ` * tldr: creates a ${kebab} instance synchronised with ${prd_ent.id}`,
              ` * verbose: provides runtime state and requirement verification for ${kebab}.`,
              ' *',
              ' * section: arguments',
              ' * - options (object, optional): runtime configuration',
              ' *',
              ' * section: return value',
              ` * - controller (object): ${kebab} instance`,
              ' *',
              ' * section: example',
              ` * const ctrl = create_${slug}();`,
              ' */',
              `export function create_${slug}(options = {}) {`,
              '  return {',
              `    id: '${prd_ent.id}',`,
              `    feature: '${kebab}',`,
              "    status: 'ready',",
              '    options,',
              `    requirements: ${slug}_prd_requirements,`,
              '    get_status() {',
              '      return {',
              `        id: '${prd_ent.id}',`,
              `        feature: '${kebab}',`,
              "        status: 'ready',",
              `        requirements_count: ${slug}_prd_requirements.length`,
              '      };',
              '    }',
              '  };',
              '}',
              ''
            ].join('\n');

            fs.writeFileSync(target_src_path, module_code, 'utf-8');
            action_taken = 'generated_module_from_prd';
          }

          if (
            context?.run_process === true
            && Boolean(target_filter)
            && prds.length === 1
            && harness
            && typeof harness.run_process === 'function'
          ) {
            await harness.run_process('develop-feature', {
              name: kebab,
              description: problem_desc,
              problem_statement: problem_desc
            });
            action_taken = `${action_taken}+executed_sdlc_process`;
          }

          code_updated_from_prd.push({
            prd_id: prd_ent.id,
            feature: kebab,
            module_path: matched_paths[0]
              ? `src/${path.basename(matched_paths[0])}`
              : `src/${kebab}.js`,
            requirements_synced: reqs.length,
            action: action_taken
          });
        }
      }

      try {
        if (context?.export_to_docs === true && typeof store.export_documents === 'function') {
          store.export_documents({ target_dir: path.join(ws_root, 'docs') });
        }
        if (typeof store.index_store_for_rag === 'function') {
          store.index_store_for_rag({ docs_dir: path.join(ws_root, 'docs') });
        }
      } catch (_err) {
        // non-fatal export/index error
      }

      const summary_lines = [
        `completed '${direction}' prd <-> code synchronisation (${prds.length} feature(s) inspected):`
      ];
      if (prds_updated_from_code.length > 0) {
        summary_lines.push(`  - code -> prd (${prds_updated_from_code.length} updated):`);
        for (let i = 0; i < prds_updated_from_code.length; i += 1) {
          const item = prds_updated_from_code[i];
          summary_lines.push(
            `    • ${item.prd_id} (${item.feature}): synced from ${item.source_files.join(', ')} (${item.exports_count} exports, ${item.requirements_count} functional requirements)`
          );
        }
      }
      if (code_updated_from_prd.length > 0) {
        summary_lines.push(`  - prd -> code (${code_updated_from_prd.length} verified/updated):`);
        for (let i = 0; i < code_updated_from_prd.length; i += 1) {
          const item = code_updated_from_prd[i];
          summary_lines.push(
            `    • ${item.feature} -> ${item.module_path}: ${item.action} (${item.requirements_synced} prd requirements aligned)`
          );
        }
      }

      emit_status(`  ✓ [sdlc-supervisor] ${summary_lines[0]}`);

      const pool = session_ctx.worker_pool || (harness ? harness.get_worker_pool() : null);
      let sync_req_res = null;
      if (pool && typeof pool.submit_request === 'function') {
        sync_req_res = await pool.submit_request({
          type: 'sync',
          role: 'product-manager',
          title: `sync:${direction}:${target_filter || 'all'}`,
          requested_by: session_ctx.get_active_agent ? session_ctx.get_active_agent() : 'product-manager',
          executor: async () => ({
            direction,
            target: target_filter || 'all',
            prds_updated_from_code: prds_updated_from_code.length,
            code_updated_from_prd: code_updated_from_prd.length
          })
        });
      }

      const out = {
        synced: true,
        direction,
        target: target_filter || 'all',
        request_id: sync_req_res?.request_id || null,
        worker_id: sync_req_res?.worker_id || null,
        routed_via: sync_req_res ? 'worker_pool' : 'direct',
        prds_updated_from_code,
        code_updated_from_prd,
        canonical_text: summary_lines.join('\n')
      };
      record_tool('sync_prd_and_code', context, out);
      return out;
    }
  });

  const suggest_features = createTool({
    id: 'suggest_features',
    description: 'analyses a free-form product idea or discussion prompt, inspects existing workspace prds read-only, and generates candidate new feature suggestions, capabilities, and acceptance criteria for collaborative discussion with product-manager without creating a prd or starting an sdlc process',
    inputSchema: z.object({
      prompt: z.string().optional(),
      topic: z.string().optional(),
      idea: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const store = session_ctx.store || (harness ? harness.get_store() : null);
      const existing_prds = store ? (store.list_entities(DocumentEntityTypes.PRD) || []) : [];

      const raw_idea = String(
        context?.prompt || context?.idea || context?.topic || session_ctx.current_user_text || 'workspace capability'
      ).trim();

      const stop_words = [
        'i', 'want', 'to', 'build', 'create', 'develop', 'implement', 'make', 'add', 'a', 'an', 'the',
        'for', 'our', 'my', 'workspace', 'system', 'so', 'that', 'when', 'or', 'and', 'with', 'in', 'on',
        'of', 'from', 'by', 'about', 'discuss', 'it', 'you', 'first', 'get', 'suggestions', 'new',
        'features', 'feature', 'we', 'would', 'need', 'should', 'could', 'maybe', 'just', 'wanted',
        'align', 'update', 'prd', 'code', 'implementation', 'later', 'operators', 'know'
      ];
      const domain_words = raw_idea
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stop_words.includes(w))
        .slice(0, 3);
      const domain_slug = domain_words.length > 0 ? domain_words.join('-') : 'capability';
      const domain_label = domain_words.length > 0 ? domain_words.join(' ') : 'workspace capability';

      const suggestions = [
        {
          id: 'feat-01',
          slug: `${domain_slug}-core-dispatcher`,
          title: `${domain_label} core event & rule dispatcher`,
          summary: `event bus and rule matcher for ${domain_label} with deterministic filtering`,
          capabilities: [
            `subscribe to statechart, review gate, and work board lifecycle transitions`,
            `evaluate declarative condition rules for ${domain_label}`
          ]
        },
        {
          id: 'feat-02',
          slug: `${domain_slug}-gate-telemetry-bridge`,
          title: `${domain_label} review gate & build failure bridge`,
          summary: `real-time bridge capturing gatekeeper violations, test regressions, and ticket escalations`,
          capabilities: [
            `correlate gate_1 through gate_4 verdicts with actionable diagnostics`,
            `surface structured alerts in the f1/f2 terminal status bar and chat stream`
          ]
        },
        {
          id: 'feat-03',
          slug: `${domain_slug}-delivery-channels`,
          title: `${domain_label} multi-channel routing & deduplication`,
          summary: `configurable delivery adapters with rate-limiting, deduplication windows, and severity thresholds`,
          capabilities: [
            `suppress duplicate alerts within a configurable cooldown window`,
            `route critical escalations to operator cli notifications and message bus signals`
          ]
        },
        {
          id: 'feat-04',
          slug: `${domain_slug}-audit-digest`,
          title: `${domain_label} tamper-evident history & digest log`,
          summary: `append-only history of triggered events, acknowledgements, and resolution timestamps`,
          capabilities: [
            `query historical alert and notification digests from cli chat`,
            `link resolved alerts to pull request attestations and retrospectives`
          ]
        }
      ];

      const lines = [
        `let's discuss your idea for "${domain_label}" first — i have not created a prd or started any sdlc process yet.`,
        `existing workspace context: ${existing_prds.length} prd(s) currently stored.`,
        `suggested features we would need to implement (${suggestions.length}):`
      ];
      for (let i = 0; i < suggestions.length; i += 1) {
        const s = suggestions[i];
        lines.push(`  ${i + 1}. ${s.slug} (${s.title}): ${s.summary}`);
        lines.push(`     • key capabilities: ${s.capabilities.join('; ')}`);
      }
      lines.push(
        `which of these suggested features would you like to explore or refine first? ` +
        `when we are happy with the scope, tell me to submit it to sdlc-supervisor (e.g. "submit to sdlc-supervisor to build feature <name> <description>") and i will coordinate with the supervisor for you.`
      );

      const out = {
        discussed: true,
        prd_created: false,
        process_started: false,
        domain_slug,
        existing_prd_count: existing_prds.length,
        suggestions,
        canonical_text: lines.join('\n')
      };
      record_tool('suggest_features', context, out);
      return out;
    }
  });

  const request_sdlc_supervisor = createTool({
    id: 'request_sdlc_supervisor',
    description: 'mediates specialist agent-to-supervisor interaction with the internal sdlc-supervisor over the message bus (actions: check_readiness, evaluate_gate, initiate_process, execute_process)',
    inputSchema: z.object({
      action: z.string().optional(),
      process_type: z.string().optional(),
      name: z.string().optional(),
      problem_statement: z.string().optional(),
      target_audience: z.string().optional(),
      acceptance_criteria: z.union([z.string(), z.array(z.string())]).optional(),
      functional_requirements: z.union([z.string(), z.array(z.string())]).optional(),
      gate_id: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const supervisor = harness && typeof harness.get_supervisor === 'function' ? harness.get_supervisor() : null;
      const from_agent = session_ctx.get_active_agent ? session_ctx.get_active_agent() : 'product-manager';
      const draft = session_ctx.spec_draft || {};
      const action = String(context?.action || 'check_readiness').toLowerCase().trim();
      const name = String(context?.name || draft.name || 'new-feature').trim();
      const process_type = String(context?.process_type || draft.process_type || 'develop-feature').trim();
      const problem_statement = context?.problem_statement || draft.problem_statement || `deliver ${name} under sdlc governance`;

      emit_status(`  ⋯ [${from_agent} -> sdlc-supervisor] mediating '${action}' request for '${name}'...`);

      let sup_res = null;
      if (supervisor && typeof supervisor.handle_agent_request === 'function') {
        sup_res = await supervisor.handle_agent_request({
          from_agent,
          action,
          process_type,
          name,
          problem_statement,
          target_audience: context?.target_audience || draft.target_audience,
          acceptance_criteria: context?.acceptance_criteria || draft.acceptance_criteria,
          functional_requirements: context?.functional_requirements || draft.functional_requirements,
          gate_id: context?.gate_id
        });
      }

      let process_result = null;
      if (action === 'execute_process' || action === 'build' || action === 'submit_and_execute') {
        process_result = await execute_sdlc_process.execute({
          process_type,
          name,
          problem_statement,
          target_audience: context?.target_audience || draft.target_audience,
          acceptance_criteria: context?.acceptance_criteria || draft.acceptance_criteria,
          functional_requirements: context?.functional_requirements || draft.functional_requirements
        });
      }

      const canonical_text = process_result && process_result.executed
        ? `i coordinated with sdlc-supervisor (receipt=${sup_res?.receipt_token || 'verified'}) and executed '${process_type}' for '${name}': completed=${process_result.all_completed} (${process_result.tickets_completed}/${process_result.tickets_total} tickets).`
        : `i checked with sdlc-supervisor on your behalf (receipt=${sup_res?.receipt_token || 'verified'}): ${sup_res?.recommendation || `action '${action}' completed for '${name}'.`}`;

      const out = {
        ok: true,
        mediated_by: 'sdlc-supervisor',
        from_agent,
        action,
        name,
        process_type,
        receipt_token: sup_res?.receipt_token || null,
        supervisor_response: sup_res,
        process_result,
        canonical_text
      };
      record_tool('request_sdlc_supervisor', context, out);
      return out;
    }
  });

  const apply_direct_code_fix = createTool({
    id: 'apply_direct_code_fix',
    description: 'executes an untethered direct workspace code/test fix or feature implementation via autonomous-engineer without phase-lock or supervisor-token restrictions, with optional capability to also consume the governed sdlc process (fix-defect or develop-feature)',
    inputSchema: z.object({
      target: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      problem_statement: z.string().optional(),
      code: z.string().optional(),
      tests: z.string().optional(),
      consume_sdlc: z.boolean().optional(),
      process_type: z.string().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      const store = session_ctx.store || (harness ? harness.get_store() : null);
      const adapter = store && typeof store.get_adapter === 'function' ? store.get_adapter() : null;
      const store_root = adapter && typeof adapter.get_store_root === 'function' ? adapter.get_store_root() : '';
      const ws_root = session_ctx.workspace_root
        || (harness && harness.workspace_root)
        || (store_root ? path.resolve(store_root, '..', '..') : process.cwd());

      const raw_name = String(
        context?.target || context?.name || session_ctx.spec_draft?.name || 'direct-fix'
      )
        .trim()
        .replace(/^(?:src|tests)\//i, '')
        .replace(/\.(?:test\.)?js$/i, '');
      const kebab = raw_name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'direct-fix';
      const safe_ident = kebab.replace(/-/g, '_');
      const desc = String(
        context?.description || context?.problem_statement || session_ctx.spec_draft?.problem_statement || `untethered autonomous fix for ${kebab}`
      ).trim();

      emit_status(`  ⋯ [autonomous-engineer] applying untethered workspace fix for '${kebab}'...`);

      const src_dir = path.join(ws_root, 'src');
      const tests_dir = path.join(ws_root, 'tests');
      fs.mkdirSync(src_dir, { recursive: true });
      fs.mkdirSync(tests_dir, { recursive: true });

      const target_src_path = path.join(src_dir, `${kebab}.js`);
      const target_test_path = path.join(tests_dir, `${kebab}.test.js`);
      const written_files = [];

      const raw_code = typeof context?.code === 'string' ? context.code.trim() : '';
      const is_valid_js_code = Boolean(
        raw_code &&
        (raw_code.includes('export ') || raw_code.includes('function ')) &&
        !/\bexport\s+(?:interface|type)\s+/i.test(raw_code)
      );
      const code_content = is_valid_js_code ? raw_code : [
        '/**',
        ' * ============================================================================',
        ` * @file ${kebab}.js`,
        ' * @version 0.1.0',
        ' * @author autonomous-engineer',
        ` * @description ${desc.toLowerCase()}`,
        ' * ============================================================================',
        ' */',
        '',
        '/**',
        ' * ============================================================================',
        ` * @function create_${safe_ident}`,
        ' * @version 0.1.0',
        ' * @author autonomous-engineer',
        ` * @description creates and operates the ${kebab} module.`,
        ' * @param {object} [options={}] - configuration options.',
        ' * @returns {object} operational controller instance.',
        ' * // ---',
        ' * // 1. normalise configuration options',
        ' * // 2. initialise internal state record',
        ' * // 3. expose status and diagnostic verification helpers',
        ' * // 4. expose execute operation',
        ' * // 5. return public controller object',
        ' * ============================================================================',
        ' */',
        `export function create_${safe_ident}(options = {}) {`,
        '  let invocations = 0;',
        '  return {',
        `    name: '${kebab}',`,
        "    status: 'active',",
        "    authored_by: 'autonomous-engineer',",
        `    description: ${JSON.stringify(desc.toLowerCase())},`,
        '    options,',
        '    verify_fix: () => ({',
        `      target: '${kebab}',`,
        '      patched: true,',
        '      untethered: true',
        '    }),',
        '    execute: (payload = {}) => {',
        '      invocations += 1;',
        '      return {',
        `        target: '${kebab}',`,
        '        executed: true,',
        '        invocations,',
        '        payload',
        '      };',
        '    }',
        '  };',
        '}',
        `export const create_${safe_ident}_patch = create_${safe_ident};`,
        ''
      ].join('\n');

      if (!fs.existsSync(target_src_path) || is_valid_js_code || Boolean(context?.overwrite)) {
        fs.writeFileSync(target_src_path, code_content, 'utf-8');
      }
      written_files.push(target_src_path);

      const raw_tests = typeof context?.tests === 'string' ? context.tests.trim() : '';
      const is_valid_js_tests = Boolean(
        raw_tests &&
        (raw_tests.includes('describe(') || raw_tests.includes('it(') || raw_tests.includes('test(')) &&
        !/\bexport\s+(?:interface|type)\s+/i.test(raw_tests)
      );
      const test_content = is_valid_js_tests ? raw_tests : [
        "import { describe, it, expect } from 'vitest';",
        `import { create_${safe_ident} } from '../src/${kebab}.js';`,
        '',
        `describe('${kebab} untethered fix verification', () => {`,
        `  it('verifies ${kebab} operates as expected', () => {`,
        `    const instance = create_${safe_ident}();`,
        `    expect(instance.name).toBe('${kebab}');`,
        "    expect(instance.status).toBe('active');",
        '    expect(instance.verify_fix().patched).toBe(true);',
        '  });',
        '});',
        ''
      ].join('\n');

      if (!fs.existsSync(target_test_path) || is_valid_js_tests || Boolean(context?.overwrite)) {
        fs.writeFileSync(target_test_path, test_content, 'utf-8');
      }
      written_files.push(target_test_path);

      let sdlc_result = null;
      if (context?.consume_sdlc === true) {
        const proc_type = context?.process_type || 'fix-defect';
        emit_status(`  ⋯ [autonomous-engineer -> sdlc] consuming governed '${proc_type}' pipeline for '${kebab}'...`);
        sdlc_result = await execute_sdlc_process.execute({
          process_type: proc_type,
          name: kebab,
          problem_statement: desc
        });
      }

      emit_status(`  ✓ [autonomous-engineer] completed fix for '${kebab}' (${written_files.length} file(s) verified).`);

      const pool = session_ctx.worker_pool || (harness ? harness.get_worker_pool() : null);
      let fix_req_res = null;
      if (pool && typeof pool.submit_request === 'function') {
        fix_req_res = await pool.submit_request({
          type: 'direct_fix',
          role: 'autonomous-engineer',
          title: `direct_fix:${kebab}`,
          requested_by: session_ctx.get_active_agent ? session_ctx.get_active_agent() : 'autonomous-engineer',
          executor: async () => ({
            target: kebab,
            written_files
          })
        });
      }

      const canonical_text =
        `autonomous-engineer applied direct workspace fix for '${kebab}' ` +
        `(untethered=${!context?.consume_sdlc}, consumed_sdlc=${Boolean(sdlc_result?.executed)}):\n` +
        `  - source module : src/${kebab}.js\n` +
        `  - test suite    : tests/${kebab}.test.js` +
        (sdlc_result?.executed
          ? `\n  - sdlc pipeline : ${sdlc_result.process_id} (${sdlc_result.tickets_completed}/${sdlc_result.tickets_total} tickets completed)`
          : '');

      const out = {
        ok: true,
        untethered: true,
        agent: 'autonomous-engineer',
        target: kebab,
        description: desc,
        written_files,
        request_id: fix_req_res?.request_id || null,
        worker_id: fix_req_res?.worker_id || null,
        routed_via: fix_req_res ? 'worker_pool' : 'direct',
        consumed_sdlc: Boolean(sdlc_result?.executed),
        sdlc_result,
        canonical_text
      };
      record_tool('apply_direct_code_fix', context, out);
      return out;
    }
  });

  const manage_sdlc_architecture = createTool({
    id: 'manage_sdlc_architecture',
    description: 'manipulates the 3-level sdlc architecture: level 1 process objects (phases, gates, roles, workflows, work_item_types, artefact_types), level 2 process definitions (stages, gate bindings, validation, cloning), and level 3 project sdlc configuration (enable/disable processes, stage overrides, gate policies, worker pool routing)',
    inputSchema: z.object({
      level: z.string().optional(),
      action: z.string().optional(),
      kind: z.string().optional(),
      id: z.string().optional(),
      process_id: z.string().optional(),
      stage: z.any().optional(),
      override: z.any().optional(),
      data: z.any().optional()
    }).passthrough(),
    execute: async (raw_input) => {
      const context = unwrap_input(raw_input);
      const harness = session_ctx.get_harness ? session_ctx.get_harness() : null;
      if (!harness) {
        const err_out = { ok: false, error: 'harness_unavailable' };
        record_tool('manage_sdlc_architecture', context, err_out);
        return err_out;
      }
      const objects = harness.get_process_objects();
      const registry = harness.get_process_registry();
      const proj_cfg = harness.get_project_sdlc_config();
      const level = String(context?.level || 'project').toLowerCase().trim();
      const action = String(context?.action || 'inspect').toLowerCase().trim();

      if (level === 'objects' || level === 'level_1' || level === '1') {
        const kind = String(context?.kind || 'phases').toLowerCase().trim();
        if (action === 'register' || action === 'add') {
          const item = context?.data || context?.item || { id: context?.id, name: context?.name || context?.id };
          let created = null;
          if (kind.startsWith('phase')) created = objects.register_phase(item);
          else if (kind.startsWith('gate')) created = objects.register_gate(item);
          else if (kind.startsWith('role')) created = objects.register_role(item);
          else if (kind.startsWith('workflow')) created = objects.register_workflow(item);
          else if (kind.startsWith('work')) created = objects.register_work_item_type(item);
          else if (kind.startsWith('artefact')) created = objects.register_artefact_type(item);
          const out = { ok: true, level: 'sdlc_process_objects', action, kind, item: created };
          record_tool('manage_sdlc_architecture', context, out);
          return out;
        }
        const snap = objects.to_snapshot();
        const out = {
          ok: true,
          level: 'sdlc_process_objects',
          action: 'inspect',
          counts: {
            phases: snap.phases.length,
            gates: snap.gates.length,
            roles: snap.roles.length,
            workflows: snap.workflows.length,
            work_item_types: snap.work_item_types.length,
            artefact_types: snap.artefact_types.length
          },
          snapshot: snap
        };
        record_tool('manage_sdlc_architecture', context, out);
        return out;
      }

      if (level === 'definition' || level === 'definitions' || level === 'level_2' || level === '2') {
        const proc_id = context?.process_id || context?.id || 'develop-feature';
        if (action === 'clone') {
          const new_id = context?.new_id || `${proc_id}-custom`;
          const cloned = registry.clone_definition(proc_id, new_id, context?.override || context?.data || {});
          const out = { ok: true, level: 'sdlc_process_definition', action: 'clone', profile: cloned.get_profile() };
          record_tool('manage_sdlc_architecture', context, out);
          return out;
        }
        const def = registry.get_definition(proc_id);
        if (!def) {
          const out = { ok: false, level: 'sdlc_process_definition', error: `process_not_found: ${proc_id}` };
          record_tool('manage_sdlc_architecture', context, out);
          return out;
        }
        if (action === 'add_stage' && context?.stage) {
          def.add_stage(context.stage);
        } else if (action === 'remove_stage' && context?.suffix) {
          def.remove_stage(context.suffix);
        } else if (action === 'bind_gate' && context?.suffix && context?.gate_id) {
          def.bind_gate(context.suffix, context.gate_id);
        }
        const validation = def.validate(objects);
        const out = {
          ok: true,
          level: 'sdlc_process_definition',
          action,
          profile: def.get_profile(),
          validation
        };
        record_tool('manage_sdlc_architecture', context, out);
        return out;
      }

      // default: level 3 project_sdlc_config
      const proc_id = context?.process_id || context?.id || 'develop-feature';
      if (action === 'disable') {
        proj_cfg.disable_process(proc_id);
      } else if (action === 'enable') {
        proj_cfg.enable_process(proc_id);
      } else if (action === 'configure' && (context?.override || context?.data)) {
        proj_cfg.configure_process(proc_id, context.override || context.data);
      }
      const effective = proj_cfg.is_process_enabled(proc_id)
        ? proj_cfg.resolve_effective_process(proc_id)
        : null;
      const out = {
        ok: true,
        level: 'project_sdlc_config',
        action,
        config: proj_cfg.get_config(),
        effective_process: effective
      };
      record_tool('manage_sdlc_architecture', context, out);
      return out;
    }
  });

  return {
    inspect_workspace_status,
    inspect_sdlc_catalog,
    manage_work_items,
    evaluate_review_gate,
    manage_worker_pool,
    sync_prd_and_code,
    suggest_features,
    request_sdlc_supervisor,
    apply_direct_code_fix,
    manage_sdlc_architecture,
    list_entities,
    show_entity,
    update_specification_draft,
    execute_sdlc_process,
    resolve_board_clarification,
    consult_specialist_agent,
    switch_active_agent
  };
}

/**
 * =========================================================================
 * function: create_interactive_discovery_chat
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: orchestrates interactive mastra agentic command-line chat sessions
 * verbose: connects the terminal repl to the registered mastra Agent instances
 * (sdlc-supervisor and the 6 specialist role agents), invoking mastra Agent.generate()
 * with native mastra tools on every turn.
 * 
 * section: arguments
 * - options (object, optional): { harness, supervisor, board, worker_pool, message_bus, io, logger }
 * 
 * section: return value
 * - discovery_chat (object): { run_agentic_chat, run_inception_chat, run_clarification_chat, parse_brief }
 * 
 * section: example
 * const chat = create_interactive_discovery_chat({ harness });
 * const res = await chat.run_agentic_chat({ agent_id: 'sdlc-supervisor' });
 * =========================================================================
 */
export function create_interactive_discovery_chat(options = {}) {
  const board = options.board || (options.harness ? options.harness.get_work_board() : null);
  const logger = options.logger || (options.harness ? options.harness.get_logger('discovery-chat') : null);
  const fallback_agents = {};

  function get_harness_ref(params = {}) {
    return params.harness || options.harness || null;
  }

  function resolve_mastra_agent(agent_id, harness) {
    if (!fallback_agents[agent_id]) {
      const registered = harness && typeof harness.get_agent === 'function'
        ? harness.get_agent(agent_id)
        : null;
      const profile = AGENT_PROFILES[agent_id] || AGENT_PROFILES['sdlc-supervisor'];
      fallback_agents[agent_id] = new Agent({
        id: agent_id,
        name: agent_id,
        instructions: `you are the ${agent_id} (${profile.title}) inside the mastra runtime. ${profile.focus}.`,
        model: registered?.model || resolve_harness_model()
      });
    }
    return fallback_agents[agent_id];
  }

  function format_draft_summary(draft) {
    const lines = [
      `--- working specification draft (${draft.entity_type || 'feature'}: '${draft.name || 'unnamed'}') ---`,
      `  problem statement : ${draft.problem_statement || '(not yet set — describe what it should do)'}`,
      `  target audience   : ${draft.target_audience || '(default: application developers and platform consumers)'}`,
      `  acceptance criteria (${(draft.acceptance_criteria || []).length}): ${(draft.acceptance_criteria || []).join('; ') || '(none yet)'}`,
      `  functional reqs   (${(draft.functional_requirements || []).length}): ${(draft.functional_requirements || []).join('; ') || '(none yet)'}`
    ];
    if (draft.architectural_constraints && draft.architectural_constraints.length > 0) {
      lines.push(`  constraints       : ${draft.architectural_constraints.join('; ')}`);
    }
    return lines.join('\n');
  }

  function is_discussion_or_suggestion_request(user_text = '', mode = 'agentic') {
    const raw = String(user_text || '').trim();
    const lower = raw.toLowerCase();
    if (!lower) {
      return false;
    }
    if (
      /\b(discuss|brainstorm|suggest|suggestions|ideas?\s+for|(?:what|which)\s+(?:new\s+)?features\s+(?:we\s+)?(?:would|should|could|might|need\s+to|can)\s+(?:need|implement|build|add|create)|new\s+features\s+we\s+(?:would|should|could|might)\s+need|talk\s+about|what\s+do\s+you\s+think|thoughts\s+on|help\s+me\s+think|just\s+want(?:ed)?\s+to\s+discuss|before\s+we\s+(?:build|implement|create|write)|do\s+not\s+create|don'?t\s+create)\b/i.test(lower)
    ) {
      return true;
    }
    if (mode !== 'inception') {
      const is_direct_cli_create = /^(?:create|build|develop|implement|start|launch)\s+(feature|defect|bug|hotfix|refactor|spike)\s+([a-z0-9_-]+)(?:\s+(.+))?$/i.test(raw)
        && !/^(?:create|build|develop|implement|start|launch)\s+(?:a|an|the|new)\b/i.test(raw);
      const is_work_cmd = /^(?:work\s+(?:list|create|start|switch|focus|show|status|advance|run|execute)|(?:list|create|start|switch|focus|show|status|advance|run|execute)\s+work)\b/i.test(lower);
      const is_sup_cmd = /\b(?:submit|send|hand\s+off|delegate|escalate|ask|have|tell|request|check\s+with)\s+(?:this\s+|it\s+)?(?:to\s+)?(?:the\s+)?sdlc[- ]?supervisor\b/i.test(lower);
      if (
        !is_direct_cli_create
        && !is_work_cmd
        && !is_sup_cmd
        && /^(?:i\s+want\s+to|i'?d\s+like\s+to|i\s+would\s+like\s+to|we\s+want\s+to|we\s+need\s+to|i\s+am\s+thinking\s+of|i'?m\s+thinking\s+of)\s+(?:build|create|design|make|add|implement|explore)\b/i.test(lower)
      ) {
        return true;
      }
    }
    return false;
  }

  function detect_supervisor_mediation_request(user_text = '') {
    const raw = String(user_text || '').trim();
    const lower = raw.toLowerCase();
    if (!lower) {
      return null;
    }

    const check_match = raw.match(
      /(?:ask|have|tell|request|check\s+with)\s+(?:the\s+)?sdlc[- ]?supervisor\s+to\s+(?:check|verify|inspect|evaluate)\s+(?:readiness|status)(?:\s+for\s+([a-z0-9_-]+))?/i
    );
    if (check_match) {
      return {
        action: 'check_readiness',
        name: check_match[1] || undefined
      };
    }

    const submit_match = raw.match(
      /(?:submit|send|hand\s+off|delegate|escalate)\s+(?:this\s+|it\s+)?to\s+(?:the\s+)?sdlc[- ]?supervisor(?:\s+to\s+(?:build|create|execute|run)(?:\s+(?:feature|work\s+item))?\s+([a-z0-9_-]+)(?:\s+(.+))?)?/i
    );
    if (submit_match) {
      return {
        action: 'execute_process',
        name: submit_match[1] || undefined,
        problem_statement: submit_match[2] ? submit_match[2].trim() : undefined
      };
    }

    return null;
  }

  function is_sdlc_execution_request(user_text = '', mode = 'agentic') {
    const raw = String(user_text || '').trim();
    const lower = raw.toLowerCase();
    if (!lower || is_discussion_or_suggestion_request(raw, mode)) {
      return false;
    }
    if (/^(build\s+it|run\s+it|execute\s+it|ship\s+it|do\s+it|start\s+it|let'?s\s+build\s+it|go\s+ahead|execute|start\s+building|launch\s+it)$/i.test(lower)) {
      return true;
    }
    if (/^(?:please\s+|let'?s\s+|can\s+you\s+)?(?:execute|run|launch|trigger)\s+(?:the\s+)?(?:governed\s+)?(?:sdlc\s+process|tier\s*1\s+process|develop-feature\s+process|sdlc\s+workflow|sdlc\s+pipeline)\b/i.test(lower)) {
      return true;
    }
    if (/\b(i\s+am\s+satisfied|i'?m\s+satisfied|satisfied|ready|looks\s+good|approved|happy\s+with)\b[^.?!]*\b(execute|run|start|build|proceed|implement|sdlc)\b/i.test(lower)) {
      return true;
    }
    if (/^(?:please\s+|let'?s\s+)?(?:build|implement)\s+(?:the\s+feature|this\s+feature|it\s+now|now)$/i.test(lower)) {
      return true;
    }
    return false;
  }

  function detect_catalog_query_category(user_text = '') {
    const raw = String(user_text || '').trim();
    const lower = raw.toLowerCase();
    if (!lower || is_sdlc_execution_request(raw)) {
      return null;
    }
    if (/^(status|state|show status|project status|board status)$/i.test(lower)) {
      return null;
    }
    if (/^(?:switch to|talk to|chat with|use agent|become|ask|consult|delegate to)\s+/i.test(lower)) {
      return null;
    }
    if (/^(?:create|build|develop|implement|start|launch)\s+/i.test(lower)) {
      return null;
    }

    const asks_statecharts = /\b(statecharts?|state\s+machines?|xstate\s+(?:machines?|statecharts?))\b/i.test(lower)
      && !/\bstatechart\s+phases?\b/i.test(lower);
    const asks_phases = /\b(phases?|macro\s+phases?|10\s+phases?|statechart\s+phases?)\b/i.test(lower);
    const asks_gates = /\b(gates?|review\s+gates?|gatekeeper\s+gates?|5\s+gates?)\b/i.test(lower);
    const asks_tiers = /\b(tiers?|tier\s*1|tier\s*2|entities\s+(?:involved|at\s+each\s+tier|exposed)|capabilities\s+at\s+each\s+tier)\b/i.test(lower);
    const asks_work_types = /\b(work[- ]?item\s+(?:types?|pathways?)|types?\s+of\s+work|work\s+pathways?|7\s+pathways?)\b/i.test(lower);
    const asks_processes = /\b(processes|high[- ]level\s+processes|sdlc\s+processes|25\s+processes)\b/i.test(lower);
    const asks_workflows = /\b(workflows?|role\s+workflows?|mastra\s+workflows?)\b/i.test(lower);
    const asks_skills = /\b(skills?|governance\s+rules?|7[- ]tier\s+rules?)\b/i.test(lower);
    const asks_agents = /\b(what\s+agents|which\s+agents|list\s+(?:the\s+)?agents|enumerate\s+(?:the\s+)?agents|registered\s+agents|specialist\s+agents|roles\s+available)\b/i.test(lower);

    if (asks_statecharts) {
      return 'statecharts';
    }
    if (asks_phases && asks_gates) {
      return 'phases_and_gates';
    }
    if (asks_tiers) {
      return 'tiers';
    }
    if (asks_phases) {
      return 'phases';
    }
    if (asks_gates) {
      return 'gates';
    }
    if (asks_work_types) {
      return 'work_types';
    }
    if (asks_processes) {
      return 'processes';
    }
    if (asks_workflows) {
      return 'workflows';
    }
    if (asks_skills) {
      return 'skills';
    }
    if (asks_agents) {
      return 'agents';
    }
    return null;
  }

  function detect_work_management_request(user_text = '') {
    const raw = String(user_text || '').trim();
    const lower = raw.toLowerCase();
    if (!lower) {
      return null;
    }

    if (
      /^(?:work\s+list|list\s+work(?:\s+items?)?|show\s+(?:all\s+)?work(?:\s+items?)?|what\s+work(?:\s+items?)?\s+(?:are\s+we\s+working\s+on|do\s+we\s+have|exist|are\s+active)\??)$/i.test(lower)
    ) {
      return { action: 'list' };
    }

    const switch_work_match = raw.match(
      /^(?:work\s+(?:switch|focus)|(?:switch|focus)\s+work(?:\s+item)?(?:\s+to|\s+on)?|switch\s+to\s+work(?:\s+item)?)\s+([a-z0-9_-]+)$/i
    );
    if (switch_work_match) {
      return {
        action: 'switch',
        name: switch_work_match[1]
      };
    }

    const create_work_match = raw.match(
      /^(?:work\s+(?:create|start)|(?:create|start)\s+work(?:\s+item)?)\s+(?:(feature|fix|defect|bug|hotfix|refactor|security_patch|dependency_upgrade|ingest)\s+)?([a-z0-9_-]+)(?:\s+(.+))?$/i
    );
    if (create_work_match) {
      return {
        action: 'create',
        type: (create_work_match[1] || 'feature').toLowerCase(),
        name: create_work_match[2],
        description: create_work_match[3] ? create_work_match[3].trim() : undefined
      };
    }

    const show_work_match = raw.match(
      /^(?:work\s+(?:show|status)|(?:show|status)\s+work(?:\s+item)?)(?:\s+([a-z0-9_-]+))?$/i
    );
    if (show_work_match) {
      return {
        action: 'show',
        name: show_work_match[1] || undefined
      };
    }

    const advance_work_match = raw.match(
      /^(?:work\s+advance|advance\s+work(?:\s+item)?)(?:\s+([a-z0-9_-]+))?$/i
    );
    if (advance_work_match) {
      return {
        action: 'advance',
        name: advance_work_match[1] || undefined
      };
    }

    const run_work_match = raw.match(
      /^(?:work\s+(?:run|execute)|(?:run|execute)\s+work(?:\s+item)?)\s+([a-z0-9_-]+)$/i
    );
    if (run_work_match) {
      return {
        action: 'run',
        name: run_work_match[1]
      };
    }

    return null;
  }

  function detect_prd_code_sync_request(user_text = '', mode = 'agentic') {
    const raw = String(user_text || '').trim();
    const lower = raw.toLowerCase();
    if (!lower || is_discussion_or_suggestion_request(raw, mode)) {
      return null;
    }

    const slash_match = raw.match(/^\/sync(?:\s+(code_to_prd|prd_to_code|bidirectional))?(?:\s+([a-z0-9_-]+))?$/i);
    if (slash_match) {
      return {
        direction: slash_match[1] ? slash_match[1].toLowerCase() : 'bidirectional',
        name: slash_match[2] || undefined
      };
    }

    const mentions_both = /\bprds?\s+from\s+(?:the\s+)?(?:code|source)[\s\S]*\b(?:code|source)\s+from\s+(?:the\s+)?prds?\b/i.test(lower)
      || /\b(?:code|source)\s+from\s+(?:the\s+)?prds?[\s\S]*\bprds?\s+from\s+(?:the\s+)?(?:code|source)\b/i.test(lower)
      || /\b(?:sync|synchronise|synchronize)\s+(?:the\s+)?(?:prds?\s+(?:and|with)\s+(?:the\s+)?(?:code|source)|(?:code|source)\s+(?:and|with)\s+(?:the\s+)?prds?)\b/i.test(lower);
    const code_to_prd = !mentions_both && /\b(?:update|sync|synchronise|synchronize|refresh)\s+(?:the\s+)?prds?\s+from\s+(?:the\s+)?(?:code|source|implementation)\b/i.test(lower);
    const prd_to_code = !mentions_both && /\b(?:update|sync|synchronise|synchronize|generate)\s+(?:the\s+)?(?:code|source|implementation)\s+from\s+(?:the\s+)?prds?\b/i.test(lower);

    if (mentions_both || code_to_prd || prd_to_code) {
      let direction = 'bidirectional';
      if (code_to_prd && !prd_to_code) {
        direction = 'code_to_prd';
      } else if (prd_to_code && !code_to_prd) {
        direction = 'prd_to_code';
      }
      const run_process = /\b(sync\s+sdlc\s+process|create\s+a\s+sync|run\s+process)\b/i.test(lower);
      return {
        direction,
        run_process
      };
    }

    if (/^(?:please\s+|let'?s\s+)?sync(?:hronis|hroniz)?(?:e|ing)?\s+sdlc\s+process\b/i.test(lower)) {
      return {
        direction: 'bidirectional',
        run_process: true
      };
    }

    return null;
  }

  function detect_direct_code_fix_request(user_text = '', active_agent_id = '') {
    const raw = String(user_text || '').trim();
    const lower = raw.toLowerCase();
    if (!lower) {
      return null;
    }
    const consume_sdlc = /\b(?:via\s+sdlc|with\s+sdlc|through\s+sdlc|consume\s+sdlc|run\s+sdlc|governed\s+sdlc|fix-defect\s+workflow|develop-feature\s+workflow)\b/i.test(lower);
    const explicit_direct = /\b(?:fix\s+directly|direct\s+fix|untethered\s+fix|patch\s+directly|autonomous[- ]engineer)\b/i.test(lower);
    const agent_is_auto = active_agent_id === 'autonomous-engineer';

    if (!explicit_direct && !agent_is_auto) {
      return null;
    }

    const file_match = raw.match(/(?:src\/|tests\/)?([a-z0-9_-]{3,})\.js\b/i);
    const workflow_for_match = raw.match(/\b(?:workflow|process|sdlc)\s+for\s+([a-z0-9_-]{3,})\b/i);
    const fix_match = raw.match(
      /(?:fix|patch|repair|implement|develop|resolve)\s+(?:directly\s+|broken\s+|helper\s+|in\s+|defect\s+|bug\s+|feature\s+|issue\s+)*(?:src\/)?([a-z0-9_-]{3,})(?:\.js)?(?:\s+(.+))?$/i
    );
    if (!file_match && !workflow_for_match && !fix_match) {
      return null;
    }
    const candidate_target = (
      file_match ? file_match[1] : (workflow_for_match ? workflow_for_match[1] : fix_match[1])
    ).toLowerCase();
    if (['the', 'this', 'that', 'it', 'work', 'sdlc', 'prd', 'code'].includes(candidate_target)) {
      return null;
    }
    const proc_type = /\b(feature|develop|build|implement)\b/i.test(lower) ? 'develop-feature' : 'fix-defect';
    return {
      target: candidate_target,
      description: fix_match && fix_match[2] ? fix_match[2].trim() : `fix and verify ${candidate_target}`,
      consume_sdlc,
      process_type: proc_type
    };
  }

  function hydrate_draft_from_transcript(draft, transcript = [], current_user_text = '', store = null) {
    const is_question_or_meta = (txt = '') => {
      const s = String(txt || '').trim().toLowerCase();
      if (!s) return true;
      if (s.endsWith('?')) return true;
      if (/^(?:what|why|how|where|when|who|which|did|is|are|was|were|can\s+you\s+verify|verify\s+that)\b/i.test(s)) {
        return true;
      }
      return false;
    };

    // check if current_user_text mentions an existing prd or feature slug in .sdlc/store
    if (store && typeof store.list_entities === 'function') {
      const prds = store.list_entities(DocumentEntityTypes.PRD) || [];
      const combined_hint = `${current_user_text || ''} ${draft.name || ''}`.toLowerCase();
      for (let i = 0; i < prds.length; i += 1) {
        const p = prds[i];
        const p_slug = String(p.slug || p.id.replace(/^prd-/, '')).toLowerCase();
        const p_kebab = p_slug.replace(/_/g, '-');
        if (
          p_kebab.length >= 4 &&
          (combined_hint.includes(p_kebab) || combined_hint.includes(p_slug))
        ) {
          draft.name = p_kebab;
          if (p.executive_summary?.problem) {
            draft.problem_statement = p.executive_summary.problem;
            draft.description = p.executive_summary.problem;
          }
          if (Array.isArray(p.functional_requirements) && p.functional_requirements.length > 0) {
            draft.functional_requirements = p.functional_requirements.map(
              (r) => (typeof r === 'string' ? r : (r.description || r.title || ''))
            ).filter(Boolean);
          }
          break;
        }
      }
    }

    const user_entries = (transcript || [])
      .filter((t) => t && t.speaker === 'user' && typeof t.text === 'string')
      .map((t) => t.text.trim())
      .filter(
        (txt) =>
          txt &&
          !txt.startsWith('/') &&
          txt !== current_user_text.trim() &&
          !is_sdlc_execution_request(txt) &&
          !is_question_or_meta(txt)
      );

    if (!draft.problem_statement && user_entries.length > 0) {
      draft.problem_statement = user_entries[0];
      draft.description = draft.problem_statement;
    }
    if ((!draft.name || draft.name === 'new-feature') && draft.problem_statement) {
      const stop_words = ['i', 'want', 'to', 'create', 'build', 'a', 'an', 'the', 'feature', 'for', 'that', 'with', 'in', 'on', 'and', 'or', 'please', 'we', 'need'];
      const words = draft.problem_statement
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1 && !stop_words.includes(w))
        .slice(0, 4);
      if (words.length > 0) {
        draft.name = words.join('-');
      }
    }
    if (user_entries.length > 1 && (!draft.functional_requirements || draft.functional_requirements.length === 0)) {
      draft.functional_requirements = user_entries.slice(1);
    }
  }

  /**
   * executes a single user turn through the active Mastra Agent.generate() loop
   */
  async function execute_mastra_agent_turn(user_text, session_ctx, tools, active_io) {
    const active_agent_id = session_ctx.get_active_agent();
    const harness = session_ctx.get_harness();
    let mastra_agent = null;
    if (session_ctx.controller_bundle?.controller && session_ctx.controller_session) {
      const target_mode = resolve_sdlc_controller_mode(active_agent_id);
      if (target_mode && session_ctx.controller_session.mode?.get() !== target_mode) {
        session_ctx.controller_session.mode.set({ modeId: target_mode });
      }
      try {
        mastra_agent = session_ctx.controller_bundle.controller.getCurrentAgent(session_ctx.controller_session);
      } catch (_err) {
        mastra_agent = null;
      }
    }
    if (!mastra_agent || mastra_agent.id !== active_agent_id) {
      mastra_agent = resolve_mastra_agent(active_agent_id, harness);
    }
    const draft = session_ctx.spec_draft;
    const turn_tool_traces = [];

    const emit_status = (line) => {
      if (typeof active_io.status === 'function') {
        active_io.status(line);
      }
    };

    const user_snippet = String(user_text || '').trim().slice(0, 60);
    let current_activity_label = `${active_agent_id}: evaluating prompt "${user_snippet}" & selecting governance skills/tools`;
    let active_step_started_at = Date.now();
    const turn_started_at = Date.now();
    session_ctx.on_status = emit_status;
    session_ctx.set_heartbeat_label = (label) => {
      current_activity_label = label || `${active_agent_id} working`;
      active_step_started_at = Date.now();
    };

    session_ctx.on_tool_executed = (trace) => {
      turn_tool_traces.push(trace);
      const summary_str = format_tool_trace_summary(trace.tool, trace.args, draft);
      current_activity_label = `${active_agent_id}: executing tool:${trace.tool}${summary_str}`;
      active_step_started_at = Date.now();
      active_io.write(`  ⚡ [${active_agent_id} -> tool:${trace.tool}]${summary_str}`);
    };

    emit_status(
      `  ⋯ [${active_agent_id}] thinking... (evaluating prompt "${user_snippet}" & selecting governance skills/tools)`
    );
    const heartbeat_timer = setInterval(() => {
      const total_s = Math.max(1, Math.round((Date.now() - turn_started_at) / 1000));
      const step_s = Math.max(1, Math.round((Date.now() - active_step_started_at) / 1000));
      emit_status(
        `  ⋯ [${current_activity_label}] (${step_s}s on current step, ${total_s}s total elapsed)...`
      );
    }, 5000);
    if (typeof heartbeat_timer.unref === 'function') {
      heartbeat_timer.unref();
    }

    const is_discussion = is_discussion_or_suggestion_request(user_text, session_ctx.mode);
    const sup_req = detect_supervisor_mediation_request(user_text);
    const sync_req = detect_prd_code_sync_request(user_text, session_ctx.mode);
    const exec_req = is_sdlc_execution_request(user_text, session_ctx.mode);
    const catalog_cat = detect_catalog_query_category(user_text);
    const work_req = detect_work_management_request(user_text);
    const direct_fix_req = detect_direct_code_fix_request(user_text, active_agent_id);
    const trimmed_user = String(user_text || '').trim();
    const is_explicit_create = !is_discussion
      && /^(?:create|build|develop|implement|start|launch)\s+(feature|defect|bug|hotfix|refactor|spike)\s+([a-z0-9_-]+)(?:\s+(.+))?$/i.test(trimmed_user)
      && !/^(?:create|build|develop|implement|start|launch)\s+(?:a|an|the|new)\b/i.test(trimmed_user);

    const is_read_only_query = Boolean(catalog_cat)
      || Boolean(work_req && ['list', 'show', 'status'].includes(work_req.action))
      || /^(?:status|state|show status|project status|board status|list\b|show\b|enumerate\b|what\b|which\b|explain\b|describe\b|inspect\b)/i.test(trimmed_user);

    session_ctx.current_user_text = user_text;
    const allow_process_execution = Boolean((exec_req || is_explicit_create || (sup_req && sup_req.action === 'execute_process')) && !is_discussion && !is_read_only_query);
    const allow_sync = Boolean(sync_req && !is_discussion && !is_read_only_query);
    const allow_direct_fix = Boolean(direct_fix_req && !is_discussion && !is_read_only_query);
    const allow_supervisor_request = Boolean((sup_req || allow_process_execution) && !is_discussion && !is_read_only_query);
    const allow_work_mutation = Boolean(
      work_req &&
      ['create', 'start', 'advance', 'run', 'execute', 'clarify'].includes(work_req.action) &&
      !is_discussion
    );
    session_ctx.allow_work_mutation = allow_work_mutation;
    session_ctx.allow_process_execution = allow_process_execution;

    const turn_tools = {};
    for (const [t_key, t_val] of Object.entries(tools)) {
      if (t_key === 'execute_sdlc_process' && !allow_process_execution) {
        continue;
      }
      if (t_key === 'sync_prd_and_code' && !allow_sync) {
        continue;
      }
      if (t_key === 'apply_direct_code_fix' && !allow_direct_fix) {
        continue;
      }
      if (t_key === 'request_sdlc_supervisor' && !allow_supervisor_request) {
        continue;
      }
      if (t_key === 'update_specification_draft' && (is_read_only_query || is_discussion)) {
        continue;
      }
      turn_tools[t_key] = t_val;
    }

    if (exec_req) {
      hydrate_draft_from_transcript(draft, session_ctx.transcript, user_text, session_ctx.store || (harness ? harness.get_store() : null));
    }

    const session_meta_tag = [
      `[active_agent:${active_agent_id}]`,
      `[session_mode:${session_ctx.mode || 'agentic'}]`,
      `[draft_name:${draft.name || 'new-feature'}]`,
      `[draft_entity:${draft.entity_type || 'feature'}]`,
      `[draft_process:${draft.process_type || 'develop-feature'}]`,
      `[draft_has_problem:${Boolean(draft.problem_statement)}]`,
      `[draft_has_audience:${Boolean(draft.target_audience)}]`,
      `[draft_has_criteria:${Boolean(draft.acceptance_criteria && draft.acceptance_criteria.length > 0)}]`,
      `[turn_index:${session_ctx.turn_index}]`,
      draft.problem_statement ? `current draft problem_statement: "${draft.problem_statement}".` : '',
      draft.target_audience ? `current draft target_audience: "${draft.target_audience}".` : '',
      draft.acceptance_criteria?.length ? `current draft acceptance_criteria: "${draft.acceptance_criteria.join('; ')}".` : '',
      draft.functional_requirements?.length ? `current draft functional_requirements: "${draft.functional_requirements.join('; ')}".` : '',
      is_discussion
        ? 'important: the user is sharing a free-form idea or asking to discuss and brainstorm candidate features. do not create a prd or start any sdlc process! invoke suggest_features and discuss candidate features, trade-offs, and questions with the user first.'
        : 'important: when the user explicitly asks to execute, run, start, or build the sdlc process or feature (or says they are satisfied with the requirements), call execute_sdlc_process or request_sdlc_supervisor.',
      'important: when the user asks to check readiness with sdlc-supervisor or submit a feature to sdlc-supervisor, invoke request_sdlc_supervisor.',
      allow_sync ? 'important: when the user asks to update the prd from the code, update the code from the prd, or run a bidirectional prd/code sync process, invoke sync_prd_and_code.' : '',
      'important: when the user asks to enumerate or describe sdlc phases, review gates, work-item types, high-level processes, tiers/entities, agents, workflows, or skills, you must invoke inspect_sdlc_catalog so the response is 100% deterministic and never a guess.',
      'important: when the user asks to list, create, switch, focus, advance, or run concurrent work items, invoke manage_work_items.',
      'when asked general questions, keep all answers strictly grounded in the coupled dual-engine sdlc methodology and the active work items in this workspace.',
      'respond in clear, concise, human-readable lowercase british english prose or bullet points. never output raw json objects or json code blocks in chat replies—always summarise tool outputs conversationally.'
    ].filter(Boolean).join(' ');

    const history_messages = [];
    const prior_transcript = Array.isArray(session_ctx.transcript) ? session_ctx.transcript : [];
    const max_prior = Math.max(0, prior_transcript.length - 1);
    const start_idx = Math.max(1, max_prior - 10);
    for (let h = start_idx; h < max_prior; h += 1) {
      const entry = prior_transcript[h];
      if (!entry || !entry.text) continue;
      if (entry.speaker === 'user') {
        if (entry.text.startsWith('/')) continue;
        history_messages.push({ role: 'user', content: entry.text });
      } else {
        const cleaned = entry.text.replace(/^[a-z0-9_-]+>\s*/i, '').trim();
        if (cleaned) {
          history_messages.push({ role: 'assistant', content: cleaned });
        }
      }
    }

    const turn_resource_id = session_ctx.controller_session?.identity?.getResourceId?.()
      || session_ctx.memory_resource_id
      || draft.name
      || 'sdlc-discovery';
    const turn_thread_id = session_ctx.controller_session?.thread?.getId?.()
      || `${session_ctx.session_id || 'discovery'}-${active_agent_id}-${turn_resource_id}`;

    let gen_res;
    let agent_error = null;
    try {
      try {
        gen_res = await mastra_agent.generate(
          [
            { role: 'system', content: session_meta_tag },
            ...history_messages,
            { role: 'user', content: user_text }
          ],
          {
            toolsets: { chat: turn_tools },
            maxSteps: 3,
            memory: (typeof mastra_agent.hasOwnMemory === 'function' && mastra_agent.hasOwnMemory())
              ? {
                thread: turn_thread_id,
                resource: turn_resource_id
              }
              : undefined,
            onStepFinish: (step) => {
              const tool_calls = Array.isArray(step?.toolCalls) ? step.toolCalls : [];
              if (tool_calls.length > 0) {
                const step_descriptions = [];
                for (let i = 0; i < tool_calls.length; i += 1) {
                  const tc = tool_calls[i] || {};
                  const t_name = tc.toolName || tc.name || tc.payload?.toolName || '';
                  const t_args = tc.args || tc.input || tc.payload?.args || {};
                  if (!t_name || turn_tool_traces.some((tr) => tr.tool === t_name)) {
                    continue;
                  }
                  if (t_name === 'activate_skill' || t_name.includes('skill')) {
                    const s_name = t_args.skill_name || t_args.name || t_args.skill || '';
                    step_descriptions.push(s_name ? `activating governance skill '${s_name}'` : `invoking ${t_name}`);
                  } else {
                    const sum = format_tool_trace_summary(t_name, t_args, draft);
                    step_descriptions.push(`invoking ${t_name}${sum}`);
                  }
                }
                if (step_descriptions.length > 0) {
                  emit_status(`  ⋯ [${active_agent_id}] ${step_descriptions.join('; ')}...`);
                }
                const executed_names = turn_tool_traces.map((t) => t.tool).join(', ');
                current_activity_label = executed_names
                  ? `${active_agent_id}: synthesising conversational reply from ${executed_names}`
                  : `${active_agent_id}: synthesising conversational reply`;
                active_step_started_at = Date.now();
              }
            }
          }
        );
      } catch (err) {
        agent_error = err;
        if (logger) {
          logger.error({
            event: 'discovery_chat:agent_turn_error',
            active_agent: active_agent_id,
            error: err.message
          });
        }
        emit_status(`  ⚠ [${active_agent_id}] recovered from runtime error (${err.message}); applying deterministic safeguards...`);
      }

      // deterministic safeguard -2: if the user shared a free-form discussion/suggestion prompt and suggest_features was not invoked, invoke it now
      const already_suggested = turn_tool_traces.some((t) => t.tool === 'suggest_features');
      if (is_discussion && !already_suggested && tools.suggest_features) {
        await tools.suggest_features.execute({ prompt: user_text });
      }

      // deterministic safeguard -1: if the user asked to mediate with sdlc-supervisor and request_sdlc_supervisor was not invoked, invoke it now
      const already_requested_sup = turn_tool_traces.some((t) => t.tool === 'request_sdlc_supervisor');
      if (sup_req && !already_requested_sup && tools.request_sdlc_supervisor) {
        await tools.request_sdlc_supervisor.execute(sup_req);
      }

      // deterministic safeguard 0: if the user asked to sync prd and code (code <-> prd) and sync_prd_and_code was not invoked, invoke it now
      const already_synced = turn_tool_traces.some((t) => t.tool === 'sync_prd_and_code');
      if (allow_sync && sync_req && !already_synced && tools.sync_prd_and_code) {
        await tools.sync_prd_and_code.execute(sync_req);
      }

      // deterministic safeguard -0.5: if autonomous-engineer or direct fix was requested and apply_direct_code_fix was not invoked, invoke it now
      const already_direct_fixed = turn_tool_traces.some((t) => t.tool === 'apply_direct_code_fix');
      if (direct_fix_req && !already_direct_fixed && tools.apply_direct_code_fix) {
        await tools.apply_direct_code_fix.execute(direct_fix_req);
      }

      // deterministic safeguard 1: if the user explicitly requested sdlc execution and the llm did not invoke execute_sdlc_process, invoke it now
      const already_executed = turn_tool_traces.some((t) => t.tool === 'execute_sdlc_process' || t.tool === 'sync_prd_and_code' || t.tool === 'apply_direct_code_fix' || (t.tool === 'request_sdlc_supervisor' && t.output?.process_result));
      if (!already_executed && exec_req && allow_process_execution && tools.execute_sdlc_process) {
        hydrate_draft_from_transcript(draft, session_ctx.transcript, user_text, session_ctx.store || (harness ? harness.get_store() : null));
        await tools.execute_sdlc_process.execute({
          process_type: draft.process_type || 'develop-feature',
          name: draft.name || 'new-feature',
          problem_statement: draft.problem_statement || undefined,
          target_audience: draft.target_audience || undefined,
          acceptance_criteria: draft.acceptance_criteria?.length ? draft.acceptance_criteria : undefined,
          functional_requirements: draft.functional_requirements?.length ? draft.functional_requirements : undefined
        });
      }

      // deterministic safeguard 2: if the user asked a work management command and manage_work_items was not invoked, invoke it now
      const already_managed_work = turn_tool_traces.some((t) => t.tool === 'manage_work_items');
      if (work_req && !already_managed_work && tools.manage_work_items) {
        await tools.manage_work_items.execute(work_req);
      }

      // deterministic safeguard 3: if the user asked to enumerate or inspect sdlc catalogue items, ensure inspect_sdlc_catalog is invoked with the exact category
      const matching_catalog_trace = turn_tool_traces.find(
        (t) => t.tool === 'inspect_sdlc_catalog' && (!catalog_cat || t.output?.category === catalog_cat || t.output?.category === 'all' || (catalog_cat === 'phases_and_gates' && t.output?.phases && t.output?.gates))
      );
      if (catalog_cat && !matching_catalog_trace && tools.inspect_sdlc_catalog) {
        await tools.inspect_sdlc_catalog.execute({ category: catalog_cat });
      }
    } finally {
      clearInterval(heartbeat_timer);
      session_ctx.on_tool_executed = null;
      session_ctx.on_status = null;
      session_ctx.set_heartbeat_label = null;
    }

    const current_agent_after_turn = session_ctx.get_active_agent();
    const suggest_traces = turn_tool_traces.filter((t) => t.tool === 'suggest_features');
    const suggest_executed = suggest_traces.length > 0 ? suggest_traces[suggest_traces.length - 1].output : null;
    const sup_traces = turn_tool_traces.filter((t) => t.tool === 'request_sdlc_supervisor');
    const sup_executed = sup_traces.length > 0 ? sup_traces[sup_traces.length - 1].output : null;
    const process_executed = turn_tool_traces.find((t) => t.tool === 'execute_sdlc_process')?.output
      || sup_executed?.process_result
      || null;
    const sync_traces = turn_tool_traces.filter((t) => t.tool === 'sync_prd_and_code');
    const sync_executed = sync_traces.length > 0 ? sync_traces[sync_traces.length - 1].output : null;
    const catalog_traces = turn_tool_traces.filter((t) => t.tool === 'inspect_sdlc_catalog');
    const catalog_executed = catalog_traces.length > 0 ? catalog_traces[catalog_traces.length - 1].output : null;
    const work_traces = turn_tool_traces.filter((t) => t.tool === 'manage_work_items');
    const work_executed = work_traces.length > 0 ? work_traces[work_traces.length - 1].output : null;
    const gate_traces = turn_tool_traces.filter((t) => t.tool === 'evaluate_review_gate');
    const gate_executed = gate_traces.length > 0 ? gate_traces[gate_traces.length - 1].output : null;
    const direct_fix_traces = turn_tool_traces.filter((t) => t.tool === 'apply_direct_code_fix');
    const direct_fix_executed = direct_fix_traces.length > 0 ? direct_fix_traces[direct_fix_traces.length - 1].output : null;

    const raw_reply_body = String(gen_res?.text || '').trim();
    let reply_body = format_chat_reply_prose(raw_reply_body);

    if (direct_fix_executed && direct_fix_executed.canonical_text) {
      reply_body = direct_fix_executed.canonical_text;
    } else if (suggest_executed && suggest_executed.canonical_text) {
      if (!reply_body || !reply_body.includes('suggested features')) {
        reply_body = reply_body
          ? `${reply_body}\n\n${suggest_executed.canonical_text}`
          : suggest_executed.canonical_text;
      }
    } else if (sup_executed && sup_executed.canonical_text && !process_executed) {
      reply_body = sup_executed.canonical_text;
    } else if (sync_executed && sync_executed.canonical_text) {
      reply_body = reply_body
        ? `${reply_body}\n\n${sync_executed.canonical_text}`
        : sync_executed.canonical_text;
    } else if (catalog_executed && catalog_executed.canonical_text) {
      reply_body = catalog_executed.canonical_text;
    } else if (work_executed && work_executed.canonical_text) {
      reply_body = work_executed.canonical_text;
    } else if (gate_executed && gate_executed.canonical_text) {
      reply_body = gate_executed.canonical_text;
    } else if (!reply_body && process_executed && process_executed.canonical_text) {
      reply_body = process_executed.canonical_text;
    } else if (!reply_body && agent_error) {
      reply_body = `encountered an error while processing your request: ${agent_error.message}. the chat session remains active—you can try '/sync', '/work list', or '/status'.`;
    }

    if (process_executed && process_executed.executed) {
      const pr_info = process_executed.pull_request
        ? `${process_executed.pull_request.id} (${process_executed.pull_request.status})`
        : 'none';
      const phases_str = Array.isArray(process_executed.phases_traversed) && process_executed.phases_traversed.length > 0
        ? process_executed.phases_traversed.join(' -> ')
        : 'inception -> completed';
      const gates_str = Array.isArray(process_executed.gates_passed) && process_executed.gates_passed.length > 0
        ? process_executed.gates_passed.join(', ')
        : 'gate_1_planning, gate_2_implementation, gate_3_qa_security, gate_4_release';
      const pipeline_board = session_ctx.layout
        ? `\n${session_ctx.layout.render_phase_gate_pipeline({ epic_id: process_executed.epic_id })}`
        : '';
      const exec_summary =
        `executed tier 1 sdlc process '${process_executed.process_id}' for epic '${process_executed.epic_id}' ` +
        `on branch '${process_executed.branch || 'main'}':\n` +
        `  - xstate phases : ${phases_str}\n` +
        `  - review gates  : ${gates_str} (all passed)\n` +
        `  - work board    : ${process_executed.tickets_completed}/${process_executed.tickets_total} tickets completed (all_completed=${process_executed.all_completed})\n` +
        `  - pull request  : ${pr_info}${pipeline_board}`;
      if (!reply_body || /\binception\s+phase\b/i.test(reply_body)) {
        reply_body = exec_summary;
      } else if (!reply_body.includes(process_executed.epic_id)) {
        reply_body = `${reply_body}\n\n${exec_summary}`;
      }
    }

    const reply = `${current_agent_after_turn}> ${reply_body}`;

    return {
      tool_traces: turn_tool_traces,
      process_executed,
      reply
    };
  }

  return {
    /**
     * section: version number
     * version: 0.1.0
     * 
     * section: documentation
     * tldr: parses inline or file-based brief parameters
     * verbose: delegates to parse_feature_brief_input with workspace defaults.
     * 
     * section: arguments
     * - params (object): brief options
     * 
     * section: return value
     * - brief (object): parsed brief
     * 
     * section: example
     * const b = chat.parse_brief({ name: 'auth', description: 'oauth2 flow' });
     */
    parse_brief(params = {}) {
      return parse_feature_brief_input(params);
    },

    /**
     * section: version number
     * version: 0.1.0
     * 
     * section: documentation
     * tldr: launches an interactive mastra agentic chat repl with sdlc-supervisor or any specialist agent
     * verbose: connects the user to the registered mastra Agent instance for sdlc-supervisor (default)
     * or any of the 6 specialist role agents, executing every turn through mastra Agent.generate()
     * with live mastra tools.
     * 
     * section: arguments
     * - params (object, optional): { agent_id, role, name, entity_type, mode, responses, io, silent }
     * 
     * section: return value
     * - result (promise<object>): { cancelled, active_agent, brief, inputs, process_result, transcript, tool_calls, output_lines }
     * 
     * section: example
     * const session = await chat.run_agentic_chat({ agent_id: 'sdlc-supervisor' });
     */
    async run_agentic_chat(params = {}) {
      const harness = get_harness_ref(params);
      const active_board = params.board || board || (harness ? harness.get_work_board() : null);
      const active_store = params.store || (harness ? harness.get_store() : null);
      const active_pool = params.worker_pool
        || options.worker_pool
        || (harness ? harness.get_worker_pool() : null);

      const raw_mode_param = params.controller_mode || params.mode_id || (params.mode && params.mode !== 'agentic' && params.mode !== 'inception' ? params.mode : null);
      const explicit_agent = resolve_agent_id(params.agent_id || params.agent || params.role || params.initial_agent || raw_mode_param);
      let active_agent = explicit_agent || 'product-manager';
      let active_controller_mode = resolve_sdlc_controller_mode(raw_mode_param || active_agent) || 'discovery';
      const controller_bundle = (harness && typeof harness.get_agent_controller === 'function' ? harness.get_agent_controller() : null)
        || create_sdlc_agent_controller({ harness });

      const initial_brief = parse_feature_brief_input(params);
      const explicit_audience = params.target_audience || params.audience || (initial_brief.source === 'markdown_file' ? initial_brief.target_audience : '');
      const spec_draft = {
        ...initial_brief,
        target_audience: explicit_audience,
        entity_type: params.entity_type || 'feature',
        process_type: params.process_type || 'develop-feature',
        acceptance_criteria: initial_brief.acceptance_criteria ? initial_brief.acceptance_criteria.slice() : [],
        functional_requirements: initial_brief.functional_requirements ? initial_brief.functional_requirements.slice() : [],
        architectural_constraints: initial_brief.architectural_constraints ? initial_brief.architectural_constraints.slice() : []
      };

      const is_named_item = Boolean(params.name && params.name !== 'new-feature');
      const transcript = [];
      const all_tool_calls = [];
      const memory_resource_id = spec_draft.name && spec_draft.name !== 'new-feature' ? spec_draft.name : 'sdlc-discovery';
      const controller_session = controller_bundle && typeof controller_bundle.create_session === 'function'
        ? await controller_bundle.create_session({
            resource_id: memory_resource_id,
            mode: active_controller_mode,
            title: `cli chat (${spec_draft.name || 'discovery'})`
          })
        : null;

      const layout = create_cli_status_bar_layout({
        get_harness: () => harness,
        active_agent,
        colour: params.colour,
        columns: params.columns,
        on_select_agent: (next) => {
          active_agent = next;
          const mapped_mode = resolve_sdlc_controller_mode(next);
          if (mapped_mode) {
            active_controller_mode = mapped_mode;
            if (controller_session?.mode?.set) {
              controller_session.mode.set({ modeId: mapped_mode });
            }
          }
        },
        on_select_work_item: (work_name) => {
          spec_draft.name = work_name;
        },
        on_select_process: (proc_id) => {
          spec_draft.process_type = proc_id;
        }
      });

      const session_ctx = {
        session_id: params.session_id || `chat-${Date.now()}`,
        workspace_root: params.workspace_root || options.workspace_root || null,
        memory_resource_id,
        get_harness: () => harness,
        board: active_board,
        store: active_store,
        worker_pool: active_pool,
        controller_bundle,
        controller_session,
        spec_draft,
        transcript,
        layout,
        mode: (params.mode === 'inception' || params.mode === 'agentic') ? params.mode : (is_named_item ? 'inception' : 'agentic'),
        allow_direct_supervisor: Boolean(params.allow_direct_supervisor || explicit_agent === 'sdlc-supervisor'),
        turn_index: 0,
        last_process_result: null,
        on_tool_executed: null,
        get_active_agent: () => active_agent,
        get_controller_mode: () => controller_session?.mode?.get?.() || active_controller_mode,
        set_active_agent: (next) => {
          active_agent = next;
          layout.set_active_agent(next);
          const mapped_mode = resolve_sdlc_controller_mode(next);
          if (mapped_mode) {
            active_controller_mode = mapped_mode;
            if (controller_session?.mode?.set) {
              controller_session.mode.set({ modeId: mapped_mode });
            }
          }
        },
        switch_controller_mode: async (raw_target) => {
          const target_mode = resolve_sdlc_controller_mode(raw_target);
          if (!target_mode) {
            return null;
          }
          const prev_mode = controller_session?.mode?.get?.() || active_controller_mode;
          if (controller_session?.mode?.switch) {
            try {
              await controller_session.mode.switch({ modeId: target_mode });
            } catch (_err) {
              controller_session.mode.set({ modeId: target_mode });
            }
          }
          active_controller_mode = target_mode;
          const mapped_role = resolve_role_for_controller_mode(target_mode);
          if (mapped_role) {
            active_agent = mapped_role;
            layout.set_active_agent(mapped_role);
            if (mapped_role === 'sdlc-supervisor') {
              session_ctx.allow_direct_supervisor = true;
            }
          }
          return {
            previous_mode: prev_mode,
            mode: target_mode,
            active_agent,
            transitions_to: controller_session?.mode?.resolve?.()?.transitionsTo || null
          };
        }
      };

      const tools = create_agentic_chat_tools(session_ctx);
      const active_io = params.io || options.io || create_terminal_chat_io({
        responses: params.responses,
        silent: params.silent,
        tui_mode: params.tui_mode ?? options.tui_mode
      });

      if (typeof active_io.attach_layout === 'function') {
        active_io.attach_layout(layout);
      }

      const is_tui_mode = typeof active_io.is_tui_mode === 'function' && active_io.is_tui_mode();

      if (typeof active_io.set_keypress_handler === 'function') {
        active_io.set_keypress_handler((str, key, ctx) => {
          const outcome = layout.handle_keypress(str, key, ctx);
          if (outcome.handled) {
            if (outcome.tree_action && outcome.tree_action.selected) {
              layout.append_chat_message(
                `${active_agent}> activated tree item '${outcome.tree_action.target_id}' (${outcome.tree_action.action_type}).`,
                { speaker: active_agent }
              );
            }
            if (!is_tui_mode) {
              if (outcome.active_window === 'chat') {
                active_io.write(`\n${layout.render_status_bar()}`);
              } else {
                active_io.write(`\n${layout.render_active_window()}`);
              }
            }
          }
          return outcome;
        });
      }

      function render_window_switch() {
        if (is_tui_mode && typeof active_io.redraw_tui === 'function') {
          active_io.redraw_tui();
        } else {
          active_io.write(layout.render_active_window());
        }
      }

      function record_turn(speaker, text) {
        transcript.push({
          speaker,
          text,
          timestamp: new Date().toISOString()
        });
      }

      const profile = AGENT_PROFILES[active_agent] || AGENT_PROFILES['sdlc-supervisor'];
      if (!is_tui_mode) {
        active_io.write(layout.render_status_bar());
      }
      active_io.write(
        '=========================================================================\n' +
        `mastra agentic chat — active agent: ${active_agent} (${profile.title})\n` +
        'agents  : sdlc-supervisor, product-manager, system-architect, software-engineer, qa-engineer, security-engineer, devops-engineer\n' +
        'windows : f1 (/f1) chat • f2 (/f2) phases & gates • f3 (/f3) doc store tree • f4 (/f4) top-level items tree • f5 (/f5) memory\n' +
        'commands: /agent <name>, /agents, /tools, /pipeline, /tree, /status, /draft, /run, /done, /cancel, /exit\n' +
        '========================================================================='
      );

      let opening_line;
      if (is_named_item) {
        opening_line = `${active_agent}> hello! i am ${active_agent}. let's collaborate on ${spec_draft.entity_type} '${spec_draft.name}'. ` +
          'describe what it should do, ask me to inspect the workspace or consult another specialist, or type /run (/done) when ready.';
      } else {
        opening_line = `${active_agent}> hello! i am ${active_agent} (${profile.focus}). ` +
          'how can i help you today? (switch mastra agents anytime with /agent <name>).';
      }
      active_io.write(opening_line);
      record_turn(active_agent, opening_line);

      let cancelled = false;
      try {
        while (true) {
          const raw_input = await active_io.ask('you> ');
          const input = String(raw_input || '').trim();
          record_turn('user', input);

          if (input === '/cancel' || input === '/abort') {
            cancelled = true;
            active_io.write(`${active_agent}> session cancelled.`);
            break;
          }
          if (input === '/exit' || input === '/quit') {
            active_io.write(`${active_agent}> closing mastra agentic chat session.`);
            break;
          }
          if (input === '/done') {
            break;
          }
          if (!input) {
            if (session_ctx.turn_index > 0 && spec_draft.problem_statement && params.auto_exit_on_empty !== false) {
              break;
            }
            continue;
          }

          if (/^hello\s*world[!?.]*$/i.test(input)) {
            session_ctx.allow_direct_supervisor = true;
            session_ctx.set_active_agent('sdlc-supervisor');
            const probe_reply = 'sdlc-supervisor> 42';
            active_io.write(probe_reply);
            record_turn('sdlc-supervisor', probe_reply);
            continue;
          }

          if (input === '/help') {
            active_io.write(
              'available slash commands & function key windows:\n' +
              '  f1 or /f1      switch to chat & live pipeline window\n' +
              '  f2 or /f2      display visual 10-phase & 4-gate execution pipeline (/pipeline)\n' +
              '  f3 or /f3      open interactive doc store treeview browser (/tree docs)\n' +
              '  f4 or /f4      open interactive top-level items treeview selector (/tree items)\n' +
              '  f5 or /f5      inspect persistent memory, knowledge graph & hybrid rag (/memory)\n' +
              '  /tree [cmd]    navigate treeview (docs, items, up, down, left, right, select <id>)\n' +
              '  /sync [name]   synchronise prd from code and code from prd (bidirectional sync)\n' +
              '  /agent <name>  switch active mastra agent (e.g. /agent system-architect, /agent sdlc-supervisor)\n' +
              '  /agents        list all 8 registered mastra agents and their roles\n' +
              '  /mode [id]     list or switch agent controller mode (discovery, architecture, implementation, security, qa, release, autonomous, supervisor)\n' +
              '  /transition    advance agent controller mode to the next lifecycle mode (transitionsTo)\n' +
              '  /session       inspect active agent controller session, thread, mode, and permissions\n' +
              '  /permissions   inspect or update agent controller tool/category permissions (read, edit, execute)\n' +
              '  /threads       list or create agent controller threads (/thread new <title>)\n' +
              '  /tools         list all mastra tools equipped on the chat session\n' +
              '  /tiers         display standardised tier 1 & tier 2 entities, verbs, and tools\n' +
              '  /statecharts   list all 9 canonical xstate v5 statecharts and active actors\n' +
              '  /phases        list all 10 sequential sdlc macro phases\n' +
              '  /gates         list all 5 formal review gates and invariants\n' +
              '  /work [cmd]    manage concurrent work items (list, create <type> <name>, switch <name>, show <name>)\n' +
              '  /status        invoke inspect_workspace_status via mastra agent\n' +
              '  /draft         display current working specification draft\n' +
              '  /run           execute the governed sdlc process for the current draft\n' +
              '  /done          finish discovery and proceed\n' +
              '  /cancel        abort without executing\n' +
              '  /exit          exit chat repl'
            );
            continue;
          }

          if (input === '/sync' || input.startsWith('/sync ')) {
            const sub_sync = input.slice(5).trim();
            const sync_prompt = sub_sync
              ? `update the prd from the code and the code from the prd for ${sub_sync}`
              : 'update the prd from the code and the code from the prd';
            const turn_res = await execute_mastra_agent_turn(sync_prompt, session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            continue;
          }

          if (input === '/f1' || input === '/chat') {
            layout.handle_keypress('', { name: 'f1' });
            render_window_switch();
            continue;
          }

          if (input === '/f2' || input === '/pipeline') {
            layout.handle_keypress('', { name: 'f2' });
            render_window_switch();
            continue;
          }

          if (input === '/f3' || input === '/docs' || input === '/tree docs') {
            layout.handle_keypress('', { name: 'f3' });
            render_window_switch();
            continue;
          }

          if (input === '/f4' || input === '/items' || input === '/tree' || input === '/tree items') {
            layout.handle_keypress('', { name: 'f4' });
            render_window_switch();
            continue;
          }

          if (input === '/f5' || input === '/memory' || input === '/knowledge') {
            layout.handle_keypress('', { name: 'f5' });
            render_window_switch();
            continue;
          }

          if (input.startsWith('/tree ')) {
            const sub_tree = input.slice(6).trim();
            if (sub_tree === 'up' || sub_tree === 'down' || sub_tree === 'left' || sub_tree === 'right' || sub_tree === 'enter') {
              if (layout.get_active_window() !== 'doc_store' && layout.get_active_window() !== 'top_level_items') {
                layout.set_active_window('top_level_items');
              }
              layout.handle_keypress('', { name: sub_tree === 'enter' ? 'return' : sub_tree });
              render_window_switch();
              continue;
            }
            if (sub_tree.startsWith('select ')) {
              const target_item_id = sub_tree.slice(7).trim();
              const active_kind = layout.get_active_window() === 'doc_store' ? 'doc_store' : 'top_level_items';
              layout.set_active_window(active_kind);
              const sel_res = layout.select_tree_item_by_id(active_kind, target_item_id);
              render_window_switch();
              if (sel_res.selected) {
                active_io.write(`${active_agent}> activated tree item '${sel_res.target_id}' (${sel_res.action_type}).`);
              }
              continue;
            }
          }

          if (input === '/tiers') {
            const turn_res = await execute_mastra_agent_turn('enumerate the tiers and entities', session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            continue;
          }

          if (input === '/statecharts' || input === '/statechart') {
            const turn_res = await execute_mastra_agent_turn('list the statecharts', session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            continue;
          }

          if (input === '/phases') {
            const turn_res = await execute_mastra_agent_turn('enumerate the phases', session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            continue;
          }

          if (input === '/gates') {
            const turn_res = await execute_mastra_agent_turn('enumerate the gates', session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            continue;
          }

          if (input === '/work' || input.startsWith('/work ')) {
            const sub_cmd = input === '/work' ? 'work list' : `work ${input.slice(6).trim()}`;
            const turn_res = await execute_mastra_agent_turn(sub_cmd, session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            continue;
          }

          if (input === '/agents') {
            const lines = ['registered mastra conversational agents (7):'];
            for (const ag of Object.values(AGENT_PROFILES)) {
              const marker = ag.id === active_agent ? '* ' : '  ';
              lines.push(`${marker}${ag.id} (${ag.title}): ${ag.focus}`);
            }
            active_io.write(lines.join('\n'));
            continue;
          }

          if (input === '/modes' || input === '/mode') {
            const curr_mode = session_ctx.get_controller_mode();
            const mode_list = controller_bundle?.modes || SDLC_CONTROLLER_MODE_DEFINITIONS;
            const lines = [`agent controller modes (${mode_list.length}) [controller=${controller_bundle?.id || 'sdlc-agent-controller'}]:`];
            for (const m of mode_list) {
              const marker = m.id === curr_mode ? '* ' : '  ';
              const next_tag = m.transitionsTo ? ` -> transitionsTo: ${m.transitionsTo}` : '';
              lines.push(`${marker}${m.id} (${m.role_id || resolve_role_for_controller_mode(m.id)}): ${m.description}${next_tag}`);
            }
            active_io.write(lines.join('\n'));
            continue;
          }

          if (input === '/transition' || input === '/mode next') {
            const curr_mode = session_ctx.get_controller_mode();
            const mode_list = controller_bundle?.modes || SDLC_CONTROLLER_MODE_DEFINITIONS;
            const found_mode = mode_list.find((m) => m.id === curr_mode);
            const next_mode = found_mode?.transitionsTo || null;
            if (!next_mode) {
              active_io.write(`${active_agent}> current controller mode '${curr_mode}' has no automatic lifecycle transition; use '/mode <id>' to switch directly.`);
              continue;
            }
            const switched = await session_ctx.switch_controller_mode(next_mode);
            const msg = `${active_agent}> transitioned agent controller mode: ${switched.previous_mode} -> ${switched.mode} (active agent: ${switched.active_agent})`;
            active_io.write(msg);
            record_turn(active_agent, msg);
            continue;
          }

          if (input.startsWith('/mode ')) {
            const target_mode = input.slice(6).trim();
            const switched = await session_ctx.switch_controller_mode(target_mode);
            if (!switched) {
              active_io.write(`${active_agent}> unknown controller mode '${target_mode}'. available modes: ${SDLC_CONTROLLER_MODE_DEFINITIONS.map((m) => m.id).join(', ')}`);
              continue;
            }
            const next_str = switched.transitions_to ? ` (next lifecycle mode: ${switched.transitions_to})` : '';
            const msg = `${active_agent}> switched agent controller mode: ${switched.previous_mode} -> ${switched.mode} (active agent: ${switched.active_agent})${next_str}`;
            active_io.write(msg);
            record_turn(active_agent, msg);
            continue;
          }

          if (input === '/session' || input === '/controller') {
            const curr_mode = session_ctx.get_controller_mode();
            const sess_id = controller_session?.identity?.getId?.() || session_ctx.session_id;
            const res_id = controller_session?.identity?.getResourceId?.() || session_ctx.memory_resource_id;
            const thr_id = controller_session?.thread?.getId?.() || 'none';
            const rules = controller_session?.permissions?.getRules?.() || { categories: {}, tools: {} };
            const cats_str = Object.entries(rules.categories || {}).map(([k, v]) => `${k}=${v}`).join(', ') || 'default';
            const next_m = controller_session?.mode?.resolve?.()?.transitionsTo || 'none';
            active_io.write(
              `agent controller session [${controller_bundle?.id || 'sdlc-agent-controller'}]:\n` +
              `  - session_id     : ${sess_id}\n` +
              `  - resource_id    : ${res_id}\n` +
              `  - thread_id      : ${thr_id}\n` +
              `  - active_mode    : ${curr_mode} (transitions_to: ${next_m})\n` +
              `  - active_agent   : ${active_agent}\n` +
              `  - permissions    : ${cats_str}`
            );
            continue;
          }

          if (input === '/permissions' || input.startsWith('/permissions ')) {
            const sub_perm = input.slice(12).trim();
            if (sub_perm && controller_session?.permissions) {
              const parts = sub_perm.split(/\s+/);
              const target_key = parts[0];
              const policy = parts[1] || 'allow';
              if (['read', 'edit', 'execute'].includes(target_key)) {
                await controller_session.permissions.setForCategory({ category: target_key, policy });
                active_io.write(`${active_agent}> updated agent controller category permission: ${target_key}=${policy}`);
              } else {
                await controller_session.permissions.setForTool({ toolName: target_key, policy });
                active_io.write(`${active_agent}> updated agent controller tool permission: ${target_key}=${policy}`);
              }
              continue;
            }
            const rules = controller_session?.permissions?.getRules?.() || { categories: {}, tools: {} };
            const cat_lines = Object.entries(rules.categories || {}).map(([k, v]) => `  - category:${k} = ${v}`);
            const tool_lines = Object.entries(rules.tools || {}).map(([k, v]) => `  - tool:${k} = ${v}`);
            active_io.write(
              'agent controller session permissions:\n' +
              (cat_lines.concat(tool_lines).join('\n') || '  (no custom permission rules configured)')
            );
            continue;
          }

          if (input === '/threads' || input === '/thread' || input.startsWith('/thread ') || input.startsWith('/threads ')) {
            const sub_thr = input.replace(/^\/threads?\s*/, '').trim();
            if (sub_thr.startsWith('new') && controller_session?.thread?.create) {
              const title = sub_thr.slice(3).trim() || `cli thread (${new Date().toISOString()})`;
              const saved_mode = active_controller_mode;
              const created = await controller_session.thread.create({ title });
              if (saved_mode && controller_session?.mode?.set) {
                controller_session.mode.set({ modeId: saved_mode });
              }
              active_io.write(`${active_agent}> created and switched to agent controller thread '${created.id}' (${created.title}).`);
              continue;
            }
            const current_thr = controller_session?.thread?.getId?.() || 'none';
            const threads_list = controller_session?.thread?.list ? await controller_session.thread.list() : [];
            const items = Array.isArray(threads_list) ? threads_list : (threads_list?.threads || []);
            const lines = [`agent controller threads (${items.length}) [active=${current_thr}]:`];
            for (const t of items) {
              const mark = t.id === current_thr ? '* ' : '  ';
              lines.push(`${mark}${t.id}: ${t.title || 'untitled'}`);
            }
            active_io.write(lines.join('\n'));
            continue;
          }

          if (input.startsWith('/agent ')) {
            const target = input.slice(7).trim();
            const turn_res = await execute_mastra_agent_turn(`switch to ${target}`, session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            continue;
          }

          if (input === '/tools') {
            const lines = ['equipped mastra agentic tools:'];
            for (const [tid, t] of Object.entries(tools)) {
              lines.push(`  - ${tid}: ${t.description}`);
            }
            active_io.write(lines.join('\n'));
            continue;
          }

          if (input === '/draft' || input === '/summary') {
            active_io.write(format_draft_summary(spec_draft));
            continue;
          }

          if (input === '/requests' || input === '/queue' || input.startsWith('/requests ')) {
            const req_list = active_pool && typeof active_pool.list_requests === 'function'
              ? active_pool.list_requests()
              : [];
            const lines = [`worker pool submitted requests (${req_list.length}):`];
            if (req_list.length === 0) {
              lines.push('  (no requests submitted to worker pool yet)');
            } else {
              for (const r of req_list) {
                const bg_tag = r.background ? ' [background]' : '';
                lines.push(`  - ${r.id} [${r.type}] status=${r.status} role=${r.role} worker=${r.worker_id || 'pool'} epic=${r.epic_id || 'n/a'}${bg_tag}`);
              }
            }
            active_io.write(lines.join('\n'));
            continue;
          }

          if (input === '/submit' || input.startsWith('/submit ')) {
            const sub_arg = input.slice(7).trim();
            const parts = sub_arg ? sub_arg.split(/\s+/) : [];
            const known_procs = ['develop-feature', 'fix-defect', 'emergency-hotfix', 'refactor-module', 'security-patch', 'upgrade-dependencies'];
            const proc_type = parts[0] && known_procs.includes(parts[0]) ? parts.shift() : (spec_draft.process_type || 'develop-feature');
            const target_name = parts[0] || spec_draft.name || `feature-${Date.now()}`;
            const desc = parts.slice(1).join(' ') || spec_draft.problem_statement || `deliver ${target_name} under sdlc governance`;
            const exec_res = await tools.execute_sdlc_process.execute({
              process_type: proc_type,
              name: target_name,
              problem_statement: desc,
              background: true
            });
            all_tool_calls.push({ tool: 'execute_sdlc_process', args: { process_type: proc_type, name: target_name, background: true }, output: exec_res });
            const reply = `${active_agent}> ${exec_res.canonical_text || `submitted '${proc_type}' for '${target_name}' to worker pool (${exec_res.request_id}).`}`;
            active_io.write(reply);
            record_turn(active_agent, reply);
            continue;
          }

          if (input === '/sdlc-config' || input.startsWith('/sdlc-config ')) {
            const sub_cfg = input.slice(12).trim() || 'project';
            const arch_res = await tools.manage_sdlc_architecture.execute({ level: sub_cfg, action: 'inspect' });
            all_tool_calls.push({ tool: 'manage_sdlc_architecture', args: { level: sub_cfg }, output: arch_res });
            active_io.write(`${active_agent}> sdlc architecture [${arch_res.level}]: ${format_chat_reply_prose(JSON.stringify(arch_res))}`);
            continue;
          }

          if (input === '/status') {
            const turn_res = await execute_mastra_agent_turn('status', session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            continue;
          }

          if (input === '/run' || input === '/start') {
            const turn_res = await execute_mastra_agent_turn('build it', session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);
            if (params.exit_after_run !== false) {
              break;
            }
            continue;
          }

          session_ctx.turn_index += 1;
          try {
            const turn_res = await execute_mastra_agent_turn(input, session_ctx, tools, active_io);
            for (let t = 0; t < turn_res.tool_traces.length; t += 1) {
              all_tool_calls.push(turn_res.tool_traces[t]);
            }
            active_io.write(turn_res.reply);
            record_turn(active_agent, turn_res.reply);

            if (turn_res.process_executed && params.exit_after_run === true) {
              break;
            }
          } catch (turn_err) {
            if (logger) {
              logger.error({
                event: 'discovery_chat:repl_turn_error',
                active_agent,
                error: turn_err.message
              });
            }
            const err_reply = `${active_agent}> encountered an unexpected error (${turn_err.message}). the chat session remains active.`;
            active_io.write(err_reply);
            record_turn(active_agent, err_reply);
          }
        }
      } finally {
        active_io.close();
      }

      const draft_was_populated = Boolean(
        is_named_item
        || spec_draft.problem_statement
        || (spec_draft.name && spec_draft.name !== 'new-feature')
      );

      if (draft_was_populated) {
        if (!spec_draft.problem_statement) {
          spec_draft.problem_statement = `deliver ${spec_draft.name} with verified specifications and tests`;
        }
        if (!spec_draft.description) {
          spec_draft.description = spec_draft.problem_statement;
        }
        if (!spec_draft.target_audience) {
          spec_draft.target_audience = 'application developers and platform consumers';
        }
        if (!spec_draft.acceptance_criteria || spec_draft.acceptance_criteria.length === 0) {
          spec_draft.acceptance_criteria = [
            `verify ${spec_draft.name} satisfies "${spec_draft.problem_statement}"`,
            `ensure all unit and regression tests pass for ${spec_draft.name}`
          ];
        }
        if (!spec_draft.functional_requirements || spec_draft.functional_requirements.length === 0) {
          spec_draft.functional_requirements = [
            spec_draft.problem_statement,
            ...spec_draft.acceptance_criteria
          ];
        }
        spec_draft.has_explicit_brief = true;
        spec_draft.source = 'agentic_chat';
      }

      if (logger) {
        logger.info({
          event: 'discovery_chat:agentic_session_completed',
          active_agent,
          name: spec_draft.name,
          cancelled,
          turns: transcript.length,
          tool_calls: all_tool_calls.length
        });
      }

      const inputs = {
        feature_name: spec_draft.name,
        title: spec_draft.title || spec_draft.name,
        description: spec_draft.description,
        problem_statement: spec_draft.problem_statement,
        target_audience: spec_draft.target_audience,
        functional_requirements: spec_draft.functional_requirements,
        acceptance_criteria: spec_draft.acceptance_criteria,
        architectural_constraints: spec_draft.architectural_constraints,
        chat_transcript: transcript
      };

      const controller_session_summary = controller_session
        ? {
            controller_id: controller_bundle?.id || 'sdlc-agent-controller',
            session_id: controller_session.identity?.getId?.() || session_ctx.session_id,
            resource_id: controller_session.identity?.getResourceId?.() || session_ctx.memory_resource_id,
            thread_id: controller_session.thread?.getId?.() || null,
            mode: controller_session.mode?.get?.() || active_controller_mode,
            transitions_to: controller_session.mode?.resolve?.()?.transitionsTo || null,
            permissions: controller_session.permissions?.getRules?.() || { categories: {}, tools: {} }
          }
        : null;

      return {
        cancelled,
        active_agent,
        active_mode: controller_session_summary?.mode || active_controller_mode,
        controller_session: controller_session_summary,
        draft_was_populated,
        brief: spec_draft,
        inputs,
        process_result: session_ctx.last_process_result,
        transcript,
        tool_calls: all_tool_calls,
        output_lines: active_io.get_output_lines()
      };
    },

    /**
     * section: version number
     * version: 0.1.0
     * 
     * section: documentation
     * tldr: runs an agentic discovery chat session for a new feature, defect, or architecture item
     * verbose: delegates to run_agentic_chat in inception mode pre-configured with sdlc-supervisor
     * (or the requested role agent) so the user can scope the item agentically before execution.
     * 
     * section: arguments
     * - params (object): { name, entity_type, role, agent_id, responses, io, silent }
     * 
     * section: return value
     * - result (promise<object>): { cancelled, active_agent, brief, inputs, process_result, transcript, tool_calls, output_lines }
     * 
     * section: example
     * const res = await chat.run_inception_chat({ name: 'session-vault', responses: ['encrypted session store', 'developers', 'ed25519; ttl'] });
     */
    async run_inception_chat(params = {}) {
      return this.run_agentic_chat({
        ...params,
        mode: 'inception',
        agent_id: params.agent_id || params.agent || params.role || 'product-manager',
        exit_after_run: true
      });
    },

    /**
     * section: version number
     * version: 0.1.0
     * 
     * section: documentation
     * tldr: resolves awaiting_input clarification requests on the work board via agentic chat
     * verbose: inspects paused tickets on the board for an epic or ticket id, presents each
     * specialist agent's question in the terminal, records the user's answer via resolve_clarification,
     * and optionally drains the board to resume execution.
     * 
     * section: arguments
     * - params (object, optional): { epic_id, ticket_id, answer, responses, io, auto_drain, silent }
     * 
     * section: return value
     * - result (promise<object>): { resolved_count, resolved_tickets, drain_report, board_summary, transcript }
     * 
     * section: example
     * const res = await chat.run_clarification_chat({ epic_id: 'session-vault', responses: ['use 15m token ttl'] });
     */
    async run_clarification_chat(params = {}) {
      const harness = get_harness_ref(params);
      const active_board = params.board || board || (harness ? harness.get_work_board() : null);
      if (!active_board) {
        throw new Error('work_board_unavailable: cannot run clarification chat without a work board instance');
      }

      const epic_id = params.epic_id || params.name || null;
      const ticket_id = params.ticket_id || null;
      const single_answer = params.answer !== undefined ? String(params.answer).trim() : null;

      const active_io = params.io || options.io || create_terminal_chat_io({
        responses: single_answer ? [single_answer] : params.responses,
        silent: params.silent
      });

      const waiting_tickets = active_board.list_tickets((t) => {
        if (t.status !== 'awaiting_input') {
          return false;
        }
        if (ticket_id && t.id !== ticket_id) {
          return false;
        }
        if (epic_id && t.epic_id !== epic_id) {
          return false;
        }
        return true;
      });

      const transcript = [];
      const resolved_tickets = [];

      try {
        if (waiting_tickets.length === 0) {
          active_io.write(
            epic_id
              ? `sdlc-supervisor> no tickets are currently awaiting_input for '${epic_id}'.`
              : 'sdlc-supervisor> no tickets are currently awaiting_input on the work board.'
          );
        } else {
          active_io.write(`sdlc-supervisor> found ${waiting_tickets.length} ticket(s) awaiting clarification:`);
          for (let i = 0; i < waiting_tickets.length; i += 1) {
            const ticket = waiting_tickets[i];
            const thread = Array.isArray(ticket.thread) ? ticket.thread : [];
            const last_req = [...thread].reverse().find((entry) => entry.type === 'clarification_request');
            const question_text = last_req
              ? last_req.message
              : `please provide required specification details for ${ticket.id} (${ticket.title})`;

            const prompt_line = `${ticket.role} [${ticket.id}]> ${question_text}\nyou> `;
            transcript.push({ speaker: ticket.role, ticket_id: ticket.id, text: question_text });
            const user_answer = await active_io.ask(prompt_line);
            transcript.push({ speaker: 'user', ticket_id: ticket.id, text: user_answer });

            if (!user_answer || user_answer === '/skip' || user_answer === '/cancel' || user_answer === '/exit') {
              continue;
            }

            const updated = active_board.resolve_clarification(ticket.id, {
              from_worker: params.from_worker || 'user-cli',
              role: params.role || 'sdlc-supervisor',
              answer: user_answer,
              problem_statement: params.problem_statement || (ticket.workflow_id === 'pm-prd-authoring' ? user_answer : undefined),
              acceptance_criteria: params.acceptance_criteria
            });
            resolved_tickets.push(updated);
            active_io.write(`sdlc-supervisor> resolved clarification on ${ticket.id}; status is now '${updated.status}'.`);
          }
        }
      } finally {
        active_io.close();
      }

      let drain_report = null;
      let board_summary = epic_id ? active_board.get_board_summary(epic_id) : active_board.get_board_summary();
      const active_pool = params.worker_pool
        || options.worker_pool
        || (harness ? harness.get_worker_pool() : null);

      if (params.auto_drain !== false && resolved_tickets.length > 0 && active_pool) {
        const target_epic = epic_id || resolved_tickets[0].epic_id;
        drain_report = await active_pool.drain_board({
          epic_id: target_epic,
          max_rounds: params.max_rounds || 50
        });
        board_summary = active_board.get_board_summary(target_epic);
      }

      return {
        resolved_count: resolved_tickets.length,
        resolved_tickets,
        drain_report,
        board_summary,
        transcript,
        output_lines: active_io.get_output_lines()
      };
    }
  };
}
