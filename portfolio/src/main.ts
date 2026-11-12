import '@fontsource-variable/inter/wght.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './styles.css';

/** The Cloudflare Worker that serves the voice assistant's embed widget. */
const ASSISTANT_ORIGIN = 'https://sabithsb.sabithsb36624.workers.dev';

declare global {
  interface Window {
    VoiceAssistant?: {
      open(): void;
      close(): void;
      start(): Promise<void>;
      stop(): Promise<void>;
      setTheme(theme: string): void;
    };
  }
}

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const compactLayout = matchMedia('(max-width: 860px), (pointer: coarse)');

/* ------------------------------------------------------------ hero title */
function splitWords(el: HTMLElement) {
  let w = 0;
  const walk = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').split(/(\s+)/).map((part) => {
        if (!part.trim()) return document.createTextNode(part);
        const outer = document.createElement('span');
        outer.className = 'word';
        const inner = document.createElement('span');
        inner.style.setProperty('--w', String(w++));
        inner.textContent = part;
        outer.append(inner);
        return outer;
      });
    }
    if (node instanceof HTMLElement) {
      const clone = node.cloneNode(false) as HTMLElement;
      node.childNodes.forEach((child) => clone.append(...walk(child)));
      return [clone];
    }
    return [node.cloneNode()];
  };
  const parts = Array.from(el.childNodes).flatMap(walk);
  el.setAttribute('aria-label', el.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  el.replaceChildren(...parts);
  // Screen readers get the aria-label; the animated spans are presentation only.
  $$('.word', el).forEach((word) => word.setAttribute('aria-hidden', 'true'));
}

function initHero() {
  const title = $('[data-split]');
  if (title) splitWords(title);
  requestAnimationFrame(() => requestAnimationFrame(() => $('[data-hero]')?.classList.add('is-ready')));
}

/* --------------------------------------------------------- reveal on view */
function initReveal() {
  const items = $$('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
}

/* ----------------------------------------------- scroll-linked behaviour */
function initScroll() {
  const nav = $('[data-nav]');
  const timeline = $('[data-timeline]');
  const supportsScrollTimeline = CSS.supports('animation-timeline: scroll()');
  let lastY = scrollY;
  // Distance scrolled in the current direction. The header only hides after a
  // deliberate scroll down and only returns after a deliberate scroll up, so
  // momentum scrolling and the mobile address bar resizing cannot make it flicker.
  let travel = 0;
  const HIDE_AFTER = 140;
  const SHOW_AFTER = 70;

  const updateNavVisibility = (el: HTMLElement, delta: number, y: number) => {
    // On phones and tablets the header stays put: hiding it there causes more
    // jumpiness than it saves space.
    if (compactLayout.matches || document.body.classList.contains('menu-open') || y < 320) {
      travel = 0;
      el.classList.remove('is-hidden');
      return;
    }
    if (delta === 0) return;
    travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
    if (travel > HIDE_AFTER) el.classList.add('is-hidden');
    else if (travel < -SHOW_AFTER) el.classList.remove('is-hidden');
  };
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;

    if (!supportsScrollTimeline) {
      document.documentElement.style.setProperty('--progress', String(max > 0 ? y / max : 0));
    }

    if (nav) {
      nav.classList.toggle('is-scrolled', y > 24);
      updateNavVisibility(nav, y - lastY, y);
    }

    if (timeline) {
      const rect = timeline.getBoundingClientRect();
      const progress = (innerHeight * 0.7 - rect.top) / rect.height;
      timeline.style.setProperty('--tl', String(Math.min(1, Math.max(0, progress))));
    }
    lastY = y;
  };

  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

/* ------------------------------------------------- active nav section */
function initActiveSection() {
  const links = $$<HTMLAnchorElement>('[data-nav-links] a');
  const byId = new Map(links.map((a) => [a.hash.slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          links.forEach((a) => a.classList.remove('is-active'));
          byId.get(entry.target.id)?.classList.add('is-active');
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  byId.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) io.observe(section);
  });
}

/* ---------------------------------------------------- pointer effects */
function initPointer() {
  if (!finePointer.matches || reducedMotion.matches) return;

  // Hero orb drifts gently toward the cursor.
  const hero = $('[data-hero]');
  const orb = $('.orb', hero ?? document);
  hero?.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    orb?.style.setProperty('--mx', `${x * 80}px`);
    orb?.style.setProperty('--my', `${y * 60}px`);
  });

  // Magnetic buttons.
  $$('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
    });
    btn.addEventListener('pointerleave', () => (btn.style.transform = ''));
  });

  // Project cards: soft tilt plus a spotlight that follows the cursor.
  $$('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.classList.add('is-tilting');
      card.style.setProperty('--ry', `${(px - 0.5) * 5}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * 5}deg`);
      card.style.setProperty('--gx', `${px * 100}%`);
      card.style.setProperty('--gy', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* -------------------------------------------------------- project filter */
function initFilters() {
  const chips = $$<HTMLButtonElement>('[data-filter]');
  const cards = $$('[data-projects] .card');

  const apply = (filter: string) => {
    for (const card of cards) {
      const show = filter === 'all' || (card.dataset.tags ?? '').split(' ').includes(filter);
      card.classList.toggle('is-filtered', !show);
    }
  };

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter ?? 'all';
      chips.forEach((c) => {
        const active = c === chip;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-pressed', String(active));
      });
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      if (doc.startViewTransition && !reducedMotion.matches) {
        // Name the cards only for this transition, so they glide to their new places.
        const name = (value: string) =>
          cards.forEach((card, i) => card.style.setProperty('view-transition-name', value && `${value}-${i}`));
        name('card');
        const vt = doc.startViewTransition(() => apply(filter)) as { finished?: Promise<void> } | undefined;
        void vt?.finished?.finally(() => name(''));
      } else {
        apply(filter);
      }
    }),
  );
}

/* --------------------------------------------------------------- counters */
function initCounters() {
  $$('[data-count]').forEach((el) => {
    const from = Number(el.dataset.count);
    const to = Number(el.dataset.to);
    if (reducedMotion.matches) {
      el.textContent = String(from);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      // Hold on the "before" value briefly, then count down to the "after" value.
      const start = performance.now() + 900;
      const duration = 1100;
      const step = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / duration));
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = (from + (to - from) * eased).toFixed(t < 1 ? 1 : 0).replace(/\.0$/, '');
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    io.observe(el);
  });
}

/* ------------------------------------------------------------------ theme */
function initTheme() {
  const toggle = $('[data-theme-toggle]');
  const root = document.documentElement;
  const setTheme = (theme: string) => {
    root.dataset.theme = theme;
    window.VoiceAssistant?.setTheme(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* storage unavailable: the choice lasts for this visit only */
    }
  };

  toggle?.addEventListener('click', (e) => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || reducedMotion.matches) return setTheme(next);
    // Reveal the new theme as a circle growing from the toggle.
    root.style.setProperty('--vt-x', `${e.clientX}px`);
    root.style.setProperty('--vt-y', `${e.clientY}px`);
    doc.startViewTransition(() => setTheme(next));
  });
}

/* ------------------------------------------------------------ mobile menu */
function initMenu() {
  const btn = $<HTMLButtonElement>('[data-menu]');
  const menu = $('[data-mobile-menu]');
  if (!btn || !menu) return;
  $$('a', menu).forEach((a, i) => a.style.setProperty('--i', String(i)));

  const setOpen = (open: boolean) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => (menu.hidden = true), 350);
    }
  };

  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') setOpen(false);
  });
}

/* ------------------------------------------------------------------ toast */
let toastTimer = 0;
function toast(message: string) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-shown'), 2400);
}

/* ------------------------------------------------------------- copy email */
function initCopy() {
  $$('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy ?? '';
      try {
        await navigator.clipboard.writeText(value);
        toast('Email copied to clipboard');
      } catch {
        location.href = `mailto:${value}`;
      }
    }),
  );
}

/* --------------------------------------------------------- voice assistant */
let widgetPromise: Promise<void> | null = null;

function loadAssistant(): Promise<void> {
  if (window.VoiceAssistant) return Promise.resolve();
  widgetPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${ASSISTANT_ORIGIN}/embed/embed.js`;
    script.async = true;
    script.dataset.title = "Sabith's AI assistant";
    script.dataset.accent = '#5eead4';
    script.dataset.theme = document.documentElement.dataset.theme ?? 'auto';
    script.onload = () => resolve();
    script.onerror = () => {
      widgetPromise = null;
      reject(new Error('assistant unavailable'));
    };
    document.body.append(script);
  });
  return widgetPromise;
}

function initAssistant() {
  $$('[data-talk]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await loadAssistant();
        document.getElementById('voice-assistant-widget')?.setAttribute('data-engaged', '');
        await window.VoiceAssistant?.start();
      } catch {
        toast('The assistant is unavailable right now — email works too.');
      }
    }),
  );
  // Load the widget quietly once the page is idle, so its launcher appears without
  // competing with the first paint.
  const idle = (cb: () => void) =>
    'requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2500);
  addEventListener('load', () => idle(() => void loadAssistant().catch(() => {})), { once: true });
}

/* ------------------------------------------------------------------- boot */
function boot() {
  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
  initHero();
  initReveal();
  initScroll();
  initActiveSection();
  initPointer();
  initFilters();
  initCounters();
  initTheme();
  initMenu();
  initCopy();
  initAssistant();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
