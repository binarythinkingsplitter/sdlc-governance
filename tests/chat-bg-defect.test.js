import { describe, it, expect } from 'vitest';
import { create_chat_bg_defect_patch } from '../src/chat-bg-defect.js';

describe('chat-bg-defect defect regression suite', () => {
  it('reproduces and verifies the defect fix for chat-bg-defect', () => {
    const patch = create_chat_bg_defect_patch();
    expect(patch.defect_id).toBe('chat-bg-defect');
    expect(patch.status).toBe('patched');
    expect(patch.verify_fix().patched).toBe(true);
  });
});
