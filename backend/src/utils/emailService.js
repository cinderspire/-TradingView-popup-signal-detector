/**
 * EMAIL NOTIFICATION SERVICE
 * Professional email templates and delivery system
 * Supports SendGrid, AWS SES, and SMTP
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

class EmailService {
    constructor() {
        this.transporter = null;
        this.fromEmail = process.env.EMAIL_FROM || 'noreply@automatedtradebot.com';
        this.fromName = 'AutomatedTradeBot';
        this.initialized = false;

        // Email templates
        this.templates = {
            welcome: this.welcomeTemplate,
            emailVerification: this.emailVerificationTemplate,
            passwordReset: this.passwordResetTemplate,
            newSignal: this.newSignalTemplate,
            signalClosed: this.signalClosedTemplate,
            subscriptionConfirm: this.subscriptionConfirmTemplate,
            subscriptionCancelled: this.subscriptionCancelledTemplate,
            paymentSuccess: this.paymentSuccessTemplate,
            paymentFailed: this.paymentFailedTemplate,
            providerNewSubscriber: this.providerNewSubscriberTemplate,
            monthlyReport: this.monthlyReportTemplate,
            securityAlert: this.securityAlertTemplate
        };
    }

    /**
     * Initialize email service
     */
    async initialize() {
        try {
            // Check which email service to use
            if (process.env.SENDGRID_API_KEY) {
                // SendGrid configuration
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.sendgrid.net',
                    port: 587,
                    auth: {
                        user: 'apikey',
                        pass: process.env.SENDGRID_API_KEY
                    }
                });
            } else if (process.env.AWS_SES_REGION) {
                // AWS SES configuration
                const aws = require('@aws-sdk/client-ses');
                this.transporter = nodemailer.createTransport({
                    SES: new aws.SES({
                        region: process.env.AWS_SES_REGION
                    })
                });
            } else {
                // Default SMTP configuration
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
            }

            // Verify connection
            if (this.transporter) {
                await this.transporter.verify();
                this.initialized = true;
                logger.info('Email service initialized successfully');
            } else {
                logger.warn('Email service not configured - emails will be logged only');
            }
        } catch (error) {
            logger.error('Email service initialization error:', error);
            logger.warn('Email service will run in mock mode');
        }
    }

    /**
     * Send email
     */
    async sendEmail({ to, subject, html, text, attachments }) {
        try {
            if (!this.initialized || !this.transporter) {
                // Mock mode - just log
                logger.info(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
                return { success: true, messageId: 'mock-' + Date.now() };
            }

            const mailOptions = {
                from: `${this.fromName} <${this.fromEmail}>`,
                to,
                subject,
                html,
                text: text || this.htmlToText(html),
                attachments
            };

            const info = await this.transporter.sendMail(mailOptions);

            logger.info(`Email sent to ${to}: ${subject}`);

            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            logger.error('Send email error:', error);
            throw error;
        }
    }

    /**
     * Send templated email
     */
    async sendTemplateEmail(templateName, to, data) {
        const template = this.templates[templateName];
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        const { subject, html } = template(data);

        return await this.sendEmail({
            to,
            subject,
            html
        });
    }

    /**
     * Welcome email template
     */
    welcomeTemplate(data) {
        const { firstName, username } = data;

        return {
            subject: 'Welcome to AutomatedTradeBot!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .content h2 { color: #333; margin-bottom: 20px; }
                        .content p { color: #666; line-height: 1.6; margin-bottom: 15px; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .features { background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0; }
                        .feature { margin: 15px 0; }
                        .feature-icon { display: inline-block; width: 30px; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚀 Welcome to AutomatedTradeBot!</h1>
                        </div>
                        <div class="content">
                            <h2>Hi ${firstName || username}!</h2>
                            <p>Thank you for joining AutomatedTradeBot - the premier crypto trading signal marketplace!</p>
                            <p>You now have access to professional trading signals from verified providers, all using REAL market data.</p>

                            <div class="features">
                                <div class="feature">
                                    <span class="feature-icon">📊</span>
                                    <strong>Live Signals</strong> - Real-time trading signals with instant notifications
                                </div>
                                <div class="feature">
                                    <span class="feature-icon">🎯</span>
                                    <strong>Top Providers</strong> - Follow verified traders with proven track records
                                </div>
                                <div class="feature">
                                    <span class="feature-icon">💹</span>
                                    <strong>Copy Trading</strong> - Automatically copy trades from successful providers
                                </div>
                                <div class="feature">
                                    <span class="feature-icon">📈</span>
                                    <strong>Performance Tracking</strong> - Detailed analytics and performance metrics
                                </div>
                            </div>

                            <a href="https://automatedtradebot.com/dashboard" class="button">Get Started</a>

                            <p>Start by browsing our top-performing signal providers and subscribe to strategies that match your trading style!</p>
                        </div>
                        <div class="footer">
                            <p>Need help? Contact us at support@automatedtradebot.com</p>
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Email verification template
     */
    emailVerificationTemplate(data) {
        const { email, verificationUrl } = data;

        return {
            subject: 'Verify Your Email Address',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✉️ Verify Your Email</h1>
                        </div>
                        <div class="content">
                            <p>Please verify your email address to activate your AutomatedTradeBot account.</p>

                            <a href="${verificationUrl}" class="button">Verify Email Address</a>

                            <p>Or copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>

                            <div class="warning">
                                <strong>⚠️ Security Notice:</strong><br>
                                This verification link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * New signal notification template
     */
    newSignalTemplate(data) {
        const { providerName, pair, side, entryPrice, stopLoss, takeProfit, confidence } = data;

        return {
            subject: `🚨 New ${side} Signal: ${pair}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: ${side === 'BUY' ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'linear-gradient(135deg, #ff3366, #ff0066)'}; padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .signal-box { background: #f9f9f9; border-radius: 10px; padding: 20px; margin: 20px 0; }
                        .signal-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
                        .signal-label { color: #666; font-weight: 500; }
                        .signal-value { color: #333; font-weight: 700; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎯 New Trading Signal</h1>
                        </div>
                        <div class="content">
                            <p><strong>Provider:</strong> ${providerName}</p>

                            <div class="signal-box">
                                <div class="signal-row">
                                    <span class="signal-label">Pair</span>
                                    <span class="signal-value">${pair}</span>
                                </div>
                                <div class="signal-row">
                                    <span class="signal-label">Direction</span>
                                    <span class="signal-value" style="color: ${side === 'BUY' ? '#00ff88' : '#ff3366'}">${side}</span>
                                </div>
                                <div class="signal-row">
                                    <span class="signal-label">Entry Price</span>
                                    <span class="signal-value">$${entryPrice.toFixed(4)}</span>
                                </div>
                                <div class="signal-row">
                                    <span class="signal-label">Stop Loss</span>
                                    <span class="signal-value">$${stopLoss.toFixed(4)}</span>
                                </div>
                                <div class="signal-row">
                                    <span class="signal-label">Take Profit</span>
                                    <span class="signal-value">$${takeProfit.toFixed(4)}</span>
                                </div>
                                <div class="signal-row">
                                    <span class="signal-label">Confidence</span>
                                    <span class="signal-value">${(confidence * 100).toFixed(0)}%</span>
                                </div>
                            </div>

                            <a href="https://automatedtradebot.com/signals" class="button">View Signal Details</a>

                            <p style="color: #999; font-size: 14px; margin-top: 20px;">
                                ⚠️ Trading involves risk. Always do your own research and never invest more than you can afford to lose.
                            </p>
                        </div>
                        <div class="footer">
                            <p>Manage your notifications in <a href="https://automatedtradebot.com/settings">Settings</a></p>
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Signal closed notification template
     */
    signalClosedTemplate(data) {
        const { pair, pnl, pnlPercent, entryPrice, exitPrice, holdTime } = data;

        return {
            subject: `${pnl > 0 ? '✅ Profit' : '❌ Loss'}: ${pair} Signal Closed`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: ${pnl > 0 ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 'linear-gradient(135deg, #ff3366, #ff0066)'}; padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .pnl-big { font-size: 48px; color: white; font-weight: 700; margin: 10px 0; }
                        .content { padding: 40px 30px; }
                        .stats { background: #f9f9f9; border-radius: 10px; padding: 20px; margin: 20px 0; }
                        .stat-row { display: flex; justify-content: space-between; margin: 10px 0; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${pnl > 0 ? '🎉 Signal Closed - PROFIT' : '📉 Signal Closed - Loss'}</h1>
                            <div class="pnl-big">${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%</div>
                        </div>
                        <div class="content">
                            <h3>${pair}</h3>

                            <div class="stats">
                                <div class="stat-row">
                                    <span>Entry Price:</span>
                                    <strong>$${entryPrice.toFixed(4)}</strong>
                                </div>
                                <div class="stat-row">
                                    <span>Exit Price:</span>
                                    <strong>$${exitPrice.toFixed(4)}</strong>
                                </div>
                                <div class="stat-row">
                                    <span>P&L:</span>
                                    <strong style="color: ${pnl > 0 ? '#00ff88' : '#ff3366'}">${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}</strong>
                                </div>
                                <div class="stat-row">
                                    <span>Hold Time:</span>
                                    <strong>${holdTime}</strong>
                                </div>
                            </div>

                            <p>View your full trading history and performance analytics in your dashboard.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Subscription confirmation template
     */
    subscriptionConfirmTemplate(data) {
        const { providerName, price, trialDays } = data;

        return {
            subject: `✅ Subscription Confirmed: ${providerName}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .info-box { background: #f9f9f9; border-radius: 10px; padding: 20px; margin: 20px 0; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✅ Subscription Active!</h1>
                        </div>
                        <div class="content">
                            <p>You've successfully subscribed to <strong>${providerName}</strong>!</p>

                            <div class="info-box">
                                ${trialDays ? `
                                    <p><strong>🎁 Free Trial:</strong> ${trialDays} days</p>
                                    <p>Your first payment of $${price} will be charged after the trial period.</p>
                                ` : `
                                    <p><strong>Monthly Price:</strong> $${price}</p>
                                    <p>Your subscription is now active and will renew monthly.</p>
                                `}
                                <p><strong>What you get:</strong></p>
                                <ul>
                                    <li>Real-time trading signals</li>
                                    <li>Instant notifications</li>
                                    <li>Copy trading capability</li>
                                    <li>Performance analytics</li>
                                </ul>
                            </div>

                            <a href="https://automatedtradebot.com/dashboard" class="button">View Signals</a>
                        </div>
                        <div class="footer">
                            <p>You can cancel your subscription anytime from your account settings.</p>
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Payment success template
     */
    paymentSuccessTemplate(data) {
        const { amount, providerName, nextBillingDate } = data;

        return {
            subject: 'Payment Received - Thank You!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #00ff88, #00d4ff); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .receipt { background: #f9f9f9; border-radius: 10px; padding: 20px; margin: 20px 0; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>💳 Payment Successful</h1>
                        </div>
                        <div class="content">
                            <p>Thank you! Your payment has been processed successfully.</p>

                            <div class="receipt">
                                <p><strong>Amount Paid:</strong> $${amount.toFixed(2)}</p>
                                <p><strong>Subscription:</strong> ${providerName}</p>
                                <p><strong>Next Billing Date:</strong> ${new Date(nextBillingDate).toLocaleDateString()}</p>
                            </div>

                            <p>Your subscription is active and you'll continue receiving premium signals.</p>
                        </div>
                        <div class="footer">
                            <p>View your payment history in <a href="https://automatedtradebot.com/settings/billing">Billing Settings</a></p>
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Payment failed template
     */
    paymentFailedTemplate(data) {
        const { amount, providerName, retryDate } = data;

        return {
            subject: '⚠️ Payment Failed - Action Required',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #ff3366, #ff0066); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>⚠️ Payment Failed</h1>
                        </div>
                        <div class="content">
                            <p>We were unable to process your payment for <strong>${providerName}</strong>.</p>

                            <div class="warning">
                                <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
                                <p>Your subscription will be paused if payment is not received.</p>
                                <p><strong>Next retry:</strong> ${new Date(retryDate).toLocaleDateString()}</p>
                            </div>

                            <p>Please update your payment method to continue receiving signals.</p>

                            <a href="https://automatedtradebot.com/settings/billing" class="button">Update Payment Method</a>
                        </div>
                        <div class="footer">
                            <p>Questions? Contact support@automatedtradebot.com</p>
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Provider new subscriber notification
     */
    providerNewSubscriberTemplate(data) {
        const { subscriberName, strategyName, monthlyRevenue } = data;

        return {
            subject: '🎉 New Subscriber!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #00ff88, #00d4ff); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .stats { background: #f9f9f9; border-radius: 10px; padding: 20px; margin: 20px 0; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎉 New Subscriber!</h1>
                        </div>
                        <div class="content">
                            <p>Great news! You have a new subscriber.</p>

                            <div class="stats">
                                <p><strong>Subscriber:</strong> ${subscriberName}</p>
                                <p><strong>Strategy:</strong> ${strategyName}</p>
                                <p><strong>Your Monthly Revenue:</strong> $${monthlyRevenue.toFixed(2)} <span style="color: #00ff88;">(70% share)</span></p>
                            </div>

                            <p>Keep up the great work! Continue providing quality signals to grow your following.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Monthly performance report template
     */
    monthlyReportTemplate(data) {
        const { month, totalSignals, winRate, totalPnl, topTrade } = data;

        return {
            subject: `📊 Your ${month} Trading Report`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
                        .metric { background: #f9f9f9; padding: 20px; border-radius: 10px; text-align: center; }
                        .metric-value { font-size: 32px; font-weight: 700; color: #667eea; }
                        .metric-label { color: #666; margin-top: 10px; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📊 Monthly Report</h1>
                            <p style="color: white; margin: 10px 0;">${month}</p>
                        </div>
                        <div class="content">
                            <p>Here's your trading performance summary for the month:</p>

                            <div class="metrics">
                                <div class="metric">
                                    <div class="metric-value">${totalSignals}</div>
                                    <div class="metric-label">Total Signals</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-value">${winRate.toFixed(1)}%</div>
                                    <div class="metric-label">Win Rate</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-value" style="color: ${totalPnl > 0 ? '#00ff88' : '#ff3366'}">${totalPnl > 0 ? '+' : ''}${totalPnl.toFixed(2)}%</div>
                                    <div class="metric-label">Total Return</div>
                                </div>
                                <div class="metric">
                                    <div class="metric-value">${topTrade.pnl > 0 ? '+' : ''}${topTrade.pnl.toFixed(2)}%</div>
                                    <div class="metric-label">Best Trade</div>
                                </div>
                            </div>

                            <p>View your complete performance analytics in your dashboard.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Security alert template
     */
    securityAlertTemplate(data) {
        const { alertType, ipAddress, location, timestamp } = data;

        return {
            subject: '🔒 Security Alert - Account Activity',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #ff3366, #ff0066); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔒 Security Alert</h1>
                        </div>
                        <div class="content">
                            <p><strong>We detected unusual activity on your account.</strong></p>

                            <div class="alert-box">
                                <p><strong>Activity Type:</strong> ${alertType}</p>
                                <p><strong>IP Address:</strong> ${ipAddress}</p>
                                <p><strong>Location:</strong> ${location}</p>
                                <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
                            </div>

                            <p>If this was you, you can safely ignore this email. If you don't recognize this activity, please secure your account immediately.</p>

                            <a href="https://automatedtradebot.com/settings/security" class="button">Review Security Settings</a>
                        </div>
                        <div class="footer">
                            <p>For immediate assistance, contact support@automatedtradebot.com</p>
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Password reset template
     */
    passwordResetTemplate(data) {
        const { resetUrl } = data;

        return {
            subject: 'Reset Your Password',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔑 Reset Your Password</h1>
                        </div>
                        <div class="content">
                            <p>We received a request to reset your password. Click the button below to create a new password:</p>

                            <a href="${resetUrl}" class="button">Reset Password</a>

                            <p>Or copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>

                            <div class="warning">
                                <strong>⚠️ Security Notice:</strong><br>
                                This link will expire in 1 hour. If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                            </div>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Subscription cancelled template
     */
    subscriptionCancelledTemplate(data) {
        const { providerName, endDate } = data;

        return {
            subject: 'Subscription Cancelled',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .info-box { background: #f9f9f9; border-radius: 10px; padding: 20px; margin: 20px 0; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Subscription Cancelled</h1>
                        </div>
                        <div class="content">
                            <p>Your subscription to <strong>${providerName}</strong> has been cancelled.</p>

                            <div class="info-box">
                                <p>You'll continue to have access until <strong>${new Date(endDate).toLocaleDateString()}</strong>.</p>
                                <p>After this date, you won't receive new signals from this provider.</p>
                            </div>

                            <p>You can reactivate your subscription anytime.</p>

                            <a href="https://automatedtradebot.com/providers" class="button">Browse Providers</a>
                        </div>
                        <div class="footer">
                            <p>We're sorry to see you go! If you have feedback, please let us know.</p>
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    }

    /**
     * Convert HTML to plain text
     */
    htmlToText(html) {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ========== CONVENIENCE METHODS ==========

    /**
     * Send welcome email to new user
     */
    async sendWelcomeEmail(email, firstName, username) {
        return await this.sendTemplateEmail('welcome', email, {
            firstName,
            username: username || email.split('@')[0]
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email, resetUrl, firstName) {
        return await this.sendTemplateEmail('passwordReset', email, {
            resetUrl,
            firstName
        });
    }

    /**
     * Send password changed confirmation email
     */
    async sendPasswordChangedEmail(email, firstName) {
        return await this.sendEmail({
            to: email,
            subject: 'Password Changed Successfully',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #00ff88, #00d4ff); padding: 40px 30px; text-align: center; }
                        .header h1 { color: white; margin: 0; font-size: 28px; }
                        .content { padding: 40px 30px; }
                        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #999; font-size: 14px; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✅ Password Changed</h1>
                        </div>
                        <div class="content">
                            <p>Hi ${firstName || 'there'},</p>
                            <p>Your password has been successfully changed.</p>

                            <div class="warning">
                                <strong>🔒 Security Notice:</strong><br>
                                If you didn't make this change, please contact support immediately at support@automatedtradebot.com
                            </div>

                            <p>You can now log in with your new password.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 AutomatedTradeBot. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });
    }

    /**
     * Send email verification
     */
    async sendEmailVerificationEmail(email, verificationUrl) {
        return await this.sendTemplateEmail('emailVerification', email, {
            email,
            verificationUrl
        });
    }

    /**
     * Send new signal notification
     */
    async sendNewSignalEmail(email, signalData) {
        return await this.sendTemplateEmail('newSignal', email, signalData);
    }

    /**
     * Send signal closed notification
     */
    async sendSignalClosedEmail(email, tradeData) {
        return await this.sendTemplateEmail('signalClosed', email, tradeData);
    }

    /**
     * Send subscription confirmation
     */
    async sendSubscriptionConfirmEmail(email, subscriptionData) {
        return await this.sendTemplateEmail('subscriptionConfirm', email, subscriptionData);
    }

    /**
     * Send subscription cancelled notification
     */
    async sendSubscriptionCancelledEmail(email, subscriptionData) {
        return await this.sendTemplateEmail('subscriptionCancelled', email, subscriptionData);
    }

    /**
     * Send payment success notification
     */
    async sendPaymentSuccessEmail(email, paymentData) {
        return await this.sendTemplateEmail('paymentSuccess', email, paymentData);
    }

    /**
     * Send payment failed notification
     */
    async sendPaymentFailedEmail(email, paymentData) {
        return await this.sendTemplateEmail('paymentFailed', email, paymentData);
    }

    /**
     * Send provider new subscriber notification
     */
    async sendProviderNewSubscriberEmail(email, subscriberData) {
        return await this.sendTemplateEmail('providerNewSubscriber', email, subscriberData);
    }

    /**
     * Send monthly report
     */
    async sendMonthlyReportEmail(email, reportData) {
        return await this.sendTemplateEmail('monthlyReport', email, reportData);
    }

    /**
     * Send security alert
     */
    async sendSecurityAlertEmail(email, alertData) {
        return await this.sendTemplateEmail('securityAlert', email, alertData);
    }
}

// Export singleton instance
module.exports = new EmailService();