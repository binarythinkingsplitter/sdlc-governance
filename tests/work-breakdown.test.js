/**
 * =========================================================================
 * test: work-breakdown.test.js
 * =========================================================================
 * 
 * section: documentation
 * tldr: tests for canonical work breakdown manager and task hierarchy builder
 * verbose: verifies action-slug task directory creation, generic task.md authoring,
 * child tasks/ directory provisioning, numbered descriptive child task generation,
 * detection of malformed/undefined files, and path traversal security.
 * =========================================================================
 */

import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  create_work_breakdown_manager
} from '../src/WorkBreakdownManager.js';
import {
  task,
  create_document_builder
} from '../src/DocumentBuilder.js';

test('work-breakdown: creates action-slug task directory and generic task.md', async () => {
  const tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-wb-test-'));

  try {
    const manager = create_work_breakdown_manager({
      root_dir: tmp_dir,
      allowed_dir: tmp_dir
    });

    const task_result = manager.create_task({
      slug: 'establish_nine_part_numbered_documentation_directory_structure',
      title: 'establish nine-part numbered documentation directory structure',
      description: 'create canonical clean-room documentation hierarchy from 00-inception through 10-continuous-learning.',
      role: 'system_architect',
      acceptance_criteria: [
        'directory 03 is strictly 03-data',
        'all folders contain baseline README.md'
      ]
    });

    assert.ok(task_result.success);
    assert.ok(fs.existsSync(task_result.task_dir));
    assert.ok(fs.existsSync(task_result.task_file));
    assert.ok(fs.existsSync(task_result.tasks_dir));

    // verify generic task.md naming
    assert.equal(path.basename(task_result.task_file), 'task.md');
    // verify child folder is named tasks (not subtasks)
    assert.equal(path.basename(task_result.tasks_dir), 'tasks');

    const content = fs.readFileSync(task_result.task_file, 'utf-8');
    assert.ok(content.includes('establish nine-part numbered documentation directory structure'));
    assert.ok(content.includes('system_architect'));
    assert.ok(content.includes('directory 03 is strictly 03-data'));
  } finally {
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  }
});

test('work-breakdown: creates numbered descriptive child tasks in tasks/ folder', async () => {
  const tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-wb-test-'));

  try {
    const manager = create_work_breakdown_manager({
      root_dir: tmp_dir,
      allowed_dir: tmp_dir
    });

    const task_slug = 'scaffold_pure_piumarta_kernel';
    manager.create_task({
      slug: task_slug,
      title: 'scaffold pure piumarta kernel',
      description: 'initialise core vtable and dynamic dispatch runtime.'
    });

    const child_1 = manager.add_child_task(task_slug, {
      number: 1,
      slug: 'implement_primitive_vtable_bootstrap',
      title: 'implement primitive vtable bootstrap',
      description: 'create root vtable and object instances without host collections.',
      steps: [
        'define vtable structure with parallel keys and values',
        'bind message send dispatch method'
      ]
    });

    const child_2 = manager.add_child_task(task_slug, {
      number: 2,
      slug: 'implement_dynamic_message_send',
      title: 'implement dynamic message send',
      description: 'dispatch messages via lookup through vtable hierarchy.',
      steps: [
        'implement lookup_method traversing delegates',
        'handle doesNotUnderstand when selector missing'
      ]
    });

    assert.equal(path.basename(child_1.file_path), '01-implement_primitive_vtable_bootstrap.md');
    assert.equal(path.basename(child_2.file_path), '02-implement_dynamic_message_send.md');

    assert.ok(fs.existsSync(child_1.file_path));
    assert.ok(fs.existsSync(child_2.file_path));

    const content_1 = fs.readFileSync(child_1.file_path, 'utf-8');
    assert.ok(content_1.includes('01-implement_primitive_vtable_bootstrap'));
    assert.ok(content_1.includes('parallel keys and values'));

    const validation = manager.validate_hierarchy(task_slug);
    assert.equal(validation.valid, true);
    assert.equal(validation.child_count, 2);
  } finally {
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  }
});

test('work-breakdown: detects malformed undefined.md files in tasks folder', async () => {
  const tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-wb-test-'));

  try {
    const manager = create_work_breakdown_manager({
      root_dir: tmp_dir,
      allowed_dir: tmp_dir
    });

    const task_slug = 'flawed_legacy_task';
    const res = manager.create_task({
      slug: task_slug,
      title: 'flawed legacy task'
    });

    // plant a malformed undefined.md file as found in legacy migrations
    fs.writeFileSync(path.join(res.tasks_dir, 'undefined.md'), 'rubbish content', 'utf-8');

    const validation = manager.validate_hierarchy(task_slug);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((err) => err.includes('undefined.md')));
  } finally {
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  }
});

test('work-breakdown: rejects path traversal attempts in task slug', async () => {
  const tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-wb-test-'));

  try {
    const manager = create_work_breakdown_manager({
      root_dir: tmp_dir,
      allowed_dir: tmp_dir
    });

    assert.throws(() => {
      manager.create_task({ slug: '../malicious_slug', title: 'malicious' });
    }, /security_violation/);

    assert.throws(() => {
      manager.create_task({ slug: 'valid_task/../../etc', title: 'malicious' });
    }, /security_violation/);
  } finally {
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  }
});

test('work-breakdown: task template in DocumentBuilder integrates seamlessly', async () => {
  const doc = task.create('build_harness_cli')
    .title('build harness cli')
    .description('cli entry points for orchestrating dual engine sdlc workflows.')
    .section.create('acceptance')
    .heading('acceptance criteria')
    .list(['package list command', 'status command']);

  const md = doc.render();
  assert.ok(md.includes('# task: build harness cli'));
  assert.ok(md.includes('cli entry points'));
  assert.ok(md.includes('package list command'));
});
