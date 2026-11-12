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
  'arrow-ur': '<path d="M7 17 17 7M8 7h9v9"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.2v.1M12 17v-3.6a2.4 2.4 0 0 1 4.8 0V17M12 10.5V17"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2.5 2.5 0 0 0 2.5 2.5H20V8H6.5A2.5 2.5 0 0 1 4 7.5Z"/><path d="M16 13.8h.1"/>',
  note: '<path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20V3.5Z"/><path d="M9 11h7M9 15h5"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 13h18"/>',
  sparkle: '<path d="M12 3.5 13.8 9l5.7 2-5.7 2L12 18.5 10.2 13l-5.7-2 5.7-2L12 3.5Z"/>',
  code: '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/>',
  list: '<path d="M8.5 7h11M8.5 12h11M8.5 17h11M4.5 7h.1M4.5 12h.1M4.5 17h.1"/>',
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
