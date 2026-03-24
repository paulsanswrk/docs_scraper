const puppeteer = require('puppeteer');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const fsPromises = require('fs').promises;
const path = require('path');

// Load Config
const args = process.argv.slice(2);
const configFile = args[0] || './configs/bitunix_futures_config.js';
let config;
try {
    config = require(path.resolve(configFile));
    console.log(`Loaded configuration: ${configFile}`);
} catch (e) {
    console.error(`Failed to load config file: ${configFile}`, e);
    process.exit(1);
}

const START_URL = config.startUrl;
const OUTPUT_DIR = path.join(__dirname, 'output', config.name ? config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'docs');
const URL_FILTER = config.urlFilter;
const TEST_MODE = config.testMode !== undefined ? config.testMode : false;
const MAX_PAGES = TEST_MODE ? 3 : 1000;

// Initialize Turndown with GFM for tables
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});
turndownService.use(gfm);

(async () => {
    console.log(`Starting ${config.name || 'Docs'} MD Scraper...`);
    
    // Ensure output dir exists
    await fsPromises.mkdir(OUTPUT_DIR, { recursive: true });

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 1600 });
    console.log('Navigating to welcome page...');
    await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000)); // Wait for SPA render

    console.log('Extracting Table of Contents...');
    let toc = [];

    if (config.toc.rootSelector) {
        console.log(`Discovering sections via root selector: ${config.toc.rootSelector}`);
        await page.waitForSelector(config.toc.rootSelector, { timeout: 10000 }).catch(() => console.log('Root selector not found'));

        const rootLinks = await page.evaluate((sel, filter) => {
            return Array.from(document.querySelectorAll(sel))
                .map(a => a.href)
                .filter(url => url.includes(filter));
        }, config.toc.rootSelector, URL_FILTER);

        console.log(`Found ${rootLinks.length} root sections:`, rootLinks);

        for (const sectionUrl of rootLinks) {
            console.log(`Mining section: ${sectionUrl}`);
            try {
                await page.goto(sectionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));
                
                const sectionToc = await page.evaluate((tocConfig, filter) => {
                    if (tocConfig.expandSelector) {
                        try {
                            document.querySelectorAll(tocConfig.expandSelector).forEach(d => {
                                if (d.tagName && d.tagName.toLowerCase() === 'details') d.open = true;
                                else d.click();
                            });
                        } catch(e){}
                    }
                    const linkSelector = tocConfig.linkSelector || 'a[href]';
                    const anchors = Array.from(document.querySelectorAll(linkSelector));
                    return anchors.map(a => ({
                        title: a.innerText.trim(),
                        url: a.href,
                    })).filter(item => item.title && item.url.includes(filter));
                }, config.toc, URL_FILTER);

                toc = toc.concat(sectionToc);
            } catch (e) {
                console.error(`Failed to mine section ${sectionUrl}:`, e);
            }
        }
    } else {
        toc = await page.evaluate((tocConfig, filter) => {
            try {
                if (tocConfig.expandSelector) {
                    document.querySelectorAll(tocConfig.expandSelector).forEach(d => {
                        if (d.tagName && d.tagName.toLowerCase() === 'details') d.open = true;
                        else d.click();
                    });
                }
                const linkSelector = tocConfig.linkSelector || 'a[href]';
                const anchors = Array.from(document.querySelectorAll(linkSelector));
                return anchors.map(a => ({
                    title: a.innerText.trim(),
                    url: a.href,
                })).filter(item => item.title && item.url.includes(filter));
            } catch (e) {
                return [];
            }
        }, config.toc, URL_FILTER);
    }

    console.log(`Found ${toc.length} pages total.`);

    const uniquePages = [];
    const seenUrls = new Set();
    for (const item of toc) {
        const cleanUrl = item.url.split('#')[0]; // strip hash
        if (!seenUrls.has(cleanUrl)) {
            seenUrls.add(cleanUrl);
            uniquePages.push({ ...item, url: cleanUrl });
        }
    }
    console.log(`Unique pages to scrape: ${uniquePages.length}`);

    let count = 0;
    for (const item of uniquePages) {
        if (count >= MAX_PAGES) break;
        count++;

        console.log(`[${count}/${uniquePages.length}] Scraping: ${item.title} (${item.url})`);

        try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            await page.evaluate(async () => {
                const distance = 400;
                const totalHeight = document.body.scrollHeight;
                let currentHeight = 0;
                while (currentHeight < totalHeight) {
                    window.scrollBy(0, distance);
                    currentHeight += distance;
                    await new Promise(r => setTimeout(r, 100));
                }
            });

            try {
                await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
            } catch (e) {}

            const htmlContent = await page.evaluate((cleanupConfig) => {
                if (cleanupConfig.hideSelectors) {
                    cleanupConfig.hideSelectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => el.remove());
                    });
                }
                
                const mainSelector = cleanupConfig.mainContentSelector || 'main';
                const main = document.querySelector(mainSelector);
                
                return main ? main.innerHTML : document.body.innerHTML;
            }, config.cleanup);
            
            let markdown = turndownService.turndown(htmlContent);
            
            let parsedUrl = new URL(item.url);
            let pathName = parsedUrl.pathname.replace(/\/$/, ""); 
            let fileName = pathName.split('/').pop() || 'index';
            
            fileName = fileName.replace(/[^a-z0-9_-]/gi, '_') + '.md';
            
            const paddedCount = String(count).padStart(3, '0');
            fileName = `${paddedCount}_${fileName}`;
            
            const filePath = path.join(OUTPUT_DIR, fileName);
            
            const finalContent = `# ${item.title}\n\nURL: ${item.url}\n\n${markdown}`;
            await fsPromises.writeFile(filePath, finalContent, 'utf8');

        } catch (e) {
            console.error(`Failed to scrape ${item.url}: `, e);
        }
    }

    console.log(`Success! Saved ${count} markdown files to ${OUTPUT_DIR}`);
    await browser.close();

})();
