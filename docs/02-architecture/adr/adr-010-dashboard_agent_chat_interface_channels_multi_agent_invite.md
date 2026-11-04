# adr: adr: adr: adr: dashboard agent chat interface with channels and multi-agent invite

**document id:** `adr-010`  
**status:** accepted  
**author:** autonomous system architect agent  
**date:** 2026-11-04  
**linked prd:** `prd-10`  

---

## 1. context & problem statement

the dual-engine software development lifecycle harness requires an administrative dashboard supporting real-time conversational collaboration between human operators and multiple autonomous mastra agents. operators must be able to create named discussion channels tied to sdlc phases, tasks, or review gates, and dynamically invite multiple specialised agents (such as planner, coder, reviewer, and evaluator) into the same channel. 

architectural trade-off analysis indicates that naive direct coupling between ui components, websocket handlers, and agent execution runtimes introduces tight coupling, blocking state updates, and race conditions during multi-agent streaming and concurrent channel message routing. a robust architectural decision is required to decouple ui interactions from agent message dispatching, state persistence, and event-driven communication.

---

---

---

## 2. decision

---

---


---


we adopt a decoupled dual-engine architecture separating the presentation layer from the agent communication runtime through an explicit event-driven message bus and persistent storage adapter layer:

2. **multi-agent invite and routing**: channels maintain a dynamic roster of participant agents. when an operator sends a prompt or invites a new agent, the message bus broadcasts the payload to all subscribed agent runners concurrently, preventing blocking single-threaded bottlenecks.
3. **asynchronous dual-engine bridge**: ui websocket connections interact exclusively with an intermediary message broker (`agentmessagebus`) and state store (`mastramemorystorage`), keeping the frontend asynchronous and resilient to slow llm generation loops or network drops.
4. **strict british lowercase prose and modular interfaces**: all module designs, internal communication schemas, and documentation adhere strictly to lowercase british english and explicit interface contracts.

---

---

---

## 3. consequences

### positive
- clean decoupling between frontend view components and backend agent execution workflows.
- concurrent multi-agent participation within shared channels without message collision or stream interleaving.
- robust audit trails and message history persistence supporting offline inspection and replay.
- predictable modular boundaries with explicit typed event schemas.

### negative
- increased message routing complexity requiring reliable event subscription management and deduplication.
- memory footprint scaling linearly with active channel count and message history size.
- mitigated by implementing bounded message retention policies and efficient in-memory ring buffers backed by atomic file persistence.


---

## 4. compliance & invariants

- strictly lowercase british english in prose
- banner-style jsdoc comments with semver v0.1.0
