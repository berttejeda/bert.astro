<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  // Which container to scan for headings
  export let selector: string = '#content';

  const dispatch = createEventDispatcher<{ applied: void }>();

  // Peel trailing " [ ... ]" blocks from text, preserving original order
  function peelMarkers(s: string) {
    const tokens: string[] = [];
    let txt = s;
    const re = /\s+\[([^\]]+)\]\s*$/;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt)) !== null) {
      tokens.unshift(m[1]);        // maintain left→right order
      txt = txt.slice(0, m.index); // drop the suffix
    }
    return { label: txt.trimEnd(), tokens };
  }

  function applyToHeading(h: HTMLElement, tokens: string[]) {
    for (const raw of tokens) {
      const t = raw.trim();

      // [DN:SiteA] -> class "DN_SiteA"
      {
        const m = /^DN:([A-Za-z0-9_-]+)$/i.exec(t);
        if (m) { h.classList.add(`DN_${m[1]}`); continue; }
      }

      // [.SomeClass] -> add class
      if (/^\.[A-Za-z0-9_-]+$/.test(t)) { h.classList.add(t.slice(1)); continue; }

      // [id:my-id] -> set id if missing
      {
        const m = /^id:(.+)$/i.exec(t);
        if (m && !h.id) { h.id = m[1].trim(); continue; }
      }

      // [class:a b c] -> add classes
      {
        const m = /^class:(.+)$/i.exec(t);
        if (m) { m[1].split(/\s+/).forEach((c) => c && h.classList.add(c)); continue; }
      }

      // generic key=value, e.g. [data-x=1]
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
      // unknown token shapes are ignored
    }
  }

  onMount(() => {
    const root = document.querySelector(selector);
    if (!root) return;

    const heads = Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));
    for (const h of heads) {
      // get clean text + trailing markers
      const txt = h.textContent ?? '';
      const { label, tokens } = peelMarkers(txt);
      if (tokens.length === 0) continue;

      // 1) update visible text (remove markers)
      h.textContent = label;

      // 2) apply class/id/attrs
      applyToHeading(h, tokens);
    }

    // Expose completion for other islands (e.g., Sites.svelte) to wait on
    (window as any).__headingMarkersApplied = true;
    window.dispatchEvent(new CustomEvent('heading-markers:applied'));
    dispatch('applied');
  });
</script>

<!-- Renders nothing; it just mutates the DOM under {selector} -->
