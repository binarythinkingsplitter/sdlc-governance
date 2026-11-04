/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: mastra filesystem storage, persistent memory domain, and scoped knowledge resolver
 * verbose: creates and configures sovereign filesystem storage, thread-scoped working and
 * observational memory, and scoped knowledge graphs for role agents.
 * persists threads, messages, working memory, observations, and
 * knowledge records atomically under .sdlc/mastra/.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - instance (object): operational memory and knowledge storage factory module
 * 
 * section: example
 * import { create_mastra_memory_storage } from './MastraMemoryStorage.js';
 * const mem_store = create_mastra_memory_storage();
 */

import fs from 'node:fs';
import path from 'node:path';
import { FilesystemStore, InMemoryStore } from '@mastra/core/storage';
import { MastraMemory, MockMemory } from '@mastra/core/memory';
import { Knowledge } from '@mastra/core/knowledge';

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: sanitises identifier strings for safe filesystem filenames
 * verbose: replaces unsafe path characters with underscores to prevent directory traversal.
 * 
 * section: arguments
 * - raw_id (string): raw identifier string
 * 
 * section: return value
 * - safe_id (string): sanitised filename stem
 * 
 * section: example
 * const safe = sanitise_storage_key('thread-01');
 */
function sanitise_storage_key(raw_id) {
  return String(raw_id || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: writes json payload atomically to disk via temporary swap file
 * verbose: serialises data to a .tmp file and renames over target path to prevent corruption.
 * 
 * section: arguments
 * - file_path (string): destination absolute file path
 * - payload (any): serialisable json value
 * 
 * section: return value
 * - written (boolean): true when write succeeds
 * 
 * section: example
 * write_json_atomic('/tmp/thread.json', { id: 't1' });
 */
function write_json_atomic(file_path, payload) {
  const parent_dir = path.dirname(file_path);
  if (!fs.existsSync(parent_dir)) {
    fs.mkdirSync(parent_dir, { recursive: true });
  }
  const tmp_path = `${file_path}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp_path, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tmp_path, file_path);
  return true;
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: reads all json files from a target directory into an array
 * verbose: scans directory entries ending with .json and parses each file safely.
 * 
 * section: arguments
 * - dir_path (string): directory path to scan
 * 
 * section: return value
 * - items (Array<object>): parsed json payloads
 * 
 * section: example
 * const records = read_json_directory('/tmp/threads');
 */
function read_json_directory(dir_path) {
  if (!fs.existsSync(dir_path)) {
    return [];
  }
  const entries = fs.readdirSync(dir_path).filter((f) => f.endsWith('.json')).sort();
  const results = [];
  for (let i = 0; i < entries.length; i += 1) {
    try {
      const full_path = path.join(dir_path, entries[i]);
      const parsed = JSON.parse(fs.readFileSync(full_path, 'utf-8'));
      results.push(parsed);
    } catch (_err) {
      // skip malformed files
    }
  }
  return results;
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a persistent filesystem-backed memory domain adapter
 * verbose: wraps mastra in-memory domain store with atomic write-through persistence and
 * automatic startup hydration across .sdlc/mastra/{threads,messages,working_memory,observations}.
 * 
 * section: arguments
 * - config (object): configuration containing storage_dir and base_memory
 * 
 * section: return value
 * - memory_domain (object): persistent mastra memory domain store
 * 
 * section: example
 * const domain = create_persistent_memory_domain({ storage_dir: '.sdlc/mastra', base_memory });
 */
export function create_persistent_memory_domain(config = {}) {
  const storage_dir = path.resolve(config.storage_dir || path.join(process.cwd(), '.sdlc', 'mastra'));
  const base_memory = config.base_memory || new InMemoryStore().stores.memory;

  const threads_dir = path.join(storage_dir, 'threads');
  const messages_dir = path.join(storage_dir, 'messages');
  const working_memory_dir = path.join(storage_dir, 'working_memory');
  const observations_dir = path.join(storage_dir, 'observations');

  const dirs = [threads_dir, messages_dir, working_memory_dir, observations_dir];
  for (let i = 0; i < dirs.length; i += 1) {
    if (!fs.existsSync(dirs[i])) {
      fs.mkdirSync(dirs[i], { recursive: true });
    }
  }

  let hydration_promise = null;

  async function ensure_hydrated() {
    if (hydration_promise) {
      return hydration_promise;
    }
    hydration_promise = (async () => {
      const stored_threads = read_json_directory(threads_dir);
      for (let i = 0; i < stored_threads.length; i += 1) {
        const raw_thread = stored_threads[i];
        if (raw_thread && raw_thread.id) {
          const restored_thread = {
            ...raw_thread,
            createdAt: raw_thread.createdAt ? new Date(raw_thread.createdAt) : new Date(),
            updatedAt: raw_thread.updatedAt ? new Date(raw_thread.updatedAt) : new Date()
          };
          await base_memory.saveThread({ thread: restored_thread });
        }
      }

      const stored_wm = read_json_directory(working_memory_dir);
      for (let i = 0; i < stored_wm.length; i += 1) {
        const wm_entry = stored_wm[i];
        if (wm_entry && wm_entry.scope === 'resource' && wm_entry.resource) {
          const restored_res = {
            ...wm_entry.resource,
            createdAt: wm_entry.resource.createdAt ? new Date(wm_entry.resource.createdAt) : new Date(),
            updatedAt: wm_entry.resource.updatedAt ? new Date(wm_entry.resource.updatedAt) : new Date()
          };
          await base_memory.saveResource({ resource: restored_res });
        }
      }

      const stored_msg_bundles = read_json_directory(messages_dir);
      for (let i = 0; i < stored_msg_bundles.length; i += 1) {
        const bundle = stored_msg_bundles[i];
        const msg_array = Array.isArray(bundle) ? bundle : (bundle && Array.isArray(bundle.messages) ? bundle.messages : []);
        if (msg_array.length > 0) {
          const restored_msgs = msg_array.map((m) => ({
            ...m,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date()
          }));
          await base_memory.saveMessages({ messages: restored_msgs });
        }
      }

      const stored_observations = read_json_directory(observations_dir);
      for (let i = 0; i < stored_observations.length; i += 1) {
        const obs = stored_observations[i];
        if (obs && obs.id && typeof base_memory.insertObservationalMemoryRecord === 'function') {
          try {
            await base_memory.insertObservationalMemoryRecord(obs);
          } catch (_err) {
            // ignore duplicate observation hydration
          }
        }
      }
    })();
    return hydration_promise;
  }

  function persist_thread_record(thread) {
    if (!thread || !thread.id) return;
    const safe_id = sanitise_storage_key(thread.id);
    write_json_atomic(path.join(threads_dir, `${safe_id}.json`), thread);
    if (thread.metadata && thread.metadata.workingMemory !== undefined) {
      write_json_atomic(path.join(working_memory_dir, `${safe_id}.json`), {
        id: thread.id,
        scope: 'thread',
        resourceId: thread.resourceId || null,
        workingMemory: thread.metadata.workingMemory,
        updatedAt: new Date().toISOString()
      });
    }
  }

  function persist_resource_record(resource) {
    if (!resource || !resource.id) return;
    const safe_id = sanitise_storage_key(resource.id);
    write_json_atomic(path.join(working_memory_dir, `${safe_id}.json`), {
      id: resource.id,
      scope: 'resource',
      workingMemory: resource.workingMemory || null,
      resource,
      updatedAt: new Date().toISOString()
    });
  }

  function persist_messages_for_thread(thread_id, incoming_messages) {
    if (!thread_id) return;
    const safe_id = sanitise_storage_key(thread_id);
    const target_path = path.join(messages_dir, `${safe_id}.json`);
    let existing = [];
    if (fs.existsSync(target_path)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(target_path, 'utf-8'));
        existing = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.messages) ? parsed.messages : []);
      } catch (_err) {
        existing = [];
      }
    }
    const merged = existing.slice();
    for (let i = 0; i < incoming_messages.length; i += 1) {
      const msg = incoming_messages[i];
      const idx = merged.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        merged[idx] = msg;
      } else {
        merged.push(msg);
      }
    }
    write_json_atomic(target_path, merged);
  }

  const proxy_handler = {
    get(target, prop) {
      if (prop === 'saveThread') {
        return async function save_thread_persisted(args) {
          await ensure_hydrated();
          const result = await target.saveThread(args);
          persist_thread_record(result || args.thread);
          return result;
        };
      }
      if (prop === 'updateThread') {
        return async function update_thread_persisted(args) {
          await ensure_hydrated();
          const result = await target.updateThread(args);
          persist_thread_record(result);
          return result;
        };
      }
      if (prop === 'deleteThread') {
        return async function delete_thread_persisted(args) {
          await ensure_hydrated();
          const result = await target.deleteThread(args);
          if (args && args.threadId) {
            const safe_id = sanitise_storage_key(args.threadId);
            const f_thread = path.join(threads_dir, `${safe_id}.json`);
            const f_msgs = path.join(messages_dir, `${safe_id}.json`);
            const f_wm = path.join(working_memory_dir, `${safe_id}.json`);
            if (fs.existsSync(f_thread)) fs.unlinkSync(f_thread);
            if (fs.existsSync(f_msgs)) fs.unlinkSync(f_msgs);
            if (fs.existsSync(f_wm)) fs.unlinkSync(f_wm);
          }
          return result;
        };
      }
      if (prop === 'saveMessages') {
        return async function save_messages_persisted(args) {
          await ensure_hydrated();
          const result = await target.saveMessages(args);
          const msgs = (args && Array.isArray(args.messages)) ? args.messages : [];
          const thread_ids = [];
          for (let i = 0; i < msgs.length; i += 1) {
            const tid = msgs[i].threadId || msgs[i].thread_id;
            if (tid && !thread_ids.includes(tid)) {
              thread_ids.push(tid);
            }
          }
          for (let i = 0; i < thread_ids.length; i += 1) {
            const tid = thread_ids[i];
            const subset = msgs.filter((m) => (m.threadId || m.thread_id) === tid);
            persist_messages_for_thread(tid, subset);
          }
          return result;
        };
      }
      if (prop === 'saveResource') {
        return async function save_resource_persisted(args) {
          await ensure_hydrated();
          const result = await target.saveResource(args);
          persist_resource_record(result || (args && args.resource));
          return result;
        };
      }
      if (prop === 'updateResource') {
        return async function update_resource_persisted(args) {
          await ensure_hydrated();
          const result = await target.updateResource(args);
          persist_resource_record(result);
          return result;
        };
      }
      if (prop === 'insertObservationalMemoryRecord') {
        return async function insert_obs_persisted(record) {
          await ensure_hydrated();
          const result = await target.insertObservationalMemoryRecord(record);
          if (record && record.id) {
            const safe_id = sanitise_storage_key(record.id);
            write_json_atomic(path.join(observations_dir, `${safe_id}.json`), record);
          }
          return result;
        };
      }
      const value = target[prop];
      if (typeof value === 'function') {
        return async function wrapped_memory_method(...call_args) {
          await ensure_hydrated();
          return value.apply(target, call_args);
        };
      }
      return value;
    }
  };

  return new Proxy(base_memory, proxy_handler);
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a persistent filesystem-backed knowledge domain adapter
 * verbose: wraps mastra knowledge storage with atomic write-through persistence and startup
 * hydration under .sdlc/mastra/knowledge/{nodes,records}.
 * 
 * section: arguments
 * - config (object): configuration containing storage_dir and base_knowledge
 * 
 * section: return value
 * - knowledge_domain (object): persistent mastra knowledge domain store
 * 
 * section: example
 * const kn_domain = create_persistent_knowledge_domain({ storage_dir: '.sdlc/mastra', base_knowledge });
 */
export function create_persistent_knowledge_domain(config = {}) {
  const storage_dir = path.resolve(config.storage_dir || path.join(process.cwd(), '.sdlc', 'mastra'));
  const base_knowledge = config.base_knowledge || new InMemoryStore().stores.knowledge;

  const kn_root = path.join(storage_dir, 'knowledge');
  const nodes_dir = path.join(kn_root, 'nodes');
  const records_dir = path.join(kn_root, 'records');

  const dirs = [kn_root, nodes_dir, records_dir];
  for (let i = 0; i < dirs.length; i += 1) {
    if (!fs.existsSync(dirs[i])) {
      fs.mkdirSync(dirs[i], { recursive: true });
    }
  }

  let hydration_promise = null;

  async function ensure_hydrated() {
    if (hydration_promise) {
      return hydration_promise;
    }
    hydration_promise = (async () => {
      const stored_nodes = read_json_directory(nodes_dir);
      for (let i = 0; i < stored_nodes.length; i += 1) {
        const n = stored_nodes[i];
        if (n && n.name && Array.isArray(n.scope)) {
          try {
            await base_knowledge.createNode({
              id: n.id,
              scope: n.scope,
              name: n.name,
              kind: n.kind,
              description: n.description
            });
          } catch (_err) {
            // ignore duplicate node hydration
          }
        }
      }

      for (let i = 0; i < stored_nodes.length; i += 1) {
        const n = stored_nodes[i];
        if (n && n.id && n.content !== undefined) {
          try {
            const current = await base_knowledge.getNode(n.id);
            if (current) {
              await base_knowledge.updateNode({
                id: n.id,
                version: current.version,
                content: n.content,
                resolutionScope: n.resolutionScope || n.scope
              });
            }
          } catch (_err) {
            // ignore update conflicts during hydration
          }
        }
      }

      const stored_records = read_json_directory(records_dir);
      for (let i = 0; i < stored_records.length; i += 1) {
        const r = stored_records[i];
        if (r && r.node && r.text && Array.isArray(r.scope)) {
          try {
            await base_knowledge.appendKnowledge({
              id: r.id,
              scope: r.scope,
              node: r.node,
              text: r.text,
              sourceThreadId: r.sourceThreadId,
              resolutionScope: r.resolutionScope || r.scope,
              defaultScope: r.defaultScope || r.scope,
              metadata: r.metadata
            });
          } catch (_err) {
            // ignore duplicate record hydration
          }
        }
      }
    })();
    return hydration_promise;
  }

  const proxy_handler = {
    get(target, prop) {
      if (prop === 'getCapabilities') {
        return function get_capabilities_sync(...call_args) {
          return target.getCapabilities(...call_args);
        };
      }
      if (prop === 'createNode') {
        return async function create_node_persisted(input) {
          await ensure_hydrated();
          const created = await target.createNode(input);
          if (created && created.id) {
            const safe_id = sanitise_storage_key(created.id);
            write_json_atomic(path.join(nodes_dir, `${safe_id}.json`), {
              ...created,
              resolutionScope: input.resolutionScope || created.scope
            });
          }
          return created;
        };
      }
      if (prop === 'updateNode') {
        return async function update_node_persisted(input) {
          await ensure_hydrated();
          const updated = await target.updateNode(input);
          if (updated && updated.id) {
            const safe_id = sanitise_storage_key(updated.id);
            write_json_atomic(path.join(nodes_dir, `${safe_id}.json`), updated);
          }
          return updated;
        };
      }
      if (prop === 'appendKnowledge') {
        return async function append_knowledge_persisted(input) {
          await ensure_hydrated();
          const record = await target.appendKnowledge(input);
          if (record && record.id) {
            const safe_id = sanitise_storage_key(record.id);
            write_json_atomic(path.join(records_dir, `${safe_id}.json`), {
              ...record,
              resolutionScope: input.resolutionScope || record.scope,
              defaultScope: input.defaultScope || record.scope
            });
          }
          return record;
        };
      }
      const value = target[prop];
      if (typeof value === 'function') {
        return async function wrapped_knowledge_method(...call_args) {
          await ensure_hydrated();
          return value.apply(target, call_args);
        };
      }
      return value;
    }
  };

  return new Proxy(base_knowledge, proxy_handler);
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a persistent filesystem-backed workflowDefinitions domain adapter
 * verbose: wraps mastra in-memory workflowDefinitions store with atomic write-through persistence
 * and automatic startup hydration under .sdlc/mastra/workflow_definitions.
 * 
 * section: arguments
 * - config (object): configuration containing storage_dir and base_workflow_definitions
 * 
 * section: return value
 * - workflow_definitions_domain (object): persistent mastra workflowDefinitions domain store
 * 
 * section: example
 * const domain = create_persistent_workflow_definitions_domain({ storage_dir: '.sdlc/mastra' });
 */
export function create_persistent_workflow_definitions_domain(config = {}) {
  const storage_dir = path.resolve(config.storage_dir || path.join(process.cwd(), '.sdlc', 'mastra'));
  const base_store = config.base_workflow_definitions || new InMemoryStore().stores.workflowDefinitions;
  const defs_dir = path.join(storage_dir, 'workflow_definitions');

  if (!fs.existsSync(defs_dir)) {
    fs.mkdirSync(defs_dir, { recursive: true });
  }

  let hydration_promise = null;

  async function ensure_hydrated() {
    if (hydration_promise) {
      return hydration_promise;
    }
    hydration_promise = (async () => {
      const stored_defs = read_json_directory(defs_dir);
      for (let i = 0; i < stored_defs.length; i += 1) {
        const def = stored_defs[i];
        if (def && def.id && typeof base_store.upsert === 'function') {
          try {
            await base_store.upsert(def);
          } catch (_err) {
            // ignore duplicate hydration
          }
        }
      }
    })();
    return hydration_promise;
  }

  const proxy_handler = {
    get(target, prop) {
      if (prop === 'upsert') {
        return async function upsert_workflow_def_persisted(input) {
          await ensure_hydrated();
          const saved = await target.upsert(input);
          const record = saved || input;
          if (record && record.id) {
            const safe_id = sanitise_storage_key(record.id);
            write_json_atomic(path.join(defs_dir, `${safe_id}.json`), record);
          }
          return saved;
        };
      }
      if (prop === 'delete') {
        return async function delete_workflow_def_persisted(id) {
          await ensure_hydrated();
          const res = await target.delete(id);
          const safe_id = sanitise_storage_key(id);
          const file_path = path.join(defs_dir, `${safe_id}.json`);
          if (fs.existsSync(file_path)) {
            try {
              fs.unlinkSync(file_path);
            } catch (_err) {
              // ignore unlink error
            }
          }
          return res;
        };
      }
      const value = target[prop];
      if (typeof value === 'function') {
        return async function wrapped_workflow_def_method(...call_args) {
          await ensure_hydrated();
          return value.apply(target, call_args);
        };
      }
      return value;
    }
  };

  return new Proxy(base_store, proxy_handler);
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: resolves persistent or in-memory storage adapter for mastra
 * verbose: initialises filesystem store targeting workspace directory or in-memory store,
 * attaching persistent memory, knowledge, workflowDefinitions, and composite domains to filesystem storage.
 * 
 * section: arguments
 * - options (object, optional): storage options including storage_type and storage_dir
 * 
 * section: return value
 * - storage (object): mastra storage adapter instance
 * 
 * section: example
 * const storage = resolve_harness_storage({ storage_type: 'filesystem' });
 */
export function resolve_harness_storage(options = {}) {
  if (options.storage) {
    return options.storage;
  }

  const storage_type = options.storage_type || (options.auto_persist === false && !options.storage_dir ? 'in-memory' : 'filesystem');
  if (storage_type === 'in-memory' || storage_type === 'memory') {
    return new InMemoryStore();
  }

  const base_root = options.workspace_root || options.base_dir || process.cwd();
  const storage_dir = path.resolve(options.storage_dir || path.join(base_root, '.sdlc', 'mastra'));
  if (!fs.existsSync(storage_dir)) {
    fs.mkdirSync(storage_dir, { recursive: true });
  }

  const fs_store = new FilesystemStore({
    dir: storage_dir
  });

  const backing = new InMemoryStore();

  if (!fs_store.stores.memory) {
    fs_store.stores.memory = create_persistent_memory_domain({
      storage_dir,
      base_memory: backing.stores.memory
    });
  }

  if (!fs_store.stores.knowledge) {
    fs_store.stores.knowledge = create_persistent_knowledge_domain({
      storage_dir,
      base_knowledge: backing.stores.knowledge
    });
  }

  if (!fs_store.stores.workflowDefinitions && backing.stores.workflowDefinitions) {
    fs_store.stores.workflowDefinitions = create_persistent_workflow_definitions_domain({
      storage_dir,
      base_workflow_definitions: backing.stores.workflowDefinitions
    });
  }

  const backing_keys = Object.keys(backing.stores || {});
  for (let i = 0; i < backing_keys.length; i += 1) {
    const domain_key = backing_keys[i];
    if (!fs_store.stores[domain_key]) {
      fs_store.stores[domain_key] = backing.stores[domain_key];
    }
  }

  return fs_store;
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: resolves thread-scoped mastra memory instance
 * verbose: initialises mastra memory with working memory and observational memory.
 * 
 * section: arguments
 * - options (object, optional): memory configuration options
 * 
 * section: return value
 * - memory (object): mastra memory instance
 * 
 * section: example
 * const mem = resolve_harness_memory({ name: 'pm-memory', storage });
 */
export function resolve_harness_memory(options = {}) {
  const name = options.name || 'default-memory';
  const storage = options.storage || resolve_harness_storage(options);

  const mem = new MockMemory({
    storage,
    enableWorkingMemory: options.working_memory !== false,
    enableMessageHistory: options.enable_message_history === true,
    options: {
      workingMemory: {
        enabled: options.working_memory !== false
      },
      observationalMemory: {
        enabled: options.observational_memory === true
      }
    }
  });
  mem.name = name;

  return mem;
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: resolves scoped mastra knowledge graph instance
 * verbose: creates a mastra knowledge instance backed by persistent filesystem knowledge domain.
 * 
 * section: arguments
 * - options (object, optional): knowledge configuration options
 * 
 * section: return value
 * - knowledge (object): mastra knowledge instance
 * 
 * section: example
 * const kn = resolve_harness_knowledge({ id: 'sdlc-knowledge', storage });
 */
export function resolve_harness_knowledge(options = {}) {
  const id = options.knowledge_id || options.id || 'sdlc-knowledge';
  const storage = options.storage || resolve_harness_storage(options);

  return new Knowledge({
    id,
    storage
  });
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates unified mastra storage, memory, and knowledge configuration bundle
 * verbose: factory function returning resolved storage adapter, primary harness memory,
 * and scoped knowledge graph instance.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - bundle (object): object containing storage, memory, and knowledge instances
 * 
 * section: example
 * const bundle = create_mastra_memory_storage();
 */
export function create_mastra_memory_storage(options = {}) {
  const storage = resolve_harness_storage(options);
  const memory = resolve_harness_memory({
    ...options,
    storage
  });
  const knowledge = resolve_harness_knowledge({
    ...options,
    storage
  });

  return {
    storage,
    memory,
    knowledge
  };
}
