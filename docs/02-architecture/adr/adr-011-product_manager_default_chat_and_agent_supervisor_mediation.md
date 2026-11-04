# adr: adr: adr: adr-011: product-manager default chat persona and agent-to-supervisor mediation bridge

**document id:** `adr-011`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-04  
**linked prd:** `prd-11`  

---

## 1. context & problem statement

the dual-engine harness separates tier 1 deterministic governance (`MacroStatechartEngine`, `WorkBoard`, `ReviewGatekeeper`, `SdlcSupervisor`) from tier 2 specialist mastra role agents (`product-manager`, `system-architect`, `software-engineer`, `qa-engineer`, `security-engineer`, `devops-engineer`).

previously, the cli chat interface (`bin/cli.js` and `InteractiveDiscoveryChat.js`) defaulted the user's active conversation partner to `sdlc-supervisor` and attached unguarded execution tools (`execute_sdlc_process`, `sync_prd_and_code`) plus broad regex safeguards (`is_sdlc_execution_request`, `detect_prd_code_sync_request`) to every turn. as a result, when a user entered a free-form prompt to `product-manager` describing what they wanted to discuss or asking for feature suggestions, the harness prematurely created a prd in `.sdlc/store` and ran the full `develop-feature` workflow.

---

---

---

## 2. decision

we adopt a specialist-first conversational architecture with explicit agent-to-supervisor mediation:

1. **default conversational agent is `product-manager`**:
   - `bin/cli.js`, `InteractiveDiscoveryChat.js`, and `CliStatusBarLayout.js` default `active_agent` to `'product-manager'`.
   - `sdlc-supervisor` operates strictly as the background governance orchestrator and only responds directly on the `helloworld` -> `42` orchestrator verification probe or when `allow_direct_supervisor: true` is explicitly configured.
2. **conversational discovery & `suggest_features` tool**:
   - free-form prompts describing product ideas or asking for feature suggestions are routed to conversational discovery and the `suggest_features` tool, which inspects existing workspace entities read-only and synthesises structured candidate feature proposals without writing to `.sdlc/store`.
   - turn-level tool gating (`allow_process_execution_this_turn` and `allow_sync_this_turn`) removes or blocks `execute_sdlc_process` and `sync_prd_and_code` during exploratory/discussion turns so neither a live llm nor a fallback handler can trigger unrequested prd creation.
3. **agent-to-supervisor mediation (`supervisor.handle_agent_request` & `request_sdlc_supervisor`)**:
   - `SdlcSupervisor` exposes `handle_agent_request(request)` and `get_agent_request_log()`.
   - when a specialist agent (`product-manager`, `system-architect`, etc.) needs to check governance readiness, seed a work item, evaluate a gate, or submit an approved specification for full sdlc execution, it sends a structured request over `AgentMessageBus` to `sdlc-supervisor` via `request_sdlc_supervisor` / `handle_agent_request`.

---

---

---

## 3. consequences

### positive
- high cohesion and explicit contracts

### negative
- requires rigorous automated gate verification


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
