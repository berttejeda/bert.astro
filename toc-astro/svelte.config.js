// svelte.config.js
import sveltePreprocess from 'svelte-preprocess';
import { preprocessMeltUI, sequence } from '@melt-ui/pp';

const config = {
  // Order matters: put general preprocessors (TS, SCSS, etc.) first,
  // and keep preprocessMeltUI() LAST.
  preprocess: sequence([
    sveltePreprocess({
      typescript: true,
    }),
    preprocessMeltUI(),
  ]),
};

export default config;
