const { encrypt } = require('../src/utils/encryption');

const apiKey = process.argv[2];
const apiSecret = process.argv[3];

if (!apiKey || !apiSecret) {
  console.error('Usage: node encrypt-api-key.js <API_KEY> <API_SECRET>');
  console.error('Example: node encrypt-api-key.js "test-key-123" "test-secret-456"');
  process.exit(1);
}

const encryptedKey = encrypt(apiKey);
const encryptedSecret = encrypt(apiSecret);

console.log('\n=== Encrypted API Credentials ===');
console.log('API Key (encrypted):', encryptedKey);
console.log('API Secret (encrypted):', encryptedSecret);
console.log('\n=== SQL Update Command ===');
console.log(`UPDATE "Subscription"`);
console.log(`SET "exchangeApiKey" = '${encryptedKey}',`);
console.log(`    "exchangeApiSecret" = '${encryptedSecret}'`);
console.log(`WHERE id = 'YOUR_SUBSCRIPTION_ID';`);
console.log('\n');
