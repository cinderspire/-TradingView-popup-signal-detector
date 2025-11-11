/**
 * Audit Logging Service
 * Track all critical actions for compliance and security
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AuditLogger {
  /**
   * Log an action
   * @param {Object} params
   */
  async log(params) {
    const {
      userId,
      action,
      resource,
      resourceId,
      details = {},
      ipAddress,
      userAgent,
      status = 'SUCCESS'
    } = params;

    try {
      await prisma.systemLog.create({
        data: {
          level: 'info',
          category: 'audit',
          message: `${action} on ${resource}`,
          data: {
            action,
            resource,
            resourceId,
            userId,
            details,
            ipAddress,
            userAgent,
            status,
            timestamp: new Date().toISOString()
          },
          userId: userId || null,
        }
      });
    } catch (error) {
      console.error('❌ Audit log error:', error.message);
    }
  }

  /**
   * Log user login
   */
  async logLogin(userId, ipAddress, userAgent, success) {
    await this.log({
      userId,
      action: 'LOGIN',
      resource: 'USER',
      resourceId: userId,
      ipAddress,
      userAgent,
      status: success ? 'SUCCESS' : 'FAILED'
    });
  }

  /**
   * Log subscription action
   */
  async logSubscription(userId, strategyId, action) {
    await this.log({
      userId,
      action: `SUBSCRIPTION_${action}`, // CREATE, CANCEL, RENEW
      resource: 'SUBSCRIPTION',
      resourceId: strategyId,
      details: { strategyId }
    });
  }

  /**
   * Log trade execution
   */
  async logTradeExecution(userId, signalId, details) {
    await this.log({
      userId,
      action: 'TRADE_EXECUTED',
      resource: 'SIGNAL',
      resourceId: signalId,
      details
    });
  }

  /**
   * Log API key changes
   */
  async logApiKeyChange(userId, exchange, action) {
    await this.log({
      userId,
      action: `API_KEY_${action}`, // CREATE, UPDATE, DELETE
      resource: 'API_KEY',
      details: { exchange },
      status: 'SUCCESS'
    });
  }

  /**
   * Get audit logs for a user
   */
  async getUserAuditLog(userId, limit = 100) {
    return await prisma.systemLog.findMany({
      where: {
        userId,
        category: 'audit'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }
}

module.exports = new AuditLogger();
