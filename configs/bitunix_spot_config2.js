module.exports = {
    name: 'BitUnix Spot API 2',
    startUrl: 'https://www.bitunix.com/api-docs/spots/en_us/common/introduction.html',
    urlFilter: '/api-docs/spots/en_us',
    testMode: false,
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
