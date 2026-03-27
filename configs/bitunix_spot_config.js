module.exports = {
    name: 'BitUnix Spot API',
    startUrl: 'https://www.bitunix.com/api-docs/spots/en_us/',
    urlFilter: '/api-docs/spots/en_us',
    testMode: false,
    toc: {
        rootSelector: null,
        expandSelector: null,
        linkSelector: 'a[href]'
    },
    cleanup: {
        mainContentSelector: '.md-content',
        hideSelectors: []
    }
};
