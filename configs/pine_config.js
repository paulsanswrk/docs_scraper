module.exports = {
    // General Settings
    name: 'Pine Script Docs',
    startUrl: 'https://www.tradingview.com/pine-script-docs/welcome/',
    urlFilter: '/pine-script-docs/',
    outputFile: 'PineScript_Docs_v2.pdf',

    // Scraper Behavior
    testMode: false, // Scrape all pages

    // Page Interaction & Selectors
    toc: {
        // Function or selectors to expand TOC if needed
        expandSelector: 'details',
        // Selector to find links in the sidebar/TOC
        linkSelector: 'aside a[href]'
    },

    cleanup: {
        // Selectors to hide/remove from the printed page
        hideSelectors: [
            'aside',
            'header',
            'footer',
            '#onetrust-banner-sdk',
            '.tv-header',
            '.layout__header',
            '.layout__sidebar',
            '.breadcrumb-container',
            '.paginator'
        ],
        // Selector for the main content area to maximize width
        mainContentSelector: 'main, .content'
    }
};
