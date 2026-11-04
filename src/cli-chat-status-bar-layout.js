/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: canonical re-export of CliStatusBarLayout for cli-chat-status-bar-layout feature
 * verbose: exposes create_cli_chat_status_bar_layout and create_cli_status_bar_layout.
 *
 * section: arguments
 * - options (object, optional): layout options
 *
 * section: return value
 * - layout (object): cli status bar layout controller
 *
 * section: example
 * import { create_cli_chat_status_bar_layout } from './cli-chat-status-bar-layout.js';
 */

export {
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
