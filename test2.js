const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto('https://www.bitunix.com/api-docs/spots/en_us/', { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(5000); // wait for js
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => `${a.className} | ${a.href} | ${a.innerText.trim()}`);
        });
        console.log(links.filter(l => l.includes('spots/en_us') && !l.includes('headerlink')).join('\n'));
    } catch (e) {
        console.error(e);
    }
    await browser.close();
})();
