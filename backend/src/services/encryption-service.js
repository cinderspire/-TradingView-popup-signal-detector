/**
 * Encryption Service for API Keys
 * AES-256 encryption for sensitive data
 */

const crypto = require('crypto');

class EncryptionService {
  constructor() {
    // In production, store this in environment variable
    this.algorithm = 'aes-256-gcm';
    this.secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production-32chars';

    // Ensure key is 32 bytes for AES-256
    this.key = crypto.scryptSync(this.secretKey, 'salt', 32);
  }

  /**
   * Encrypt text
   * @param {string} text - Plain text to encrypt
   * @returns {string} Encrypted text with IV prepended
   */
  encrypt(text) {
    if (!text) return '';

    try {
      // Generate random IV (initialization vector)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Return: IV + authTag + encrypted (all hex)
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('❌ Encryption error:', error.message);
      return '';
    }
  }

  /**
   * Decrypt text
   * @param {string} encryptedText - Encrypted text with IV prepended
   * @returns {string} Decrypted plain text
   */
  decrypt(encryptedText) {
    if (!encryptedText) return '';

    try {
      // Split IV, authTag, and encrypted data
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('❌ Decryption error:', error.message);
      return '';
    }
  }

  /**
   * Encrypt API key object
   */
  encryptApiKey(apiKey, apiSecret, apiPassphrase = null) {
    return {
      apiKey: this.encrypt(apiKey),
      apiSecret: this.encrypt(apiSecret),
      apiPassphrase: apiPassphrase ? this.encrypt(apiPassphrase) : null
    };
  }

  /**
   * Decrypt API key object
   */
  decryptApiKey(encryptedApiKey, encryptedApiSecret, encryptedPassphrase = null) {
    return {
      apiKey: this.decrypt(encryptedApiKey),
      apiSecret: this.decrypt(encryptedApiSecret),
      apiPassphrase: encryptedPassphrase ? this.decrypt(encryptedPassphrase) : null
    };
  }

  /**
   * Hash password (one-way)
   */
  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Generate secure random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

module.exports = new EncryptionService();
