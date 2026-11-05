/**
 * Unit tests for `shots/sceneHeading.ts`: INT./EXT. prefixes, dash
 * separators, time of day, scene numbers, and heading-order settings.
 */

import { describe, expect, it } from 'vitest';
import { parseSceneHeading } from '../../src/shots/sceneHeading';

describe('parseSceneHeading', () => {
  it('splits a hyphen-separated heading', () => {
    expect(parseSceneHeading('INT. HOLLOW HOUSE - BASEMENT - NIGHT')).toEqual({
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      setting: ['HOLLOW HOUSE', 'BASEMENT'],
    });
  });

  it('splits on em dashes and keeps heading order (specific to general here)', () => {
    expect(parseSceneHeading("INT. LUCIEN'S BASEMENT — WEST ORANGE, NJ — NIGHT")).toEqual({
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      setting: ["LUCIEN'S BASEMENT", 'WEST ORANGE, NJ'],
    });
  });

  it('splits on en dashes', () => {
    expect(parseSceneHeading('EXT. FIELD – DAWN').setting).toEqual(['FIELD']);
  });

  it('keeps an unrecognized final segment as setting, not time of day', () => {
    expect(parseSceneHeading('INT. THE ARCHIVE — READING — SPUNK, 1925')).toEqual({
      intExt: 'INT',
      setting: ['THE ARCHIVE', 'READING', 'SPUNK, 1925'],
    });
  });

  it('recognizes multi-word time of day, case-insensitively, kept raw', () => {
    expect(parseSceneHeading('EXT. STREET - moments later').timeOfDay).toBe('moments later');
  });

  it.each([
    ['INT./EXT. CAR - DAY', 'INT/EXT'],
    ['EXT./INT. CAR - DAY', 'INT/EXT'],
    ['I/E CAR - DAY', 'INT/EXT'],
    ['EXT. STREET - DAY', 'EXT'],
    ['int. kitchen - day', 'INT'],
  ])('reads the prefix of %s as %s', (heading, intExt) => {
    expect(parseSceneHeading(heading).intExt).toBe(intExt);
  });

  it('leaves intExt absent for EST. and for a forced heading', () => {
    expect(parseSceneHeading('EST. SKYLINE - NIGHT')).toEqual({ timeOfDay: 'NIGHT', setting: ['SKYLINE'] });
    expect(parseSceneHeading('.FLASHBACK - THE RIVER')).toEqual({ setting: ['FLASHBACK', 'THE RIVER'] });
  });

  it('strips a trailing scene number', () => {
    expect(parseSceneHeading('INT. KITCHEN - NIGHT #12A#')).toEqual({ intExt: 'INT', timeOfDay: 'NIGHT', setting: ['KITCHEN'] });
  });

  it('does not split on a hyphen inside a word', () => {
    expect(parseSceneHeading('INT. BACK-ROOM - DAY').setting).toEqual(['BACK-ROOM']);
  });
});
