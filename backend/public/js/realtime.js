/**
 * REAL-TIME DATA CLIENT
 * ONLY FETCHES AND DISPLAYS REAL DATA FROM EXCHANGES
 * NO FAKE/DEMO DATA - GERÇEK VERİ
 */

class RealTimeDataClient {
    constructor() {
        this.apiBase = '/api/realtime';
        this.updateInterval = 1000; // 1 second updates
        this.priceElements = new Map();
        this.signalElements = new Map();
        this.isRunning = false;

        // Priority pairs to track
        this.priorityPairs = [
            'XRP/USDT',
            'SOL/USDT',
            'BTC/USDT',
            'ETH/USDT',
            'DOGE/USDT',
            'ADA/USDT'
        ];
    }

    /**
     * Initialize real-time updates
     */
    async init() {
        console.log('Initializing REAL data client - NO FAKE DATA');

        // Verify all connections are real
        await this.verifyRealConnections();

        // Start real-time updates
        this.startRealTimeUpdates();

        // Test latency
        await this.testLatency();

        // Load initial data
        await this.loadInitialData();
    }

    /**
     * Verify all data sources are real exchanges
     */
    async verifyRealConnections() {
        try {
            const response = await fetch(`${this.apiBase}/verify`);
            const data = await response.json();

            if (data.success) {
                console.log('✅ All data sources verified as REAL exchanges');
                console.log('Connected exchanges:', data.exchanges);

                // Display verification badge
                this.displayVerificationBadge(data.exchanges);
            }
        } catch (error) {
            console.error('Error verifying connections:', error);
        }
    }

    /**
     * Display verification badge on page
     */
    displayVerificationBadge(exchanges) {
        const badge = document.createElement('div');
        badge.className = 'real-data-badge';
        badge.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #00ff88, #00d4ff);
                color: #0a0e1a;
                padding: 15px 20px;
                border-radius: 10px;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 10px 30px rgba(0, 255, 136, 0.3);
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="
                        width: 10px;
                        height: 10px;
                        background: #00ff00;
                        border-radius: 50%;
                        animation: pulse 2s infinite;
                    "></div>
                    <span>REAL DATA ONLY</span>
                </div>
                <div style="font-size: 0.8rem; margin-top: 5px; opacity: 0.9;">
                    Connected: ${Object.keys(exchanges).filter(e => exchanges[e].connected).join(', ')}
                </div>
            </div>
        `;
        document.body.appendChild(badge);
    }

    /**
     * Test real latency to exchanges
     */
    async testLatency() {
        try {
            const response = await fetch(`${this.apiBase}/latency`);
            const data = await response.json();

            if (data.success) {
                console.log(`⚡ Average latency: ${data.averageLatency}ms`);

                // Update latency display
                const latencyElement = document.getElementById('latency');
                if (latencyElement) {
                    latencyElement.textContent = `${data.averageLatency}ms`;
                }

                // Show individual exchange latencies
                data.tests.forEach(test => {
                    console.log(`${test.exchange}: ${test.latency}ms - ${test.status}`);
                });
            }
        } catch (error) {
            console.error('Error testing latency:', error);
        }
    }

    /**
     * Load initial real data
     */
    async loadInitialData() {
        // Load real prices
        await this.updateRealPrices();

        // Load real signals
        await this.updateRealSignals();

        // Load real trades
        await this.loadRecentTrades();
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        if (this.isRunning) return;

        this.isRunning = true;

        // Update prices every second
        setInterval(() => {
            this.updateRealPrices();
        }, this.updateInterval);

        // Update signals every 5 seconds
        setInterval(() => {
            this.updateRealSignals();
        }, 5000);

        // Update latency every 10 seconds
        setInterval(() => {
            this.testLatency();
        }, 10000);

        console.log('Started real-time updates');
    }

    /**
     * Update real prices from exchanges
     */
    async updateRealPrices() {
        try {
            const symbols = this.priorityPairs.join(',');
            const response = await fetch(`${this.apiBase}/prices?symbols=${symbols}`);
            const data = await response.json();

            if (data.success && data.data) {
                data.data.forEach(priceData => {
                    if (!priceData.error) {
                        this.updatePriceDisplay(priceData);
                    }
                });
            }
        } catch (error) {
            console.error('Error updating prices:', error);
        }
    }

    /**
     * Update price display elements
     */
    updatePriceDisplay(priceData) {
        // Update any elements with data-symbol attribute
        const elements = document.querySelectorAll(`[data-symbol="${priceData.symbol}"]`);
        elements.forEach(element => {
            const priceElement = element.querySelector('.price');
            const changeElement = element.querySelector('.change');

            if (priceElement) {
                const oldPrice = parseFloat(priceElement.textContent.replace(/[$,]/g, ''));
                const newPrice = priceData.price;

                // Update price with animation
                priceElement.textContent = `$${newPrice.toLocaleString()}`;

                // Flash color based on price movement
                if (oldPrice && newPrice > oldPrice) {
                    priceElement.style.color = '#00ff88';
                } else if (oldPrice && newPrice < oldPrice) {
                    priceElement.style.color = '#ff3366';
                }

                setTimeout(() => {
                    priceElement.style.color = '';
                }, 500);
            }

            if (changeElement && priceData.change24h !== undefined) {
                changeElement.textContent = `${priceData.change24h > 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%`;
                changeElement.style.color = priceData.change24h > 0 ? '#00ff88' : '#ff3366';
            }
        });

        // Update specific price displays
        const priceId = priceData.symbol.replace('/', '-').toLowerCase() + '-price';
        const priceEl = document.getElementById(priceId);
        if (priceEl) {
            priceEl.textContent = `$${priceData.price.toLocaleString()}`;
        }
    }

    /**
     * Update real signals from market analysis
     */
    async updateRealSignals() {
        try {
            const response = await fetch(`${this.apiBase}/signals`);
            const data = await response.json();

            if (data.success && data.data) {
                this.displayRealSignals(data.data);
            }
        } catch (error) {
            console.error('Error updating signals:', error);
        }
    }

    /**
     * Display real trading signals
     */
    displayRealSignals(signals) {
        const signalContainer = document.getElementById('liveSignals');
        if (!signalContainer) return;

        // Clear old signals
        signalContainer.innerHTML = '';

        // Display new signals
        signals.forEach((signal, index) => {
            const signalElement = document.createElement('div');
            signalElement.className = 'signal-item';
            signalElement.style.animation = `slideIn 0.5s ease ${index * 0.1}s`;

            const pairSymbol = signal.pair.split('/')[0];
            const sideColor = signal.side === 'BUY' ? '#00ff88' : '#ff3366';

            signalElement.innerHTML = `
                <div class="signal-info">
                    <div class="signal-icon">${pairSymbol}</div>
                    <div class="signal-details">
                        <h4>${signal.pair} ${signal.side}</h4>
                        <span>${signal.reason} (RSI: ${signal.rsi.toFixed(2)})</span>
                    </div>
                </div>
                <div class="signal-performance">
                    <div class="performance-value" style="color: ${sideColor}">
                        $${signal.price.toLocaleString()}
                    </div>
                    <div class="performance-label">Entry Price</div>
                </div>
                <div class="latency-badge">REAL</div>
            `;

            signalContainer.appendChild(signalElement);
        });

        // Update signal count
        const countElement = document.getElementById('signal-count');
        if (countElement) {
            countElement.textContent = signals.length;
        }
    }

    /**
     * Load recent real trades
     */
    async loadRecentTrades() {
        try {
            const response = await fetch(`${this.apiBase}/trades/BTC-USDT?limit=10`);
            const data = await response.json();

            if (data.success && data.data) {
                this.displayRecentTrades(data.data);
            }
        } catch (error) {
            console.error('Error loading trades:', error);
        }
    }

    /**
     * Display recent trades
     */
    displayRecentTrades(trades) {
        const tradesContainer = document.getElementById('recentTrades');
        if (!tradesContainer) return;

        tradesContainer.innerHTML = trades.map(trade => `
            <div class="trade-item" style="
                display: flex;
                justify-content: space-between;
                padding: 10px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            ">
                <span style="color: ${trade.side === 'buy' ? '#00ff88' : '#ff3366'}">
                    ${trade.side.toUpperCase()}
                </span>
                <span>$${trade.price.toLocaleString()}</span>
                <span>${trade.amount.toFixed(4)}</span>
            </div>
        `).join('');
    }

    /**
     * Load historical chart data
     */
    async loadHistoricalChart(symbol, timeframe = '1h') {
        try {
            const endDate = new Date().toISOString();
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const response = await fetch(
                `${this.apiBase}/historical?symbol=${symbol}&timeframe=${timeframe}&startDate=${startDate}&endDate=${endDate}`
            );
            const data = await response.json();

            if (data.success && data.data) {
                console.log(`Loaded ${data.dataPoints} real historical data points for ${symbol}`);
                this.renderChart(data.data, symbol);
            }
        } catch (error) {
            console.error('Error loading historical data:', error);
        }
    }

    /**
     * Render chart with real data
     */
    renderChart(data, symbol) {
        // This would integrate with a charting library like Chart.js or TradingView
        console.log(`Rendering chart for ${symbol} with ${data.length} real data points`);
    }

    /**
     * Subscribe to WebSocket for live updates
     */
    connectWebSocket() {
        const ws = new WebSocket('ws://automatedtradebot.com/realtime');

        ws.onopen = () => {
            console.log('Connected to real-time WebSocket');

            // Subscribe to channels
            this.priorityPairs.forEach(pair => {
                ws.send(JSON.stringify({
                    action: 'subscribe',
                    channel: `prices:${pair}`
                }));
            });
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'price') {
                this.updatePriceDisplay(message.data);
            } else if (message.type === 'signal') {
                this.displayRealSignals([message.data]);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const realTimeClient = new RealTimeDataClient();
    realTimeClient.init();

    // Make available globally for debugging
    window.realTimeClient = realTimeClient;
});

// Add CSS animations
const realtimeStyle = document.createElement('style');
realtimeStyle.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.5;
            transform: scale(1.5);
        }
    }

    .signal-item {
        animation: slideIn 0.5s ease;
    }
`;
document.head.appendChild(realtimeStyle);

/**
 * USAGE:
 * Include this script in your HTML:
 * <script src="/js/realtime.js"></script>
 *
 * The client will automatically:
 * - Verify all data sources are real
 * - Fetch real prices every second
 * - Update signals every 5 seconds
 * - Test latency every 10 seconds
 * - Display a "REAL DATA ONLY" badge
 *
 * NO FAKE DATA - ONLY REAL EXCHANGE DATA
 * SAHTE VERİ YOK - SADECE GERÇEK BORSA VERİLERİ
 */