/** Origin of the API service. Empty means same origin (or the Vite dev proxy). */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export const TOKEN_ENDPOINT = `${API_BASE}/api/v1/token`;

export const OWNER = {
  name: 'Sabith S B',
  firstName: 'Sabith',
  tagline: 'AI Software Engineer · Voice AI & GenAI',
  links: [
    { label: 'Portfolio', href: 'https://sabithsb.fermyon.app/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/s4b11' },
    { label: 'GitHub', href: 'https://github.com/s4b11' },
  ],
} as const;

/** Aura colour, matching the accent used across the UI. */
export const AURA_COLOR = '#1FD5F9';
