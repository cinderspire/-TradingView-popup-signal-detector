/**
 * AUTHENTICATION SERVICE
 * Complete JWT-based authentication with role-based access control
 * Includes registration, login, 2FA, password reset
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/emailService');
const { validateEmail, validatePassword, validateUsername } = require('../utils/validators');

const prisma = new PrismaClient();

class AuthService {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
        this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
        this.SALT_ROUNDS = 12;
    }

    /**
     * Register new user
     */
    async register(userData) {
        const {
            email,
            username,
            password,
            firstName,
            lastName,
            referralCode
        } = userData;

        try {
            // Validate input
            if (!validateEmail(email)) {
                throw new Error('Invalid email format');
            }

            if (!validateUsername(username)) {
                throw new Error('Username must be 3-30 characters, alphanumeric with underscores');
            }

            if (!validatePassword(password)) {
                throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
            }

            // Check if user exists
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: email.toLowerCase() },
                        { username: username.toLowerCase() }
                    ]
                }
            });

            if (existingUser) {
                throw new Error('User with this email or username already exists');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

            // Generate verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');

            // Create user
            const user = await prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    username: username.toLowerCase(),
                    password: hashedPassword,
                    firstName,
                    lastName,
                    verificationToken,
                    notificationSettings: {
                        email: true,
                        signals: true,
                        trades: true,
                        system: true
                    },
                    tradingPreferences: {
                        defaultExchange: 'bybit',
                        riskLevel: 'MEDIUM',
                        maxDrawdown: 0.1,
                        positionSizing: 'FIXED'
                    }
                }
            });

            // Send verification email
            await this.sendVerificationEmail(user.email, verificationToken);

            // Generate tokens
            const tokens = this.generateTokens(user);

            // Log registration
            logger.info(`New user registered: ${user.email}`);

            return {
                success: true,
                user: this.sanitizeUser(user),
                tokens,
                message: 'Registration successful. Please check your email to verify your account.'
            };
        } catch (error) {
            logger.error('Registration error:', error);
            throw error;
        }
    }

    /**
     * Login user
     */
    async login(credentials) {
        const { email, username, password, twoFactorCode } = credentials;

        try {
            // Find user
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: email?.toLowerCase() },
                        { username: username?.toLowerCase() }
                    ]
                }
            });

            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Check if user is active
            if (!user.isActive) {
                throw new Error('Account is disabled. Please contact support.');
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                throw new Error('Invalid credentials');
            }

            // Check 2FA if enabled
            if (user.twoFactorEnabled) {
                if (!twoFactorCode) {
                    return {
                        success: false,
                        requiresTwoFactor: true,
                        message: 'Two-factor authentication code required'
                    };
                }

                const isValidToken = speakeasy.totp.verify({
                    secret: user.twoFactorSecret,
                    encoding: 'base32',
                    token: twoFactorCode,
                    window: 2
                });

                if (!isValidToken) {
                    throw new Error('Invalid two-factor authentication code');
                }
            }

            // Update last login
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() }
            });

            // Generate tokens
            const tokens = this.generateTokens(user);

            // Create session
            await this.createSession(user.id, tokens.refreshToken);

            logger.info(`User logged in: ${user.email}`);

            return {
                success: true,
                user: this.sanitizeUser(user),
                tokens
            };
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET);

            // Find session
            const session = await prisma.session.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            });

            if (!session || !session.isActive) {
                throw new Error('Invalid refresh token');
            }

            // Check if token is expired
            if (new Date() > session.expiresAt) {
                await prisma.session.update({
                    where: { id: session.id },
                    data: { isActive: false }
                });
                throw new Error('Refresh token expired');
            }

            // Generate new tokens
            const tokens = this.generateTokens(session.user);

            // Update session with new refresh token
            await prisma.session.update({
                where: { id: session.id },
                data: {
                    token: tokens.refreshToken,
                    lastActivity: new Date(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
                }
            });

            return {
                success: true,
                tokens
            };
        } catch (error) {
            logger.error('Token refresh error:', error);
            throw error;
        }
    }

    /**
     * Logout user
     */
    async logout(userId, refreshToken) {
        try {
            // Invalidate session
            await prisma.session.updateMany({
                where: {
                    userId,
                    token: refreshToken
                },
                data: {
                    isActive: false
                }
            });

            logger.info(`User logged out: ${userId}`);

            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            logger.error('Logout error:', error);
            throw error;
        }
    }

    /**
     * Verify email
     */
    async verifyEmail(token) {
        try {
            const user = await prisma.user.findFirst({
                where: { verificationToken: token }
            });

            if (!user) {
                throw new Error('Invalid verification token');
            }

            // Update user
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    emailVerified: true,
                    verificationToken: null
                }
            });

            logger.info(`Email verified for user: ${user.email}`);

            return {
                success: true,
                message: 'Email verified successfully'
            };
        } catch (error) {
            logger.error('Email verification error:', error);
            throw error;
        }
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email) {
        try {
            const user = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            if (!user) {
                // Don't reveal if user exists
                return {
                    success: true,
                    message: 'If an account exists with this email, a password reset link has been sent.'
                };
            }

            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Save token to database (you'd need to add these fields to User model)
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordResetToken: resetToken,
                    passwordResetExpiry: resetTokenExpiry
                }
            });

            // Send reset email
            await this.sendPasswordResetEmail(user.email, resetToken);

            logger.info(`Password reset requested for: ${user.email}`);

            return {
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent.'
            };
        } catch (error) {
            logger.error('Password reset request error:', error);
            throw error;
        }
    }

    /**
     * Reset password
     */
    async resetPassword(token, newPassword) {
        try {
            // Validate new password
            if (!validatePassword(newPassword)) {
                throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
            }

            const user = await prisma.user.findFirst({
                where: {
                    passwordResetToken: token,
                    passwordResetExpiry: {
                        gt: new Date()
                    }
                }
            });

            if (!user) {
                throw new Error('Invalid or expired reset token');
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

            // Update user
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                    passwordResetToken: null,
                    passwordResetExpiry: null
                }
            });

            // Invalidate all sessions
            await prisma.session.updateMany({
                where: { userId: user.id },
                data: { isActive: false }
            });

            logger.info(`Password reset for user: ${user.email}`);

            return {
                success: true,
                message: 'Password reset successfully'
            };
        } catch (error) {
            logger.error('Password reset error:', error);
            throw error;
        }
    }

    /**
     * Enable two-factor authentication
     */
    async enableTwoFactor(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                throw new Error('User not found');
            }

            if (user.twoFactorEnabled) {
                throw new Error('Two-factor authentication is already enabled');
            }

            // Generate secret
            const secret = speakeasy.generateSecret({
                name: `AutomatedTradeBot (${user.email})`,
                issuer: 'AutomatedTradeBot'
            });

            // Generate QR code
            const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

            // Save secret (temporarily, until verified)
            await prisma.user.update({
                where: { id: userId },
                data: {
                    twoFactorSecret: secret.base32
                }
            });

            return {
                success: true,
                secret: secret.base32,
                qrCode: qrCodeUrl,
                message: 'Scan the QR code with your authenticator app and verify with the code'
            };
        } catch (error) {
            logger.error('2FA enable error:', error);
            throw error;
        }
    }

    /**
     * Verify and confirm two-factor authentication
     */
    async verifyTwoFactor(userId, token) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user || !user.twoFactorSecret) {
                throw new Error('Two-factor setup not initiated');
            }

            // Verify token
            const isValid = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token,
                window: 2
            });

            if (!isValid) {
                throw new Error('Invalid verification code');
            }

            // Enable 2FA
            await prisma.user.update({
                where: { id: userId },
                data: {
                    twoFactorEnabled: true
                }
            });

            // Generate backup codes
            const backupCodes = this.generateBackupCodes();

            logger.info(`2FA enabled for user: ${userId}`);

            return {
                success: true,
                backupCodes,
                message: 'Two-factor authentication enabled successfully'
            };
        } catch (error) {
            logger.error('2FA verification error:', error);
            throw error;
        }
    }

    /**
     * Disable two-factor authentication
     */
    async disableTwoFactor(userId, password) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                throw new Error('Invalid password');
            }

            // Disable 2FA
            await prisma.user.update({
                where: { id: userId },
                data: {
                    twoFactorEnabled: false,
                    twoFactorSecret: null
                }
            });

            logger.info(`2FA disabled for user: ${userId}`);

            return {
                success: true,
                message: 'Two-factor authentication disabled successfully'
            };
        } catch (error) {
            logger.error('2FA disable error:', error);
            throw error;
        }
    }

    /**
     * Change password
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            // Validate new password
            if (!validatePassword(newPassword)) {
                throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

            // Update password
            await prisma.user.update({
                where: { id: userId },
                data: {
                    password: hashedPassword
                }
            });

            logger.info(`Password changed for user: ${userId}`);

            return {
                success: true,
                message: 'Password changed successfully'
            };
        } catch (error) {
            logger.error('Password change error:', error);
            throw error;
        }
    }

    /**
     * Generate JWT tokens
     */
    generateTokens(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role
        };

        const accessToken = jwt.sign(
            payload,
            this.JWT_SECRET,
            { expiresIn: this.JWT_EXPIRES_IN }
        );

        const refreshToken = jwt.sign(
            { userId: user.id },
            this.JWT_REFRESH_SECRET,
            { expiresIn: this.JWT_REFRESH_EXPIRES_IN }
        );

        return {
            accessToken,
            refreshToken
        };
    }

    /**
     * Create session
     */
    async createSession(userId, refreshToken) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await prisma.session.create({
            data: {
                userId,
                token: refreshToken,
                expiresAt,
                deviceInfo: {},
                userAgent: ''
            }
        });
    }

    /**
     * Generate backup codes
     */
    generateBackupCodes(count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }

    /**
     * Sanitize user object
     */
    sanitizeUser(user) {
        const { password, twoFactorSecret, verificationToken, ...sanitizedUser } = user;
        return sanitizedUser;
    }

    /**
     * Send verification email
     */
    async sendVerificationEmail(email, token) {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

        await sendEmail({
            to: email,
            subject: 'Verify your AutomatedTradeBot account',
            html: `
                <h2>Welcome to AutomatedTradeBot!</h2>
                <p>Please click the link below to verify your email address:</p>
                <a href="${verificationUrl}" style="
                    display: inline-block;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 20px 0;
                ">Verify Email</a>
                <p>Or copy this link: ${verificationUrl}</p>
                <p>This link will expire in 24 hours.</p>
            `
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email, token) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

        await sendEmail({
            to: email,
            subject: 'Reset your AutomatedTradeBot password',
            html: `
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password. Click the link below:</p>
                <a href="${resetUrl}" style="
                    display: inline-block;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 20px 0;
                ">Reset Password</a>
                <p>Or copy this link: ${resetUrl}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        });
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        return this.sanitizeUser(user);
    }
}

// Export singleton instance
module.exports = new AuthService();