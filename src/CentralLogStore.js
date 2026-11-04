/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: central pino structured logging and telemetry store
 * verbose: creates a centralised pino logging pipeline and queryable log store
 * for the dual-engine harness, capturing structured logs across macro statechart
 * transitions, mastra agentic workflows, step pipelines, and review gates.
 * 
 * section: arguments
 * - options (object, optional): configuration options including log_file, level, session_id
 * 
 * section: return value
 * - store (object): central log store instance with pino logger and querying methods
 * 
 * section: example
 * import { create_central_log_store } from './CentralLogStore.js';
 * const store = create_central_log_store({ session_id: 'sess-01' });
 * const logger = store.get_logger('statechart');
 * logger.info({ event: 'phase:transition', to: 'phase_01_specifications' });
 */

import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import pino from 'pino';

/**
 * =========================================================================
 * class: CentralLogStore
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: central structured log store using pino
 * verbose: holds an in-memory structured log ring and optional append-only file sink.
 * 
 * section: arguments
 * - options (object, optional): { session_id, level, log_file }
 * 
 * section: example
 * const store = new CentralLogStore();
 * const entries = store.get_entries();
 * =========================================================================
 */
export class CentralLogStore {
  entries = [];
  log_file;
  root_logger;
  #file_stream = null;

  constructor(options = {}) {
    const session_id = options.session_id || 'default';
    const min_level = options.level || 'debug';
    this.log_file = options.log_file || null;

    if (this.log_file) {
      const dir = path.dirname(path.resolve(this.log_file));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.#file_stream = fs.createWriteStream(path.resolve(this.log_file), { flags: 'a' });
      this.#file_stream.on('error', () => {
        // ignore async stream open/write errors when temporary test directories are removed
      });
    }

    const memory_stream = new Writable({
      write: (chunk, _encoding, callback) => {
        const raw = chunk.toString();
        try {
          this.entries.push(JSON.parse(raw));
        } catch (_err) {
          this.entries.push({ msg: raw, time: Date.now() });
        }
        if (this.#file_stream && !this.#file_stream.destroyed) {
          this.#file_stream.write(raw);
        }
        callback();
      }
    });

    this.root_logger = pino({ level: min_level, base: { session_id } }, memory_stream);
  }

  get_root_logger() {
    return this.root_logger;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: creates a child pino logger bound to a specific component
   * verbose: binds component name and contextual metadata to child logger instance.
   * 
   * section: arguments
   * - component (string): component identifier (statechart, mastra, gatekeeper, etc.)
   * - bindings (object, optional): extra static bindings
   * 
   * section: return value
   * - logger (object): pino child logger
   * 
   * section: example
   * const logger = store.get_logger('mastra', { task_id: 'task-1' });
   */
  get_logger(component, bindings = {}) {
    return this.root_logger.child({
      component,
      ...bindings
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns all captured log entries
   * verbose: returns array copy of all structured log entries recorded in memory.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - logs (array): list of structured log entries
   * 
   * section: example
   * const all = store.get_entries();
   */
  get_entries() {
    return [...this.entries];
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: queries recorded logs by filtering criteria
   * verbose: filters log entries by component, event, level, or custom predicate.
   * 
   * section: arguments
   * - criteria (object, optional): filter properties (component, event, level, task_id)
   * 
   * section: return value
   * - matches (array): array of matching log entries
   * 
   * section: example
   * const mastra_logs = store.query_logs({ component: 'mastra' });
   */
  query_logs(criteria = {}) {
    return this.entries.filter((entry) => {
      if (criteria.component && entry.component !== criteria.component) {
        return false;
      }
      if (criteria.event && entry.event !== criteria.event) {
        return false;
      }
      if (criteria.task_id && entry.task_id !== criteria.task_id) {
        return false;
      }
      if (criteria.session_id && entry.session_id !== criteria.session_id) {
        return false;
      }
      if (typeof criteria.level === 'number' && entry.level !== criteria.level) {
        return false;
      }
      return true;
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: clears in-memory log buffer
   * verbose: empties the array of recorded log entries.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * none
   * 
   * section: example
   * store.clear();
   */
  clear() {
    this.entries.length = 0;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns configured persistent log file path
   * verbose: returns string path to persistent log file or null if unconfigured.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - file_path (string|null): path to log file
   * 
   * section: example
   * const path = store.get_log_file();
   */
  get_log_file() {
    return this.log_file;
  }
}

/**
 * function: create_central_log_store
 * tldr: convenience constructor returning a new CentralLogStore
 */
export function create_central_log_store(options = {}) {
  return new CentralLogStore(options);
}
