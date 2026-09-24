import { describe, expect, it } from 'vitest';
import { renderStoryOverviewBody } from '../../src/providers/storyOverviewRender';

describe('renderStoryOverviewBody', () => {
  it('returns an empty string for a blank or whitespace-only body', () => {
    expect(renderStoryOverviewBody('')).toBe('');
    expect(renderStoryOverviewBody('  \n\n ')).toBe('');
  });

  it('renders headings, emphasis, and lists', () => {
    const html = renderStoryOverviewBody('## Premise\n\nA **grieving** archivist.\n\n- one\n- two\n');
    expect(html).toContain('<h2>Premise</h2>');
    expect(html).toContain('<strong>grieving</strong>');
    expect(html).toContain('<li>one</li>');
  });

  it('escapes raw HTML in the source instead of passing it through', () => {
    const html = renderStoryOverviewBody('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not emit a link for a javascript: URL', () => {
    const html = renderStoryOverviewBody('[click me](javascript:alert(1))');
    expect(html).not.toContain('href="javascript:');
  });

  it('keeps an ordinary https link', () => {
    const html = renderStoryOverviewBody('[site](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });
});
