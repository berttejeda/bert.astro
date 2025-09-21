// src/stores/siteFilter.ts
import { writable } from 'svelte/store';
export const selectedSite = writable<string>('All');
