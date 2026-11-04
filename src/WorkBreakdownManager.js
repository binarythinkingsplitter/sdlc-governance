/**
 * =========================================================================
 * module: WorkBreakdownManager.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: canonical work breakdown manager and task hierarchy builder
 * verbose: creates action-slug task directories containing a generic task.md
 * specification, an isolated tasks/ child directory, numbered child task
 * markdown files, and structural validation guards.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - object: exports factory functions for work breakdown management
 * 
 * section: example
 * import { create_work_breakdown_manager } from './WorkBreakdownManager.js';
 * const manager = create_work_breakdown_manager({ root_dir: 'docs/work-breakdown/tasks' });
 * manager.create_task({ slug: 'implement_feature', title: 'implement feature' });
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * =========================================================================
 * function: sanitize_slug
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: validates and normalises slug against path traversal characters
 * verbose: checks slug against strict alphanumeric pattern and throws if unsafe.
 * 
 * section: arguments
 * - slug (string): input slug string
 * 
 * section: return value
 * - safe_slug (string): sanitised lowercase slug
 * 
 * section: example
 * const safe = sanitize_slug('build_feature');
 * =========================================================================
 */
export function sanitize_slug(slug) {
  if (typeof slug !== 'string' || !slug.trim()) {
    throw new Error('invalid_argument: slug must be a non-empty string');
  }
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`security_violation: slug contains path traversal characters: ${slug}`);
  }
  if (!/^[a-z0-9_-]+$/.test(trimmed)) {
    throw new Error(`invalid_slug: slug must only contain lowercase alphanumeric characters, underscores, or hyphens: ${slug}`);
  }
  return trimmed;
}

/**
 * =========================================================================
 * function: create_work_breakdown_manager
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates work breakdown hierarchy manager instance
 * verbose: manages creation and validation of canonical task directories
 * (<slug>/task.md and <slug>/tasks/<n>-<child>.md) preserving clean doc structures.
 * 
 * section: arguments
 * - options (object, optional): configuration including root_dir and allowed_dir
 * 
 * section: return value
 * - manager (object): functional work breakdown manager instance
 * 
 * section: example
 * const mgr = create_work_breakdown_manager({ root_dir: './tasks' });
 * =========================================================================
 */
export function create_work_breakdown_manager(options = {}) {
  const root_dir = path.resolve(options.root_dir || path.join(process.cwd(), 'docs', 'work-breakdown', 'tasks'));
  const allowed_dir = path.resolve(options.allowed_dir || root_dir);

  function assert_safe_path(target_path) {
    const resolved = path.resolve(target_path);
    if (!resolved.startsWith(allowed_dir)) {
      throw new Error(`security_violation: target path resides outside allowed boundary: ${resolved}`);
    }
    return resolved;
  }

  return {
    get_root_dir() {
      return root_dir;
    },

    /**
     * section: version number
     * version: 0.1.0
     * 
     * section: documentation
     * tldr: creates a canonical task directory with generic task.md and tasks/ folder
     * verbose: provisions <root>/<slug>/task.md and <root>/<slug>/tasks/ directory.
     * 
     * section: arguments
     * - task_options (object): task parameters (slug, title, description, role, acceptance_criteria)
     * 
     * section: return value
     * - result (object): task directory layout confirmation receipt
     */
    create_task(task_options = {}) {
      const slug = sanitize_slug(task_options.slug);
      const task_dir = assert_safe_path(path.join(root_dir, slug));
      const tasks_dir = path.join(task_dir, 'tasks');
      const task_file = path.join(task_dir, 'task.md');

      if (!fs.existsSync(tasks_dir)) {
        fs.mkdirSync(tasks_dir, { recursive: true });
      }

      const title = task_options.title || slug.replace(/[_-]/g, ' ');
      const description = task_options.description || 'decomposed operational work breakdown task.';
      const role = task_options.role || 'software_engineer';
      const status = task_options.status || 'proposed';
      const criteria = Array.isArray(task_options.acceptance_criteria)
        ? task_options.acceptance_criteria
        : [];

      const lines = [
        `# task: ${title}`,
        '',
        `**task slug:** \`${slug}\`  `,
        `**status:** ${status}  `,
        `**assigned role:** ${role}  `,
        `**created at:** ${new Date().toISOString().split('T')[0]}  `,
        '',
        '---',
        '',
        '## 1. objective & description',
        '',
        description,
        '',
        '---',
        '',
        '## 2. acceptance criteria',
        ''
      ];

      if (criteria.length > 0) {
        for (let i = 0; i < criteria.length; i++) {
          lines.push(`- ${criteria[i]}`);
        }
      } else {
        lines.push('- all child tasks in `tasks/` complete with verified gate passing.');
      }

      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('## 3. decomposed child tasks');
      lines.push('');
      lines.push('child execution tasks reside in the `tasks/` directory below.');
      lines.push('');

      fs.writeFileSync(task_file, lines.join('\n'), 'utf-8');

      return {
        success: true,
        task_slug: slug,
        task_dir,
        task_file,
        tasks_dir
      };
    },

    /**
     * section: version number
     * version: 0.1.0
     * 
     * section: documentation
     * tldr: adds a numbered descriptive child task file inside tasks/ directory
     * verbose: creates <root>/<task_slug>/tasks/<number>-<child_slug>.md with structured content.
     * 
     * section: arguments
     * - task_slug (string): parent task slug
     * - child_options (object): child task parameters (number, slug, title, description, steps)
     * 
     * section: return value
     * - result (object): child task creation receipt
     */
    add_child_task(task_slug, child_options = {}) {
      const parent_slug = sanitize_slug(task_slug);
      const child_slug = sanitize_slug(child_options.slug);
      const number = typeof child_options.number === 'number' ? child_options.number : 1;
      const padded_number = String(number).padStart(2, '0');
      const filename = `${padded_number}-${child_slug}.md`;

      const task_dir = assert_safe_path(path.join(root_dir, parent_slug));
      const tasks_dir = path.join(task_dir, 'tasks');
      if (!fs.existsSync(tasks_dir)) {
        fs.mkdirSync(tasks_dir, { recursive: true });
      }

      const file_path = path.join(tasks_dir, filename);
      const title = child_options.title || child_slug.replace(/[_-]/g, ' ');
      const description = child_options.description || 'detailed execution subtask step.';
      const steps = Array.isArray(child_options.steps) ? child_options.steps : [];

      const lines = [
        `# subtask: ${padded_number} - ${title}`,
        '',
        `**parent task:** \`${parent_slug}\`  `,
        `**subtask id:** \`${padded_number}-${child_slug}\`  `,
        `**status:** ${child_options.status || 'proposed'}  `,
        '',
        '---',
        '',
        '## 1. objective',
        '',
        description,
        '',
        '---',
        '',
        '## 2. implementation steps',
        ''
      ];

      if (steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          lines.push(`${i + 1}. ${steps[i]}`);
        }
      } else {
        lines.push('1. implement required changes and verify assertions.');
      }

      lines.push('');

      fs.writeFileSync(file_path, lines.join('\n'), 'utf-8');

      return {
        success: true,
        filename,
        file_path,
        number,
        parent_slug,
        child_slug
      };
    },

    /**
     * section: version number
     * version: 0.1.0
     * 
     * section: documentation
     * tldr: validates hierarchy integrity of a task directory
     * verbose: ensures task.md exists, tasks/ folder exists, and flags malformed/undefined files.
     * 
     * section: arguments
     * - task_slug (string): task slug to inspect
     * 
     * section: return value
     * - validation (object): { valid: boolean, errors: array, child_count: number }
     */
    validate_hierarchy(task_slug) {
      const slug = sanitize_slug(task_slug);
      const task_dir = assert_safe_path(path.join(root_dir, slug));
      const errors = [];

      if (!fs.existsSync(task_dir)) {
        errors.push(`task directory does not exist: ${task_dir}`);
        return { valid: false, errors, child_count: 0 };
      }

      const task_file = path.join(task_dir, 'task.md');
      if (!fs.existsSync(task_file)) {
        errors.push(`generic task.md missing from task directory: ${task_dir}`);
      }

      const tasks_dir = path.join(task_dir, 'tasks');
      let child_count = 0;

      if (!fs.existsSync(tasks_dir)) {
        errors.push(`tasks child directory missing from task directory: ${task_dir}`);
      } else {
        const files = fs.readdirSync(tasks_dir);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file === 'undefined.md') {
            errors.push(`malformed file: undefined.md found in tasks directory: ${path.join(tasks_dir, file)}`);
          } else if (file.endsWith('.md')) {
            if (!/^\d{2}-.+\.md$/.test(file)) {
              errors.push(`un-numbered child task file found: ${file} (expected ##-<slug>.md format)`);
            } else {
              child_count++;
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        child_count
      };
    },

    /**
     * section: version number
     * version: 0.1.0
     * 
     * section: documentation
     * tldr: lists all registered tasks and their child task counts
     * verbose: scans root directory for compliant task structures using primitive arrays.
     * 
     * section: arguments
     * none
     * 
     * section: return value
     * - tasks (array): array of task descriptors
     */
    list_tasks() {
      if (!fs.existsSync(root_dir)) return [];
      const entries = fs.readdirSync(root_dir, { withFileTypes: true });
      const tasks = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.isDirectory()) {
          const task_slug = entry.name;
          const val = this.validate_hierarchy(task_slug);
          tasks.push({
            slug: task_slug,
            valid: val.valid,
            child_count: val.child_count,
            task_file: path.join(root_dir, task_slug, 'task.md')
          });
        }
      }

      return tasks;
    }
  };
}
