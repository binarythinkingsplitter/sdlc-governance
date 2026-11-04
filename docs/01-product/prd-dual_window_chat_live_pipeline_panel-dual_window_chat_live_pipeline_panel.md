# product requirements document: dual-window-chat-live-pipeline-panel

**document id:** `prd-dual_window_chat_live_pipeline_panel`  
**system / component:** `@sdlc/dual-engine-harness`  
**status:** approved  
**author:** product-manager  
**date:** 2026-11-04  

---

## 1. problem framing & strategic objectives

### vision
modern multi-window terminal layout with pinned status bar, visual phase/gate pipeline, and treeview menus

### problem statement
the f1 cli chat viewport previously interleaved conversational agent replies and background sdlc pipeline telemetry in a single stream without a split-pane view

### strategic context
Users need a clear, split-view interface that separates automated SDLC pipeline progression logs from conversational agentic chat messages so they can track background work without losing sight of interactive chat. (target audience: Developers and operators managing dual-engine harness pipelines)

### primary objectives
- Split container renders two independent scrollable panes for SDLC pipeline messages and agentic chat messages
- SDLC system events, build logs, and gate evaluations route exclusively to the SDLC pane
- Conversational agent dialogue routes exclusively to the agentic chat pane
- Visual distinction and independent scroll states function correctly in both panes

---

## 2. user personas & target audience

---

## 3. functional requirements

### fr-01: Create a dual-pane container within the chat and pipeline interface
- **priority:** must_have
- **status:** approved
- **description:** Create a dual-pane container within the chat and pipeline interface

### fr-02: Implement independent message routing for SDLC pipeline logs versus agentic chat dialogue
- **priority:** must_have
- **status:** approved
- **description:** Implement independent message routing for SDLC pipeline logs versus agentic chat dialogue

### fr-03: Ensure independent scrolling and clean visual styling for each pane
- **priority:** must_have
- **status:** approved
- **description:** Ensure independent scrolling and clean visual styling for each pane

### fr-code-04: module dual-window-chat-live-pipeline-panel.js exports (wrap_pane_entries, is_pipeline_telemetry_entry, create_dual_window_chat_live_pipeline_panel)
- **priority:** must_have
- **status:** approved
- **description:** verified source implementation in src/dual-window-chat-live-pipeline-panel.js exporting wrap_pane_entries, is_pipeline_telemetry_entry, create_dual_window_chat_live_pipeline_panel

### fr-code-05: module clistatusbarlayout.js exports (strip_ansi, visible_length, colourise, truncate_visible, pad_visible, format_progress_bar)
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
- src/dual-window-chat-live-pipeline-panel.js (3 exports)
- src/CliStatusBarLayout.js (11 exports)

### out of scope
