/**
 * Keeps each bundled demo's `lorefountain.config.json` `project_type` in step
 * with the Install Demo catalog, and checks every demo's value is valid.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProjectType } from 'lorefountain-core/config/projectType';
import { DEMO_CATALOG } from '../../src/demos/demoCatalog';

const repoRoot = path.resolve(__dirname, '..', '..');

function demoProjectType(repoPath: string): unknown {
  const config = JSON.parse(fs.readFileSync(path.join(repoRoot, repoPath, 'lorefountain.config.json'), 'utf8')) as { project_type?: unknown };
  return config.project_type;
}

describe('demo project types', () => {
  it.each(DEMO_CATALOG.map((demo) => [demo.id, demo] as const))('%s records the type the catalog lists', (_id, demo) => {
    expect(isProjectType(demo.projectType)).toBe(true);
    expect(demoProjectType(demo.repoPath)).toBe(demo.projectType);
  });

  it('gives every demo folder a valid project_type', () => {
    const demos = fs.readdirSync(path.join(repoRoot, 'demos'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
    for (const demo of demos) {
      expect(isProjectType(demoProjectType(path.join('demos', demo.name))), demo.name).toBe(true);
    }
  });
});
