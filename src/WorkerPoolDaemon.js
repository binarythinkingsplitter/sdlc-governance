/**
 * =========================================================================
 * module: worker pool daemon
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: scalable daemon worker pool polling the work board under sdlc-supervisor mediation
 * verbose: manages 1 to 10,000 idle-polling and event-woken specialist worker daemons across
 * product-manager, system-architect, software-engineer, security-engineer, qa-engineer,
 * and devops-engineer roles. workers claim ready tickets with feature affinity, execute pure
 * mastra workflows using supervisor-issued tokens, and submit outputs for supervisor review.
 * 
 * section: export catalog
 * - create_worker_pool_daemon: factory creating the scalable daemon worker pool
 * =========================================================================
 */

const ROLE_PREFIX_MAP = Object.freeze({
  'product-manager': 'pm-worker',
  'system-architect': 'arch-worker',
  'software-engineer': 'se-worker',
  'security-engineer': 'sec-worker',
  'qa-engineer': 'qa-worker',
  'devops-engineer': 'devops-worker',
  'autonomous-engineer': 'auto-worker'
});

const DEFAULT_ROLE_COUNTS = Object.freeze({
  'product-manager': 1,
  'system-architect': 1,
  'software-engineer': 2,
  'security-engineer': 1,
  'qa-engineer': 1,
  'devops-engineer': 1
});

/**
 * =========================================================================
 * function: create_worker_pool_daemon
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a scalable daemon worker pool coordinated by sdlc-supervisor
 * verbose: instantiates role worker daemons, supports dynamic horizontal scaling (1..10,000),
 * listens for ticket:ready events on AgentMessageBus, and drains board queues deterministically.
 * 
 * section: arguments
 * - options (object): { supervisor, board, message_bus, role_counts, logger }
 * 
 * section: return value
 * - pool (object): worker pool daemon controller
 * 
 * section: example
 * const pool = create_worker_pool_daemon({ supervisor, board, message_bus });
 * pool.scale('software-engineer', 5);
 * const report = await pool.drain_board({ epic_id: 'user-auth' });
 * =========================================================================
 */
export class WorkerPoolDaemon {
  options;
  workers;
  is_running;
  message_bus;
  unsubscribe_bus;
  logger;
  submitted_requests;
  supervisor;
  request_promises;

  constructor(options = {}) {
    this.options = options;
    this.supervisor = options.supervisor;

    this.message_bus = options.message_bus || null;

    this.logger = options.logger || null;

    this.is_running = false;

    this.unsubscribe_bus = null;

    this.workers = [];

    this.submitted_requests = [];

    this.request_promises = new Map();

    // initialise default worker roster
    const initial_counts = {
      ...DEFAULT_ROLE_COUNTS,
      ...(options.role_counts || {})
    };

    for (const [role, count] of Object.entries(initial_counts)) {
      this.#sync_role_workers(role, count);
    }

  }

  #acquire_role_worker(role) {
    const resolved_role = role || 'product-manager';
    let candidate = this.workers.find((w) => w.role === resolved_role && w.status === 'idle');
    if (!candidate) {
      candidate = this.workers.find((w) => w.role === resolved_role);
    }
    if (!candidate) {
      this.#sync_role_workers(resolved_role, 1);
      candidate = this.workers.find((w) => w.role === resolved_role);
    }
    return candidate;
  }

  #build_worker_id(role, index) {
    const prefix = ROLE_PREFIX_MAP[role] || `${role}-worker`;
    return `${prefix}-${String(index).padStart(2, '0')}`;
  }

  #sync_role_workers(role, target_count) {
    const count = Math.max(0, Math.min(10000, Number(target_count) || 0));
    const current_for_role = this.workers.filter((w) => w.role === role);

    if (current_for_role.length < count) {
      for (let i = current_for_role.length + 1; i <= count; i += 1) {
        this.workers.push({
          id: this.#build_worker_id(role, i),
          role,
          status: 'idle',
          active_ticket_id: null,
          completed_count: 0,
          history: []
        });
      }
    } else if (current_for_role.length > count) {
      let to_remove = current_for_role.length - count;
      for (let i = this.workers.length - 1; i >= 0 && to_remove > 0; i -= 1) {
        if (this.workers[i].role === role && this.workers[i].status === 'idle') {
          this.workers.splice(i, 1);
          to_remove -= 1;
        }
      }
    }
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: starts the daemon worker pool and subscribes to message bus wakeups
   * verbose: activates idle workers to listen for ticket:ready events on the bus.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - status (object): pool status summary
   * 
   * section: example
   * pool.start();
   */
  start() {
    if (this.is_running) {
      return this.get_status();
    }
    this.is_running = true;
    if (this.message_bus) {
      this.unsubscribe_bus = this.message_bus.subscribe('ticket:ready', () => {
        // wakeup signal received
      });
    }
    if (this.logger) {
      this.logger.info({
        event: 'worker_pool:started',
        total_workers: this.workers.length
      });
    }
    return this.get_status();
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: stops the daemon worker pool and unsubscribes from message bus
   * verbose: transitions the daemon pool to stopped state cleanly.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - status (object): pool status summary
   * 
   * section: example
   * pool.stop();
   */
  stop() {
    this.is_running = false;
    if (this.unsubscribe_bus) {
      this.unsubscribe_bus();
      this.unsubscribe_bus = null;
    }
    if (this.logger) {
      this.logger.info({ event: 'worker_pool:stopped' });
    }
    return this.get_status();
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: dynamically scales the number of daemon workers for a role (1 to 10,000)
   * verbose: adds or removes idle daemon worker instances for the specified role.
   * 
   * section: arguments
   * - role (string): agent role identifier (e.g. 'software-engineer')
   * - count (number): target number of worker instances (0..10000)
   * 
   * section: return value
   * - role_workers (array): updated list of workers for that role
   * 
   * section: example
   * pool.scale('software-engineer', 10);
   */
  scale(role, count) {
    this.#sync_role_workers(role, count);
    if (this.logger) {
      this.logger.info({
        event: 'worker_pool:scaled',
        role,
        target_count: count,
        total_workers: this.workers.length
      });
    }
    return this.workers.filter((w) => w.role === role);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists registered daemon workers in the pool
   * verbose: returns worker descriptors filtered optionally by role or status.
   * 
   * section: arguments
   * - filter (object, optional): { role, status }
   * 
   * section: return value
   * - list (array): array of worker descriptors
   * 
   * section: example
   * const se_workers = pool.list_workers({ role: 'software-engineer' });
   */
  list_workers(filter = {}) {
    return this.workers.filter((w) => {
      if (filter.role && w.role !== filter.role) return false;
      if (filter.status && w.status !== filter.status) return false;
      return true;
    }).map((w) => ({
      id: w.id,
      role: w.role,
      status: w.status,
      active_ticket_id: w.active_ticket_id,
      completed_count: w.completed_count
    }));
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns aggregate status of the daemon worker pool
   * verbose: summarizes running state, worker counts per role, idle/busy counts, and completed tickets.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - status (object): pool status summary
   * 
   * section: example
   * const st = pool.get_status();
   */
  get_status() {
    const role_counts = {};
    let idle_workers = 0;
    let busy_workers = 0;
    let total_completed_tickets = 0;

    for (let i = 0; i < this.workers.length; i += 1) {
      const w = this.workers[i];
      role_counts[w.role] = (role_counts[w.role] || 0) + 1;
      if (w.status === 'idle') idle_workers += 1;
      if (w.status === 'busy') busy_workers += 1;
      total_completed_tickets += w.completed_count;
    }

    let queued_requests = 0;
    let running_requests = 0;
    let completed_requests = 0;
    for (let r = 0; r < this.submitted_requests.length; r += 1) {
      const req = this.submitted_requests[r];
      if (req.status === 'queued') queued_requests += 1;
      else if (req.status === 'running') running_requests += 1;
      else if (req.status === 'completed') completed_requests += 1;
    }

    return {
      running: this.is_running,
      total_workers: this.workers.length,
      idle_workers,
      busy_workers,
      total_completed_tickets,
      total_requests: this.submitted_requests.length,
      queued_requests,
      running_requests,
      completed_requests,
      role_counts
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: executes a single poll-claim-execute-submit cycle for a specific worker daemon
   * verbose: asks sdlc-supervisor for the next ready ticket matching the worker's role and affinity,
   * runs the mastra workflow under the supervisor token, and submits the output for review.
   * 
   * section: arguments
   * - worker_id (string): daemon worker identifier
   * - options (object, optional): { epic_id, custom_executor }
   * 
   * section: return value
   * - outcome (promise<object|null>): execution and review outcome, or null if no ready work
   * 
   * section: example
   * const res = await pool.step_worker('se-worker-01', { epic_id: 'user-auth' });
   */
  async step_worker(worker_id, step_options = {}) {
    const worker = this.workers.find((w) => w.id === worker_id);
    if (!worker || worker.status !== 'idle') {
      return null;
    }

    const claimed = this.supervisor.claim_next_ticket({
      worker_id: worker.id,
      role: worker.role,
      epic_id: step_options.epic_id || null
    });

    if (!claimed) {
      return null;
    }

    const { ticket, input_data, supervisor_token, request_context } = claimed;
    worker.status = 'busy';
    worker.active_ticket_id = ticket.id;
    const drained_signals = (this.message_bus && typeof this.message_bus.drain_signals === 'function')
      ? this.message_bus.drain_signals(worker.id)
      : null;

    if (typeof step_options.on_progress === 'function') {
      try {
        step_options.on_progress({
          event: 'ticket_started',
          worker_id: worker.id,
          role: worker.role,
          ticket_id: ticket.id,
          title: ticket.title,
          workflow_id: ticket.workflow_id,
          phase: ticket.phase
        });
      } catch (_err) {
        // ignore progress callback errors
      }
    }

    const step_progress_handler = typeof step_options.on_progress === 'function'
      ? (step_ev) => {
        try {
          step_options.on_progress({
            ...step_ev,
            worker_id: worker.id,
            role: step_ev.role || worker.role,
            ticket_id: ticket.id,
            title: ticket.title,
            workflow_id: ticket.workflow_id,
            phase: ticket.phase
          });
        } catch (_err) {
          // ignore progress callback errors
        }
      }
      : undefined;
    if (step_progress_handler && request_context && typeof request_context.set === 'function') {
      request_context.set('on_step_progress', step_progress_handler);
    }

    try {
      if (typeof step_options.custom_executor === 'function') {
        const custom_res = await step_options.custom_executor({
          worker,
          ticket,
          input_data,
          supervisor_token,
          request_context,
          drained_signals
        });
        if (custom_res && custom_res.paused_for_clarification) {
          worker.status = 'idle';
          worker.active_ticket_id = null;
          return {
            worker_id: worker.id,
            ticket_id: ticket.id,
            status: 'awaiting_input'
          };
        }
        const review = await this.supervisor.submit_and_review_ticket(ticket.id, {
          worker_id: worker.id,
          supervisor_token,
          request_context,
          output: custom_res?.output || custom_res || {},
          approved: custom_res?.approved,
          violations: custom_res?.violations,
          feedback: custom_res?.feedback
        });
        if (review.approved) {
          worker.completed_count += 1;
        }
        worker.history.push(ticket.id);
        worker.status = 'idle';
        worker.active_ticket_id = null;
        if (typeof step_options.on_progress === 'function') {
          try {
            step_options.on_progress({
              event: 'ticket_completed',
              worker_id: worker.id,
              role: worker.role,
              ticket_id: ticket.id,
              title: ticket.title,
              workflow_id: ticket.workflow_id,
              approved: review.approved,
              spawned_count: Array.isArray(review.spawned_tickets) ? review.spawned_tickets.length : 0,
              git_event: review.git_provenance_event || null,
              phase_transitions: review.phase_transitions || [],
              gate_evaluations: review.gate_evaluations || [],
              active_phase: review.active_phase || null
            });
          } catch (_err) {
            // ignore progress callback errors
          }
        }
        return {
          worker_id: worker.id,
          ticket_id: ticket.id,
          workflow_id: ticket.workflow_id,
          review
        };
      }

      const run_state = await this.supervisor.execute_supervised_workflow(
        ticket.workflow_id,
        {
          ...input_data,
          on_step_progress: step_progress_handler
        },
        {
          supervisor_token,
          request_context,
          worker_id: worker.id,
          ticket_id: ticket.id,
          role: worker.role
        }
      );

      const review = await this.supervisor.submit_and_review_ticket(ticket.id, {
        worker_id: worker.id,
        supervisor_token,
        request_context,
        output: run_state
      });

      if (review.approved) {
        worker.completed_count += 1;
      }
      worker.history.push(ticket.id);
      worker.status = 'idle';
      worker.active_ticket_id = null;

      if (typeof step_options.on_progress === 'function') {
        try {
          step_options.on_progress({
            event: 'ticket_completed',
            worker_id: worker.id,
            role: worker.role,
            ticket_id: ticket.id,
            title: ticket.title,
            workflow_id: ticket.workflow_id,
            approved: review.approved,
            spawned_count: Array.isArray(review.spawned_tickets) ? review.spawned_tickets.length : 0,
            git_event: review.git_provenance_event || null,
            phase_transitions: review.phase_transitions || [],
            gate_evaluations: review.gate_evaluations || [],
            active_phase: review.active_phase || null
          });
        } catch (_err) {
          // ignore progress callback errors
        }
      }

      return {
        worker_id: worker.id,
        ticket_id: ticket.id,
        workflow_id: ticket.workflow_id,
        run_state,
        review
      };
    } catch (err) {
      worker.status = 'idle';
      worker.active_ticket_id = null;
      throw err;
    }
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: runs all idle daemon workers across the board until all runnable tickets complete
   * verbose: iterates through rounds of concurrent worker polling until no ready or rework
   * tickets remain on the board (or max_rounds is reached).
   * 
   * section: arguments
   * - drain_options (object, optional): { epic_id, max_rounds, custom_executor }
   * 
   * section: return value
   * - report (promise<object>): { rounds, executed_steps, worker_status }
   * 
   * section: example
   * const report = await pool.drain_board({ epic_id: 'user-auth' });
   */
  async drain_board(drain_options = {}) {
    const max_rounds = drain_options.max_rounds || 50;
    const executed_steps = [];
    let rounds = 0;

    this.start();

    while (rounds < max_rounds) {
      rounds += 1;
      let round_progress = 0;

      for (let i = 0; i < this.workers.length; i += 1) {
        const w = this.workers[i];
        if (w.status === 'idle') {
          const step_res = await this.step_worker(w.id, drain_options);
          if (step_res) {
            executed_steps.push(step_res);
            round_progress += 1;
          }
        }
      }

      if (round_progress === 0) {
        break;
      }
    }

    return {
      rounds,
      executed_count: executed_steps.length,
      executed_steps,
      pool_status: this.get_status()
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: routes any submitted sdlc or specialist request through the daemon worker pool
   * verbose: decouples interactive chat agents (such as product-manager) from synchronous execution
   * by routing all submitted requests (processes, workflows, consultations, prd/code syncs, direct
   * fixes, and agent tasks) through the worker pool in foreground or background mode.
   * 
   * section: arguments
   * - request_spec (object): { type, role, process_type, workflow_id, epic_id, name, params, background, executor, on_progress }
   * 
   * section: return value
   * - outcome (promise<object>): request execution result or background receipt
   * 
   * section: example
   * const res = await pool.submit_request({ type: 'process', process_type: 'develop-feature', name: 'vault' });
   */
  async submit_request(request_spec = {}) {
    this.start();

    const request_id = String(
      request_spec.id || request_spec.request_id || `req-${String(this.submitted_requests.length + 1).padStart(4, '0')}`
    );
    const req_type = String(
      request_spec.type
      || (request_spec.process_type ? 'process' : (request_spec.workflow_id ? 'workflow' : 'task'))
    ).toLowerCase();
    const target_role = request_spec.role
      || (req_type === 'direct_fix' ? 'autonomous-engineer' : 'product-manager');
    const is_background = Boolean(request_spec.background);
    const assigned_worker = this.#acquire_role_worker(target_role);

    const req_record = {
      id: request_id,
      type: req_type,
      role: target_role,
      worker_id: assigned_worker ? assigned_worker.id : null,
      process_type: request_spec.process_type || null,
      workflow_id: request_spec.workflow_id || null,
      epic_id: request_spec.epic_id || request_spec.name || request_spec.params?.name || null,
      title: request_spec.title || request_spec.description || request_spec.question || `${req_type}:${request_id}`,
      requested_by: request_spec.requested_by || request_spec.from_agent || 'interactive-chat',
      background: is_background,
      status: 'queued',
      submitted_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      result: null,
      error: null
    };
    this.submitted_requests.push(req_record);

    if (this.message_bus && typeof this.message_bus.publish === 'function') {
      this.message_bus.publish('worker_pool:request_submitted', {
        request_id,
        type: req_type,
        role: target_role,
        worker_id: req_record.worker_id,
        background: is_background
      });
    }

    const execute_on_pool = async () => {
      req_record.status = 'running';
      req_record.started_at = new Date().toISOString();

      try {
        if (req_type === 'process') {
          const proc_type = request_spec.process_type || 'develop-feature';
          const proc_params = request_spec.params || request_spec;
          const initiated = request_spec.initiated
            || this.supervisor.initiate_process(proc_type, proc_params);
          req_record.epic_id = initiated.epic.id;

          const drain_report = await this.drain_board({
            epic_id: initiated.epic.id,
            max_rounds: proc_params.max_rounds || request_spec.max_rounds || 50,
            on_progress: proc_params.on_progress || request_spec.on_progress,
            custom_executor: proc_params.custom_executor || request_spec.custom_executor
          });
          const board_ref = this.options.board || (this.supervisor && typeof this.supervisor.get_board === 'function' ? this.supervisor.get_board() : null);
          const board_summary = board_ref && typeof board_ref.get_board_summary === 'function'
            ? board_ref.get_board_summary(initiated.epic.id)
            : { all_completed: true, counts: { total: initiated.tickets.length, completed: initiated.tickets.length } };

          const final_res = {
            ...initiated,
            request_id,
            routed_via: 'worker_pool',
            worker_id: req_record.worker_id,
            drain_report,
            board_summary
          };
          req_record.status = 'completed';
          req_record.completed_at = new Date().toISOString();
          req_record.result = final_res;
          if (typeof request_spec.on_complete === 'function') {
            await request_spec.on_complete(final_res, req_record);
          }
          return final_res;
        }

        const worker = this.#acquire_role_worker(target_role);
        const prev_status = worker ? worker.status : 'idle';
        const prev_ticket = worker ? worker.active_ticket_id : null;
        if (worker) {
          worker.status = 'busy';
          worker.active_ticket_id = request_id;
          req_record.worker_id = worker.id;
        }

        try {
          let output;
          if (typeof request_spec.executor === 'function') {
            output = await request_spec.executor({
              worker,
              pool: this,
              supervisor: this.supervisor,
              request: req_record
            });
          } else if (req_type === 'workflow' && request_spec.workflow_id && this.supervisor) {
            output = await this.supervisor.execute_supervised_workflow(
              request_spec.workflow_id,
              request_spec.inputs || request_spec.params || {},
              {
                worker_id: worker ? worker.id : 'pm-worker-01',
                ticket_id: request_id,
                role: target_role
              }
            );
          } else {
            output = {
              executed: true,
              request_id,
              worker_id: worker ? worker.id : null,
              role: target_role
            };
          }

          if (worker) {
            worker.completed_count += 1;
            worker.history.push(request_id);
            worker.status = prev_status === 'busy' ? 'busy' : 'idle';
            worker.active_ticket_id = prev_ticket;
          }

          const final_res = {
            request_id,
            routed_via: 'worker_pool',
            worker_id: worker ? worker.id : null,
            role: target_role,
            type: req_type,
            status: 'completed',
            output
          };
          req_record.status = 'completed';
          req_record.completed_at = new Date().toISOString();
          req_record.result = final_res;
          if (typeof request_spec.on_complete === 'function') {
            await request_spec.on_complete(final_res, req_record);
          }
          return final_res;
        } catch (inner_err) {
          if (worker) {
            worker.status = prev_status === 'busy' ? 'busy' : 'idle';
            worker.active_ticket_id = prev_ticket;
          }
          throw inner_err;
        }
      } catch (err) {
        req_record.status = 'failed';
        req_record.completed_at = new Date().toISOString();
        req_record.error = err.message;
        throw err;
      }
    };

    const run_promise = execute_on_pool();
    this.request_promises.set(request_id, run_promise);

    if (is_background) {
      run_promise.catch(() => {
        // captured in req_record.error for background requests
      });
      return {
        request_id,
        routed_via: 'worker_pool',
        background: true,
        status: req_record.status,
        worker_id: req_record.worker_id,
        role: target_role,
        type: req_type,
        epic_id: req_record.epic_id
      };
    }

    return run_promise;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists requests submitted to the daemon worker pool
   * verbose: returns request descriptors filtered optionally by status, type, or role.
   * 
   * section: arguments
   * - filter (object, optional): { status, type, role }
   * 
   * section: return value
   * - requests (array): list of submitted request records
   * 
   * section: example
   * const reqs = pool.list_requests({ status: 'completed' });
   */
  list_requests(filter = {}) {
    return this.submitted_requests
      .filter((r) => {
        if (filter.status && r.status !== filter.status) return false;
        if (filter.type && r.type !== filter.type) return false;
        if (filter.role && r.role !== filter.role) return false;
        return true;
      })
      .map((r) => ({ ...r }));
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: retrieves a specific worker pool request by identifier
   * verbose: returns a shallow copy of the request record or null if not found.
   * 
   * section: arguments
   * - request_id (string): request identifier
   * 
   * section: return value
   * - request (object|null): request record
   * 
   * section: example
   * const req = pool.get_request('req-0001');
   */
  get_request(request_id) {
    const found = this.submitted_requests.find((r) => r.id === request_id);
    return found ? { ...found } : null;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: awaits completion of a background or foreground worker pool request
   * verbose: resolves with the request outcome once the worker pool finishes executing it.
   * 
   * section: arguments
   * - request_id (string): request identifier
   * 
   * section: return value
   * - outcome (promise<object|null>): resolved request outcome
   * 
   * section: example
   * const done = await pool.wait_for_request('req-0001');
   */
  async wait_for_request(request_id) {
    if (this.request_promises.get(request_id)) {
      return this.request_promises.get(request_id);
    }
    return this.get_request(request_id);
  }
}

export function create_worker_pool_daemon(options = {}) {
  return new WorkerPoolDaemon(options);
}

