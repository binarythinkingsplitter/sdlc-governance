# product requirements document: cli-chat-status-bar-layout

**document id:** `prd-cli-chat-status-bar-layout`  
**system / component:** `@sdlc/dual-engine-harness / cli interface`  
**status:** approved  
**author:** autonomous sdlc product engineering team  
**date:** 2026-11-04  

---

## 1. problem framing & strategic objectives

### vision
the cli chat interface currently lacks a persistent, dynamic status bar at the top of the terminal screen. during complex autonomous workflows and interactive terminal sessions, users experience severe situational awareness deficits. operators cannot easily track active project metadata, the current execution phase in the ten-stage software development lifecycle statechart, or active work items and background tasks without interrupting conversation flow or invoking manual inspection commands.

this document defines the product requirements for the `cli-chat-status-bar-layout` feature. the component provides a responsive, immutable visual telemetry banner pinned to the uppermost viewport boundary of the terminal session. it renders real-time state from the macro statechart engine and micro execution workers, empowering developers and cli users with immediate visibility into project health, active phase progress, and active work item status.

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

### fr-01: prd-cli-chat-status-bar-layout core capability
- **priority:** must_have
- **status:** approved
- **description:** comprehensive implementation of prd-cli-chat-status-bar-layout

---

## 4. non-functional requirements

- **performance:** p95 phase transition latency under 50ms
- **immutability:** zero reduction in test assertions
- **sovereignty:** zero external runtime daemon dependencies
- **style:** strictly lowercase british english

---

## 5. scope boundaries

### in scope
- prd-cli-chat-status-bar-layout

### out of scope
- legacy external services
