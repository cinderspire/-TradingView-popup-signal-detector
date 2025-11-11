#!/usr/bin/env node
/**
 * CHECK MEXC API KEY STATUS
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAPIKey() {
  try {
    const user = await prisma.user.findFirst({
      where: { username: 'suyttru' }
    });

    if (!user) {
      console.log('❌ User not found');
      return false;
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        userId: user.id,
        exchange: 'mexc',
        isActive: true
      }
    });

    if (!apiKey) {
      console.log('❌ No MEXC API key found');
      return false;
    }

    console.log('✅ MEXC API key found');
    console.log('Key length:', apiKey.key.length);
    console.log('Secret length:', apiKey.secret.length);
    console.log('Is active:', apiKey.isActive);

    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
    return false;
  }
}

checkAPIKey();
