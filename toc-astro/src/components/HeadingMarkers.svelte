<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  // Scan headings under this container
  export let selector: string = '#content';

  // Consumers (e.g., Sites.svelte) can wait for this signal before building sections
  const dispatch = createEventDispatcher<{ applied: void }>();

  // --- Helpers ---------------------------------------------------------------

  // Peel any number of trailing bracket BLOCKS: " ... [ ... ] [ ... ]"
  function peelBracketBlocks(s: string): { label: string; blocks: string[] } {
    const blocks: string[] = [];
    let txt = s;
    const re = /\s+\[([^\]]+)\]\s*$/;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt)) !== null) {
      blocks.unshift(m[1]);      // preserve left→right order
      txt = txt.slice(0, m.index);
    }
    return { label: txt.trimEnd(), blocks };
  }

  // From a single bracket block (e.g. "class.SiteA id.my-id"), split into tokens
  function splitBlock(block: string): string[] {
    return block.split(/\s+/).filter(Boolean);
  }

  // Peel any number of trailing UPPERCASE bracketless tokens:
  //   "... CLASS.SiteA ID.some-id"
  function peelBareTokens(s: string): { label: string; tokens: string[] } {
    const tokens: string[] = [];
    let txt = s;
    const re = /(.*?)(?:\s+((?:CLASS|ID)\.[A-Za-z0-9_-]+))\s*$/; // CASE-SENSITIVE: CLASS / ID
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt)) !== null) {
      tokens.unshift(m[2]);      // preserve left→right order
      txt = m[1];
    }
    return { label: txt.trimEnd(), tokens };
  }

  function applyToken(h: HTMLElement, token: string) {
    // --- NEW bracketless syntax (CASE-SENSITIVE) ---
    if (token.startsWith('CLASS.')) {
      const name = token.slice('CLASS.'.length);
      if (name) h.classList.add(`DN_${name}`);
      return;
    }
    if (token.startsWith('ID.')) {
      const id = token.slice('ID.'.length);
      if (id && !h.id) h.id = id;
      return;
    }

    // --- Back-compat tokens (from older setups) ---
    // [.SomeClass]
    if (/^\.[A-Za-z0-9_-]+$/.test(token)) { h.classList.add(token.slice(1)); return; }

    // [DN:SiteA]
    {
      const m = /^DN:([A-Za-z0-9_-]+)$/i.exec(token);
      if (m) { h.classList.add(`DN_${m[1]}`); return; }
    }

    // [id:my-id]
    {
      const m = /^id:(.+)$/i.exec(token);
      if (m && !h.id) { h.id = m[1].trim(); return; }
    }

    // [class:a b c]
    {
      const m = /^class:(.+)$/i.exec(token);
      if (m) { m[1].split(/\s+/).forEach((c) => c && h.classList.add(c)); return; }
    }

    // Generic key=value (e.g. [data-x=1])
    {
      const m = /^([A-Za-z_:][-A-Za-z0-9_:.]*)=(.+)$/.exec(token);
      if (m) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        h.setAttribute(m[1], v);
        return;
      }
    }
    // Unknown token shapes are ignored
  }

  // --------------------------------------------------------------------------

  onMount(() => {
    const root = document.querySelector(selector);
    if (!root) return;

    const heads = Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'));

    for (const h of heads) {
      // Start with full text (note: this will drop inline markup inside headings if present)
      let label = h.textContent ?? '';

      // 1) Peel bracket blocks at the end:  "... [ ... ] [ ... ]"
      const peeled1 = peelBracketBlocks(label);
      label = peeled1.label;
      const tokensFromBlocks = peeled1.blocks.flatMap(splitBlock);

      // 2) Peel NEW bare tokens at the end: "... CLASS.X ID.y"
      const peeled2 = peelBareTokens(label);
      label = peeled2.label;
      const bareTokens = peeled2.tokens;

      const allTokens = [...tokensFromBlocks, ...bareTokens];

      if (allTokens.length === 0) continue;

      // Update visible text (strip tokens)
      h.textContent = label;

      // Apply tokens
      for (const t of allTokens) applyToken(h, t);
    }

    // Signal completion so Sites.svelte can proceed
    (window as any).__headingMarkersApplied = true;
    window.dispatchEvent(new CustomEvent('heading-markers:applied'));
    dispatch('applied');
  });
</script>

<!-- This component renders nothing; it mutates headings under {selector}. -->
