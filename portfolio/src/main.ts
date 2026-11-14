import '@fontsource-variable/inter/wght.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './styles.css';

/** The Cloudflare Worker that serves the voice assistant's embed widget. */
const ASSISTANT_ORIGIN = 'https://assistant.sabiii.workers.dev';
const LAVENDER = '#9d8cf2';

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
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/* ---------------------------------------------------------- split to words */
/** Wraps each word in spans so it can be animated; keeps inline elements like <em>. */
function splitWords(el: HTMLElement, wordClass: string, nested: boolean) {
  let index = 0;
  const walk = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').split(/(\s+)/).map((part) => {
        if (!part.trim()) return document.createTextNode(part.replace(/\s+/g, ' '));
        const outer = document.createElement('span');
        outer.className = wordClass;
        outer.style.setProperty('--w', String(index++));
        if (nested) {
          const inner = document.createElement('span');
          inner.style.setProperty('--w', outer.style.getPropertyValue('--w'));
          inner.textContent = part;
          outer.append(inner);
        } else {
          outer.textContent = part;
        }
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
  const label = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  el.replaceChildren(...Array.from(el.childNodes).flatMap(walk));
  // Keep punctuation with the element before it ("<em>cites</em>," must not break
  // before the comma).
  $$(`.${wordClass}`, el).forEach((word) => {
    const before = word.previousSibling;
    if (!/^[,.;:!?]+$/.test(word.textContent ?? '') || !(before instanceof HTMLElement)) return;
    const keep = document.createElement('span');
    keep.style.whiteSpace = 'nowrap';
    before.before(keep);
    keep.append(before, word);
  });
  // Screen readers get the sentence once; the animated spans are presentation only.
  el.setAttribute('aria-label', label);
  if (!el.hasAttribute('role') && el.tagName === 'P') el.setAttribute('role', 'paragraph');
  $$(`.${wordClass}`, el).forEach((word) => word.setAttribute('aria-hidden', 'true'));
  return index;
}

function initHero() {
  const title = $('[data-split]');
  if (title) splitWords(title, 'word', true);
  requestAnimationFrame(() => requestAnimationFrame(() => $('[data-hero]')?.classList.add('is-ready')));
}

/* ---------------------------------------------------------- reveal on view */
function initReveal() {
  const items = $$('.reveal, .case');
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

/* ------------------------------------------------- scroll-linked behaviour */
function initScroll() {
  const nav = $('[data-nav]');
  const timeline = $('[data-timeline]');
  const cases = $$('[data-cases] .case');
  const statement = $('[data-fill]');
  const words = statement ? (splitWords(statement, 'w', false), $$('.w', statement)) : [];
  const footer = $('.footer');
  let ticking = false;

  let lastLit = -1;
  let scrolled: boolean | null = null;

  // Every value is read first and written after, so a frame costs one layout at
  // most; and each variable is set on the one element that uses it, never on
  // <html> (which would restyle the whole page on every frame).
  const update = () => {
    ticking = false;
    const y = scrollY;
    const vh = innerHeight;

    const tlRect = timeline?.getBoundingClientRect();
    const caseTops = cases.map((card) => card.getBoundingClientRect().top);
    const caseHeights = cases.map((card) => card.offsetHeight);
    const stRect = statement && words.length ? statement.getBoundingClientRect() : null;
    const footRect = footer?.getBoundingClientRect();

    if (scrolled !== y > 24) {
      scrolled = y > 24;
      nav?.classList.toggle('is-scrolled', scrolled);
    }

    // Career line draws itself as the list scrolls through.
    if (timeline && tlRect && tlRect.bottom > -vh && tlRect.top < vh * 2) {
      timeline.style.setProperty('--tl', clamp((vh * 0.72 - tlRect.top) / tlRect.height).toFixed(4));
    }

    // Stacked case studies: a card recedes slightly as the next one slides over it.
    for (let i = 0; i < cases.length - 1; i++) {
      const p = clamp(1 - (caseTops[i + 1] - caseTops[i]) / caseHeights[i]).toFixed(3);
      if (cases[i].style.getPropertyValue('--p') !== p) cases[i].style.setProperty('--p', p);
    }

    // The about statement fills in word by word; only the words that change are touched.
    if (statement && stRect) {
      const progress = clamp((vh * 0.86 - stRect.top) / (stRect.height + vh * 0.36));
      const lit = Math.round(progress * words.length);
      if (lit !== lastLit) {
        const from = lastLit < 0 ? 0 : Math.min(lit, lastLit);
        const to = lastLit < 0 ? words.length : Math.max(lit, lastLit);
        for (let i = from; i < to; i++) words[i].classList.toggle('on', i < lit);
        lastLit = lit;
      }
    }

    if (footer && footRect && footRect.top < vh) {
      footer.style.setProperty('--foot', clamp((vh - footRect.top) / Math.max(footRect.height, 1)).toFixed(4));
    }
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  update();
}

/* ---------------------------------------------------- active nav section */
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
  // Watch every section, so the highlight clears over ones that have no nav link.
  $$('main > section[id]').forEach((section) => io.observe(section));
}

/* --------------------------------------------------------- pointer effects */
function initPointer() {
  if (!finePointer.matches || reducedMotion.matches) return;

  const hero = $('[data-hero]');
  const glow = $('.glow-a', hero ?? document);
  let heroEvent: PointerEvent | null = null;
  hero?.addEventListener('pointermove', (e) => {
    if (!heroEvent) {
      requestAnimationFrame(() => {
        const ev = heroEvent;
        heroEvent = null;
        if (!ev) return;
        const rect = hero.getBoundingClientRect();
        glow?.style.setProperty('--mx', `${(((ev.clientX - rect.left) / rect.width - 0.5) * 90).toFixed(1)}px`);
        glow?.style.setProperty('--my', `${(((ev.clientY - rect.top) / rect.height - 0.5) * 60).toFixed(1)}px`);
      });
    }
    heroEvent = e;
  });

  $$('.magnetic').forEach((btn) => {
    let pending: PointerEvent | null = null;
    let rect: DOMRect | null = null;
    btn.addEventListener('pointerenter', () => (rect = btn.getBoundingClientRect()));
    btn.addEventListener('pointermove', (e) => {
      if (!pending) {
        requestAnimationFrame(() => {
          const ev = pending;
          pending = null;
          if (!ev || !rect) return;
          const x = ev.clientX - rect.left - rect.width / 2;
          const y = ev.clientY - rect.top - rect.height / 2;
          btn.style.transform = `translate(${(x * 0.16).toFixed(1)}px, ${(y * 0.26).toFixed(1)}px)`;
        });
      }
      pending = e;
    });
    btn.addEventListener('pointerleave', () => {
      pending = null;
      btn.style.transform = '';
    });
  });
}

/* -------------------------------------------------- pause off-screen loops */
/** Looping CSS animations (spinners, marquee, glows) pause outside the viewport. */
function initOffscreenPause() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
    },
    { rootMargin: '120px 0px' },
  );
  $$('main > section, main > div, .footer').forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------- local time */
function initClock() {
  const targets = $$('[data-clock]');
  if (!targets.length) return;
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const tick = () => {
    const now = format.format(new Date());
    targets.forEach((el) => (el.textContent = now));
  };
  tick();
  setInterval(tick, 15_000);
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
let heroInView = false;

function loadAssistant(): Promise<void> {
  if (window.VoiceAssistant) return Promise.resolve();
  widgetPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${ASSISTANT_ORIGIN}/embed/embed.js`;
    script.async = true;
    script.dataset.title = "Sabith's AI assistant";
    script.dataset.accent = LAVENDER;
    script.dataset.theme = 'light';
    script.onload = () => {
      document.getElementById('voice-assistant-widget')?.toggleAttribute('data-hero', heroInView);
      resolve();
    };
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
  // On a phone the launcher sits over the hero's buttons, so it steps aside while
  // they are on screen (see #voice-assistant-widget[data-hero] in styles.css).
  const cta = $('.hero-cta');
  if (cta && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroInView = entry.isIntersecting;
      document.getElementById('voice-assistant-widget')?.toggleAttribute('data-hero', heroInView);
    }).observe(cta);
  }
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
  initOffscreenPause();
  initClock();
  initMenu();
  initCopy();
  initAssistant();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
