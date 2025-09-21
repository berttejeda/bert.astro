<script lang="ts">
  import { createTableOfContents } from '@melt-ui/svelte';
  import TocItem from './TocItem.svelte';
  import { selectedSite } from '../stores/siteFilter';
  import { visibleHeadingIds } from '../stores/visibleHeadings';

  export let selector: string = '#content';
  export let exclude: Array<'h1'|'h2'|'h3'|'h4'|'h5'|'h6'> = []; // include all
  export let activeType:
    | 'all' | 'all-parents' | 'lowest' | 'highest'
    | 'lowest-parents' | 'highest-parents' | 'none' = 'lowest';

  // ✅ Initialize builder at module scope (like your earlier working version)
  const {
    elements: { item },
    states: { headingsTree }
  } = createTableOfContents({
    selector,
    exclude,
    activeType,
    scrollOffset: 0,
    scrollBehaviour: 'smooth'
  });

  type TocNode = { id: unknown; level: number; children?: TocNode[] };

  function coerceId(n: TocNode): string {
    const v = n.id as any;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      if (typeof v.id === 'string') return v.id;
      if (typeof v.value === 'string') return v.value;
      if (v instanceof HTMLElement && typeof v.id === 'string') return v.id;
    }
    const guess = String(v);
    const el = typeof document !== 'undefined' ? document.getElementById(guess) : null;
    return el?.id ?? '';
  }

  function filterByVisibleIds(nodes: TocNode[] | undefined, idSet: Set<string>): TocNode[] {
    if (!nodes || !nodes.length) return [];
    const out: TocNode[] = [];
    for (const n of nodes) {
      const id = coerceId(n);
      const kids = filterByVisibleIds(n.children, idSet);
      // Keep node if it (or any descendant) is visible; if idSet is empty (initial), keep all
      const keep = (id && idSet.has(id)) || kids.length > 0 || idSet.size === 0;
      if (keep) out.push({ ...n, children: kids });
    }
    return out;
  }

  let pruned: TocNode[] = [];
  $: {
    // Recompute when the selection changes, visible IDs change, or Melt’s tree updates
    const _site = $selectedSite;      // subscribe
    const ids = $visibleHeadingIds;   // subscribe
    pruned = filterByVisibleIds($headingsTree, ids);
  }
</script>

<nav aria-label="Table of contents" class="toc">
  {#if pruned.length}
    <ul class="toc-list">
      {#each pruned as node (String(node.id))}
        <TocItem {node} {item} />
      {/each}
    </ul>
  {/if}
</nav>

<style>
  .toc { position: sticky; top: 1rem; max-height: calc(100dvh - 2rem); overflow: auto; font-size: .95rem; }
  .toc-list, .toc-sub { list-style: none; padding-left: 0; margin: 0; }
  .toc-sub { padding-left: .9rem; border-left: 1px solid var(--toc-border, #e5e7eb); margin-top: .35rem; }
  .toc-li { margin: .25rem 0; }
  .toc-link { text-decoration: none; }
</style>
