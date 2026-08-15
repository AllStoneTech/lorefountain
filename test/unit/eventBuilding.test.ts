/**
 * Unit tests for `eventBuilding.ts`: editor/platform detection, event
 * construction, and schema validation — deliberately free of any `vscode`
 * runtime dependency (see that module's doc comment). `events.ts`'s
 * `recordEvent`/`flushSessionUsageFlags` are the `vscode`-facing glue on
 * top of this and stay untested here, same posture as `licenseState.ts`.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTelemetryEvent,
  detectEditorProduct,
  detectPlatform,
  telemetryEventSchema,
} from '../../src/telemetry/eventBuilding';
import { setSessionTier } from '../../src/telemetry/telemetryState';

describe('detectEditorProduct', () => {
  it('recognizes VS Code', () => {
    expect(detectEditorProduct('Visual Studio Code')).toBe('vscode');
  });

  it('recognizes Cursor', () => {
    expect(detectEditorProduct('Cursor')).toBe('cursor');
  });

  it('recognizes Windsurf', () => {
    expect(detectEditorProduct('Windsurf')).toBe('windsurf');
  });

  it('recognizes Antigravity', () => {
    expect(detectEditorProduct('Antigravity')).toBe('antigravity');
  });

  it('falls back to "other" for an unrecognized app name', () => {
    expect(detectEditorProduct('Some Other Editor')).toBe('other');
  });
});

describe('detectPlatform', () => {
  it.each(['win32', 'darwin', 'linux'])('passes %s through unchanged', (platform) => {
    expect(detectPlatform(platform)).toBe(platform);
  });

  it('falls back to "other" for an unlisted platform', () => {
    expect(detectPlatform('freebsd')).toBe('other');
  });
});

describe('buildTelemetryEvent', () => {
  it('builds a schema-valid event using the current session tier', () => {
    setSessionTier('pro');
    const event = buildTelemetryEvent(
      'lorefountain.newCharacter',
      '0.11.0',
      'Cursor',
      'darwin',
      new Date('2026-08-12T00:00:00Z'),
    );

    expect(event).toEqual({
      event: 'lorefountain.newCharacter',
      tier: 'pro',
      timestamp: '2026-08-12T00:00:00.000Z',
      extensionVersion: '0.11.0',
      editorProduct: 'cursor',
      platform: 'darwin',
    });
    expect(telemetryEventSchema.safeParse(event).success).toBe(true);
    setSessionTier('free'); // reset for other tests
  });
});

describe('telemetryEventSchema', () => {
  const valid = {
    event: 'lorefountain.structuredSearch',
    tier: 'free' as const,
    timestamp: '2026-08-12T00:00:00.000Z',
    extensionVersion: '0.11.0',
    editorProduct: 'vscode' as const,
    platform: 'win32' as const,
  };

  it('accepts a well-formed event', () => {
    expect(telemetryEventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty event name', () => {
    expect(telemetryEventSchema.safeParse({ ...valid, event: '' }).success).toBe(false);
  });

  it('rejects an unrecognized tier', () => {
    expect(telemetryEventSchema.safeParse({ ...valid, tier: 'enterprise' }).success).toBe(false);
  });

  it('rejects a non-ISO timestamp', () => {
    expect(telemetryEventSchema.safeParse({ ...valid, timestamp: 'yesterday' }).success).toBe(false);
  });

  it('rejects an unrecognized editor product', () => {
    expect(telemetryEventSchema.safeParse({ ...valid, editorProduct: 'notepad' }).success).toBe(false);
  });
});
