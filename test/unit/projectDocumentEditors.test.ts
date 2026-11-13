/**
 * Unit tests for project-document editor routing
 * (`src/providers/projectDocumentEditors.ts`), which the Story Card provider
 * uses to hand a `*.lf.md` file to the right editor (ADR-0047).
 */

import { describe, expect, it } from 'vitest';
import { isProjectDocument } from 'lorefountain-core/project/files';
import { editorViewTypeForProjectDocument, STORY_OVERVIEW_VIEW_TYPE, STYLE_BIBLE_VIEW_TYPE } from '../../src/providers/projectDocumentEditors';

describe('editorViewTypeForProjectDocument', () => {
  it('routes the style bible, in any case and any folder name, to the guided editor', () => {
    expect(editorViewTypeForProjectDocument('/p/world/style.lf.md')).toBe(STYLE_BIBLE_VIEW_TYPE);
    expect(editorViewTypeForProjectDocument('C:\\p\\lore\\Style.LF.MD')).toBe(STYLE_BIBLE_VIEW_TYPE);
  });

  it('routes the story overview to its own editor', () => {
    expect(editorViewTypeForProjectDocument('/p/world/overview.lf.md')).toBe(STORY_OVERVIEW_VIEW_TYPE);
  });

  it('opens any other project document as text, never as an entity form', () => {
    expect(isProjectDocument('/p/world/future.lf.md')).toBe(true);
    expect(editorViewTypeForProjectDocument('/p/world/future.lf.md')).toBe('default');
  });
});
