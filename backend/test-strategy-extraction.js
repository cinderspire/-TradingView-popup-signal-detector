// Test strategy extraction
const exitRawText = 'Alert on ROSEUSDT.P7RSI{"action":"sell","contracts":"100","marketPosition":"flat"}';
const entryRawText = '7RSI{"action":"buy","contracts":"100","marketPosition":"long"}';
const symbol = 'ROSEUSDT.P';

console.log('Testing strategy extraction...\n');

// Extract from EXIT
const beforeBrace = exitRawText.split('{')[0];
console.log('EXIT rawText:', exitRawText);
console.log('Before brace:', beforeBrace);

const cleaned = beforeBrace
  .replace(/^Alert on /i, '')
  .replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
  .replace(/[^A-Za-z0-9 ]/g, '')
  .trim();

console.log('Extracted strategy:', `"${cleaned}"`);
console.log('\nENTRY rawText:', entryRawText);
console.log('ENTRY starts with extracted strategy?', entryRawText.startsWith(cleaned));

// Check what ENTRY actually starts with
console.log('\nENTRY starts with "7RSI"?', entryRawText.startsWith('7RSI'));
