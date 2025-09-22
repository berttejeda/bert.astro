<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { selectedSite } from '../stores/siteFilter';
  import { visibleHeadingIds } from '../stores/visibleHeadings';

  // Props
  export let items: string[] = [];
  export let label: string = 'Select a site';
  export let name: string = 'sites';
  export let placeholder: string = 'Choose…';
  export let value: string | null = null;           // e.g., "All"
  export let contentSelector: string = '#content';  // MDX wrapper

  const STORAGE_KEY = 'siteFilter';
  const dispatch = createEventDispatcher<{ change: string }>();
  type Section = {
    site: string | null;       // "SiteA" | "SiteB" | ... | null (global)
    elements: HTMLElement[];   // heading + siblings until next heading
  };

  let sections: Section[] = [];
  let container: HTMLElement | null = null;

  const isHeading = (el: Element) =>
    ['H1','H2','H3','H4','H5','H6'].includes(el.tagName);

  const extractDN = (el: Element): string | null => {
    for (const cls of Array.from(el.classList)) {
      if (cls.startsWith('DN_')) return cls.slice(3);
    }
    return null;
  };

  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function buildSections() {
    sections = [];
    if (!container) return;
    const kids = Array.from(container.children) as HTMLElement[];
    let i = 0;

    while (i < kids.length) {
      const el = kids[i];
      if (!isHeading(el)) { i += 1; continue; }

      const dn = extractDN(el); // site or null (global)

      const chunk: HTMLElement[] = [el];
      let j = i + 1;
      while (j < kids.length && !isHeading(kids[j])) {
        chunk.push(kids[j]);
        j += 1;
      }
      sections.push({ site: dn, elements: chunk });
      i = j;
    }
  }

  function setVisible(el: HTMLElement, show: boolean) {
    if (show) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  function recomputeVisibleHeadings() {
    if (!container) return;
    const heads = Array.from(container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
    const set = new Set<string>();

    for (const h of heads) {
      if (!h.id) {
        const guess = slugify(h.textContent || 'section');
        if (guess) h.id = guess;
      }
      // check visibility up the chain
      let cur: HTMLElement | null = h;
      let vis = true;
      while (cur) {
        if (cur.hasAttribute('hidden')) { vis = false; break; }
        const cs = getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden') { vis = false; break; }
        cur = cur.parentElement;
      }
      if (vis && h.id) set.add(h.id);
    }
    visibleHeadingIds.set(set);
  }

  async function applyFilter(site: string | null) {
    if (!container) return;
    if (!sections.length) buildSections();

    const showAll = !site || site === 'All';

    // Unhide everything first
    for (const s of sections) for (const el of s.elements) setVisible(el, true);
    await tick();
    recomputeVisibleHeadings();

    if (showAll) {
      selectedSite.set('All');
      dispatch('change', 'All');
      try { localStorage.setItem(STORAGE_KEY, 'All'); } catch {}
      return;
    }

    // Hide non-matching site sections; global sections (site=null) always visible
    for (const s of sections) {
      if (s.site && s.site !== site) {
        for (const el of s.elements) setVisible(el, false);
      }
    }
    await tick();
    recomputeVisibleHeadings();

    if (location.hash) {
      const id = location.hash.slice(1);
      const target = document.getElementById(id);
      if (target?.hasAttribute('hidden')) {
        const firstVisible = sections.find((sec) => !sec.elements[0].hasAttribute('hidden'));
        firstVisible?.elements[0]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    selectedSite.set(site ?? 'All');
    dispatch('change', site ?? 'All');
    try { localStorage.setItem(STORAGE_KEY, site ?? 'All'); } catch {}
  }

  function handleChange(e: Event) {
    value = (e.target as HTMLSelectElement).value || null;
    applyFilter(value);
  }

  onMount(async () => {
    container = document.querySelector(contentSelector) as HTMLElement | null;

    // restore selection
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!value) value = saved ?? (items.includes('All') ? 'All' : (items[0] ?? null));
    } catch {
      if (!value) value = items.includes('All') ? 'All' : (items[0] ?? null);
    }

    // ⚠️ Wait for HeadingMarkers to finish (ensures DN_* classes are present)
    if (!(window as any).__headingMarkersApplied) {
      await new Promise<void>((resolve) => {
        const done = () => { window.removeEventListener('heading-markers:applied', done); resolve(); };
        window.addEventListener('heading-markers:applied', done, { once: true });
        // fallback in case event never fires
        setTimeout(done, 200);
      });
    }

    buildSections();
    applyFilter(value);
  });
</script>

<div class="sites">
  <label for={name} class="sites-label">{label}</label>
  <select id={name} class="sites-select" on:change={handleChange} bind:value aria-label={label}>
    {#if placeholder && (!value || value === '')}
      <option value="" disabled selected hidden>{placeholder}</option>
    {/if}
    {#each items as opt (opt)}
      <option value={opt}>{opt}</option>
    {/each}
  </select>
</div>

<style>
  .sites { display: grid; gap: .5rem; max-width: 20rem; }
  .sites-label { font-weight: 600; }
  :global(:root) { --select-bg:#fff; --select-fg:#111827; --select-border:#d1d5db; --select-focus:#2563eb; }
  @media (prefers-color-scheme: dark) {
    :global(:root) { --select-bg:#0f172a; --select-fg:#e5e7eb; --select-border:#334155; }
  }
  .sites-select {
    padding:.5rem .6rem; border:1px solid var(--select-border); border-radius:.5rem;
    background:var(--select-bg); color:var(--select-fg);
  }
  .sites-select option { background:var(--select-bg); color:var(--select-fg); }
  .sites-select:focus { outline:2px solid var(--select-focus); outline-offset:2px; }
</style>
