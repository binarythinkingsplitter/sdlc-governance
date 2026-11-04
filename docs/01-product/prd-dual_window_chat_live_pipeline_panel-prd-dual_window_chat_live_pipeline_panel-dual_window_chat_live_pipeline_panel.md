# product requirements document: dual-window-chat-live-pipeline-panel

**document id:** `prd-dual_window_chat_live_pipeline_panel`  
**system / component:** `@sdlc/dual-engine-harness`  
**status:** approved  
**author:** product-manager  
**date:** 2026-11-04  

---

## 1. problem framing & strategic objectives

### vision
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
- Visual distinction and independent scroll states function correctly in bo

### problem statement
unconstrained agent drift vs rigid workflow gridlock

### strategic context
clean modular sdlc development

### primary objectives
- leverage native es6 collections and classes in the core model
- enforce mathematical transition guards and quality gates

---

## 2. user personas & target audience

### persona 1: software engineer
- **id:** `persona-swe`
- **description:** executes tdd red-green cycles and adheres to governance standards
- **responsibilities:**
  - author tests
  - write clean modular code

---

## 3. functional requirements

### fr-01: create a dual-pane container within the chat and pipeline interface
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-01: create a dual-pane container within the chat and pipeline interface

### fr-02: implement independent message routing for sdlc pipeline logs versus agentic chat dialogue
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-02: implement independent message routing for sdlc pipeline logs versus agentic chat dialogue

### fr-03: ensure independent scrolling and clean visual styling for each pane
- **priority:** must_have
- **status:** approved
- **description:** requirement fr-03: ensure independent scrolling and clean visual styling for each pane

---

## 4. non-functional requirements

- **performance:** p95 phase transition latency under 50ms
- **immutability:** zero reduction in test assertions
- **sovereignty:** zero external runtime daemon dependencies
- **style:** strictly lowercase british english

---

## 5. scope boundaries

### in scope
- prd-dual_window_chat_live_pipeline_panel-dual_window_chat_live_pipeline_panel

### out of scope
- legacy external services
