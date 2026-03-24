module.exports = {
    name: 'BitUnix Spot API',
    startUrl: 'https://www.bitunix.com/api-docs/spots/en_us/',
    urlFilter: '/api-docs/spots/en_us',
    testMode: true, // test with 3 pages first
    toc: {
        rootSelector: null,
        expandSelector: 'nav.md-nav .md-nav__item--nested > label',
        linkSelector: 'nav.md-nav .md-nav__link'
    },
    cleanup: {
        mainContentSelector: '.md-content',
        hideSelectors: []
    }
};
