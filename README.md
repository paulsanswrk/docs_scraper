# Docs Scraper

A generic Node.js documentation scraper that uses Puppeteer to navigate and capture documentation pages, merging them into a single comprehensive PDF file using `pdf-lib`.

## Features
- Deep scraping using Table of Contents discovery.
- Merges multiple pages into one PDF with internally-navigable links and bookmarks.
- Automatically handles CSS cleanup for documentation (forces light mode themes, expands tabs, removes backgrounds etc.) optimized for reading.
- Support for multiple configurations.

## Setup
1. Run `npm install` over the root directory to install required packages (`puppeteer` and `pdf-lib`).

## Usage
Run the scraper by pointing it to a configuration file. If no configuration file is provided, it defaults to checking `./configs/pine_config.js`.

```bash
node scrape_docs.js [path/to/config.js]
```

### Examples
```bash
node scrape_docs.js ./configs/supabase_config.js
node scrape_docs.js ./configs/nuxt_config.js
```

## Configuration Files
Place your `.js` configurations inside the `configs/` directory.
