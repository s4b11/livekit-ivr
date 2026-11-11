import { OWNER } from '@/lib/config';

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-wide">{OWNER.name}</p>
        <p className="text-muted-foreground truncate text-xs">{OWNER.tagline}</p>
      </div>
      <nav aria-label="Links" className="flex shrink-0 gap-4 text-xs">
        {OWNER.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
