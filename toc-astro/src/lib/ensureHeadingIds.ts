// src/lib/ensureHeadingIds.ts
function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ensureHeadingIds(rootSelector = '#content') {
  const root = document.querySelector(rootSelector);
  if (!root) return;

  const existing = new Set<string>();
  // collect existing ids to prevent collisions
  root.querySelectorAll<HTMLElement>('[id]').forEach((el) => existing.add(el.id));

  const headings = Array.from(
    root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
  );

  for (const h of headings) {
    if (h.id && h.id.length) {
      existing.add(h.id);
      continue;
    }
    let base = slugify(h.textContent || 'section') || 'section';
    let candidate = base;
    let i = 2;
    while (existing.has(candidate) || document.getElementById(candidate)) {
      candidate = `${base}-${i++}`;
    }
    h.id = candidate;
    existing.add(candidate);
  }
}
