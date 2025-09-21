<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { selectedSite } from '../stores/siteFilter';
  import { visibleHeadingIds } from '../stores/visibleHeadings';

  // Props
  export let items: string[] = [];
  export let label: string = 'Select a site';
  export let name: string = 'sites';
  export let placeholder: string = 'Choose…';
  export let value: string | null = null;           // initial selection (e.g., "All")
  export let contentSelector: string = '#content';  // MDX wrapper in your layout

  const dispatch = createEventDispatcher<{ change: string }>();

  type Section = {
    site: string | null;       // "SiteA" | "SiteB" | ... | null (global)
    elements: HTMLElement[];   // heading + all siblings until next heading
  };

  let sections: Section[] = [];
  let container: HTMLElement | null = null;

  // ---------------------------
  // Utilities
  // ---------------------------
  const isHeading = (el: Element) =>
    ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName);

  const extractDN = (el: Element): string | null => {
    for (const cls of Array.from(el.classList)) {
      if (cls.startsWith('DN_')) return cls.slice(3); // remove "DN_"
    }
    return null;
  };

  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Parse trailing markers like:
  //   [DN:SiteA] [id:site-a-1] [.Extra] [class:foo bar] [data-x=1]
  function applyHeadingMarkers() {
    if (!container) return;

    const heads = Array.from(
      container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')
    );

    // Peel off trailing " [ ... ]" blocks from the end, preserving order
    const peelMarkers = (s: string) => {
      const tokens: string[] = [];
      let txt = s;
      const re = /\s+\[([^\]]+)\]\s*$/;
      let m: RegExpExecArray | null;
      while ((m = re.exec(txt)) !== null) {
        tokens.unshift(m[1]);        // keep original left-to-right order
        txt = txt.slice(0, m.index); // drop the matched suffix
      }
      return { label: txt.trimEnd(), tokens };
    };

    for (const h of heads) {
      // Prefer textContent; headings created by MDX/Markdown should have a text node inside
      const current = h.textContent ?? '';
      const { label, tokens } = peelMarkers(current);
      if (tokens.length === 0) continue;

      // 1) Update visible text (remove the trailing markers)
      h.textContent = label;

      // 2) Apply tokens
      for (const raw of tokens) {
        const t = raw.trim();

        // [DN:SiteA] -> class "DN_SiteA"
        {
          const m = /^DN:([A-Za-z0-9_-]+)$/i.exec(t);
          if (m) { h.classList.add(`DN_${m[1]}`); continue; }
        }

        // [.SomeClass] -> class "SomeClass"
        if (/^\.[A-Za-z0-9_-]+$/.test(t)) { h.classList.add(t.slice(1)); continue; }

        // [id:my-id]
        {
          const m = /^id:(.+)$/i.exec(t);
          if (m && !h.id) { h.id = m[1].trim(); continue; }
        }

        // [class:a b c]
        {
          const m = /^class:(.+)$/i.exec(t);
          if (m) { m[1].split(/\s+/).forEach((c) => c && h.classList.add(c)); continue; }
        }

        // [data-x=1] (generic key=value)
        {
          const m = /^([A-Za-z_:][-A-Za-z0-9_:.]*)=(.+)$/.exec(t);
          if (m) {
            let v = m[2].trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            h.setAttribute(m[1], v);
            continue;
          }
        }
        // Unknown token shapes are ignored
      }
    }
  }

  function buildSections() {
    sections = [];
    if (!container) return;

    const kids = Array.from(container.children) as HTMLElement[];
    let i = 0;

    while (i < kids.length) {
      const el = kids[i];

      // Sections start only at headings.
      if (!isHeading(el)) { i += 1; continue; }

      const dn = extractDN(el); // site name or null (global)

      // Capture from this heading up to (but not including) the next heading
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
    // Using the 'hidden' attribute preserves layout semantics
    if (show) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  function recomputeVisibleHeadings() {
    if (!container) return;

    const heads = Array.from(
      container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')
    );

    const set = new Set<string>();
    for (const h of heads) {
      // ensure an id exists for linking/ToC lookups
      if (!h.id) {
        const guess = slugify(h.textContent || 'section');
        if (guess) h.id = guess;
      }

      // visible? (no hidden/display:none/visibility:hidden up the chain)
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

  // ---------------------------
  // Filtering
  // ---------------------------
  async function applyFilter(site: string | null) {
    if (!container) return;
    if (!sections.length) buildSections();

    const showAll = !site || site === 'All';

    // 1) Unhide everything first
    for (const s of sections) for (const el of s.elements) setVisible(el, true);
    await tick();
    recomputeVisibleHeadings(); // publish visible ids (all)

    if (showAll) {
      selectedSite.set('All');
      dispatch('change', 'All');
      return;
    }

    // 2) Hide only site-specific sections that don't match the selection
    for (const s of sections) {
      if (s.site && s.site !== site) {
        for (const el of s.elements) setVisible(el, false);
      }
      // global (s.site === null) => never hidden
    }
    await tick();
    recomputeVisibleHeadings(); // publish visible ids (post-filter)

    // If current hash is hidden, scroll to first visible section
    if (location.hash) {
      const id = location.hash.slice(1);
      const target = document.getElementById(id);
      if (target?.hasAttribute('hidden')) {
        const visible = sections.find((sec) => !sec.elements[0].hasAttribute('hidden'));
        visible?.elements[0]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    selectedSite.set(site ?? 'All');
    dispatch('change', site ?? 'All');
  }

  function handleChange(e: Event) {
    value = (e.target as HTMLSelectElement).value || null;
    applyFilter(value);
  }

  onMount(() => {
    container = document.querySelector(contentSelector) as HTMLElement | null;

    // 👇 Convert trailing "[...]" markers into real classes/ids BEFORE building sections
    applyHeadingMarkers();

    if (!value) value = items.includes('All') ? 'All' : (items[0] ?? null);
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

  /* Light defaults */
  :global(:root) { --select-bg:#fff; --select-fg:#111827; --select-border:#d1d5db; --select-focus:#2563eb; }
  /* Dark mode overrides */
  @media (prefers-color-scheme: dark) {
    :global(:root) { --select-bg:#0f172a; --select-fg:#e5e7eb; --select-border:#334155; }
  }

  .sites-select {
    padding:.5rem .6rem;
    border:1px solid var(--select-border);
    border-radius:.5rem;
    background:var(--select-bg);
    color:var(--select-fg);
  }
  .sites-select option {
    background:var(--select-bg);
    color:var(--select-fg);
  }
  .sites-select:focus {
    outline:2px solid var(--select-focus);
    outline-offset:2px;
  }
</style>
