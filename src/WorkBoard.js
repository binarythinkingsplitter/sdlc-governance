/**
 * =========================================================================
 * module: work board
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: jira-style pull queue, dependency unblocker, and ticket lifecycle manager
 * verbose: manages work board epics and tickets backed by the tier 1 document entity store
 * and task dag engine. enforces acyclic task dependencies, single-developer feature affinity
 * (with optional multi-developer swarm mode for large features), atomic worker leases with
 * heartbeats, clarification pause/resume, and review/rework/escalation lifecycles.
 * 
 * section: export catalog
 * - create_work_board: factory creating a tier 1 work board instance
 * =========================================================================
 */

import crypto from 'node:crypto';
import { DocumentEntityTypes } from './DocumentEntitiesSchema.js';
import { create_task_dag_runner } from './TaskDagEngine.js';
import { create_content_pointer } from './GitGovernanceProvenance.js';

/**
 * =========================================================================
 * function: create_work_board
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a work board and dependency-aware pull queue
 * verbose: coordinates ticket dependencies via TaskDagEngine, hydrates plain input context
 * from DocumentEntityStore on pull, and commits verified outputs only after review approval.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 *   - store (object): tier 1 document entity store instance
 *   - message_bus (object, optional): inter-agent message bus instance
 *   - dag_runner (object, optional): custom task dag runner instance
 *   - default_lease_ms (number, optional): lease ttl in milliseconds (default 60000)
 *   - default_max_retries (number, optional): rework limit before escalation (default 3)
 *   - logger (object, optional): structured pino logger
 * 
 * section: return value
 * - board (object): work board instance
 * 
 * section: example
 * import { create_work_board } from './WorkBoard.js';
 * const board = create_work_board({ store, message_bus });
 * =========================================================================
 */
export class WorkBoard {
  store;
  memory_tickets;
  epics;
  default_max_retries;
  dag_runner;
  message_bus;
  default_lease_ms;
  logger;

  constructor(options = {}) {
    this.store = options.store || null;

    this.message_bus = options.message_bus || null;

    this.dag_runner = options.dag_runner || create_task_dag_runner({ logger: options.logger });

    this.default_lease_ms = options.default_lease_ms || 60000;

    this.default_max_retries = options.default_max_retries || 3;

    this.logger = options.logger || null;

    this.epics = new Map();

    this.memory_tickets = new Map();

  }

  #save_ticket_record(ticket) {
    const updated = {
      ...ticket,
      updated_at: new Date().toISOString()
    };
    if (this.store) {
      return this.store.save_entity(DocumentEntityTypes.TICKET, updated);
    }
    this.memory_tickets.set(updated.id, updated);
    return updated;
  }

  #get_ticket_record(id) {
    if (this.store) {
      return this.store.get_entity(DocumentEntityTypes.TICKET, id);
    }
    return this.memory_tickets.get(id) || null;
  }

  #list_ticket_records(filter_fn = null) {
    if (this.store) {
      return this.store.list_entities(DocumentEntityTypes.TICKET, filter_fn);
    }
    const all = Array.from(this.memory_tickets.values());
    return filter_fn ? all.filter(filter_fn) : all;
  }

  #hydrate_ticket_context(ticket) {
    const epic = this.epics.get(ticket.epic_id) || {};
    const hydrated = {
      ticket_id: ticket.id,
      epic_id: ticket.epic_id,
      feature_name: ticket.epic_id,
      defect_id: ticket.epic_id,
      project_id: ticket.epic_id,
      title: ticket.title,
      phase: ticket.phase,
      retry_count: ticket.retry_count,
      review_thread: (ticket.thread || []).slice(),
      ...epic.payload,
      ...ticket.inputs
    };

    if (this.store && ticket.linked_prd_id) {
      const tree = this.store.query_by_prd(ticket.linked_prd_id);
      const entity_pointers = [];
      if (tree.prd) {
        hydrated.prd_snapshot = tree.prd;
        entity_pointers.push(create_content_pointer('prd', tree.prd.id, tree.prd, { include_compressed: false }));
      }
      if (tree.stories && tree.stories.length > 0) {
        hydrated.stories_snapshot = tree.stories;
        for (let i = 0; i < tree.stories.length; i += 1) {
          entity_pointers.push(create_content_pointer('user_story', tree.stories[i].id, tree.stories[i], { include_compressed: false }));
        }
      }
      if (tree.adrs && tree.adrs.length > 0) {
        hydrated.adrs_snapshot = tree.adrs;
        for (let i = 0; i < tree.adrs.length; i += 1) {
          entity_pointers.push(create_content_pointer('adr', tree.adrs[i].id, tree.adrs[i], { include_compressed: false }));
        }
      }
      if (tree.interfaces && tree.interfaces.length > 0) {
        hydrated.interfaces_snapshot = tree.interfaces;
        for (let i = 0; i < tree.interfaces.length; i += 1) {
          entity_pointers.push(create_content_pointer('interface_contract', tree.interfaces[i].id, tree.interfaces[i], { include_compressed: false }));
        }
      }
      hydrated.entity_pointers = entity_pointers;
    }

    return hydrated;
  }

  #are_dependencies_completed(ticket, all_tickets_map) {
    const deps = ticket.depends_on || [];
    if (deps.length === 0) {
      return true;
    }
    for (let i = 0; i < deps.length; i += 1) {
      const dep_ticket = all_tickets_map[deps[i]];
      if (!dep_ticket || dep_ticket.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: registers or updates a top-level epic / feature on the work board
   * verbose: sets the concurrency policy (single-developer default vs multi-developer swarm)
   * and stores shared epic metadata.
   * 
   * section: arguments
   * - params (object): { id, name, process_type, concurrency_mode, max_workers, linked_prd_id, payload }
   * 
   * section: return value
   * - epic (object): registered epic descriptor
   * 
   * section: example
   * board.create_epic({ id: 'user-auth', process_type: 'develop-feature', concurrency_mode: 'single-developer' });
   */
  create_epic(params = {}) {
    const epic_id = params.id || params.name || `epic-${Date.now()}`;
    const concurrency_mode = params.concurrency_mode || 'single-developer';
    const max_workers = concurrency_mode === 'single-developer'
      ? 1
      : (params.max_workers || 4);

    const epic = {
      id: epic_id,
      name: params.name || epic_id,
      process_type: params.process_type || 'develop-feature',
      concurrency_mode,
      max_workers,
      assigned_developer: params.assigned_developer || null,
      linked_prd_id: params.linked_prd_id || null,
      payload: params.payload || {},
      created_at: new Date().toISOString()
    };

    this.epics.set(epic_id, epic);
    return epic;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: retrieves epic configuration by identifier
   * verbose: returns stored epic descriptor or null if not registered.
   * 
   * section: arguments
   * - epic_id (string): epic identifier
   * 
   * section: return value
   * - epic (object|null): epic configuration
   * 
   * section: example
   * const ep = board.get_epic('user-auth');
   */
  get_epic(epic_id) {
    return this.epics.get(epic_id) || null;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: creates a single ticket on the work board and validates dag acyclicity
   * verbose: validates dependencies via TaskDagEngine, sets initial ready/blocked status,
   * persists to the store, and publishes ticket:ready if immediately runnable.
   * 
   * section: arguments
   * - params (object): ticket definition
   * 
   * section: return value
   * - ticket (object): persisted ticket entity
   * 
   * section: example
   * const t = board.create_ticket({ id: 't-01', epic_id: 'user-auth', title: 'author prd', workflow_id: 'pm-prd-authoring', role: 'product-manager' });
   */
  create_ticket(params = {}) {
    const epic_id = params.epic_id || 'default-epic';
    if (!this.epics.has(epic_id)) {
      this.create_epic({ id: epic_id });
    }

    const existing = this.#list_ticket_records((t) => t.epic_id === epic_id);
    const all_map = {};
    for (let i = 0; i < existing.length; i += 1) {
      all_map[existing[i].id] = existing[i];
    }

    const epic = this.epics.get(epic_id) || {};
    const role = params.role || 'software-engineer';
    const default_affinity = (role === 'software-engineer' && epic.concurrency_mode === 'single-developer' && epic.assigned_developer)
      ? epic.assigned_developer
      : null;

    const candidate = {
      id: params.id || `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      epic_id,
      title: params.title || params.workflow_id || 'untitled ticket',
      workflow_id: params.workflow_id || 'se-feature-implementation',
      role,
      phase: params.phase || 'inception',
      status: 'backlog',
      depends_on: Array.isArray(params.depends_on) ? params.depends_on : [],
      affinity: params.affinity !== undefined ? params.affinity : default_affinity,
      lease: null,
      retry_count: 0,
      max_retries: params.max_retries || this.default_max_retries,
      linked_prd_id: params.linked_prd_id || epic.linked_prd_id || undefined,
      inputs: params.inputs || {},
      output: null,
      artefact_refs: [],
      thread: params.thread || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // verify dag acyclicity across the epic
    const dag_nodes = existing
      .filter((t) => t.id !== candidate.id)
      .concat([candidate])
      .map((t) => ({
        id: t.id,
        role: t.role,
        depends_on: (t.depends_on || []).filter((dep_id) => dep_id === candidate.id || Boolean(all_map[dep_id]))
      }));

    this.dag_runner.compute_topological_order({ nodes: dag_nodes });

    const ready_now = this.#are_dependencies_completed(candidate, all_map);
    candidate.status = ready_now ? 'ready' : 'blocked';

    const saved = this.#save_ticket_record(candidate);
    this.dag_runner.set_task_status(saved.id, saved.status);

    if (saved.status === 'ready' && this.message_bus) {
      this.message_bus.publish('ticket:ready', {
        ticket_id: saved.id,
        epic_id: saved.epic_id,
        role: saved.role,
        workflow_id: saved.workflow_id
      });
    }

    return saved;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: creates a batch of interdependent tickets and validates topological order
   * verbose: inserts multiple tickets at once, validates the full dependency graph for cycles,
   * and transitions root tickets to ready.
   * 
   * section: arguments
   * - tickets_array (array): array of ticket definition objects
   * 
   * section: return value
   * - created (array): array of persisted ticket entities in topological order
   * 
   * section: example
   * const created = board.create_tickets_batch([t1, t2]);
   */
  create_tickets_batch(tickets_array = []) {
    if (tickets_array.length === 0) {
      return [];
    }
    const epic_id = tickets_array[0].epic_id || 'default-epic';
    if (!this.epics.has(epic_id)) {
      this.create_epic({ id: epic_id });
    }

    const batch_ids = tickets_array.map((t) => t.id);
    const existing = this.#list_ticket_records((t) => t.epic_id === epic_id && !batch_ids.includes(t.id));
    const combined_nodes = existing.map((t) => ({
      id: t.id,
      depends_on: t.depends_on || []
    })).concat(tickets_array.map((t) => ({
      id: t.id,
      depends_on: t.depends_on || []
    })));

    // validate acyclicity before saving any ticket in the batch
    const order = this.dag_runner.compute_topological_order({ nodes: combined_nodes });

    const by_id = {};
    for (let i = 0; i < tickets_array.length; i += 1) {
      by_id[tickets_array[i].id] = tickets_array[i];
    }

    const created = [];
    for (let i = 0; i < order.length; i += 1) {
      const id = order[i];
      if (by_id[id]) {
        created.push(this.create_ticket(by_id[id]));
      }
    }
    return created;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: re-evaluates blocked tickets and unblocks any whose dependencies are completed
   * verbose: scans blocked/backlog tickets and flips them to ready when all depends_on are completed.
   * 
   * section: arguments
   * - epic_id (string, optional): optional epic filter
   * 
   * section: return value
   * - unblocked (array): list of newly unblocked ticket records
   * 
   * section: example
   * const newly_ready = board.unblock_ready_tickets('user-auth');
   */
  unblock_ready_tickets(epic_id = null) {
    const all = this.#list_ticket_records(epic_id ? (t) => t.epic_id === epic_id : null);
    const all_map = {};
    for (let i = 0; i < all.length; i += 1) {
      all_map[all[i].id] = all[i];
    }

    const unblocked = [];
    for (let i = 0; i < all.length; i += 1) {
      const t = all[i];
      if ((t.status === 'blocked' || t.status === 'backlog') && this.#are_dependencies_completed(t, all_map)) {
        const epic = this.epics.get(t.epic_id);
        const updated_affinity = (!t.affinity && t.role === 'software-engineer' && epic?.concurrency_mode === 'single-developer' && epic?.assigned_developer)
          ? epic.assigned_developer
          : t.affinity;

        const saved = this.#save_ticket_record({
          ...t,
          affinity: updated_affinity,
          status: 'ready'
        });
        this.dag_runner.set_task_status(saved.id, 'ready');
        unblocked.push(saved);

        if (this.message_bus) {
          this.message_bus.publish('ticket:ready', {
            ticket_id: saved.id,
            epic_id: saved.epic_id,
            role: saved.role,
            workflow_id: saved.workflow_id
          });
        }
      }
    }

    return unblocked;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: reaps expired worker leases and returns stalled tickets to ready status
   * verbose: checks in_progress tickets against current timestamp and recovers expired leases.
   * 
   * section: arguments
   * - now_ms (number, optional): current epoch timestamp in ms
   * 
   * section: return value
   * - reaped (array): list of recovered tickets returned to ready
   * 
   * section: example
   * const recovered = board.reap_expired_leases();
   */
  reap_expired_leases(now_ms = Date.now()) {
    const in_prog = this.#list_ticket_records((t) => t.status === 'in_progress');
    const reaped = [];
    for (let i = 0; i < in_prog.length; i += 1) {
      const t = in_prog[i];
      if (t.lease && t.lease.expires_at < now_ms) {
        const recovered = this.#save_ticket_record({
          ...t,
          status: 'ready',
          lease: null,
          thread: (t.thread || []).concat([{
            author: 'work-board',
            role: 'system',
            type: 'lease_expired',
            message: `lease expired for worker ${t.lease.worker_id}; returned to ready queue`,
            timestamp: new Date().toISOString()
          }])
        });
        this.dag_runner.set_task_status(recovered.id, 'ready');
        reaped.push(recovered);
      }
    }
    return reaped;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: atomically claims the next ready or rework ticket matching worker role and affinity
   * verbose: enforces single-developer feature ownership by default (or multi-developer swarm limits),
   * acquires a supervisor token lease, and returns the ticket with hydrated store context.
   * 
   * section: arguments
   * - params (object): { worker_id, role, epic_id, lease_ms, issue_token_fn }
   * 
   * section: return value
   * - claimed (object|null): { ticket, input_data, supervisor_token } or null if no matching work
   * 
   * section: example
   * const job = board.pull_next({ worker_id: 'se-worker-01', role: 'software-engineer' });
   */
  pull_next(params = {}) {
    const worker_id = params.worker_id || 'anonymous-worker';
    const role = params.role || 'software-engineer';
    const target_epic_id = params.epic_id || null;
    const lease_ms = params.lease_ms || this.default_lease_ms;

    this.reap_expired_leases();

    const all_tickets = this.#list_ticket_records(
      target_epic_id ? (t) => t.epic_id === target_epic_id : null
    );

    // prioritize rework tickets for this worker first, then ready tickets
    const candidates = all_tickets.filter((t) => (
      (t.status === 'rework' || t.status === 'ready') && t.role === role
    ));

    candidates.sort((a, b) => {
      if (a.status === 'rework' && b.status !== 'rework') return -1;
      if (b.status === 'rework' && a.status !== 'rework') return 1;
      return a.id.localeCompare(b.id);
    });

    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const epic = this.epics.get(candidate.epic_id) || {
        concurrency_mode: 'single-developer',
        max_workers: 1,
        assigned_developer: null
      };

      // check explicit ticket affinity
      if (candidate.affinity && candidate.affinity !== worker_id) {
        continue;
      }

      // enforce feature-level concurrency and developer affinity for software engineers
      if (role === 'software-engineer') {
        if (epic.concurrency_mode === 'single-developer') {
          if (epic.assigned_developer && epic.assigned_developer !== worker_id) {
            continue;
          }
        } else {
          // multi-developer swarm mode: check active worker count on this epic
          const active_on_epic = all_tickets.filter((t) => (
            t.epic_id === candidate.epic_id &&
            t.role === 'software-engineer' &&
            t.status === 'in_progress' &&
            t.lease?.worker_id !== worker_id
          ));
          if (active_on_epic.length >= (epic.max_workers || 4)) {
            continue;
          }
        }
      }

      // bind feature owner on first software-engineer claim in single-developer mode
      if (role === 'software-engineer' && epic.concurrency_mode === 'single-developer' && !epic.assigned_developer) {
        epic.assigned_developer = worker_id;
        this.epics.set(candidate.epic_id, epic);

        // stamp affinity onto remaining software-engineer tickets in this epic
        const sibling_se_tickets = all_tickets.filter((t) => (
          t.epic_id === candidate.epic_id &&
          t.role === 'software-engineer' &&
          t.id !== candidate.id &&
          !t.affinity
        ));
        for (let s = 0; s < sibling_se_tickets.length; s += 1) {
          this.#save_ticket_record({
            ...sibling_se_tickets[s],
            affinity: worker_id
          });
        }
      }

      const now = Date.now();
      const supervisor_token = typeof params.issue_token_fn === 'function'
        ? params.issue_token_fn({ ticket_id: candidate.id, worker_id, role, workflow_id: candidate.workflow_id })
        : `sup-tok-${candidate.id}-${worker_id}-${crypto.randomBytes(6).toString('hex')}`;

      const leased_ticket = this.#save_ticket_record({
        ...candidate,
        affinity: candidate.affinity || (role === 'software-engineer' && epic.concurrency_mode === 'single-developer' ? worker_id : null),
        status: 'in_progress',
        lease: {
          worker_id,
          supervisor_token,
          leased_at: now,
          expires_at: now + lease_ms
        }
      });

      this.dag_runner.set_task_status(leased_ticket.id, 'in_progress');
      const input_data = this.#hydrate_ticket_context(leased_ticket);

      if (this.logger) {
        this.logger.info({
          event: 'board:ticket_claimed',
          ticket_id: leased_ticket.id,
          epic_id: leased_ticket.epic_id,
          worker_id,
          role,
          workflow_id: leased_ticket.workflow_id
        });
      }

      return {
        ticket: leased_ticket,
        input_data,
        supervisor_token
      };
    }

    return null;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: renews the heartbeat lease on an in-progress ticket
   * verbose: extends lease expires_at timestamp for the active worker.
   * 
   * section: arguments
   * - ticket_id (string): ticket identifier
   * - worker_id (string): worker holding the lease
   * - lease_ms (number, optional): extension duration in ms
   * 
   * section: return value
   * - updated (object): updated ticket record
   * 
   * section: example
   * board.renew_lease('t-01', 'se-worker-01');
   */
  renew_lease(ticket_id, worker_id, lease_ms = this.default_lease_ms) {
    const ticket = this.#get_ticket_record(ticket_id);
    if (!ticket || ticket.status !== 'in_progress' || ticket.lease?.worker_id !== worker_id) {
      throw new Error(`invalid_lease_renewal: ticket "${ticket_id}" is not leased by "${worker_id}"`);
    }
    return this.#save_ticket_record({
      ...ticket,
      lease: {
        ...ticket.lease,
        expires_at: Date.now() + lease_ms
      }
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: pauses an in-progress ticket awaiting clarification from another agent
   * verbose: moves ticket to awaiting_input, records the question in the ticket thread,
   * and dispatches a clarification_request on the message bus.
   * 
   * section: arguments
   * - ticket_id (string): ticket identifier
   * - params (object): { worker_id, to_role, question }
   * 
   * section: return value
   * - result (object): { ticket, message }
   * 
   * section: example
   * board.pause_for_clarification('t-06', { worker_id: 'se-01', to_role: 'system-architect', question: 'token ttl?' });
   */
  pause_for_clarification(ticket_id, params = {}) {
    const ticket = this.#get_ticket_record(ticket_id);
    if (!ticket) {
      throw new Error(`ticket_not_found: "${ticket_id}"`);
    }

    const updated = this.#save_ticket_record({
      ...ticket,
      status: 'awaiting_input',
      lease: null,
      thread: (ticket.thread || []).concat([{
        author: params.worker_id || 'worker',
        role: ticket.role,
        type: 'clarification_request',
        message: `question for ${params.to_role || 'system-architect'}: ${params.question}`,
        timestamp: new Date().toISOString()
      }])
    });

    this.dag_runner.set_task_status(updated.id, 'awaiting_input');

    let msg = null;
    if (this.message_bus) {
      msg = this.message_bus.request_clarification({
        from_worker: params.worker_id || ticket.role,
        to_role: params.to_role || 'system-architect',
        ticket_id: updated.id,
        question: params.question
      });
    }

    return { ticket: updated, message: msg };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: resolves a clarification request and returns the paused ticket to ready status
   * verbose: records the answer in the ticket thread, updates inputs with clarification,
   * and flips the ticket back to ready so the worker can resume.
   * 
   * section: arguments
   * - ticket_id (string): ticket identifier
   * - params (object): { from_worker, role, answer, request_id }
   * 
   * section: return value
   * - ticket (object): updated ticket in ready status
   * 
   * section: example
   * board.resolve_clarification('t-06', { from_worker: 'arch-01', answer: 'use 15m access token ttl' });
   */
  resolve_clarification(ticket_id, params = {}) {
    const ticket = this.#get_ticket_record(ticket_id);
    if (!ticket) {
      throw new Error(`ticket_not_found: "${ticket_id}"`);
    }

    const clarifications = Array.isArray(ticket.inputs?.clarifications)
      ? ticket.inputs.clarifications.slice()
      : [];
    clarifications.push({
      from: params.from_worker || params.role || 'system-architect',
      answer: params.answer
    });

    const enriched_fields = {};
    if (params.problem_statement) {
      enriched_fields.problem_statement = params.problem_statement;
    } else if (ticket.workflow_id === 'pm-prd-authoring' && params.answer) {
      enriched_fields.problem_statement = params.answer;
    }
    if (params.target_audience) {
      enriched_fields.target_audience = params.target_audience;
    }
    if (Array.isArray(params.acceptance_criteria) && params.acceptance_criteria.length > 0) {
      enriched_fields.acceptance_criteria = params.acceptance_criteria;
    }
    if (Array.isArray(params.functional_requirements) && params.functional_requirements.length > 0) {
      enriched_fields.functional_requirements = params.functional_requirements;
    }

    const ticket_epic = this.epics.get(ticket.epic_id);
    if (ticket_epic) {
      const epic_clarifications = Array.isArray(ticket_epic.payload?.clarifications)
        ? ticket_epic.payload.clarifications.slice()
        : [];
      epic_clarifications.push({
        ticket_id: ticket.id,
        from: params.from_worker || params.role || 'system-architect',
        answer: params.answer
      });
      ticket_epic.payload = {
        ...(ticket_epic.payload || {}),
        ...enriched_fields,
        clarifications: epic_clarifications
      };
    }

    const updated = this.#save_ticket_record({
      ...ticket,
      status: 'ready',
      inputs: {
        ...ticket.inputs,
        ...enriched_fields,
        clarifications
      },
      thread: (ticket.thread || []).concat([{
        author: params.from_worker || 'system-architect',
        role: params.role || 'system-architect',
        type: 'clarification_reply',
        message: params.answer || '',
        timestamp: new Date().toISOString()
      }])
    });

    this.dag_runner.set_task_status(updated.id, 'ready');

    if (this.message_bus) {
      if (params.request_id) {
        this.message_bus.reply_clarification({
          request_id: params.request_id,
          from_worker: params.from_worker || 'system-architect',
          answer: params.answer
        });
      }
      this.message_bus.publish('ticket:ready', {
        ticket_id: updated.id,
        epic_id: updated.epic_id,
        role: updated.role,
        workflow_id: updated.workflow_id
      });
    }

    return updated;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: submits pure mastra workflow output for tier 1 supervisor review
   * verbose: verifies the worker's supervisor_token lease, attaches the candidate output
   * payload to the ticket without mutating canonical store collections, and transitions to in_review.
   * 
   * section: arguments
   * - ticket_id (string): ticket identifier
   * - params (object): { worker_id, supervisor_token, output, summary }
   * 
   * section: return value
   * - ticket (object): updated ticket in in_review status
   * 
   * section: example
   * board.submit_for_review('t-01', { worker_id: 'pm-01', supervisor_token: tok, output: { prd_entity } });
   */
  submit_for_review(ticket_id, params = {}) {
    const ticket = this.#get_ticket_record(ticket_id);
    if (!ticket) {
      throw new Error(`ticket_not_found: "${ticket_id}"`);
    }
    if (ticket.status !== 'in_progress') {
      throw new Error(`invalid_ticket_submission: ticket "${ticket_id}" is in status "${ticket.status}", expected "in_progress"`);
    }
    if (!ticket.lease || ticket.lease.worker_id !== params.worker_id) {
      throw new Error(`unauthorized_worker_submission: ticket "${ticket_id}" is not leased by "${params.worker_id}"`);
    }
    if (ticket.lease.supervisor_token !== params.supervisor_token) {
      throw new Error(`invalid_supervisor_token: submission for ticket "${ticket_id}" rejected due to token mismatch`);
    }

    const output_pointer = create_content_pointer(
      'ticket_output',
      ticket.id,
      params.output || {},
      {
        branch: params.branch || null,
        commit_sha: params.commit_sha || null,
        pr_id: params.pr_id || null,
        summary: params.summary || `submitted output for ${ticket.workflow_id}`
      }
    );

    const updated = this.#save_ticket_record({
      ...ticket,
      status: 'in_review',
      output: params.output || {},
      output_pointer,
      thread: (ticket.thread || []).concat([{
        author: params.worker_id,
        role: ticket.role,
        type: 'submission',
        message: params.summary || `submitted output for ${ticket.workflow_id} [${output_pointer.ref}]`,
        timestamp: new Date().toISOString()
      }])
    });

    this.dag_runner.set_task_status(updated.id, 'in_review');

    if (this.message_bus) {
      this.message_bus.publish('ticket:in_review', {
        ticket_id: updated.id,
        epic_id: updated.epic_id,
        role: updated.role,
        workflow_id: updated.workflow_id
      });
    }

    return updated;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: completes tier 1 review of a submitted ticket, committing to store or routing to rework/escalation
   * verbose: if approved, commits verified entities to DocumentEntityStore, marks ticket completed,
   * and unblocks downstream dependent tickets. if rejected, increments retry_count and transitions
   * to rework (or escalated when retry_count reaches max_retries).
   * 
   * section: arguments
   * - ticket_id (string): ticket identifier
   * - review (object): { approved, reviewer, feedback, violations, verified_entities }
   * 
   * section: return value
   * - outcome (object): { ticket, unblocked_tickets, committed_refs }
   * 
   * section: example
   * const res = board.complete_review('t-01', { approved: true, verified_entities: [{ type: 'prd', data: prd_obj }] });
   */
  complete_review(ticket_id, review = {}) {
    const ticket = this.#get_ticket_record(ticket_id);
    if (!ticket) {
      throw new Error(`ticket_not_found: "${ticket_id}"`);
    }

    const reviewer = review.reviewer || 'sdlc-supervisor';

    if (review.approved) {
      const committed_refs = (ticket.artefact_refs || []).slice();
      const entities_to_commit = Array.isArray(review.verified_entities) ? review.verified_entities : [];

      if (this.store) {
        for (let i = 0; i < entities_to_commit.length; i += 1) {
          const item = entities_to_commit[i];
          if (item && item.type && item.data) {
            const saved_ent = this.store.save_entity(item.type, item.data);
            committed_refs.push({ type: item.type, id: saved_ent.id });
          }
        }
      }

      const completed_ticket = this.#save_ticket_record({
        ...ticket,
        status: 'completed',
        lease: null,
        artefact_refs: committed_refs,
        thread: (ticket.thread || []).concat([{
          author: reviewer,
          role: 'supervisor',
          type: 'review_approved',
          message: review.feedback || 'review and gate verification passed',
          timestamp: new Date().toISOString()
        }])
      });

      this.dag_runner.set_task_status(completed_ticket.id, 'completed');
      const unblocked_tickets = this.unblock_ready_tickets(completed_ticket.epic_id);

      if (this.message_bus) {
        this.message_bus.publish('ticket:completed', {
          ticket_id: completed_ticket.id,
          epic_id: completed_ticket.epic_id,
          unblocked_count: unblocked_tickets.length
        });
      }

      return {
        ticket: completed_ticket,
        unblocked_tickets,
        committed_refs
      };
    }

    // rejected -> rework or escalate
    const next_retries = (ticket.retry_count || 0) + 1;
    const max_retries = ticket.max_retries || this.default_max_retries;
    const is_escalated = next_retries >= max_retries;
    const next_status = is_escalated ? 'escalated' : 'rework';
    const violation_str = Array.isArray(review.violations) && review.violations.length > 0
      ? `violations: ${review.violations.join('; ')}`
      : (review.feedback || 'review verification failed');

    const rejected_ticket = this.#save_ticket_record({
      ...ticket,
      status: next_status,
      lease: null,
      retry_count: next_retries,
      thread: (ticket.thread || []).concat([{
        author: reviewer,
        role: 'supervisor',
        type: is_escalated ? 'escalated' : 'review_rejected',
        message: `[attempt ${next_retries}/${max_retries}] ${violation_str}`,
        timestamp: new Date().toISOString()
      }])
    });

    this.dag_runner.set_task_status(rejected_ticket.id, next_status);

    if (this.message_bus) {
      if (is_escalated) {
        this.message_bus.send_message({
          from: reviewer,
          to: 'sdlc-supervisor',
          topic: 'escalation',
          ticket_id: rejected_ticket.id,
          payload: {
            epic_id: rejected_ticket.epic_id,
            retry_count: next_retries,
            violations: review.violations || [],
            feedback: violation_str
          }
        });
      } else {
        this.message_bus.publish('ticket:ready', {
          ticket_id: rejected_ticket.id,
          epic_id: rejected_ticket.epic_id,
          role: rejected_ticket.role,
          workflow_id: rejected_ticket.workflow_id,
          rework: true
        });
      }
    }

    return {
      ticket: rejected_ticket,
      unblocked_tickets: [],
      committed_refs: []
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: retrieves a ticket by identifier
   * verbose: returns ticket entity from store or null.
   * 
   * section: arguments
   * - ticket_id (string): ticket identifier
   * 
   * section: return value
   * - ticket (object|null): ticket entity
   * 
   * section: example
   * const t = board.get_ticket('t-01');
   */
  get_ticket(ticket_id) {
    return this.#get_ticket_record(ticket_id);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists tickets on the work board with optional filtering
   * verbose: filters tickets by epic_id, status, role, or phase.
   * 
   * section: arguments
   * - filter (object, optional): { epic_id, status, role, phase }
   * 
   * section: return value
   * - tickets (array): matching ticket records
   * 
   * section: example
   * const ready = board.list_tickets({ status: 'ready' });
   */
  list_tickets(filter = {}) {
    if (typeof filter === 'function') {
      return this.#list_ticket_records(filter);
    }
    return this.#list_ticket_records((t) => {
      if (filter.epic_id && t.epic_id !== filter.epic_id) return false;
      if (filter.status && t.status !== filter.status) return false;
      if (filter.role && t.role !== filter.role) return false;
      if (filter.phase && t.phase !== filter.phase) return false;
      return true;
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: computes aggregate status counts across the work board
   * verbose: summarizes total, ready, blocked, in_progress, in_review, rework, escalated, and completed tickets.
   * 
   * section: arguments
   * - epic_id (string, optional): optional epic filter
   * 
   * section: return value
   * - summary (object): status breakdown object
   * 
   * section: example
   * const stats = board.get_board_summary('user-auth');
   */
  get_board_summary(epic_id = null) {
    const tickets = this.list_tickets(epic_id ? { epic_id } : {});
    const counts = {
      total: tickets.length,
      backlog: 0,
      blocked: 0,
      ready: 0,
      in_progress: 0,
      awaiting_input: 0,
      in_review: 0,
      rework: 0,
      escalated: 0,
      completed: 0
    };
    for (let i = 0; i < tickets.length; i += 1) {
      const st = tickets[i].status;
      if (counts[st] !== undefined) {
        counts[st] += 1;
      }
    }
    return {
      epic: epic_id ? this.epics.get(epic_id) || null : null,
      counts,
      all_completed: tickets.length > 0 && counts.completed === tickets.length,
      has_escalations: counts.escalated > 0
    };
  }
}

export function create_work_board(options = {}) {
  return new WorkBoard(options);
}

