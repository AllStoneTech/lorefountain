/**
 * Unit tests for Story Overview form-state conversion
 * (`src/providers/storyOverviewForm.ts`).
 */

import { describe, it, expect } from 'vitest';
import { parseStoryOverviewFile, type StoryOverview } from '../../src/model/storyOverview';
import { applyFormStateToStoryOverview, storyOverviewToFormState } from '../../src/providers/storyOverviewForm';

function overviewFrom(frontmatterLines: string[], body = ''): StoryOverview {
  const text = ['---', ...frontmatterLines, '---', '', body].join('\n');
  const result = parseStoryOverviewFile(text, '/world/OVERVIEW.md');
  if (!result.ok) throw new Error('expected a valid overview in test setup');
  return result.overview;
}

describe('storyOverviewToFormState', () => {
  it('flattens populated frontmatter and body', () => {
    const overview = overviewFrom(['title: Orun', 'pitch: A logline.', 'tone: elegiac', 'genre: drama'], 'Some body text.');
    expect(storyOverviewToFormState(overview)).toEqual({
      title: 'Orun',
      pitch: 'A logline.',
      tone: 'elegiac',
      genre: 'drama',
      body: 'Some body text.',
    });
  });

  it('defaults unset fields to empty strings', () => {
    const overview = overviewFrom([], 'Just a body.');
    expect(storyOverviewToFormState(overview)).toEqual({ title: '', pitch: '', tone: '', genre: '', body: 'Just a body.' });
  });
});

describe('applyFormStateToStoryOverview', () => {
  it('applies edited fields and re-validates', () => {
    const overview = overviewFrom(['title: Orun'], 'Old body.');
    const updated = applyFormStateToStoryOverview(overview, {
      title: 'Orun (Season 1)',
      pitch: 'A new pitch.',
      tone: '',
      genre: '',
      body: 'New body.',
    });
    expect(updated.frontmatter.title).toBe('Orun (Season 1)');
    expect(updated.frontmatter.pitch).toBe('A new pitch.');
    expect(updated.frontmatter.tone).toBeUndefined();
    expect(updated.body).toBe('New body.');
  });

  it('preserves unknown frontmatter fields not covered by the form', () => {
    const overview = overviewFrom(['title: Orun', 'custom_field: kept']);
    const updated = applyFormStateToStoryOverview(overview, {
      title: 'Orun',
      pitch: '',
      tone: '',
      genre: '',
      body: '',
    });
    expect(updated.frontmatter.custom_field).toBe('kept');
  });

  it('trims blank fields to undefined rather than storing empty strings', () => {
    const overview = overviewFrom(['title: Orun']);
    const updated = applyFormStateToStoryOverview(overview, { title: '   ', pitch: '', tone: '', genre: '', body: '' });
    expect(updated.frontmatter.title).toBeUndefined();
  });
});
