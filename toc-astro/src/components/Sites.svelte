<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import { createSelect, melt } from '@melt-ui/svelte';
  import { selectedSite } from '../stores/siteFilter';          // still publish a human-friendly label
  import { visibleHeadingIds } from '../stores/visibleHeadings'; // drives ToC pruning

  // --------------------------------------------------------------------------
  // Props
  // --------------------------------------------------------------------------
  export let items: unknown[] = [];                 // grouped or flat
  export let label: string = 'Select site(s)';
  export let name: string = 'sites';
  export let placeholder: string = 'Choose…';
  export let value: string[] | string | null = null;  // initial selection(s)
  export let contentSelector: string = '#content';    // MDX wrapper container

  const STORAGE_KEY = 'siteFilterMulti';
  const dispatch = createEventDispatcher<{ change: string[] }>();

  // --------------------------------------------------------------------------
  // Normalize groups
  // --------------------------------------------------------------------------
  type Group = { key: string; values: string[] };

  function normalizeItems(input: unknown[]): Group[] {
    if (!Array.isArray(input)) return [];
    const groups: Group[] = [];

    // flat strings -> single group "Sites"
    const flats = input.filter((x) => typeof x === 'string') as string[];
    if (flats.length) groups.push({ key: 'Sites', values: flats.map(String) });

    // object maps -> { key: string[] }
    const maps = input.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
    for (const obj of maps) {
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) groups.push({ key: String(k), values: (v as unknown[]).map(String) });
      }
    }

    // de-dupe while preserving order
    const seen = new Set<string>();
    for (const g of groups) g.values = g.values.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
    return groups;
  }

  const groups: Group[] = normalizeItems(items);
  const allOptions: string[] = Array.from(new Set(groups.flatMap((g) => g.values)));

  // --------------------------------------------------------------------------
  // Content sections (same logic as before)
  // --------------------------------------------------------------------------
  type Section = { site: string | null; elements: HTMLElement[] };
  let sections: Section[] = [];
  let container: HTMLElement | null = null;

  const isHeading = (el: Element) => ['H1','H2','H3','H4','H5','H6'].includes(el.tagName);

  const extractDN = (el: Element): string | null => {
    for (const cls of Array.from(el.classList)) {
      if (cls.startsWith('DN_')) return cls.slice(3); // "DN_SiteA" -> "SiteA"
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
      const dn = extractDN(el);
      const chunk: HTMLElement[] = [el];
      let j = i + 1;
      while (j < kids.length && !isHeading(kids[j])) { chunk.push(kids[j]); j += 1; }
      sections.push({ site: dn, elements: chunk });
      i = j;
    }
  }

  function setVisible(el: HTMLElement, show: boolean) {
    if (show) el.removeAttribute('hidden'); else el.setAttribute('hidden','');
  }

  function recomputeVisibleHeadings() {
    if (!container) return;
    const heads = Array.from(container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
    const set = new Set<string>();
    for (const h of heads) {
      if (!h.id) h.id = slugify(h.textContent || 'section');
      let cur: HTMLElement | null = h, vis = true;
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

  async function applyFilterForSet(sel: Set<string>) {
    if (!container) return;
    if (!sections.length) buildSections();

    const showAll = sel.size === 0 || sel.has('All');

    // Unhide everything first
    for (const s of sections) for (const el of s.elements) setVisible(el, true);
    await tick();
    recomputeVisibleHeadings();

    if (!showAll) {
      for (const s of sections) {
        if (s.site && !sel.has(s.site)) for (const el of s.elements) setVisible(el, false);
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
    }

    // Publish a friendly label to the legacy store (useful elsewhere in UI)
    const list = Array.from(sel);
    selectedSite.set(showAll ? 'All' : (list.join(', ') || 'All'));
    dispatch('change', showAll ? ['All'] : list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(showAll ? ['All'] : list)); } catch {}
  }

  // --------------------------------------------------------------------------
  // Melt Select (multiple + groups)
  // --------------------------------------------------------------------------
  const {
    elements: { trigger, menu, option, group, groupLabel, label: labelEl },
    states: { selected, selectedLabel, open },
    helpers: { isSelected },
  } = createSelect<string>({
    name,
    multiple: true,
    forceVisible: true,
    positioning: { placement: 'bottom', fitViewport: true, sameWidth: true },
  });

  // Helpers for the selected store <-> string arrays
  type Sel = { value: string; label?: string };
  const toEntries = (arr: string[]) => arr.map((v) => ({ value: v, label: v } as Sel));
  const fromEntries = (arr: Sel[] | Sel | null | undefined) =>
    Array.isArray(arr) ? arr.map((o) => o.value) : arr ? [arr.value] : [];

  function arraysEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Keep "All" mutually exclusive with other selections
  function normalizeMulti(sel: string[]): string[] {
    // remove unknown values
    sel = sel.filter((v) => allOptions.includes(v));
    const hasAll = sel.includes('All');
    if (hasAll && sel.length > 1) return ['All']; // All wins by itself
    return sel;
  }

  // React to selection changes from Melt
  let prevApplied: string[] = [];
  $: {
    const raw = fromEntries($selected as any);
    const normalized = normalizeMulti(Array.from(new Set(raw)));
    // if user selected any non-All while All was selected, rewrite store to drop All
    if (!arraysEqual(raw, normalized)) {
      selected.set(toEntries(normalized) as any);
    }
    // Apply filter if changed
    if (!arraysEqual(prevApplied, normalized)) {
      prevApplied = normalized;
      applyFilterForSet(new Set(normalized));
    }
  }

  function setInitialSelection(initial: string[] | null) {
    if (!initial) return;
    const normalized = normalizeMulti(initial);
    selected.set(toEntries(normalized) as any);
    prevApplied = normalized;
  }

  // --------------------------------------------------------------------------
  // Init
  // --------------------------------------------------------------------------
  onMount(async () => {
    container = document.querySelector(contentSelector) as HTMLElement | null;

    // Derive initial selection(s)
    let init: string[] | null = Array.isArray(value) ? value.slice()
                      : typeof value === 'string' && value ? [value]
                      : null;
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (!init && savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) init = parsed.map(String);
      }
    } catch { /* ignore */ }
    if (!init) {
      init = allOptions.includes('All') ? ['All'] : (allOptions[0] ? [allOptions[0]] : []);
    }

    // Wait for HeadingMarkers so DN_* classes exist
    if (!(window as any).__headingMarkersApplied) {
      await new Promise<void>((resolve) => {
        const done = () => { window.removeEventListener('heading-markers:applied', done); resolve(); };
        window.addEventListener('heading-markers:applied', done, { once: true });
        setTimeout(done, 200);
      });
    }

    buildSections();
    setInitialSelection(init);
    await tick();
    applyFilterForSet(new Set(init));
  });
</script>

<!-- UI -->
<div class="sites">
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <label class="sites-label" use:melt={$labelEl}>{label}</label>

  <button class="sites-trigger" use:melt={$trigger} aria-label={label} type="button">
    {$selectedLabel || placeholder}
    <svg viewBox="0 0 20 20" aria-hidden="true" class="chev">
      <path d="M5.5 7.5l4.5 4 4.5-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  {#if $open}
    <div class="sites-menu" use:melt={$menu}>
      {#each groups as g (g.key)}
        <div use:melt={$group(g.key)}>
          <div class="sites-group-label" use:melt={$groupLabel(g.key)}>{g.key}</div>
          {#each g.values as opt (opt)}
            <div
              class="sites-option"
              use:melt={$option({ value: opt, label: opt })}
              data-selected={$isSelected(opt) ? 'true' : undefined}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" class="check" style="display: {$isSelected(opt) ? 'block' : 'none'};">
                <path d="M5 10.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {opt}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sites { display: grid; gap: .5rem; max-width: 28rem; }
  .sites-label { font-weight: 600; }

  :global(:root) {
    --sel-bg:#fff; --sel-fg:#111827; --sel-border:#d1d5db; --sel-hover:#f3f4f6; --sel-focus:#2563eb;
    --menu-bg:#fff; --menu-fg:#111827; --menu-hover:#e5e7eb; --menu-border:#e5e7eb;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --sel-bg:#0f172a; --sel-fg:#e5e7eb; --sel-border:#334155; --sel-hover:#0b1222; --sel-focus:#60a5fa;
      --menu-bg:#0b1222; --menu-fg:#e5e7eb; --menu-hover:#111827; --menu-border:#1f2937;
    }
  }

  .sites-trigger {
    display:flex; align-items:center; justify-content:space-between;
    min-height: 2.5rem; min-width: 14rem;
    padding:.5rem .6rem; border:1px solid var(--sel-border); border-radius:.5rem;
    background:var(--sel-bg); color:var(--sel-fg);
    box-shadow: 0 1px 2px rgba(0,0,0,.04);
  }
  .sites-trigger:focus-visible { outline:2px solid var(--sel-focus); outline-offset:2px; }
  .chev { width: 1rem; height: 1rem; opacity:.7; margin-left:.5rem; }

  .sites-menu {
    position: relative; z-index: 50;
    max-height: 18rem; overflow: auto;
    padding:.25rem; margin-top:.25rem;
    border:1px solid var(--menu-border); border-radius:.5rem;
    background: var(--menu-bg); color: var(--menu-fg);
    box-shadow: 0 8px 24px rgba(0,0,0,.12);
  }

  .sites-group-label { padding:.4rem .75rem; font-weight: 600; opacity:.9; }

  .sites-option {
    position: relative; cursor: pointer; border-radius:.5rem;
    padding:.375rem .75rem .375rem 2rem; line-height: 1.35;
  }
  .sites-option:hover, .sites-option[data-highlighted] { background: var(--menu-hover); }
  .sites-option[data-disabled] { opacity:.5; cursor:not-allowed; }
  .sites-option[data-selected="true"] { font-weight: 600; }

  .check { position: absolute; left:.5rem; top:50%; transform: translateY(-50%); width:1rem; height:1rem; }
</style>
