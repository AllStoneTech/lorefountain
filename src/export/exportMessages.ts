/**
 * The messages between the Export Script dialog's webview and the extension
 * host (ADR-0050). The webview is untrusted input, so every inbound message
 * is validated with Zod before the host acts on it.
 *
 * Exports {@link parseExportDialogMessage}, {@link ExportDialogMessage},
 * {@link ExportDialogInit} and {@link ExportChoice}.
 */

import { z } from 'zod';
import { EXPORT_PRESET_IDS, exportContentSchema, type ExportContent, type ExportPresetId } from 'lorefountain-core/export/options';
import { EXPORT_FORMATS, EXPORT_LAYOUTS, type ExportFormat, type ExportSettings } from 'lorefountain-core/export/settings';

/** What the writer chose in the dialog. */
const exportChoiceSchema = z.strictObject({
  type: z.literal('export'),
  format: z.enum(EXPORT_FORMATS),
  preset: z.enum(EXPORT_PRESET_IDS),
  content: exportContentSchema,
  paper: z.enum(['letter', 'a4']),
  titlePage: z.boolean(),
  layout: z.enum(EXPORT_LAYOUTS),
  comicPageSides: z.boolean(),
  scope: z.enum(['script', 'group']),
});

/** Every message the webview may send. */
const exportDialogMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ready') }),
  z.strictObject({ type: z.literal('cancel') }),
  exportChoiceSchema,
]);

/** A validated message from the webview. */
export type ExportDialogMessage = z.infer<typeof exportDialogMessageSchema>;

/** The writer's export choice. */
export type ExportChoice = z.infer<typeof exportChoiceSchema>;

/**
 * Validate a message from the webview.
 *
 * @param value - The raw message; expected to be one of {@link ExportDialogMessage}.
 * @returns The message, or `undefined` when it isn't a valid one (it is then ignored).
 */
export function parseExportDialogMessage(value: unknown): ExportDialogMessage | undefined {
  const result = exportDialogMessageSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

/** The state the host sends the webview when it opens. */
export interface ExportDialogInit {
  type: 'init';
  formats: { id: ExportFormat; label: string }[];
  presets: { id: ExportPresetId; label: string; description: string; content: ExportContent }[];
  settings: ExportSettings;
  /** The script being exported, and its season when it has one. */
  scope: { script: string; group?: { name: string; count: number } };
}
