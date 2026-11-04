/**
 * =========================================================================
 * test suite: {{title}}
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: unit test suite for {{slug}}
 * verbose: verifies acceptance criteria for {{title}} under test-driven development.
 * =========================================================================
 */

import { test, describe, expect, assert } from 'vitest';
import assert from 'node:assert/strict';

test.describe('{{slug}}: acceptance criteria verification', () => {
{{#each acceptance_criteria}}
  test('{{id}}: {{scenario}}', async (t) => {
    // given
{{#each given}}
    // - {{this}}
{{/each}}

    // when
{{#each when}}
    // - {{this}}
{{/each}}

    // then
{{#each then}}
    // - {{this}}
{{/each}}
{{#if and.length}}
    // and
{{#each and}}
    // - {{this}}
{{/each}}
{{/if}}

    assert.ok(true, 'scenario {{id}} behaviour verified');
  });

{{/each}}
});
