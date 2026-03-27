# BitUnix Markdown Documentation Scraper

A specialized extension of the generic documentation scraper designed specifically for downloading documentation as a structured set of Markdown files instead of a single PDF.

## Purpose

This tool is optimized for the BitUnix API documentation, which consists of two separate structures:
- **Futures API:** Built using VitePress (`bitunix_futures_config.js`).
- **Spot API:** Built using MkDocs/Material (`bitunix_spot_config.js`).

The standard `scrape_docs.js` targets PDF generation. `scrape_to_md.js` uses `turndown` and `turndown-plugin-gfm` to process HTML tags directly into formatted Markdown (including tables).

## Setup
Ensure that the markdown parser dependencies and Playwright are installed:
```bash
npm install turndown turndown-plugin-gfm playwright playwright-extra puppeteer-extra-plugin-stealth
npx playwright install chromium
```

*(These have been added to the project's dependencies.)*

## Usage

You can run the MD scraper against the pre-configured BitUnix endpoints:

```bash
# Scrape BitUnix Futures API Docs directly to MD
node scrape_to_md.js configs/bitunix_futures_config.js

# Scrape BitUnix Spot API Docs directly to MD
node scrape_to_md.js configs/bitunix_spot_config.js
```

### Local Site Downloader
If you just want to download the raw HTML of the entire rendered documentation site (e.g., to bypass protections or view offline), you can use the downloader script:

```bash
# Download raw HTML pages to the downloaded_html folder
node download_site.js configs/bitunix_futures_config.js
```

## How It Works

1. **Table of Contents Extraction:** The script evaluates the sidebar links depending on the configuration provided (VitePress or MkDocs layout).
2. **Page Scraping:** For each resolved link, it waits for the Main Content frame to render (handling Single Page Applications like Vue/Vite).
3. **HTML to Markdown Conversion:** Specifically targets the Main Content region, strips out excess layout styling (headers/footers/nav bars), and applies `turndown` to properly convert textual elements into readable `.md` strings.
4. **File Output:** Saves each Markdown string sequentially into an isolated `output/{configName}` directory.

## Known Limitations

- **Datacenter IP Block:** BitUnix enforces strict Cloudflare protection for its APIs and Documentation against datacenter IPs (AWS, GCP, etc.). The script uses `playwright-extra` and `puppeteer-extra-plugin-stealth` to reduce bot detection, but if it still receives a `403 Forbidden` response, you may need to add a manual pause to solve the Turnstile captcha in the browser, or use a residential proxy.
