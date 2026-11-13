/**
 * Unit tests for `config/projectTypePrompt.ts`: when the project-type prompt
 * shows, and what its dropdown holds.
 */

import { describe, expect, it } from 'vitest';
import { PROJECT_TYPES } from 'lorefountain-core/config/projectType';
import { SKIP_CHOICE, decideProjectTypePrompt, projectTypePickItems } from '../../src/config/projectTypePrompt';

const base = { hasConfigFile: true, alreadyAsked: false, enabled: true } as const;

describe('decideProjectTypePrompt', () => {
  it('asks a configured project that has no type and was never asked', () => {
    expect(decideProjectTypePrompt({ ...base })).toBe(true);
  });

  it('never asks a project that already has a type', () => {
    expect(decideProjectTypePrompt({ ...base, projectType: 'comic' })).toBe(false);
    expect(decideProjectTypePrompt({ ...base, projectType: 'custom' })).toBe(false);
  });

  it('does not ask again after the user was asked or skipped', () => {
    expect(decideProjectTypePrompt({ ...base, alreadyAsked: true })).toBe(false);
  });

  it('does not ask without a config file to record the answer in', () => {
    expect(decideProjectTypePrompt({ ...base, hasConfigFile: false })).toBe(false);
  });

  it('respects the setting that turns the prompt off', () => {
    expect(decideProjectTypePrompt({ ...base, enabled: false })).toBe(false);
  });
});

describe('projectTypePickItems', () => {
  it('lists every type in order, then a skip entry', () => {
    const items = projectTypePickItems();
    expect(items.map((item) => item.value)).toEqual([...PROJECT_TYPES, SKIP_CHOICE]);
  });

  it('gives every entry a label and a description', () => {
    for (const item of projectTypePickItems()) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it('marks the current type', () => {
    const items = projectTypePickItems('serialized_universe');
    expect(items.find((item) => item.value === 'serialized_universe')?.description).toContain('(current)');
    expect(items.find((item) => item.value === 'comic')?.description).not.toContain('(current)');
  });

  it('lists the recommended conventions in the detail line', () => {
    const detail = projectTypePickItems().find((item) => item.value === 'serialized_universe')?.detail ?? '';
    expect(detail).toContain('arcs');
  });
});
