module.exports = {
    name: 'BitUnix Futures API',
    startUrl: 'https://www.bitunix.com/api-docs/futures/',
    urlFilter: '/api-docs/futures/',
    testMode: true, // we will test with just 3 pages first
    toc: {
        rootSelector: null,
        expandSelector: '.VPSidebar .item[role="button"]',
        linkSelector: '.VPSidebar a.VPLink'
    },
    cleanup: {
        mainContentSelector: 'div.vp-doc',
        hideSelectors: ['.VPDocFooter']
    }
};
