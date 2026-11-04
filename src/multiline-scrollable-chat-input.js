/**
 * ============================================================================
 * @file multiline-scrollable-chat-input.js
 * @version 0.1.0
 * @author dual-engine-harness
 * @description multi-line, vertically scrollable chat input component for the
 *   terminal user interface. supports environment-driven configuration
 *   (CHAT_INPUT_MAX_HEIGHT, CHAT_INPUT_DEFAULT_ROWS, CHAT_INPUT_SCROLL_STEP,
 *   CHAT_INPUT_BUFFER_LIMIT), dynamic height expansion and contraction,
 *   cursor-tracked viewport scrolling, and multi-line paste sanitization.
 * ============================================================================
 */

const strip_ansi = (text = '') => String(text || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]|\x1b[78]/g, '');

/**
 * ============================================================================
 * @function resolve_chat_input_config
 * @version 0.1.0
 * @author dual-engine-harness
 * @description resolves and validates the multi-line chat input configuration
 *   from explicit options and environment variables with safe fallback defaults.
 * @param {object} [options={}] - explicit configuration overrides.
 * @param {object} [env=process.env] - environment variables dictionary.
 * @returns {object} validated chat input configuration parameters.
 * // ---
 * // 1. parse integer candidates from options and environment variables
 * // 2. clamp default_rows and max_height to safe terminal bounds
 * // 3. clamp scroll_step and buffer_limit to positive integers
 * // 4. ensure max_height is always >= default_rows
 * // 5. return normalised configuration object
 * ============================================================================
 */
export function resolve_chat_input_config(options = {}, env = process.env) {
  const safe_env = env && typeof env === 'object' ? env : {};
  const parse_positive_int = (primary, env_val, fallback, min_val, max_val) => {
    const candidate = primary !== undefined && primary !== null
      ? Number(primary)
      : env_val !== undefined && env_val !== null && String(env_val).trim() !== ''
        ? Number(env_val)
        : fallback;
    if (!Number.isFinite(candidate) || Number.isNaN(candidate) || candidate < min_val) {
      return fallback;
    }
    return Math.min(max_val, Math.floor(candidate));
  };

  const default_rows = parse_positive_int(
    options.default_rows,
    safe_env.CHAT_INPUT_DEFAULT_ROWS,
    1,
    1,
    20,
  );
  const raw_max_height = parse_positive_int(
    options.max_height,
    safe_env.CHAT_INPUT_MAX_HEIGHT,
    6,
    1,
    24,
  );
  const max_height = Math.max(default_rows, raw_max_height);
  const scroll_step = parse_positive_int(
    options.scroll_step,
    safe_env.CHAT_INPUT_SCROLL_STEP,
    1,
    1,
    10,
  );
  const buffer_limit = parse_positive_int(
    options.buffer_limit,
    safe_env.CHAT_INPUT_BUFFER_LIMIT,
    16384,
    64,
    1048576,
  );

  return {
    default_rows,
    max_height,
    scroll_step,
    buffer_limit,
  };
}

/**
 * ============================================================================
 * @function sanitize_chat_paste_payload
 * @version 0.1.0
 * @author dual-engine-harness
 * @description sanitizes raw multi-line pasted text by normalising line breaks,
 *   expanding tabs, stripping terminal control sequences, and enforcing the
 *   configured character buffer limit.
 * @param {string} raw_text - raw input or pasted string payload.
 * @param {number} [buffer_limit=16384] - maximum allowed character length.
 * @returns {object} sanitized text, truncation flag, and warning message.
 * // ---
 * // 1. coerce raw_text to string and normalise crlf/cr line endings to lf
 * // 2. strip dangerous ansi escape sequences and non-printable control chars
 * // 3. convert tabs into two spaces to preserve visual indentation
 * // 4. enforce character buffer limit with clean truncation
 * // 5. return structured sanitization result
 * ============================================================================
 */
export function sanitize_chat_paste_payload(raw_text, buffer_limit = 16384) {
  const safe_limit = Number.isFinite(Number(buffer_limit)) && Number(buffer_limit) > 0
    ? Math.floor(Number(buffer_limit))
    : 16384;
  const input_str = typeof raw_text === 'string' ? raw_text : String(raw_text || '');

  // normalise line endings and strip bracketed paste markers if present
  const without_paste_markers = input_str
    .replace(/\x1b\[200~/g, '')
    .replace(/\x1b\[201~/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // strip ansi control sequences while keeping newlines and tabs
  const stripped_ansi = strip_ansi(without_paste_markers);
  let cleaned = '';
  for (let i = 0; i < stripped_ansi.length; i += 1) {
    const code = stripped_ansi.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < stripped_ansi.length ? stripped_ansi.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        cleaned += stripped_ansi[i] + stripped_ansi[i + 1];
        i += 1;
      } else {
        cleaned += '\uFFFD';
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      cleaned += '\uFFFD';
    } else if (code === 10) {
      cleaned += '\n';
    } else if (code === 9) {
      cleaned += '  ';
    } else if (code >= 32 && code !== 127) {
      cleaned += stripped_ansi[i];
    }
  }

  const truncated = cleaned.length > safe_limit;
  const text = truncated ? cleaned.slice(0, safe_limit) : cleaned;
  const warning = truncated
    ? `input truncated to ${safe_limit} characters (CHAT_INPUT_BUFFER_LIMIT)`
    : null;

  return {
    text,
    truncated,
    original_length: cleaned.length,
    limit: safe_limit,
    warning,
  };
}

/**
 * ============================================================================
 * @function wrap_buffer_into_visual_lines
 * @version 0.1.0
 * @author dual-engine-harness
 * @description splits a multi-line text buffer into visual terminal rows with
 *   exact character-index mappings so cursor position and vertical scroll
 *   offsets remain synchronised across hard newlines and soft line wraps.
 * @param {string} buffer - raw multi-line text buffer.
 * @param {number} [line_width=60] - usable character width per visual row.
 * @param {number} [cursor_index=0] - current 0-based character cursor index.
 * @returns {object} visual lines array and resolved cursor row/col coordinates.
 * // ---
 * // 1. clamp line_width and cursor_index to valid bounds
 * // 2. split buffer by hard newline characters
 * // 3. wrap each logical line into visual segments of at most line_width
 * // 4. locate the visual row and column corresponding to cursor_index
 * // 5. return visual rows metadata and cursor coordinates
 * ============================================================================
 */
export function wrap_buffer_into_visual_lines(buffer = '', line_width = 60, cursor_index = null) {
  const text = typeof buffer === 'string' ? buffer : String(buffer || '');
  const width = Math.max(8, Math.floor(Number(line_width) || 60));
  const clamped_cursor = cursor_index === null || cursor_index === undefined
    ? text.length
    : Math.max(0, Math.min(text.length, Math.floor(Number(cursor_index))));

  const visual_lines = [];
  let pos = 0;
  const logical_parts = text.split('\n');

  for (let i = 0; i < logical_parts.length; i += 1) {
    const part = logical_parts[i];
    const part_start = pos;
    if (part.length === 0) {
      visual_lines.push({
        text: '',
        start_index: part_start,
        end_index: part_start,
        logical_line: i,
        is_wrapped: false,
      });
    } else {
      let offset = 0;
      while (offset < part.length) {
        const slice = part.slice(offset, offset + width);
        const seg_start = part_start + offset;
        const seg_end = seg_start + slice.length;
        visual_lines.push({
          text: slice,
          start_index: seg_start,
          end_index: seg_end,
          logical_line: i,
          is_wrapped: offset > 0,
        });
        offset += width;
      }
    }
    pos += part.length + 1;
  }

  if (visual_lines.length === 0) {
    visual_lines.push({
      text: '',
      start_index: 0,
      end_index: 0,
      logical_line: 0,
      is_wrapped: false,
    });
  }

  let cursor_row = visual_lines.length - 1;
  let cursor_col = visual_lines[cursor_row].text.length;

  for (let r = 0; r < visual_lines.length; r += 1) {
    const row = visual_lines[r];
    const next_row = visual_lines[r + 1];
    const is_same_logical_next = Boolean(next_row && next_row.logical_line === row.logical_line);

    if (clamped_cursor >= row.start_index && clamped_cursor < row.end_index) {
      cursor_row = r;
      cursor_col = clamped_cursor - row.start_index;
      break;
    }
    if (clamped_cursor === row.end_index && !is_same_logical_next) {
      cursor_row = r;
      cursor_col = clamped_cursor - row.start_index;
      break;
    }
  }

  return {
    visual_lines,
    total_visual_rows: visual_lines.length,
    cursor_index: clamped_cursor,
    cursor_row,
    cursor_col,
    line_width: width,
  };
}

/**
 * ============================================================================
 * @function create_multiline_scrollable_chat_input
 * @version 0.1.0
 * @author dual-engine-harness
 * @description creates a stateful multi-line scrollable chat input controller
 *   that manages text editing, multi-line paste sanitization, dynamic height
 *   expansion/contraction, vertical scrolling, and ansi box rendering.
 * @param {object} [options={}] - configuration and environment options.
 * @returns {object} public multi-line chat input api.
 * // ---
 * // 1. resolve configuration from options and environment variables
 * // 2. initialise internal text buffer, cursor index, and scroll offset state
 * // 3. define cursor-tracking and viewport height calculation helpers
 * // 4. implement editing, navigation, scrolling, and paste operations
 * // 5. implement bordered ansi multi-line rendering with scrollbar indicator
 * ============================================================================
 */
export function create_multiline_scrollable_chat_input(options = {}) {
  const config = resolve_chat_input_config(options, options.env || process.env);

  let buffer = typeof options.initial_value === 'string' ? options.initial_value : '';
  let cursor_index = buffer.length;
  let scroll_offset = 0;
  let last_line_width = Math.max(12, Number(options.line_width || 68));
  let last_warning = null;

  const compute_viewport_metrics = (line_width = last_line_width) => {
    last_line_width = Math.max(12, Math.floor(Number(line_width) || 68));
    const wrapped = wrap_buffer_into_visual_lines(buffer, last_line_width, cursor_index);
    const desired_rows = Math.max(config.default_rows, wrapped.total_visual_rows);
    const viewport_rows = Math.min(config.max_height, desired_rows);
    const max_scroll_offset = Math.max(0, wrapped.total_visual_rows - viewport_rows);

    if (scroll_offset > max_scroll_offset) {
      scroll_offset = max_scroll_offset;
    }
    if (scroll_offset < 0) {
      scroll_offset = 0;
    }

    return {
      value: buffer,
      ...wrapped,
      viewport_rows,
      max_scroll_offset,
      scroll_offset,
      is_scrollable: wrapped.total_visual_rows > viewport_rows,
    };
  };

  const ensure_cursor_visible = (line_width = last_line_width) => {
    const metrics = compute_viewport_metrics(line_width);
    if (metrics.cursor_row < scroll_offset) {
      scroll_offset = metrics.cursor_row;
    } else if (metrics.cursor_row >= scroll_offset + metrics.viewport_rows) {
      scroll_offset = metrics.cursor_row - metrics.viewport_rows + 1;
    }
    return compute_viewport_metrics(line_width);
  };

  const set_value = (next_value = '', next_cursor = null) => {
    const sanitized = sanitize_chat_paste_payload(next_value, config.buffer_limit);
    buffer = sanitized.text;
    last_warning = sanitized.warning;
    cursor_index = next_cursor === null || next_cursor === undefined
      ? buffer.length
      : Math.max(0, Math.min(buffer.length, Math.floor(Number(next_cursor))));
    return ensure_cursor_visible(last_line_width);
  };

  const insert_text = (raw_insertion = '') => {
    const remaining_capacity = Math.max(0, config.buffer_limit - buffer.length);
    const sanitized = sanitize_chat_paste_payload(raw_insertion, Math.max(1, remaining_capacity));
    if (remaining_capacity === 0) {
      last_warning = `input buffer full at ${config.buffer_limit} characters (CHAT_INPUT_BUFFER_LIMIT)`;
      return ensure_cursor_visible(last_line_width);
    }
    const insertion = sanitized.text;
    last_warning = sanitized.warning;
    buffer = buffer.slice(0, cursor_index) + insertion + buffer.slice(cursor_index);
    cursor_index += insertion.length;
    return ensure_cursor_visible(last_line_width);
  };

  const insert_newline = () => insert_text('\n');

  const delete_backward = () => {
    if (cursor_index <= 0) {
      return ensure_cursor_visible(last_line_width);
    }
    buffer = buffer.slice(0, cursor_index - 1) + buffer.slice(cursor_index);
    cursor_index -= 1;
    last_warning = null;
    return ensure_cursor_visible(last_line_width);
  };

  const delete_forward = () => {
    if (cursor_index >= buffer.length) {
      return ensure_cursor_visible(last_line_width);
    }
    buffer = buffer.slice(0, cursor_index) + buffer.slice(cursor_index + 1);
    last_warning = null;
    return ensure_cursor_visible(last_line_width);
  };

  const move_cursor_horizontal = (delta) => {
    cursor_index = Math.max(0, Math.min(buffer.length, cursor_index + Number(delta || 0)));
    return ensure_cursor_visible(last_line_width);
  };

  const move_cursor_vertical = (row_delta, line_width = last_line_width) => {
    const metrics = compute_viewport_metrics(line_width);
    const target_row = Math.max(
      0,
      Math.min(metrics.total_visual_rows - 1, metrics.cursor_row + Number(row_delta || 0)),
    );
    const row_info = metrics.visual_lines[target_row];
    const target_col = Math.min(metrics.cursor_col, row_info.text.length);
    cursor_index = row_info.start_index + target_col;
    return ensure_cursor_visible(line_width);
  };

  const scroll_up = (steps = config.scroll_step, line_width = last_line_width) => {
    const metrics = compute_viewport_metrics(line_width);
    const step_count = Math.max(1, Math.floor(Number(steps) || config.scroll_step));
    scroll_offset = Math.max(0, metrics.scroll_offset - step_count);
    return compute_viewport_metrics(line_width);
  };

  const scroll_down = (steps = config.scroll_step, line_width = last_line_width) => {
    const metrics = compute_viewport_metrics(line_width);
    const step_count = Math.max(1, Math.floor(Number(steps) || config.scroll_step));
    scroll_offset = Math.min(metrics.max_scroll_offset, metrics.scroll_offset + step_count);
    return compute_viewport_metrics(line_width);
  };

  const reset = () => {
    buffer = '';
    cursor_index = 0;
    scroll_offset = 0;
    last_warning = null;
    return compute_viewport_metrics(last_line_width);
  };

  const handle_keypress = (str, key = {}, line_width = last_line_width) => {
    const key_name = key && typeof key.name === 'string' ? key.name.toLowerCase() : '';
    const is_shift = Boolean(key && key.shift);
    const is_meta = Boolean(key && (key.meta || key.alt));
    const is_ctrl = Boolean(key && key.ctrl);

    // multi-line newline insertion: shift+enter, alt/meta+enter, ctrl+j, or literal newline in paste
    if (
      (key_name === 'return' && (is_shift || is_meta)) ||
      (key_name === 'enter' && (is_shift || is_meta)) ||
      (is_ctrl && key_name === 'j') ||
      str === '\x1b\r' ||
      str === '\x1b\n'
    ) {
      insert_newline();
      return { action: 'newline', value: buffer, state: get_state(line_width) };
    }

    // plain enter submits the current buffer
    if (key_name === 'return' || key_name === 'enter') {
      const submitted = buffer;
      return { action: 'submit', value: submitted, state: get_state(line_width) };
    }

    if (key_name === 'backspace') {
      delete_backward();
      return { action: 'edit', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'delete') {
      delete_forward();
      return { action: 'edit', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'left') {
      move_cursor_horizontal(-1);
      return { action: 'cursor', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'right') {
      move_cursor_horizontal(1);
      return { action: 'cursor', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'up') {
      const before = compute_viewport_metrics(line_width);
      if (before.cursor_row > 0) {
        move_cursor_vertical(-1, line_width);
        return { action: 'cursor', value: buffer, state: get_state(line_width) };
      }
      if (before.scroll_offset > 0) {
        scroll_up(config.scroll_step, line_width);
        return { action: 'scroll', value: buffer, state: get_state(line_width) };
      }
      return { action: 'boundary_top', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'down') {
      const before = compute_viewport_metrics(line_width);
      if (before.cursor_row < before.total_visual_rows - 1) {
        move_cursor_vertical(1, line_width);
        return { action: 'cursor', value: buffer, state: get_state(line_width) };
      }
      if (before.scroll_offset < before.max_scroll_offset) {
        scroll_down(config.scroll_step, line_width);
        return { action: 'scroll', value: buffer, state: get_state(line_width) };
      }
      return { action: 'boundary_bottom', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'pageup') {
      scroll_up(config.scroll_step, line_width);
      return { action: 'scroll', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'pagedown') {
      scroll_down(config.scroll_step, line_width);
      return { action: 'scroll', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'home' || (is_ctrl && key_name === 'a')) {
      const metrics = compute_viewport_metrics(line_width);
      const current_row = metrics.visual_lines[metrics.cursor_row];
      cursor_index = current_row ? current_row.start_index : 0;
      ensure_cursor_visible(line_width);
      return { action: 'cursor', value: buffer, state: get_state(line_width) };
    }

    if (key_name === 'end' || (is_ctrl && key_name === 'e')) {
      const metrics = compute_viewport_metrics(line_width);
      const current_row = metrics.visual_lines[metrics.cursor_row];
      cursor_index = current_row ? current_row.end_index : buffer.length;
      ensure_cursor_visible(line_width);
      return { action: 'cursor', value: buffer, state: get_state(line_width) };
    }

    // handle multi-character paste or printable character input
    if (typeof str === 'string' && str.length > 0 && !is_ctrl && !is_meta) {
      if (str.includes('\n') || str.includes('\r') || str.length > 1) {
        insert_text(str);
        return { action: 'paste', value: buffer, state: get_state(line_width) };
      }
      if (str >= ' ' && str !== '\x7f') {
        insert_text(str);
        return { action: 'edit', value: buffer, state: get_state(line_width) };
      }
    }

    return { action: 'noop', value: buffer, state: get_state(line_width) };
  };

  const get_state = (line_width = last_line_width) => {
    const metrics = compute_viewport_metrics(line_width);
    return {
      value: buffer,
      cursor_index: metrics.cursor_index,
      cursor_row: metrics.cursor_row,
      cursor_col: metrics.cursor_col,
      scroll_offset: metrics.scroll_offset,
      max_scroll_offset: metrics.max_scroll_offset,
      viewport_rows: metrics.viewport_rows,
      total_visual_rows: metrics.total_visual_rows,
      is_scrollable: metrics.is_scrollable,
      visual_lines: metrics.visual_lines,
      config: { ...config },
      warning: last_warning,
    };
  };

  const render_window = (render_options = {}) => {
    const cols = Math.max(40, Number(render_options.columns || 80));
    const inner_w = Math.max(20, cols - 4);
    const active_role = String(render_options.active_agent_role || 'product-manager');
    const prompt_prefix = `${active_role}> `;
    const continuation_prefix = `${' '.repeat(Math.max(0, active_role.length))}· `;
    const prefix_len = strip_ansi(prompt_prefix).length;
    const usable_text_width = Math.max(12, inner_w - prefix_len - 3);

    const metrics = compute_viewport_metrics(usable_text_width);
    const visible_slice = metrics.visual_lines.slice(
      metrics.scroll_offset,
      metrics.scroll_offset + metrics.viewport_rows,
    );

    const CYAN = '\x1b[36m';
    const GREEN = '\x1b[32m';
    const YELLOW = '\x1b[33m';
    const DIM = '\x1b[2m';
    const BOLD = '\x1b[1m';
    const RESET = '\x1b[0m';

    const fit = (text = '', width = inner_w) => {
      const plain = strip_ansi(String(text));
      if (plain.length > width) {
        return `${plain.slice(0, Math.max(0, width - 1))}…`;
      }
      return `${String(text)}${' '.repeat(Math.max(0, width - plain.length))}`;
    };

    const scroll_badge = metrics.is_scrollable
      ? `rows ${metrics.scroll_offset + 1}-${Math.min(metrics.total_visual_rows, metrics.scroll_offset + metrics.viewport_rows)}/${metrics.total_visual_rows} [↑/↓/pgup/pgdn]`
      : `rows ${metrics.viewport_rows}/${config.max_height} [alt+enter/ctrl+j newline]`;
    const top_label = last_warning
      ? ` 💬 chat input (${YELLOW}${last_warning}${RESET}${CYAN}) `
      : ` 💬 chat input (${scroll_badge}) `;
    const top_plain_len = strip_ansi(top_label).length;
    const top_dashes = '─'.repeat(Math.max(0, cols - 2 - top_plain_len));

    const lines = [
      `${CYAN}┌${top_label}${top_dashes}┐${RESET}`,
    ];

    for (let i = 0; i < metrics.viewport_rows; i += 1) {
      const global_row_idx = metrics.scroll_offset + i;
      const row_data = visible_slice[i] || { text: '', logical_line: i, is_wrapped: false };
      const is_first_row = global_row_idx === 0;
      const prefix_plain = is_first_row ? prompt_prefix : continuation_prefix;
      const prefix_styled = is_first_row
        ? `${BOLD}${GREEN}${active_role}>${RESET} `
        : `${DIM}${continuation_prefix}${RESET}`;

      let line_content = row_data.text;
      if (buffer.length === 0 && is_first_row && render_options.placeholder) {
        line_content = `${DIM}${String(render_options.placeholder).slice(0, usable_text_width)}${RESET}`;
      } else if (global_row_idx === metrics.cursor_row) {
        const before_cursor = row_data.text.slice(0, metrics.cursor_col);
        const at_cursor = row_data.text[metrics.cursor_col] || '█';
        const after_cursor = row_data.text.slice(metrics.cursor_col + (row_data.text[metrics.cursor_col] ? 1 : 0));
        line_content = `${before_cursor}${GREEN}${at_cursor}${RESET}${after_cursor}`;
      }

      // compute scrollbar indicator on the right edge when content exceeds viewport
      let scroll_glyph = ' ';
      if (metrics.is_scrollable) {
        const thumb_pos = metrics.max_scroll_offset > 0
          ? Math.round((metrics.scroll_offset / metrics.max_scroll_offset) * Math.max(0, metrics.viewport_rows - 1))
          : 0;
        scroll_glyph = i === thumb_pos ? `${CYAN}█${RESET}` : `${DIM}│${RESET}`;
      }

      const content_plain_len = strip_ansi(prefix_plain).length + strip_ansi(line_content).length;
      const pad_spaces = ' '.repeat(Math.max(0, inner_w - 1 - content_plain_len));
      lines.push(
        `${CYAN}│${RESET} ${prefix_styled}${line_content}${pad_spaces}${scroll_glyph} ${CYAN}│${RESET}`,
      );
    }

    lines.push(`${CYAN}└${'─'.repeat(Math.max(0, cols - 2))}┘${RESET}`);
    return lines.join('\n');
  };

  return {
    get_config: () => ({ ...config }),
    get_value: () => buffer,
    set_value,
    insert_text,
    insert_newline,
    delete_backward,
    delete_forward,
    move_cursor_horizontal,
    move_cursor_vertical,
    scroll_up,
    scroll_down,
    reset,
    clear: reset,
    handle_keypress,
    get_state,
    render_window,
  };
}
