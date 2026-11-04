import { test } from 'vitest';
import assert from 'node:assert/strict';
import { create_structured_agent_schemas } from '../src/structured_agent_schemas.js';

test('structured_agent_schemas: verifies primary operation', () => {
  const instance = create_structured_agent_schemas();
  assert.ok(instance);
});