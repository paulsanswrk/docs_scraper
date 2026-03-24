module.exports = {
    // General Settings
    name: 'Nuxt 4 Docs',
    startUrl: 'https://nuxt.com/docs/4.x/getting-started/introduction',
    urlFilter: '/docs/4.x/',
    outputFile: 'Nuxt4_Docs.pdf',

    // Scraper Behavior
    testMode: false, // Scrape all pages

    // Light mode toggle - click this selector before scraping if it exists
    lightModeSelector: '[aria-label="Switch to dark mode"]', // Paradoxically, if this exists, we're in light mode already
    forceLightModeSelector: '[aria-label="Switch to light mode"]', // Click this to switch TO light mode

    // Page Interaction & Selectors
    toc: {
        // Multi-step discovery:
        // 1. Find top-level sections (e.g. "Get Started", "Guide", "API", etc.)
        rootSelector: 'nav[aria-label="Main"] a',
        // 2. On each top-level page, expand details and scrape sidebar links
        expandSelector: 'details',
        linkSelector: 'nav a[href*="/docs/4.x/"]'
    },

    cleanup: {
        // Selectors to hide/remove from the printed page
        hideSelectors: [
            'header',
            'aside:not(main aside)', // Keep asides inside main content
            '.layout__sidebar',
            '[aria-label="Breadcrumb"]'
        ],
        // Selector for the main content area to maximize width
        mainContentSelector: 'main',
        // Expand multi-tab examples (show all tabs stacked with headers)
        expandTabs: true,
        // Force darker text color (closer to black)
        darkText: true
    }
};
