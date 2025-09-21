<script lang="ts">
  import TocItem from './TocItem.svelte';
  import { melt } from '@melt-ui/svelte';
  import { visibleHeadingIds } from '../stores/visibleHeadings';

  export type TocNode = {
    id: unknown;
    level: number;
    children?: TocNode[];
    text?: string; label?: string; title?: string;
  };

  export let node: TocNode;
  export let item: (opts: { id: string }) => any; // Melt UI builder store

  // --- helpers ---------------------------------------------------------------
  function stripMarkers(s: string): string {
    // removes trailing " [ ... ]" blocks (one or many) from the end of a string
    let out = s ?? '';
    const re = /\s+\[[^\]]+\]\s*$/;
    while (re.test(out)) out = out.replace(re, '');
    return out.trimEnd();
  }

  function getHeadingText(id: string): string {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!el) return '';
    // clone so we can remove decorations (anchors/icons) safely
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('a, svg, .sr-only, [aria-hidden="true"]').forEach((n) => n.remove());
    const txt = clone.textContent?.trim() || '';
    return stripMarkers(txt);
  }

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
    if (el?.id) return el.id;

    // Fallback: try to match by (marker-stripped) text
    const raw = stripMarkers(n.text ?? n.label ?? n.title ?? '');
    if (raw) {
      const candidates = Array.from(
        document.querySelectorAll('#content h1,#content h2,#content h3,#content h4,#content h5,#content h6')
      ) as HTMLElement[];
      const match = candidates.find((h) => (h.textContent?.trim() || '') === raw);
      if (match?.id) return match.id;
    }
    return '';
  }

  function nodeHasVisibleDescendant(n: TocNode, idSet: Set<string>): boolean {
    if (!n?.children?.length) return false;
    for (const c of n.children) {
      const cid = coerceId(c);
      if (cid && idSet.has(cid)) return true;
      if (nodeHasVisibleDescendant(c, idSet)) return true;
    }
    return false;
  }
  // --------------------------------------------------------------------------

  const id = coerceId(node);

  // Prefer live DOM label (already cleaned by your Sites helper), then fallback to node text with marker stripping
  const domLabel = id ? getHeadingText(id) : '';
  const fallback = stripMarkers(node.text ?? node.label ?? node.title ?? '');
  const rawLabel = domLabel || fallback || (id ? id : '(untitled)');

  // Show this item if:
  //  - the visible set is empty (initial render), OR
  //  - our own id is visible, OR
  //  - any descendant’s id is visible (so parents stay when children are shown)
  $: show = (() => {
    const ids = $visibleHeadingIds;
    if (!ids || ids.size === 0) return true;
    if (id && ids.has(id)) return true;
    return nodeHasVisibleDescendant(node, ids);
  })();
</script>

{#if show}
  <li class="toc-li">
    <a
      class="toc-link"
      href={id ? `#${id}` : undefined}
      use:melt={id ? $item({ id }) : undefined}
      on:click|preventDefault={() => { if (id) location.hash = `#${id}`; }}
    >
      {rawLabel}
    </a>

    {#if node.children?.length}
      <ul class="toc-sub">
        {#each node.children as child (String(child.id))}
          <TocItem node={child} {item} />
        {/each}
      </ul>
    {/if}
  </li>
{/if}

<style>
  .toc-li { margin: .25rem 0; }
</style>
