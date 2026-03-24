const puppeteer = require('puppeteer');
const { PDFDocument, PDFName, PDFString, PDFDict, PDFHexString } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Load Config
const args = process.argv.slice(2);
const configFile = args[0] || './configs/pine_config.js';
let config;
try {
    config = require(path.resolve(configFile));
    console.log(`Loaded configuration: ${configFile} `);
} catch (e) {
    console.error(`Failed to load config file: ${configFile} `, e);
    process.exit(1);
}

const START_URL = config.startUrl;
const OUTPUT_FILE = config.outputFile || 'Docs.pdf';
const URL_FILTER = config.urlFilter;
const TEST_MODE = config.testMode !== undefined ? config.testMode : false;
const MAX_PAGES = TEST_MODE ? 3 : 1000;

(async () => {
    console.log(`Starting ${config.name || 'Docs'} Scraper...`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set viewport and theme
    await page.setViewport({ width: 1200, height: 1600 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

    console.log('Navigating to welcome page...');
    await page.goto(START_URL, { waitUntil: 'domcontentloaded' });

    // 1. Scrape the Sidebar for TOC
    // 1. Scrape the Sidebar for TOC
    console.log('Extracting Table of Contents...');
    let toc = [];

    if (config.toc.rootSelector) {
        // Multi-Step Discovery
        console.log(`Discovering sections via root selector: ${config.toc.rootSelector}`);
        await page.waitForSelector(config.toc.rootSelector, { timeout: 10000 }).catch(() => console.log('Root selector not found'));

        const rootLinks = await page.evaluate((sel, filter) => {
            return Array.from(document.querySelectorAll(sel))
                .map(a => a.href)
                .filter(url => url.includes(filter));
        }, config.toc.rootSelector, URL_FILTER);

        console.log(`Found ${rootLinks.length} root sections:`, rootLinks);

        // Iterate sections
        for (const sectionUrl of rootLinks) {
            console.log(`Mining section: ${sectionUrl}`);
            try {
                await page.goto(sectionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));
                // Force light mode on each section page if needed (before scraping sidebar? sidebar shouldn't change, but good practice)
                if (config.forceLightModeSelector) {
                    try {
                        const btn = await page.$(config.forceLightModeSelector);
                        if (btn) await btn.click();
                        await new Promise(r => setTimeout(r, 500));
                    } catch (e) { }
                }

                // Scrape sidebar
                const sectionToc = await page.evaluate((tocConfig, filter) => {
                    if (tocConfig.expandSelector) {
                        document.querySelectorAll(tocConfig.expandSelector).forEach(d => d.open = true);
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
        // Legacy Single-Step Discovery
        toc = await page.evaluate((tocConfig, filter) => {
            try {
                if (tocConfig.expandSelector) {
                    document.querySelectorAll(tocConfig.expandSelector).forEach(d => d.open = true);
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

    console.log(`Found ${toc.length} pages.`);

    // Deduplicate
    const uniquePages = [];
    const seenUrls = new Set();
    for (const item of toc) {
        // Strip hash for deduplication to avoid scraping same page multiple times
        const cleanUrl = item.url.split('#')[0];
        if (!seenUrls.has(cleanUrl)) {
            seenUrls.add(cleanUrl);
            // Use the clean URL for scraping
            uniquePages.push({ ...item, url: cleanUrl });
        }
    }
    console.log(`Unique pages to scrape: ${uniquePages.length} `);

    const pdfBuffers = [];

    // 2. Scrape each page
    let count = 0;
    for (const item of uniquePages) {
        if (count >= MAX_PAGES) break;
        count++;

        console.log(`[${count}/${uniquePages.length}]Scraping: ${item.title} (${item.url})`);

        try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Force light mode if configured
            if (config.forceLightModeSelector) {
                try {
                    const lightModeBtn = await page.$(config.forceLightModeSelector);
                    if (lightModeBtn) {
                        await lightModeBtn.click();
                        await new Promise(r => setTimeout(r, 500)); // Wait for theme to apply
                    }
                } catch (e) { /* Ignore if button not found */ }
            }

            // Robust Lazy Loading: Scroll in chunks and wait
            await page.evaluate(async () => {
                const distance = 400;
                const totalHeight = document.body.scrollHeight;
                let currentHeight = 0;
                while (currentHeight < totalHeight) {
                    window.scrollBy(0, distance);
                    currentHeight += distance;
                    // Wait a bit for scroll event to trigger observers
                    await new Promise(r => setTimeout(r, 100));
                }
            });

            // Wait for any triggered network requests to finish
            try {
                await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
            } catch (e) {
                // Ignore timeout if no new requests happen
            }

            // Cleanup
            await page.evaluate((cleanupConfig) => {
                document.body.style.backgroundColor = '#ffffff';
                document.documentElement.style.backgroundColor = '#ffffff';

                if (cleanupConfig.hideSelectors) {
                    cleanupConfig.hideSelectors.forEach(sel => {
                        const els = document.querySelectorAll(sel);
                        els.forEach(el => el.style.setProperty('display', 'none', 'important'));
                    });
                }

                const mainSelector = cleanupConfig.mainContentSelector || 'main';
                const main = document.querySelector(mainSelector);

                if (main) {
                    main.style.maxWidth = '100%';
                    main.style.margin = '0';
                    main.style.padding = '0';
                    main.style.width = '100%';
                }

                // Expand all tabs for PDF (show all tabpanels with headers)
                if (cleanupConfig.expandTabs) {
                    document.querySelectorAll('[role="tab"]').forEach(tab => {
                        const panelId = tab.getAttribute('aria-controls');
                        const panel = document.getElementById(panelId);
                        if (panel) {
                            // Inject header to identify the tab content
                            const header = document.createElement('div');
                            header.innerText = '▸ ' + tab.innerText;
                            header.style.cssText = 'font-weight: bold; margin-top: 16px; padding: 8px 12px; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 13px; color: #1f2937;';
                            panel.parentNode.insertBefore(header, panel);

                            // Force panel and ALL descendants to be visible
                            panel.style.display = 'block';
                            panel.style.visibility = 'visible';
                            panel.style.opacity = '1';
                            panel.style.height = 'auto';
                            panel.style.maxHeight = 'none';
                            panel.style.overflow = 'visible';
                            panel.removeAttribute('hidden');
                            panel.setAttribute('data-state', 'active');

                            // Also show all nested hidden elements
                            panel.querySelectorAll('[hidden], [data-state="inactive"]').forEach(el => {
                                el.removeAttribute('hidden');
                                el.setAttribute('data-state', 'active');
                                el.style.display = 'block';
                                el.style.visibility = 'visible';
                            });
                        }
                    });
                    // Hide the tab list itself since all content is now visible
                    document.querySelectorAll('[role="tablist"]').forEach(el => el.style.display = 'none');
                }

                // E-ink friendly styles: dark text, light backgrounds
                if (cleanupConfig.darkText) {
                    const style = document.createElement('style');
                    style.textContent = `
                        /* Dark text for readability */
                        body, p, li, span, h1, h2, h3, h4, h5, h6, .prose, article, div, label {
                            color: #111827 !important;
                        }
                        a { color: #1e40af !important; }
                        
                        /* WHITE backgrounds for ALL container elements */
                        html, body, div, section, main, article, aside, nav, header, footer, 
                        .prose, [class*="container"], [class*="wrapper"], [class*="content"],
                        [class*="page"], [class*="layout"], [class*="bg-"] {
                            background-color: #ffffff !important;
                        }
                        
                        /* Code blocks and pre elements */
                        pre, code, kbd, samp, .shiki, [class*="code-block"], [class*="codeblock"] {
                            background-color: #f3f4f6 !important;
                            color: #111827 !important;
                        }
                        pre code, pre .shiki {
                            background-color: transparent !important;
                        }
                        
                        /* Inline code */
                        :not(pre) > code {
                            background-color: #e5e7eb !important;
                            color: #1f2937 !important;
                            padding: 2px 6px !important;
                            border-radius: 4px !important;
                        }
                        
                        /* Buttons and interactive elements */
                        button, [role="button"], .btn, [class*="button"] {
                            background-color: #ffffff !important;
                            color: #111827 !important;
                            border: 1px solid #d1d5db !important;
                        }
                        
                        /* Code block headers (Terminal, etc.) */
                        pre > div, [class*="filename"], [class*="header"], [class*="title"] {
                            background-color: #e5e7eb !important;
                            color: #1f2937 !important;
                        }
                        
                        /* Reset ALL dark-themed elements aggressively */
                        [class*="dark"], [class*="bg-gray-8"], [class*="bg-gray-9"], 
                        [class*="bg-zinc-8"], [class*="bg-zinc-9"], [class*="bg-slate-8"], 
                        [class*="bg-slate-9"], [class*="bg-neutral-8"], [class*="bg-neutral-9"],
                        [class*="bg-black"], [style*="background-color: rgb(0"], 
                        [style*="background-color: rgb(1"], [style*="background-color: rgb(2"],
                        [style*="background-color: rgb(3"], [style*="background-color: rgb(4"],
                        [style*="background: rgb(0"], [style*="background: rgb(1"],
                        [style*="background: rgb(2"], [style*="background: rgb(3"] {
                            background-color: #ffffff !important;
                            color: #111827 !important;
                        }
                    `;
                    document.head.appendChild(style);

                    // Also directly fix inline styles on elements
                    document.querySelectorAll('*').forEach(el => {
                        const bg = window.getComputedStyle(el).backgroundColor;
                        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                            // Parse RGB values
                            const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                            if (match) {
                                const [, r, g, b] = match.map(Number);
                                // If dark (low luminance), make it light
                                if ((r + g + b) / 3 < 100) {
                                    el.style.setProperty('background-color', '#ffffff', 'important');
                                    el.style.setProperty('color', '#111827', 'important');
                                }
                            }
                        }
                    });
                }
            }, config.cleanup);

            // Capture PDF
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' }
            });

            pdfBuffers.push({
                buffer: pdfBuffer,
                title: item.title,
                url: item.url
            });

        } catch (e) {
            console.error(`Failed to scrape ${item.url}: `, e);
        }
    }

    // 3. Merge PDFs
    if (pdfBuffers.length === 0) {
        console.error('No PDFs generated.');
        await browser.close();
        return;
    }

    console.log('Merging PDFs...');

    const mergedPdf = await PDFDocument.create();

    const docs = [];
    const urlToPageMap = new Map(); // Map URL -> Start Page Index in final PDF

    // Initialize with TOC offset estimate (assume 0 for now, fix later?)
    // Actually we need to know the TOC size first if we put it at the front.
    // Let's generate TOC first.

    // --- Visual TOC Generation ---
    console.log('Generating Table of Contents Page...');
    let tocLength = 0;

    try {
        const tocPage = await browser.newPage();

        // Count pages first
        const docStruct = [];
        for (const item of pdfBuffers) {
            const d = await PDFDocument.load(item.buffer);
            docStruct.push({ title: item.title, count: d.getPageIndices().length });
        }

        const tocHtml = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; font-size: 12px; }
        h1 { text-align: center; margin-bottom: 30px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px dotted #ccc; align-items: flex-end; }
        .title { background: #fff; padding-right: 5px; font-weight: bold; text-decoration: none; color: #333; }
        .title:hover { color: #0066cc; }
        .page { background: #fff; padding-left: 5px; }
    </style>
</head>
<body>
    <h1>Table of Contents</h1>
    <p style="text-align: center; color: #666; margin-bottom: 20px;">Scraped on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
    <div id="toc-list"></div>
</body>
</html>`;
        await tocPage.setContent(tocHtml);

        const renderToc = async (pageOffset) => {
            await tocPage.evaluate((items, offset) => {
                const container = document.getElementById('toc-list');
                container.innerHTML = '';
                let current = offset + 1;
                items.forEach((item, idx) => {
                    const row = document.createElement('div');
                    row.className = 'row';
                    // Simple text display - Puppeteer doesn't create clickable PDF links for anchor hrefs
                    row.innerHTML = `<span class="title">${item.title}</span><span class="page">${current}</span>`;
                    container.appendChild(row);
                    current += item.count;
                });
            }, docStruct, pageOffset);

            return await tocPage.pdf({
                format: 'A4',
                margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
            });
        };

        const tempBuffer = await renderToc(0);
        const tempDoc = await PDFDocument.load(tempBuffer);
        tocLength = tempDoc.getPageCount();
        console.log(`TOC length estimate: ${tocLength} pages`);

        const finalBuffer = await renderToc(tocLength);
        const finalDoc = await PDFDocument.load(finalBuffer);

        const tocPages = await mergedPdf.copyPages(finalDoc, finalDoc.getPageIndices());
        tocPages.forEach(p => mergedPdf.addPage(p));

        await tocPage.close();

    } catch (e) {
        console.error('Error generating TOC:', e);
    }

    await browser.close();

    // Add Content
    let currentPageIndex = tocLength;

    for (const item of pdfBuffers) {
        const doc = await PDFDocument.load(item.buffer);
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());

        // Map this URL to the current page index
        // Normalize URL: strip hash, lower case logic?
        // Pine docs often use fragments. If specific fragment not found, jump to page start.
        // We map exact scraped URL.
        const normalizedUrl = item.url.split('#')[0]; // Base URL
        if (!urlToPageMap.has(normalizedUrl)) {
            urlToPageMap.set(normalizedUrl, currentPageIndex);
        }

        pages.forEach(p => {
            mergedPdf.addPage(p);
            currentPageIndex++;
        });
    }

    // --- Link Localization ---
    console.log('Rewriting internal links...');
    const pages = mergedPdf.getPages();

    try {
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const annotations = page.node.Annots();
            if (!annotations) continue;

            for (let j = 0; j < annotations.size(); j++) {
                const annotation = annotations.lookup(j);
                if (!annotation) continue;

                const subtype = annotation.get(PDFName.of('Subtype'));
                if (subtype && subtype.toString() === '/Link') {
                    const action = annotation.get(PDFName.of('A'));
                    if (action) {
                        const type = action.get(PDFName.of('S'));
                        if (type && type.toString() === '/URI') {
                            const uri = action.get(PDFName.of('URI'));
                            if (uri) {
                                const uriString = uri.toString();
                                const targetUrl = uriString.slice(1, -1); // remove parenthesis () from PDFString

                                // Check for TOC internal links like "http://toc-internal/page5"
                                const pageMatch = targetUrl.match(/toc-internal\/page(\d+)$/);
                                if (pageMatch) {
                                    const targetPageNum = parseInt(pageMatch[1], 10) - 1; // 0-indexed
                                    if (pages[targetPageNum]) {
                                        const targetPageRef = pages[targetPageNum].ref;
                                        const newAction = mergedPdf.context.obj({
                                            Type: 'Action',
                                            S: 'GoTo',
                                            D: [targetPageRef, PDFName.of('XYZ'), null, null, null]
                                        });
                                        annotation.set(PDFName.of('A'), newAction);
                                    }
                                } else {
                                    // Check if this URI matches one of our scraped pages
                                    const targetBase = targetUrl.split('#')[0];
                                    if (urlToPageMap.has(targetBase)) {
                                        const targetPageIndex = urlToPageMap.get(targetBase);
                                        if (pages[targetPageIndex]) {
                                            const targetPageRef = pages[targetPageIndex].ref;
                                            const newAction = mergedPdf.context.obj({
                                                Type: 'Action',
                                                S: 'GoTo',
                                                D: [targetPageRef, PDFName.of('XYZ'), null, null, null]
                                            });
                                            annotation.set(PDFName.of('A'), newAction);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error rewriting links:', e);
    }

    // --- Create PDF Outlines (Bookmarks) ---
    console.log('Creating PDF bookmarks...');
    try {
        const outlineItems = [];

        // Build outline entries for each scraped page
        for (const item of pdfBuffers) {
            const normalizedUrl = item.url.split('#')[0];
            const pageIndex = urlToPageMap.get(normalizedUrl);
            if (pageIndex !== undefined && pages[pageIndex]) {
                outlineItems.push({
                    title: item.title,
                    pageRef: pages[pageIndex].ref
                });
            }
        }

        if (outlineItems.length > 0) {
            const context = mergedPdf.context;

            // Create outline item refs first
            const outlineItemRefs = outlineItems.map(() => context.nextRef());

            // Create the Outlines dictionary (root of bookmark tree)
            const outlinesRef = context.nextRef();

            // Build outline items with prev/next links
            for (let i = 0; i < outlineItems.length; i++) {
                const item = outlineItems[i];
                const outlineItemDict = context.obj({
                    Title: PDFHexString.fromText(item.title),
                    Parent: outlinesRef,
                    Dest: [item.pageRef, PDFName.of('XYZ'), null, null, null]
                });

                // Add prev/next links for sibling navigation
                if (i > 0) {
                    outlineItemDict.set(PDFName.of('Prev'), outlineItemRefs[i - 1]);
                }
                if (i < outlineItems.length - 1) {
                    outlineItemDict.set(PDFName.of('Next'), outlineItemRefs[i + 1]);
                }

                context.assign(outlineItemRefs[i], outlineItemDict);
            }

            // Create root Outlines dictionary
            const outlinesDict = context.obj({
                Type: 'Outlines',
                First: outlineItemRefs[0],
                Last: outlineItemRefs[outlineItemRefs.length - 1],
                Count: outlineItems.length
            });
            context.assign(outlinesRef, outlinesDict);

            // Set the Outlines in the document catalog
            mergedPdf.catalog.set(PDFName.of('Outlines'), outlinesRef);

            console.log(`Created ${outlineItems.length} bookmarks.`);
        }
    } catch (e) {
        console.error('Error creating bookmarks:', e);
    }

    const pdfBytes = await mergedPdf.save();
    fs.writeFileSync(OUTPUT_FILE, pdfBytes);

    console.log(`Success! Saved to ${OUTPUT_FILE} `);

})();
