console.log('Test log: start');
try {
    const p = require('puppeteer');
    console.log('Puppeteer required successfully');
    const pdf = require('pdf-lib');
    console.log('pdf-lib required successfully');
} catch (e) {
    console.error('Error requiring modules:', e);
}
console.log('Test log: end');
