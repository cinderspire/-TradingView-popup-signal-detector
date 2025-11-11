/**
 * Encryption Utility
 * AES-256-GCM encryption for sensitive data (API keys, secrets)
 *
 * Security Features:
 * - AES-256-GCM (Authenticated Encryption)
 * - Random IV for each encryption
 * - Authentication tag to prevent tampering
 * - Key derived from environment variable
 */

const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for GCM
const TAG_LENGTH = 16; // 16 bytes authentication tag
const SALT_LENGTH = 64; // 64 bytes salt for key derivation

/**
 * Get encryption key from environment
 * Creates a 32-byte key using PBKDF2 with salt
 */
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not set');
  }

  // Use a fixed salt for key derivation (should be in env in production)
  const salt = process.env.ENCRYPTION_SALT || 'automatedtradebot-default-salt-2025';

  // Derive 32-byte key using PBKDF2
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt a string value
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Base64 encoded encrypted data (format: iv:authTag:encryptedData)
 */
function encrypt(text) {
  if (!text) return null;

  try {
    const key = getEncryptionKey();

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine iv:authTag:encrypted and encode as base64
    const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    return Buffer.from(combined).toString('base64');

  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string (supports both old and new formats)
 * @param {string} encryptedData - Base64 encoded encrypted data OR old format iv:encrypted
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedData) {
  if (!encryptedData) return null;

  try {
    const key = getEncryptionKey();

    // Try to detect format
    let parts;

    // Check if it's base64 encoded (new format)
    if (!encryptedData.includes(':') || encryptedData.length > 200) {
      // New format: Base64(iv:authTag:encrypted)
      const combined = Buffer.from(encryptedData, 'base64').toString('utf8');
      parts = combined.split(':');

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;

    } else {
      // Old format: iv:encrypted (no authTag, no base64, AES-256-CBC)
      parts = encryptedData.split(':');

      if (parts.length === 2) {
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        // Use AES-256-CBC for old format (no auth tag)
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } else {
        throw new Error('Invalid encrypted data format');
      }
    }

  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt data - data may be corrupted or key is incorrect');
  }
}

/**
 * Check if encryption is properly configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!process.env.ENCRYPTION_SECRET;
}

/**
 * Generate a random encryption secret (for initial setup)
 * @returns {string} - Random 64-character hex string
 */
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  isConfigured,
  generateSecret
};
