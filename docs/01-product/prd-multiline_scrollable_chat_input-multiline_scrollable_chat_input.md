# product requirements document: multiline-scrollable-chat-input

**document id:** `prd-multiline_scrollable_chat_input`  
**system / component:** `@sdlc/dual-engine-harness`  
**status:** approved  
**author:** product-manager  
**date:** 2026-11-04  

---

## 1. problem framing & strategic objectives

### vision
modern multi-window terminal layout with pinned status bar, visual phase/gate pipeline, and treeview menus

### problem statement
Enable a multi-line, scrollable chat input configurable via environment variables.

### strategic context
Enable a multi-line, scrollable chat input configurable via environment variables. (target audience: application developers and platform consumers)

### primary objectives
- The chat input textarea expands vertically as lines are added up to a maximum height limit
- Scrollbars appear automatically when the maximum height is exceeded
- Enter key submits the message while Shift+Enter inserts a newline

---

## 2. user personas & target audience

---

## 3. functional requirements

### fr-01: Enable a multi-line, scrollable chat input configurable via environment variables.
- **priority:** must_have
- **status:** approved
- **description:** Enable a multi-line, scrollable chat input configurable via environment variables.

### fr-code-02: module multiline-scrollable-chat-input.js exports (resolve_chat_input_config, sanitize_chat_paste_payload, wrap_buffer_into_visual_lines, create_multiline_scrollable_chat_input)
- **priority:** must_have
- **status:** approved
- **description:** verified source implementation in src/multiline-scrollable-chat-input.js exporting resolve_chat_input_config, sanitize_chat_paste_payload, wrap_buffer_into_visual_lines, create_multiline_scrollable_chat_input

### fr-code-03: module clistatusbarlayout.js exports (strip_ansi, visible_length, colourise, truncate_visible, pad_visible, format_progress_bar)
- **priority:** must_have
- **status:** approved
- **description:** modern multi-window terminal layout with pinned status bar, visual phase/gate pipeline, and treeview menus — exported symbols: strip_ansi, visible_length, colourise, truncate_visible, pad_visible, format_progress_bar, resolve_status_badge, render_process_execution_step, create_cli_status_bar_layout, CLI_WINDOWS, create_cli_chat_status_bar_layout

---

## 4. non-functional requirements

- **performance:** 
- **immutability:** 
- **sovereignty:** 
- **style:** 

---

## 5. scope boundaries

### in scope
- src/multiline-scrollable-chat-input.js (4 exports)
- src/CliStatusBarLayout.js (11 exports)

### out of scope
