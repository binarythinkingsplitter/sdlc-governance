/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: task backlog dag planning and topological execution engine
 * verbose: manages task graph dependencies, detects cycles, and resolves execution
 * order using plain arrays.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - runner (object): task dag runner engine instance
 * 
 * section: example
 * import { create_task_dag_runner } from './TaskDagEngine.js';
 * const runner = create_task_dag_runner();
 */

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a task backlog dag runner with topological dependency resolution
 * verbose: resolves task dependencies using primitive arrays to guarantee strict
 * topological execution order.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - runner (object): task dag runner instance with compute_topological_order method
 * 
 * section: example
 * const runner = create_task_dag_runner();
 * const order = runner.compute_topological_order({ nodes: [] });
 */
export class TaskDagRunner {
  logger;
  task_states;

  constructor(options = {}) {
    this.task_states = [];

    this.logger = options.logger || null;

  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: computes topological ordering of task dag nodes
   * verbose: performs kahn-style topological sort over node dependency graph.
   * 
   * section: arguments
   * - dag (object): directed acyclic graph containing nodes array
   * 
   * section: return value
   * - order (array): topologically ordered array of task identifiers
   * 
   * section: example
   * const order = runner.compute_topological_order({ nodes: [{ id: 'a' }] });
   */
  compute_topological_order(dag) {
    const raw_nodes = dag?.nodes || [];
    const nodes = [];
    for (let i = 0; i < raw_nodes.length; i += 1) {
      const candidate = raw_nodes[i];
      if (!candidate || !candidate.id) {
        continue;
      }
      const existing_idx = nodes.findIndex((n) => n.id === candidate.id);
      if (existing_idx >= 0) {
        nodes[existing_idx] = candidate;
      } else {
        nodes.push(candidate);
      }
    }
    const order = [];
    const resolved = [];

    if (this.logger) {
      this.logger.debug({
        event: 'dag:sort:started',
        component: 'dag',
        node_count: nodes.length
      });
    }

    let iterations = 0;
    const max_iterations = nodes.length * 2 + 10;

    while (order.length < nodes.length && iterations < max_iterations) {
      iterations += 1;
      let progress = false;

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (resolved.includes(node.id)) {
          continue;
        }

        const dependencies = node.depends_on || [];
        const all_satisfied = dependencies.every((dep_id) => resolved.includes(dep_id));

        if (all_satisfied) {
          order.push(node.id);
          resolved.push(node.id);
          progress = true;
        }
      }

      if (!progress) {
        break;
      }
    }

    if (order.length < nodes.length) {
      if (this.logger) {
        this.logger.error({
          event: 'dag:cycle_detected',
          component: 'dag',
          resolved_count: order.length,
          total_nodes: nodes.length
        });
      }
      throw new Error(`invalid_cyclic_dependency: cycle detected across ${nodes.length - order.length} unresolved task nodes`);
    }

    if (this.logger) {
      this.logger.info({
        event: 'dag:sort:completed',
        component: 'dag',
        ordered_nodes: order
      });
    }

    return order;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: registers or updates execution status of a task
   * verbose: updates task state in array tracking list.
   * 
   * section: arguments
   * - task_id (string): task identifier
   * - status (string): task status
   * 
   * section: return value
   * - updated (object): updated task status record
   * 
   * section: example
   * runner.set_task_status('task-1', 'completed');
   */
  set_task_status(task_id, status) {
    for (let i = 0; i < this.task_states.length; i += 1) {
      if (this.task_states[i].task_id === task_id) {
        this.task_states[i].status = status;
        return this.task_states[i];
      }
    }
    const record = { task_id, status };
    this.task_states.push(record);
    return record;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns all registered task state records
   * verbose: returns array copy of current task states.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - states (array): array copy of registered task states
   * 
   * section: example
   * const states = runner.get_task_states();
   */
  get_task_states() {
    return this.task_states.slice();
  }
}

export function create_task_dag_runner(options = {}) {
  return new TaskDagRunner(options);
}

