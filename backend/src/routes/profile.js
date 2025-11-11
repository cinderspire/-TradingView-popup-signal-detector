const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption'); // Use centralized encryption

const prisma = new PrismaClient();

// Get user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        apiKeys: {
          select: {
            id: true,
            exchange: true,
            isActive: true,
            permissions: true,
            createdAt: true
            // DO NOT return encrypted keys
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body;

    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        username: true,
        role: true
      }
    });

    res.json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// Add API Key
router.post('/api-keys', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchange, apiKey, apiSecret, apiPassphrase, permissions } = req.body;

    if (!exchange || !apiKey || !apiSecret) {
      return res.status(400).json({ success: false, message: 'Exchange, API Key, and API Secret are required' });
    }

    // Encrypt sensitive data
    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);
    const encryptedPassphrase = apiPassphrase ? encrypt(apiPassphrase) : null;

    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        userId,
        exchange: exchange.toLowerCase(),
        apiKey: encryptedKey,
        apiSecret: encryptedSecret,
        apiPassphrase: encryptedPassphrase,
        permissions: permissions || ['spot', 'futures']
      },
      select: {
        id: true,
        exchange: true,
        isActive: true,
        permissions: true,
        createdAt: true
      }
    });

    res.json({ success: true, message: 'API Key added successfully', apiKey: apiKeyRecord });
  } catch (error) {
    console.error('Error adding API key:', error);
    res.status(500).json({ success: false, message: 'Failed to add API key' });
  }
});

// Get API Keys (without showing actual keys)
router.get('/api-keys', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        exchange: true,
        isActive: true,
        permissions: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, apiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch API keys' });
  }
});

// Update API Key status
router.put('/api-keys/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { isActive, permissions } = req.body;

    const updates = {};
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (permissions) updates.permissions = permissions;

    const apiKey = await prisma.apiKey.updateMany({
      where: { id, userId }, // Ensure user owns this key
      data: updates
    });

    if (apiKey.count === 0) {
      return res.status(404).json({ success: false, message: 'API Key not found' });
    }

    res.json({ success: true, message: 'API Key updated' });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ success: false, message: 'Failed to update API key' });
  }
});

// Delete API Key
router.delete('/api-keys/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await prisma.apiKey.deleteMany({
      where: { id, userId } // Ensure user owns this key
    });

    if (result.count === 0) {
      return res.status(404).json({ success: false, message: 'API Key not found' });
    }

    res.json({ success: true, message: 'API Key deleted' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ success: false, message: 'Failed to delete API key' });
  }
});

// Test API Key (decrypt and test connection)
router.post('/api-keys/:id/test', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: { id, userId }
    });

    if (!apiKeyRecord) {
      return res.status(404).json({ success: false, message: 'API Key not found' });
    }

    // Decrypt and test (implement exchange-specific testing)
    const decryptedKey = decrypt(apiKeyRecord.apiKey);
    const decryptedSecret = decrypt(apiKeyRecord.apiSecret);

    // TODO: Implement actual exchange API testing with ccxt
    // For now, just return success if decryption worked
    res.json({
      success: true,
      message: 'API Key decrypted successfully (exchange testing not yet implemented)',
      exchange: apiKeyRecord.exchange
    });
  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({ success: false, message: 'Failed to test API key' });
  }
});

module.exports = router;
