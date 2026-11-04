/**
 * ============================================================================
 * @file dual-window-chat-live-pipeline-panel.js
 * @version 0.1.0
 * @author dual-engine-harness
 * @description dual-pane split-view terminal layout component for the f1
 *   mastra agentic chat & live pipeline window. separates conversational
 *   dialogue (left pane) from real-time sdlc pipeline progression logs and
 *   phase/gate telemetry (right pane) with independent scroll viewports and
 *   chat-to-pipeline run correlation.
 * ============================================================================
 */

const strip_ansi = (text = '') => String(text || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]|\x1b[78]/g, '');

/**
 * ============================================================================
 * @function wrap_pane_entries
 * @version 0.1.0
 * @author dual-engine-harness
 * @description wraps an array of chat or pipeline log messages into fixed-width
 *   terminal lines while preserving ansi colour sequences on the leading line.
 * @param {string[]} entries - list of raw message strings.
 * @param {number} [max_width=36] - usable character width for each wrapped line.
 * @returns {string[]} array of wrapped lines ready for viewport slicing.
 * // ---
 * // 1. normalise width to a safe positive integer
 * // 2. iterate over each entry and split by explicit newline characters
 * // 3. preserve short ansi-styled lines without stripping colour codes
 * // 4. wrap long plain lines into continuation rows with 2-space indent
 * // 5. return flattened array of wrapped visual lines
 * ============================================================================
 */
export function wrap_pane_entries(entries = [], max_width = 36) {
  const safe_width = Math.max(12, Math.floor(Number(max_width) || 36));
  const list = Array.isArray(entries) ? entries : [];
  const wrapped = [];

  for (const raw_entry of list) {
    const sub_lines = String(raw_entry || '').split('\n');
    for (const sub of sub_lines) {
      const plain = strip_ansi(sub);
      if (plain.length <= safe_width) {
        wrapped.push(sub);
      } else {
        let remaining = plain;
        let first = true;
        while (remaining.length > 0) {
          const chunk_w = first ? safe_width : Math.max(8, safe_width - 2);
          const chunk = remaining.slice(0, chunk_w);
          wrapped.push(first ? chunk : `  ${chunk}`);
          remaining = remaining.slice(chunk_w);
          first = false;
        }
      }
    }
  }

  return wrapped;
}

/**
 * ============================================================================
 * @function is_pipeline_telemetry_entry
 * @version 0.1.0
 * @author dual-engine-harness
 * @description classifies whether a message string represents live sdlc
 *   pipeline progression telemetry rather than conversational user/agent chat.
 * @param {string} message - raw message text to classify.
 * @returns {boolean} true if the message belongs in the live pipeline pane.
 * // ---
 * // 1. strip ansi sequences and normalise message to lowercase
 * // 2. check for explicit pipeline markers ([sdlc], [pipeline], [phase, [gate)
 * // 3. check for ticket/workflow lifecycle prefixes and progress symbols
 * // 4. exclude direct conversational role prompts (user>, product-manager>)
 * // 5. return boolean classification result
 * ============================================================================
 */
export function is_pipeline_telemetry_entry(message = '') {
  const plain = strip_ansi(String(message || '')).trim().toLowerCase();
  if (!plain) {
    return false;
  }
  if (
    plain.startsWith('user>') ||
    plain.startsWith('product-manager>') ||
    plain.startsWith('software-engineer>') ||
    plain.startsWith('system-architect>') ||
    plain.startsWith('qa-engineer>') ||
    plain.startsWith('security-architect>') ||
    plain.startsWith('devops-engineer>') ||
    plain.startsWith('technical-writer>') ||
    plain.startsWith('autonomous-engineer>') ||
    plain.startsWith('sdlc-supervisor>')
  ) {
    return false;
  }
  return (
    plain.includes('[sdlc]') ||
    plain.includes('[pipeline]') ||
    plain.includes('[phase') ||
    plain.includes('[gate') ||
    plain.includes('[xstate]') ||
    plain.includes('[heartbeat]') ||
    plain.startsWith('⏳') ||
    plain.startsWith('▶') ||
    plain.startsWith('✔') ||
    plain.startsWith('✖') ||
    plain.startsWith('⚡') ||
    plain.includes('ticket_started') ||
    plain.includes('ticket_completed') ||
    plain.includes('workflow_step') ||
    plain.includes('executing sdlc')
  );
}

/**
 * ============================================================================
 * @function create_dual_window_chat_live_pipeline_panel
 * @version 0.1.0
 * @author dual-engine-harness
 * @description creates the dual-pane split-view controller for the f1 mastra
 *   agentic chat & live pipeline window. maintains separate message buffers,
 *   independent scroll offsets, correlation links between chat turns and
 *   pipeline runs, and side-by-side ansi frame rendering.
 * @param {object} [options={}] - configuration and initial state options.
 * @returns {object} public dual-window chat and live pipeline panel api.
 * // ---
 * // 1. resolve split ratio and pane focus defaults from options and env
 * // 2. initialise separate chat_messages and pipeline_messages arrays
 * // 3. maintain independent scroll offsets and turn-to-run correlation records
 * // 4. expose message append, scroll, focus, and split-ratio mutators
 * // 5. render side-by-side dual-pane terminal frame with independent scrollbars
 * ============================================================================
 */
export function create_dual_window_chat_live_pipeline_panel(options = {}) {
  const env = options.env && typeof options.env === 'object' ? options.env : process.env;
  const clamp_ratio = (val) => {
    const num = Number(val);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      return 0.54;
    }
    return Math.max(0.3, Math.min(0.7, num));
  };

  let split_ratio = clamp_ratio(
    options.split_ratio !== undefined ? options.split_ratio : env.CHAT_SPLIT_RATIO,
  );
  let active_pane = options.active_pane === 'pipeline' ? 'pipeline' : 'chat';
  let chat_scroll_offset = Math.max(0, Number(options.chat_scroll_offset || 0));
  let pipeline_log_scroll_offset = Math.max(0, Number(options.pipeline_log_scroll_offset || 0));

  const chat_messages = Array.isArray(options.chat_messages) ? [...options.chat_messages] : [];
  const pipeline_messages = Array.isArray(options.pipeline_messages)
    ? [...options.pipeline_messages]
    : [];
  const correlation_keys = [];
  const correlation_values = [];

  const correlate_turn_with_run = (turn_id, run_id) => {
    const safe_turn = String(turn_id || '').trim();
    const safe_run = String(run_id || '').trim();
    if (!safe_turn || !safe_run) {
      return null;
    }
    const existing_idx = correlation_keys.indexOf(safe_turn);
    if (existing_idx >= 0) {
      correlation_values[existing_idx] = safe_run;
    } else {
      correlation_keys.push(safe_turn);
      correlation_values.push(safe_run);
    }
    return { turn_id: safe_turn, run_id: safe_run };
  };

  const get_correlated_run = (turn_id) => {
    const idx = correlation_keys.indexOf(String(turn_id || '').trim());
    return idx >= 0 ? correlation_values[idx] : null;
  };

  const append_chat_message = (message, metadata = {}) => {
    const text = String(message || '').trimEnd();
    if (!text) {
      return chat_messages.length;
    }
    const run_id = metadata && metadata.run_id ? String(metadata.run_id).trim() : '';
    const turn_id = metadata && metadata.turn_id ? String(metadata.turn_id).trim() : '';
    if (turn_id && run_id) {
      correlate_turn_with_run(turn_id, run_id);
    }
    const badge = run_id ? ` \x1b[2m[run:${run_id}]\x1b[0m` : '';
    chat_messages.push(`${text}${badge}`);
    if (chat_messages.length > 500) {
      chat_messages.shift();
    }
    if (metadata && metadata.reset_scroll !== false) {
      chat_scroll_offset = 0;
    }
    return chat_messages.length;
  };

  const append_pipeline_message = (message, metadata = {}) => {
    const text = String(message || '').trimEnd();
    if (!text) {
      return pipeline_messages.length;
    }
    const run_id = metadata && metadata.run_id ? String(metadata.run_id).trim() : '';
    const turn_id = metadata && metadata.turn_id ? String(metadata.turn_id).trim() : '';
    if (turn_id && run_id) {
      correlate_turn_with_run(turn_id, run_id);
    }
    const prefix = run_id && !strip_ansi(text).includes(`[${run_id}]`)
      ? `\x1b[2m[${run_id}]\x1b[0m `
      : '';
    pipeline_messages.push(`${prefix}${text}`);
    if (pipeline_messages.length > 500) {
      pipeline_messages.shift();
    }
    if (metadata && metadata.reset_scroll !== false) {
      pipeline_log_scroll_offset = 0;
    }
    return pipeline_messages.length;
  };

  const scroll_chat = (delta = 0) => {
    chat_scroll_offset = Math.max(0, chat_scroll_offset + Number(delta || 0));
    return chat_scroll_offset;
  };

  const scroll_pipeline = (delta = 0) => {
    pipeline_log_scroll_offset = Math.max(0, pipeline_log_scroll_offset + Number(delta || 0));
    return pipeline_log_scroll_offset;
  };

  const set_chat_scroll_offset = (offset = 0) => {
    chat_scroll_offset = Math.max(0, Math.floor(Number(offset) || 0));
    return chat_scroll_offset;
  };

  const set_pipeline_scroll_offset = (offset = 0) => {
    pipeline_log_scroll_offset = Math.max(0, Math.floor(Number(offset) || 0));
    return pipeline_log_scroll_offset;
  };

  const set_active_pane = (pane = 'chat') => {
    active_pane = pane === 'pipeline' ? 'pipeline' : 'chat';
    return active_pane;
  };

  const toggle_active_pane = () => {
    active_pane = active_pane === 'chat' ? 'pipeline' : 'chat';
    return active_pane;
  };

  const set_split_ratio = (next_ratio) => {
    split_ratio = clamp_ratio(next_ratio);
    return split_ratio;
  };

  const render_dual_pane_window = (render_options = {}) => {
    const cols = Math.max(60, Number(render_options.columns || 100));
    const max_rows = Math.max(6, Number(render_options.max_rows || 14));
    const active_role = String(render_options.active_agent_role || 'product-manager');
    const phase_label = String(render_options.phase_label || 'phase-00');
    const gate_status = String(render_options.gate_status || 'pending');
    const active_ticket = render_options.active_ticket
      ? String(render_options.active_ticket)
      : 'idle';
    const progress_pct = Number.isFinite(Number(render_options.progress_pct))
      ? Math.max(0, Math.min(100, Math.round(Number(render_options.progress_pct))))
      : 0;

    // partition external chat_messages if caller passed a combined list
    const external_chat = Array.isArray(render_options.chat_messages)
      ? render_options.chat_messages
      : chat_messages;
    const external_pipeline = Array.isArray(render_options.pipeline_messages)
      ? render_options.pipeline_messages
      : pipeline_messages;

    const effective_chat = [];
    const effective_pipeline = [...external_pipeline];

    for (const msg of external_chat) {
      if (is_pipeline_telemetry_entry(msg)) {
        effective_pipeline.push(msg);
      } else {
        effective_chat.push(msg);
      }
    }

    const total_inner = Math.max(40, cols - 3);
    const left_w = Math.max(22, Math.min(total_inner - 20, Math.floor(total_inner * split_ratio)));
    const right_w = Math.max(18, total_inner - left_w);

    const CYAN = '\x1b[36m';
    const GREEN = '\x1b[32m';
    const YELLOW = '\x1b[33m';
    const MAGENTA = '\x1b[35m';
    const DIM = '\x1b[2m';
    const BOLD = '\x1b[1m';
    const RESET = '\x1b[0m';

    const fit_cell = (text = '', width = 20) => {
      const str = String(text || '');
      const plain = strip_ansi(str);
      if (plain.length > width) {
        return `${plain.slice(0, Math.max(0, width - 1))}…`;
      }
      const pad = ' '.repeat(Math.max(0, width - plain.length));
      return `${str}${pad}`;
    };

    const effective_chat_offset = render_options.chat_scroll_offset !== undefined
      ? Math.max(0, Number(render_options.chat_scroll_offset || 0))
      : chat_scroll_offset;
    const effective_pipeline_offset = render_options.pipeline_scroll_offset !== undefined
      ? Math.max(0, Number(render_options.pipeline_scroll_offset || 0))
      : pipeline_log_scroll_offset;

    const left_content_w = Math.max(12, left_w - 3);
    const right_content_w = Math.max(12, right_w - 3);

    const wrapped_chat = wrap_pane_entries(effective_chat, left_content_w);
    const wrapped_pipeline = wrap_pane_entries(effective_pipeline, right_content_w);

    const body_rows = Math.max(3, max_rows - 1);
    const right_log_rows = Math.max(2, body_rows - 1);

    const max_chat_offset = Math.max(0, wrapped_chat.length - body_rows);
    const clamped_chat_offset = Math.min(effective_chat_offset, max_chat_offset);
    const chat_end = Math.max(0, wrapped_chat.length - clamped_chat_offset);
    const chat_start = Math.max(0, chat_end - body_rows);
    const visible_chat = wrapped_chat.slice(chat_start, chat_end);

    const max_pipe_offset = Math.max(0, wrapped_pipeline.length - right_log_rows);
    const clamped_pipe_offset = Math.min(effective_pipeline_offset, max_pipe_offset);
    const pipe_end = Math.max(0, wrapped_pipeline.length - clamped_pipe_offset);
    const pipe_start = Math.max(0, pipe_end - right_log_rows);
    const visible_pipeline = wrapped_pipeline.slice(pipe_start, pipe_end);

    const left_focus_marker = active_pane === 'chat' ? `${GREEN}●${RESET}` : `${DIM}○${RESET}`;
    const right_focus_marker = active_pane === 'pipeline' ? `${GREEN}●${RESET}` : `${DIM}○${RESET}`;

    const left_title = ` 💬 mastra agentic chat (${active_role}) `;
    const right_title = ` ⚡ live sdlc pipeline (${phase_label}) `;

    const left_title_plain = strip_ansi(left_title);
    const right_title_plain = strip_ansi(right_title);

    const left_border_top = `${left_title.slice(0, left_w)}${'─'.repeat(Math.max(0, left_w - Math.min(left_w, left_title_plain.length)))}`;
    const right_border_top = `${right_title.slice(0, right_w)}${'─'.repeat(Math.max(0, right_w - Math.min(right_w, right_title_plain.length)))}`;

    const lines = [
      `${CYAN}┌${left_border_top}┬${right_border_top}┐${RESET}`,
    ];

    // sub-header row showing focus, scroll status, and live pipeline ribbon
    const chat_scroll_tag = clamped_chat_offset > 0
      ? `${YELLOW}scroll -${clamped_chat_offset}${RESET}`
      : `${DIM}live (${wrapped_chat.length} lines)${RESET}`;
    const pipe_scroll_tag = clamped_pipe_offset > 0
      ? `${YELLOW}scroll -${clamped_pipe_offset}${RESET}`
      : `${MAGENTA}${gate_status}${RESET} ${DIM}| ${active_ticket} (${progress_pct}%)${RESET}`;

    const left_sub = fit_cell(` ${left_focus_marker} dialogue | ${chat_scroll_tag}`, left_w);
    const right_sub = fit_cell(` ${right_focus_marker} ${pipe_scroll_tag}`, right_w);
    lines.push(`${CYAN}│${RESET}${left_sub}${CYAN}│${RESET}${right_sub}${CYAN}│${RESET}`);

    // separator under sub-header on right pane and left pane
    lines.push(
      `${CYAN}├${'─'.repeat(left_w)}┼${'─'.repeat(right_w)}┤${RESET}`,
    );

    const chat_scrollable = wrapped_chat.length > body_rows;
    const pipe_scrollable = wrapped_pipeline.length > right_log_rows;

    for (let r = 0; r < right_log_rows; r += 1) {
      let left_line = visible_chat[r];
      if (left_line === undefined) {
        left_line = r === 0 && wrapped_chat.length === 0
          ? `${DIM}(no chat messages yet — type below to converse with ${active_role})${RESET}`
          : '';
      }

      let right_line = visible_pipeline[r];
      if (right_line === undefined) {
        right_line = r === 0 && wrapped_pipeline.length === 0
          ? `${DIM}(awaiting sdlc pipeline events — ask an agent to execute sdlc)${RESET}`
          : '';
      }

      let left_thumb = ' ';
      if (chat_scrollable) {
        const ratio = max_chat_offset > 0 ? (max_chat_offset - clamped_chat_offset) / max_chat_offset : 1;
        const pos = Math.round(ratio * Math.max(0, right_log_rows - 1));
        left_thumb = r === pos ? `${CYAN}█${RESET}` : `${DIM}│${RESET}`;
      }

      let right_thumb = ' ';
      if (pipe_scrollable) {
        const ratio = max_pipe_offset > 0 ? (max_pipe_offset - clamped_pipe_offset) / max_pipe_offset : 1;
        const pos = Math.round(ratio * Math.max(0, right_log_rows - 1));
        right_thumb = r === pos ? `${MAGENTA}█${RESET}` : `${DIM}│${RESET}`;
      }

      const left_cell = `${fit_cell(` ${left_line}`, left_w - 1)}${left_thumb}`;
      const right_cell = `${fit_cell(` ${right_line}`, right_w - 1)}${right_thumb}`;
      lines.push(`${CYAN}│${RESET}${left_cell}${CYAN}│${RESET}${right_cell}${CYAN}│${RESET}`);
    }

    lines.push(`${CYAN}└${'─'.repeat(left_w)}┴${'─'.repeat(right_w)}┘${RESET}`);
    return lines.join('\n');
  };

  const get_state = () => ({
    split_ratio,
    active_pane,
    chat_scroll_offset,
    pipeline_log_scroll_offset,
    chat_message_count: chat_messages.length,
    pipeline_message_count: pipeline_messages.length,
    chat_messages: [...chat_messages],
    pipeline_messages: [...pipeline_messages],
  });

  return {
    append_chat_message,
    append_pipeline_message,
    get_chat_messages: () => [...chat_messages],
    get_pipeline_messages: () => [...pipeline_messages],
    scroll_chat,
    scroll_pipeline,
    set_chat_scroll_offset,
    set_pipeline_scroll_offset,
    get_chat_scroll_offset: () => chat_scroll_offset,
    get_pipeline_scroll_offset: () => pipeline_log_scroll_offset,
    set_active_pane,
    get_active_pane: () => active_pane,
    toggle_active_pane,
    set_split_ratio,
    get_split_ratio: () => split_ratio,
    correlate_turn_with_run,
    get_correlated_run,
    render_dual_pane_window,
    get_state,
  };
}
