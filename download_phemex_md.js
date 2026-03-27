const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/phemex/phemex-api-docs.git';
// Creating temp dir unique to this script to avoid collisions
const TEMP_DIR = path.join(__dirname, '.temp_phemex_docs_clone');
const OUTPUT_DIR = path.join(__dirname, 'output', 'phemex_api');

console.log('Starting Phemex MD Docs Downloader...');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Clean up previous temp dir if it exists
if (fs.existsSync(TEMP_DIR)) {
    console.log('Cleaning up previous temporary directory...');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

console.log('Cloning Phemex API Docs repository (this may take a few seconds)...');
try {
    execSync(`git clone --depth 1 ${REPO_URL} "${TEMP_DIR}"`, { stdio: 'inherit' });
} catch (error) {
    console.error('Failed to clone repository. Is git installed?', error.message);
    process.exit(1);
}

console.log('\nCopying Markdown files to output directory...');
const files = fs.readdirSync(TEMP_DIR);
let count = 0;

for (const file of files) {
    // Only copy markdown files and ignore README if it's just the repo description
    if (file.endsWith('.md')) {
        const srcPath = path.join(TEMP_DIR, file);
        const destPath = path.join(OUTPUT_DIR, file);
        fs.copyFileSync(srcPath, destPath);
        console.log(`- Copied: ${file}`);
        count++;
    }
}

console.log('\nCleaning up temporary directory...');
try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
} catch (e) {
    console.log('Warning: Could not completely remove temporary directory. You may delete it manually later.');
}

console.log(`\nSuccess! ${count} Markdown files saved to: ${OUTPUT_DIR}`);
