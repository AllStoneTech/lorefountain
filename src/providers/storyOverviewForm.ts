/**
 * Story Overview form state (ADR-0029): pure conversion between a
 * {@link StoryOverview} and a flat, JSON-serializable form state the webview
 * can render and edit — mirrors `storyCardForm.ts`'s split between pure logic
 * here and `vscode`-facing glue in `storyOverviewEditorProvider.ts`.
 *
 * Deliberately small: four short structured fields (`title`, `pitch`, `tone`,
 * `genre`) plus one flexible Markdown body. There is no type-specific
 * branching here the way Story Card has for Character/Location/Arc — every
 * Story Overview has the same shape.
 */

import { storyOverviewSchema, type StoryOverview } from '../model/storyOverview';

/** The Story Overview form's full, flat, editable state. */
export interface StoryOverviewFormState {
  title: string;
  pitch: string;
  tone: string;
  genre: string;
  body: string;
}

/**
 * Flatten a Story Overview into form state for the webview to render.
 *
 * @param overview - The Story Overview to render in the form.
 * @returns The corresponding flat form state.
 */
export function storyOverviewToFormState(overview: StoryOverview): StoryOverviewFormState {
  const fm = overview.frontmatter;
  return {
    title: fm.title ?? '',
    pitch: fm.pitch ?? '',
    tone: fm.tone ?? '',
    genre: fm.genre ?? '',
    body: overview.body,
  };
}

/**
 * Apply edited form state back onto a Story Overview, producing its new state.
 *
 * Any frontmatter fields the form doesn't cover are preserved unchanged from
 * `overview.frontmatter` — the schema's `catchall` means nothing here is
 * silently dropped.
 *
 * @param overview - The Story Overview being edited (for its file path and any preserved fields).
 * @param formState - The current form state to apply.
 * @returns The updated Story Overview, with `frontmatter` re-validated by {@link storyOverviewSchema}.
 */
export function applyFormStateToStoryOverview(overview: StoryOverview, formState: StoryOverviewFormState): StoryOverview {
  const merged: Record<string, unknown> = {
    ...overview.frontmatter,
    title: undefinedIfBlank(formState.title),
    pitch: undefinedIfBlank(formState.pitch),
    tone: undefinedIfBlank(formState.tone),
    genre: undefinedIfBlank(formState.genre),
  };

  return { ...overview, frontmatter: storyOverviewSchema.parse(merged), body: formState.body };
}

function undefinedIfBlank(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
