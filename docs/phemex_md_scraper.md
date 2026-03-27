# Phemex API Markdown Downloader

A specialized utility script to fetch the official Phemex API documentation directly in Markdown format.

## Purpose

While the BitUnix documentation required a complex Playwright-based web scraper (`scrape_to_md.js`) to convert HTML pages into Markdown, **Phemex officially maintains and provides its API documentation natively in Markdown format on GitHub**.

Attempting to scrape the Phemex rendered documentation site (`phemex-docs.github.io`) using Playwright is inefficient and problematic because it is a Single-Page Application (SPA) built with Slate. The entire documentation exists on a single, massive HTML page, which would cause HTML scrapers to repeatedly process the same 1MB+ file for every anchor link, resulting in duplications.

Therefore, the most robust and accurate method to obtain the Phemex API docs in Markdown is to clone them directly from their official GitHub repository (`phemex/phemex-api-docs`).

## Setup

Ensure you have Git installed on your system.
No additional NPM packages are required beyond standard Node.js built-ins.

## Usage

Run the downloader script:

```bash
node download_phemex_md.js
```

## How It Works

1. **Repository Cloning:** The script performs a shallow clone (`git clone --depth 1`) of the official `https://github.com/phemex/phemex-api-docs.git` repository into a temporary directory (`.temp_phemex_docs_clone`).
2. **File Extraction:** It scans the cloned repository for all `.md` files (such as `Public-Contract-API-en.md`, `Public-Spot-API-en.md`, `Generic-API-Info.en.md`, etc.).
3. **File Output:** Copies the discovered Markdown files into the `output/phemex_api/` directory.
4. **Cleanup:** Removes the temporary cloned repository to save space.

## Known Limitations

- **Large Documents:** Phemex organizes its documentation into a few very large Markdown files (e.g., all Contract API endpoints are in a single 100KB+ file) rather than splitting them by endpoint like BitUnix. If you are feeding this into an LLM or using it for reference, be aware that you will be searching within single large files rather than many small ones.
