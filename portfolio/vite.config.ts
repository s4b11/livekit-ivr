import * as simpleIcons from 'simple-icons';
import { defineConfig, type Plugin } from 'vite';

type SimpleIcon = { slug: string; title: string; path: string; hex: string };

const BRANDS = new Map(
  (Object.values(simpleIcons) as unknown[])
    .filter((icon): icon is SimpleIcon => typeof icon === 'object' && icon !== null && 'slug' in icon)
    .map((icon) => [icon.slug, icon]),
);

/** Line icons for concepts that have no brand logo (24×24, stroked). */
const LINE_ICONS: Record<string, string> = {
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  wave: '<path d="M2 12h2M6 8v8M10 5v14M14 8v8M18 10v4M22 12h0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.5 18a10 10 0 1 1 17 0"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7Z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
};

/**
 * Replaces <i data-icon="slug"></i> in index.html with an inline SVG at build time:
 * a Simple Icons brand logo, or `line:name` for one of the line icons above. No icon
 * library ships to the browser.
 */
function inlineIcons(): Plugin {
  return {
    name: 'inline-icons',
    transformIndexHtml(html) {
      return html.replace(/<i data-icon="([\w:-]+)"><\/i>/g, (_, name: string) => {
        if (name.startsWith('line:')) {
          const body = LINE_ICONS[name.slice(5)];
          if (!body) throw new Error(`Unknown line icon "${name}"`);
          return (
            '<svg class="ico ico-line" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
            `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
          );
        }
        const brand = BRANDS.get(name);
        if (!brand) throw new Error(`Unknown Simple Icons slug "${name}"`);
        return (
          `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style="--brand:#${brand.hex}">` +
          `<path d="${brand.path}"/></svg>`
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [inlineIcons()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    // Fonts stay separate files so they cache independently.
    assetsInlineLimit: 0,
  },
});
