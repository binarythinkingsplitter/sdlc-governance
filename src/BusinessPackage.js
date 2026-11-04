/**
 * =========================================================================
 * module: BusinessPackage.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: business package specification, validation, and registry engine
 * verbose: provides modern es6 abstractions for defining self-contained business domain packages
 * (macro statecharts, stage routing, review gates, micro workflows, role agents, tools, skills, schemas)
 * and managing dynamic discovery and registration.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - object: exports package definition, registry factory, and discovery utilities
 * 
 * section: example
 * import { define_business_package, create_package_registry } from './BusinessPackage.js';
 * const pkg = define_business_package({ id: 'crm-core', name: 'crm package', version: '0.1.0' });
 * const reg = create_package_registry();
 * reg.register_package(pkg);
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * =========================================================================
 * function: define_business_package
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: validates and defines an immutable business domain package descriptor
 * verbose: enforces fail-closed manifest validation on package metadata and returns
 * a structured package descriptor bundling statecharts, gates, workflows, agents, tools, skills, and schemas.
 * 
 * section: arguments
 * - definition (object): raw package configuration dictionary
 * 
 * section: return value
 * - pkg (object): validated business domain package descriptor
 * 
 * section: example
 * const pkg = define_business_package({
 *   id: 'finance-core',
 *   name: 'finance package',
 *   version: '0.1.0',
 *   description: 'budget variance and invoice approvals'
 * });
 * =========================================================================
 */
export function define_business_package(definition = {}) {
  if (!definition || typeof definition !== 'object') {
    throw new Error('invalid_package_manifest: package definition must be a valid configuration object');
  }

  const { id, name, version, description = '' } = definition;

  if (!id || typeof id !== 'string') {
    throw new Error('invalid_package_manifest: package definition requires a valid string id');
  }

  if (!/^[a-z0-9_-]+$/i.test(id)) {
    throw new Error(`invalid_package_id: package id '${id}' contains invalid characters (allowed: a-z, 0-9, _, -)`);
  }

  if (!name || typeof name !== 'string') {
    throw new Error('invalid_package_manifest: package definition requires a valid string name');
  }

  if (!version || typeof version !== 'string') {
    throw new Error('invalid_package_manifest: package definition requires a valid semantic version string');
  }

  const statecharts = definition.statecharts || {};
  const gates = definition.gates || {};
  const workflows = definition.workflows || {};
  const agents = definition.agents || {};
  const tools = definition.tools || {};
  const skills = definition.skills || {};
  const schemas = definition.schemas || {};

  return {
    id: id.toLowerCase(),
    name: name.toLowerCase(),
    version,
    description: description.toLowerCase(),
    statecharts: {
      project_machine_config: statecharts.project_machine_config || null,
      work_item_machine_config: statecharts.work_item_machine_config || null,
      stage_routing: statecharts.stage_routing || {}
    },
    gates,
    workflows,
    agents,
    tools,
    skills,
    schemas
  };
}

/**
 * =========================================================================
 * class: PackageRegistry
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: provides dynamic package registry using modern ES6 Map collection
 * verbose: manages registered business packages, indexing by unique package identifier
 * leveraging native Map collection and ES6 class syntax.
 * =========================================================================
 */
export class PackageRegistry {
  constructor(options = {}) {
    this.options = options;
    this.packages = new Map();
  }

  register_package(pkg) {
    const validated = define_business_package(pkg);
    this.packages.set(validated.id, validated);
    return true;
  }

  get_package(package_id) {
    if (!package_id) return null;
    return this.packages.get(package_id.toLowerCase()) || null;
  }

  list_packages() {
    return Array.from(this.packages.values());
  }
}

/**
 * =========================================================================
 * function: create_package_registry
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: creates a dynamic package registry instance
 * verbose: returns a PackageRegistry instance powered by native Map collection.
 * =========================================================================
 */
export function create_package_registry(options = {}) {
  return new PackageRegistry(options);
}

/**
 * =========================================================================
 * function: discover_installed_packages
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: dynamically discovers business packages from workspace search paths
 * verbose: scans designated directories and manifests to discover and instantiate
 * business packages matching the canonical package manifest contract.
 * 
 * section: arguments
 * - options (object, optional): search options including search_paths and workspace_root
 * 
 * section: return value
 * - discovered (array): array of discovered package descriptors
 * 
 * section: example
 * const pkgs = discover_installed_packages({ workspace_root: process.cwd() });
 * =========================================================================
 */
export function discover_installed_packages(options = {}) {
  const discovered = [];
  const search_dirs = options.search_paths || [];
  const root = options.workspace_root || process.cwd();

  // check workspace packages directory if it exists
  const default_pkg_dir = path.join(root, '.sdlc', 'packages');
  if (fs.existsSync(default_pkg_dir)) {
    search_dirs.push(default_pkg_dir);
  }

  for (let s = 0; s < search_dirs.length; s += 1) {
    const dir = search_dirs[s];
    if (!fs.existsSync(dir)) continue;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (let e = 0; e < entries.length; e += 1) {
        const entry = entries[e];
        if (entry.isDirectory()) {
          const manifest_path = path.join(dir, entry.name, 'package.json');
          if (fs.existsSync(manifest_path)) {
            try {
              const raw = JSON.parse(fs.readFileSync(manifest_path, 'utf-8'));
              if (raw.sdlc_package || raw.business_package) {
                const pkg_def = raw.sdlc_package || raw.business_package;
                discovered.push(define_business_package({
                  id: pkg_def.id || entry.name,
                  name: pkg_def.name || raw.name || entry.name,
                  version: pkg_def.version || raw.version || '0.1.0',
                  description: pkg_def.description || raw.description || ''
                }));
              }
            } catch (_err) {
              // ignore malformed manifest
            }
          }
        }
      }
    } catch (_err) {
      // ignore readdir error
    }
  }

  return discovered;
}
