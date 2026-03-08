import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const { SITE_URL, AUTH_URL } = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import auth from 'auth-astro';

const DEV_PORT = 2121;

// https://astro.build/config
export default defineConfig({
	site: process.env.CI
		? 'https://themesberg.github.io'
		: process.env.SITE_URL || SITE_URL || AUTH_URL || `http://localhost:${DEV_PORT}`,
	base: process.env.CI ? '/flowbite-astro-admin-dashboard' : undefined,

	output: 'server',
	adapter: node({
		mode: 'standalone'
	}),

	/* Like Vercel, Netlify,… Mimicking for dev. server */
	// trailingSlash: 'always',

	server: {
		/* Dev. server only */
		port: DEV_PORT,
	},

	integrations: [
		//
		auth(),
		sitemap(),
		tailwind(),
		mdx(),
	],
	vite: {
		server: {
			allowedHosts: ['dashboard.leh.tejedas.net']
		},
		build: {
			rollupOptions: {
				external: ['shiki/themes/hc_light.json']
			}
		}
	}
});
