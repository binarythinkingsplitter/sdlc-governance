/**
 * =========================================================================
 * module: filestore adapter
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: filesystem storage adapter for sdlc document entity store
 * verbose: provides persistent json entity persistence under .sdlc/store,
 * supporting isolation, path sanitisation, and collection indexing.
 * 
 * section: export catalog
 * - create_filestore_adapter: factory function creating a filestore adapter instance
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * =========================================================================
 * class: FilestoreAdapter
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: durable json filestore adapter for tier 1 entities
 * verbose: manages directory creation, json serialisation, and retrieval with path traversal defence.
 * 
 * section: arguments
 * - options (object, optional): { store_root, workspace_root }
 * 
 * section: example
 * const adapter = new FilestoreAdapter({ store_root: '.sdlc/store' });
 * =========================================================================
 */
export class FilestoreAdapter {
  workspace_root;
  store_root;

  constructor(options = {}) {
    this.workspace_root = path.resolve(options.workspace_root || process.cwd());
    this.store_root = options.store_root
      ? path.resolve(this.workspace_root, options.store_root)
      : path.join(this.workspace_root, '.sdlc', 'store');
  }

  /**
   * sanitises collection and entity identifiers to prevent path traversal
   */
  #sanitize_path_segment(segment) {
    if (!segment || typeof segment !== 'string') {
      throw new Error('invalid storage segment: identifier must be a non-empty string');
    }
    const sanitized = path.basename(segment);
    if (sanitized !== segment || segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
      throw new Error(`path traversal violation detected: "${segment}"`);
    }
    return sanitized;
  }

  #resolve_collection_dir(collection) {
    return path.join(this.store_root, this.#sanitize_path_segment(collection));
  }

  #resolve_entity_file(collection, id) {
    const dir = this.#resolve_collection_dir(collection);
    const safe_id = this.#sanitize_path_segment(id);
    const file_name = safe_id.endsWith('.json') ? safe_id : `${safe_id}.json`;
    return path.join(dir, file_name);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns resolved base storage directory
   * verbose: returns absolute path to root directory containing collection folders.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - root (string): storage root path
   * 
   * section: example
   * const root = adapter.get_store_root();
   */
  get_store_root() {
    return this.store_root;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: saves an entity to storage
   * verbose: writes entity as formatted json to .sdlc/store/<collection>/<id>.json.
   * 
   * section: arguments
   * - collection (string): collection name (e.g. prds, stories, tasks)
   * - id (string): unique entity identifier
   * - data (object): serialisable entity data
   * 
   * section: return value
   * - file_path (string): path where entity was written
   * 
   * section: example
   * adapter.save('prds', 'prd-01', { id: 'prd-01', title: 'harness' });
   */
  save(collection, id, data) {
    const target_file = this.#resolve_entity_file(collection, id);
    const target_dir = path.dirname(target_file);

    if (!fs.existsSync(target_dir)) {
      fs.mkdirSync(target_dir, { recursive: true });
    }

    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(target_file, payload, 'utf-8');
    return target_file;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: retrieves entity by identifier
   * verbose: reads and parses json file or returns null if not found.
   * 
   * section: arguments
   * - collection (string): collection name
   * - id (string): entity identifier
   * 
   * section: return value
   * - entity (object|null): parsed entity object or null
   * 
   * section: example
   * const prd = adapter.find_by_id('prds', 'prd-01');
   */
  find_by_id(collection, id) {
    const target_file = this.#resolve_entity_file(collection, id);
    if (!fs.existsSync(target_file)) {
      return null;
    }
    const raw = fs.readFileSync(target_file, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists all entity identifiers in a collection
   * verbose: reads directory and extracts entity ids without .json extension.
   * 
   * section: arguments
   * - collection (string): collection name
   * 
   * section: return value
   * - ids (array): array of entity identifier strings
   * 
   * section: example
   * const ids = adapter.list_ids('prds');
   */
  list_ids(collection) {
    const dir = this.#resolve_collection_dir(collection);
    if (!fs.existsSync(dir)) {
      return [];
    }
    const files = fs.readdirSync(dir);
    const ids = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (file.endsWith('.json')) {
        ids.push(file.slice(0, -5));
      }
    }
    return ids;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: finds all entities matching an optional filter predicate
   * verbose: iterates through collection files, parsing and filtering records.
   * 
   * section: arguments
   * - collection (string): collection name
   * - filter_fn (function, optional): predicate function (item) => boolean
   * 
   * section: return value
   * - items (array): array of matching parsed entity objects
   * 
   * section: example
   * const items = adapter.find_all('stories', (s) => s.linked_prd_id === 'prd-01');
   */
  find_all(collection, filter_fn = null) {
    const dir = this.#resolve_collection_dir(collection);
    if (!fs.existsSync(dir)) {
      return [];
    }
    const files = fs.readdirSync(dir);
    const results = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (file.endsWith('.json')) {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
        const parsed = JSON.parse(raw);
        if (!filter_fn || filter_fn(parsed)) {
          results.push(parsed);
        }
      }
    }
    return results;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: deletes entity from collection
   * verbose: unlinks json entity file if it exists.
   * 
   * section: arguments
   * - collection (string): collection name
   * - id (string): entity identifier
   * 
   * section: return value
   * - deleted (boolean): true if file was deleted, false if file did not exist
   * 
   * section: example
   * adapter.delete('prds', 'prd-01');
   */
  delete(collection, id) {
    const target_file = this.#resolve_entity_file(collection, id);
    if (!fs.existsSync(target_file)) {
      return false;
    }
    fs.unlinkSync(target_file);
    return true;
  }
}

/**
 * function: create_filestore_adapter
 * tldr: convenience constructor returning a new FilestoreAdapter
 */
export function create_filestore_adapter(options = {}) {
  return new FilestoreAdapter(options);
}
