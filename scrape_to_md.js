const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const fsPromises = require('fs').promises;
const readline = require('readline');
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
    console.log(`Starting ${config.name || 'Docs'} MD Scraper using Playwright...`);
    
    // Ensure output dir exists
    await fsPromises.mkdir(OUTPUT_DIR, { recursive: true });

    // Use a desktop User-Agent to avoid generic headless bot flags
    const browser = await chromium.launch({ headless: false }); // Optional: Make it visible to verify
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1200, height: 1600 }
    });
    
    const page = await context.newPage();

    console.log(`Navigating to welcome page: ${START_URL}...`);
    // 'networkidle' helps wait for SPA routing, though it can strictly fail if connections persist
    await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Additional wait for SPA frameworks like VitePress/MkDocs to render sidebars
    await page.waitForTimeout(5000); 

    console.log('Extracting Table of Contents...');
    let toc = [];

    if (config.toc.rootSelector) {
        console.log(`Discovering sections via root selector: ${config.toc.rootSelector}`);
        try {
            await page.waitForSelector(config.toc.rootSelector, { timeout: 10000 });
        } catch (e) {
            console.log('Root selector not found, attempting to continue anyway...');
        }

        const rootLinks = await page.evaluate(({sel, filter}) => {
            return Array.from(document.querySelectorAll(sel))
                .map(a => a.href)
                .filter(url => url.includes(filter));
        }, { sel: config.toc.rootSelector, filter: URL_FILTER });

        console.log(`Found ${rootLinks.length} root sections:`, rootLinks);

        for (const sectionUrl of rootLinks) {
            console.log(`Mining section: ${sectionUrl}`);
            try {
                await page.goto(sectionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(2000);
                
                const sectionToc = await page.evaluate(({tocConfig, filter}) => {
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
                }, { tocConfig: config.toc, filter: URL_FILTER });

                toc = toc.concat(sectionToc);
            } catch (e) {
                console.error(`Failed to mine section ${sectionUrl}:`, e);
            }
        }
    } else {
        toc = await page.evaluate(({tocConfig, filter}) => {
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
        }, { tocConfig: config.toc, filter: URL_FILTER });
    }

    console.log(`Found ${toc.length} pages total.`);

    const uniquePages = [];
    const seenUrls = new Set();
    for (const item of toc) {
        // Strip out hash fragments to avoid duplicates of the same page
        const cleanUrl = item.url.split('#')[0]; 
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
            await page.waitForTimeout(1000); // Give JS a moment

            // Robust Lazy Loading scroll down loop equivalent
            await page.evaluate(async () => {
                const distance = 400;
                const totalHeight = document.body.scrollHeight;
                let currentHeight = 0;
                while (currentHeight < totalHeight) {
                    window.scrollBy(0, distance);
                    currentHeight += distance;
                    await new Promise(r => setTimeout(r, 100)); // sleep inside browser context
                }
            });

            // Re-wait for any triggers to settle
            await page.waitForTimeout(1000);

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
            
            // Generate valid filename
            let parsedUrl;
            try {
                parsedUrl = new URL(item.url);
            } catch (e) {
                // local file:// or relative paths fallback
                parsedUrl = { pathname: item.url };
            }
            
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
