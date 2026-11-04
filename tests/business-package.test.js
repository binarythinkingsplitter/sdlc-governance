/**
 * =========================================================================
 * test: business-package.test.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: test suite for business package system, dynamic discovery, and sdlc package
 * verbose: verifies definition, validation, registration, dynamic discovery, and CLI
 * introspection of modular business packages decoupled from the dual-engine runtime.
 * 
 * section: example
 * node --test packages/sdlc/packages/dual-engine-harness/tests/business-package.test.js
 * =========================================================================
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  define_business_package,
  create_package_registry,
  discover_installed_packages
} from '../src/BusinessPackage.js';
import { create_sdlc_package } from '../src/SdlcPackage.js';
import { create_dual_engine_harness } from '../src/index.js';

const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('business-package: define_business_package validates package contracts', () => {
  assert.throws(() => {
    define_business_package({ name: 'missing id' });
  }, /invalid_package_manifest/);

  assert.throws(() => {
    define_business_package({ id: 'INVALID/NAME', name: 'bad characters' });
  }, /invalid_package_id/);

  const pkg = define_business_package({
    id: 'test-package',
    name: 'test business package',
    version: '1.0.0',
    description: 'a test business package for evaluation',
    statecharts: { stage_routing: {} },
    gates: {},
    workflows: {},
    agents: {},
    tools: {},
    skills: {},
    schemas: {}
  });

  assert.equal(pkg.id, 'test-package');
  assert.equal(pkg.name, 'test business package');
  assert.equal(pkg.version, '1.0.0');
});

test('business-package: package registry registers and retrieves packages without host collections', () => {
  const registry = create_package_registry();

  const pkg1 = define_business_package({
    id: 'pkg-alpha',
    name: 'alpha package',
    version: '0.1.0',
    description: 'first package'
  });

  const pkg2 = define_business_package({
    id: 'pkg-beta',
    name: 'beta package',
    version: '0.2.0',
    description: 'second package'
  });

  registry.register_package(pkg1);
  registry.register_package(pkg2);

  const list = registry.list_packages();
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'pkg-alpha');
  assert.equal(list[1].id, 'pkg-beta');

  const found = registry.get_package('pkg-alpha');
  assert.equal(found.name, 'alpha package');

  const not_found = registry.get_package('unknown');
  assert.equal(not_found, null);
});

test('business-package: create_sdlc_package returns canonical sdlc business package', () => {
  const sdlc_pkg = create_sdlc_package();

  assert.equal(sdlc_pkg.id, 'sdlc-core');
  assert.equal(sdlc_pkg.name, 'software development lifecycle package');
  assert.ok(sdlc_pkg.statecharts.project_machine_config);
  assert.ok(sdlc_pkg.statecharts.work_item_machine_config);
  assert.ok(sdlc_pkg.statecharts.stage_routing);

  // verify review gates
  assert.ok(sdlc_pkg.gates.gate_1_planning);
  assert.ok(sdlc_pkg.gates.gate_2_implementation);
  assert.ok(sdlc_pkg.gates.gate_3_qa_security);
  assert.ok(sdlc_pkg.gates.gate_4_release);

  // verify role agents and workflows
  assert.ok(sdlc_pkg.workflows['pm-prd-authoring']);
  assert.ok(sdlc_pkg.agents['product-manager']);
  assert.ok(sdlc_pkg.tools['harness-test-runner']);
  assert.ok(sdlc_pkg.skills['tdd-lifecycle']);
  assert.ok(sdlc_pkg.schemas['product-manager']);
});

test('business-package: dual engine harness automatically mounts canonical sdlc package', () => {
  const harness = create_dual_engine_harness({
    session_id: 'test-packages-harness',
    log_file: null
  });

  const installed = harness.get_installed_packages();
  assert.ok(installed.length >= 1);
  assert.equal(installed[0].id, 'sdlc-core');

  const pkg = harness.get_package('sdlc-core');
  assert.ok(pkg);
  assert.equal(pkg.id, 'sdlc-core');

  // register custom package dynamically
  const custom_pkg = define_business_package({
    id: 'procurement-core',
    name: 'procurement package',
    version: '0.1.0',
    description: 'procurement and purchase order approvals'
  });

  harness.register_package(custom_pkg);
  assert.equal(harness.get_installed_packages().length, 2);
  assert.ok(harness.get_package('procurement-core'));
});

test('business-package: cli package list and info commands execute cleanly', () => {
  const cli_path = path.join(package_root, 'bin', 'cli.js');

  const list_out = execSync(`node ${cli_path} package list`, {
    cwd: package_root,
    encoding: 'utf-8'
  });

  assert.ok(list_out.includes('installed business packages'));
  assert.ok(list_out.includes('sdlc-core'));

  const info_out = execSync(`node ${cli_path} package info sdlc-core`, {
    cwd: package_root,
    encoding: 'utf-8'
  });

  assert.ok(info_out.includes('package id: sdlc-core'));
  assert.ok(info_out.includes('software development lifecycle package'));
  assert.ok(info_out.includes('gates (4)'));
});
