module.exports = {
    // General Settings
    name: 'Supabase Docs',
    startUrl: 'https://supabase.com/docs/guides/database/overview',
    urlFilter: '/docs/',
    outputFile: 'Supabase_Docs.pdf',

    // Scraper Behavior
    testMode: false, // Scrape all pages

    // Light mode - Supabase has a hamburger menu toggle
    // We'll force light mode via CSS media emulation instead
    forceLightModeSelector: null, // Complex hamburger menu, use media emulation

    // Page Interaction & Selectors
    toc: {
        // No expandable sections needed - all links visible
        expandSelector: null,
        // Sidebar navigation links - use the sticky nav container
        linkSelector: 'nav[class*="lg:sticky"] a[href^="/docs/"]'
    },

    cleanup: {
        // Selectors to hide/remove from the printed page
        hideSelectors: [
            'nav', // Top navigation
            'header',
            'footer',
            'aside', // Right sidebar (On this page)
            'div[scrollable="true"]', // Left sidebar
            'div.mt-16.not-prose', // Feedback section
            'div.flex.items-center.gap-1', // Breadcrumbs
            '[data-radix-popper-content-wrapper]' // Dropdown menus
        ],
        // Selector for the main content area
        mainContentSelector: 'main#docs-content-container, article.prose'
    }
};
