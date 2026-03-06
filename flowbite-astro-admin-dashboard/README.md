# Overview

I knabbed this from the upstream repo at https://github.com/themesberg/flowbite-astro-admin-dashboard/. 	

# My Changes

1. **Fixed Sidebar Parsing Error**: Corrected invalid backslash-escaped single quotes within JavaScript template literals in `src/app/SideBar.astro`, resolving a rendering crash in development.
2. **Fixed Build Error**: Updated `astro.config.mjs` to configure Vite/Rollup to externalize the missing `shiki/themes/hc_light.json` file, restoring `pnpm run build` functionality.
3. **Persistent Layout Applied**: Modified multiple page layouts (`pricing.astro`, `500.astro`, `maintenance.astro`, and `404.astro`) to use `<LayoutSidebar>` instead of `<LayoutStacked>`, ensuring the left-hand navigation bar persists consistently when navigating.
