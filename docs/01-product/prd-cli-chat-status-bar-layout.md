# product requirements document: cli-chat-status-bar-layout

**document id:** `prd-cli-chat-status-bar-layout`  
**system / component:** `@sdlc/dual-engine-harness` / cli interface  
**lifecycle phase:** phase 01 (specifications & product requirements)  
**governance gate:** gate 1 (planning & architecture)  
**status:** proposed / approved  
**author:** autonomous sdlc product engineering team  
**date:** 2026-11-04  

---

## 1. executive summary & problem statement

the cli chat interface currently lacks a persistent, dynamic status bar at the top of the terminal screen. during complex autonomous workflows and interactive terminal sessions, users experience severe situational awareness deficits. operators cannot easily track active project metadata, the current execution phase in the ten-stage software development lifecycle statechart, or active work items and background tasks without interrupting conversation flow or invoking manual inspection commands.

this document defines the product requirements for the `cli-chat-status-bar-layout` feature. the component provides a responsive, immutable visual telemetry banner pinned to the uppermost viewport boundary of the terminal session. it renders real-time state from the macro statechart engine and micro execution workers, empowering developers and cli users with immediate visibility into project health, active phase progress, and active work item status.

## 2. target audience & engineering personas

- **cli power users**: developers operating mastra directly via terminal emulators who require compact, glanceable session telemetry without obscuring chat scrollback buffers.
- **autonomous sdlc supervisors**: engineers overseeing dual-engine harness runs who need immediate verification of active xstate lifecycle phases, gate statuses, and agent task queues.
- **terminal ui (tui) developers**: contributors extending or maintaining terminal presentation layers who require clean separation between status rendering, state subscription hooks, and interactive message streams.

## 3. functional requirements

- **fr-01: fixed top viewport anchoring**: the cli chat interface must reserve the uppermost row(s) of the terminal viewport for the status bar component, ensuring it remains pinned during chat message scrolling and interactive prompt entry.
- **fr-02: project metadata telemetry**: the status bar must render active project identifier, workspace path or repository slug, and active session configuration profile.
- **fr-03: active sdlc phase indicator**: the component must display the current macro statechart phase (ranging from phase 00 inception through phase 10 continuous learning) with distinct visual styling reflecting active execution vs. suspended human-in-the-loop (hitl) governance states.
- **fr-04: active work items & task counter**: the status bar must show summary counts and identifiers of active work breakdown items, current active worker daemon states, and pending review gates.
- **fr-05: real-time state subscription**: the layout renderer must subscribe to the central event bus and state storage stores, updating telemetry indicators asynchronously upon state transitions without dropping terminal frame rates or blocking user input.
- **fr-06: responsive terminal truncation**: when terminal window width drops below minimum threshold columns, the layout must gracefully truncate metadata fields and retain critical phase and work item indicators without wrapping or breaking layout borders.

## 4. non-functional requirements

- **nfr-01: strict lowercase british english compliance**: all prose, documentation headings, bullet points, logs, and user-facing status messages within the component implementation and associated documentation must use strict lowercase british english spelling and zero uppercase characters in prose.
- **nfr-02: minimal layout latency**: status bar re-rendering upon state transition events must complete in under five milliseconds to preserve smooth terminal interactivity.
- **nfr-03: terminal width compatibility**: the layout must support standard terminal dimensions ranging from 80 columns by 24 rows up to unlimited widescreen widths without visual corruption or control character leakage.
- **nfr-04: banner documentation adherence**: every exported function and module within the layout codebase must contain structured banner comments with five required sections: version number, documentation (tldr, verbose), arguments, return value, and example.
- **nfr-05: robust test coverage**: implementation must include automated test suites verifying layout rendering invariants across various terminal width states and event payloads with zero test immutability violations.

## 5. scope & non-goals

### in-scope
- design and implementation of the cli chat status bar layout component.
- integration with xstate macro statechart engine and work board state stores.
- responsive width truncation logic and terminal viewport row reservation.
- automated unit and integration tests verifying status bar rendering and state binding.
- strict lowercase british english prose documentation.

### non-goals
- graphical desktop ui layouts or web-based dashboard status bars (covered by admin dashboard specs).
- interactive mouse click handling within the status bar region.
- custom terminal theme editors or user colour scheme configuration file parsers.

## 6. acceptance criteria & verification checklist

- **ac-01: status bar presence**: verify that launching the cli chat interface reserves the top viewport rows and renders the status bar before prompt input is enabled.
- **ac-02: metadata reflection**: verify that changing project configuration or active workspace updates the project slug and metadata fields in real time.
- **ac-03: phase state accuracy**: verify that triggering xstate macro phase transitions updates the active phase indicator and styling correctly.
- **ac-04: work item tracking**: verify that active task counts reflect work breakdown item updates from the work board daemon.
- **ac-05: responsive truncation**: verify that resizing the terminal window below 80 columns truncates auxiliary metadata cleanly without breaking layout borders or wrapping lines.
- **ac-06: language & documentation invariant check**: verify via automated audit scripts that all prose and exported functions adhere to strict lowercase british english and banner documentation standards.
