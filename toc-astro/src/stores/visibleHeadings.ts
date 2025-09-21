import { writable } from 'svelte/store';

// Set of heading IDs (h1..h6 in #content) that are currently visible in the DOM
export const visibleHeadingIds = writable<Set<string>>(new Set());
