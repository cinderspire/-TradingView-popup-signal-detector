# -*- coding: utf-8 -*-
"""
Paper Trading 7-RSI Bot - FIXED VERSION
Starting Balance: $70 USDT with 10x Leverage
Pairs: DUCK, TUT, AERO, BLUE, FORM, BANANAS31, BCH
"""

import sys
import asyncio

# FIX FOR WINDOWS - Must be set before any other imports
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import ccxt.async_support as ccxt
import pandas as pd
import numpy as np
import talib
import time
import json
import os
import warnings
from datetime import datetime, timedelta
import threading
from typing import Dict, List, Optional
from collections import defaultdict
import logging

warnings.filterwarnings("ignore")

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- PAPER TRADING CONFIGURATION ------------------------------------ #
API_KEY = "RgNeIB6mPrVtQlTy2iQHULq0hZLifPXkPeMHA5qR9RijPW0i7i9oBPJrR7orfRbT"
API_SECRET = "jIBuKL3rtFuGPom95wH8u4Hlo62AxWJmuv1VOCfvU3MWAqjXY7SqzrEAO3CwMO72"

# Paper Trading Settings
STARTING_BALANCE = 70.0  # $70 starting balance
LEVERAGE = 10  # 10x leverage
PAPER_TRADING_MODE = True  # Enable paper trading flexibility

# Trading pairs - More stable coins added
PAIRS = [
    "DUCK/USDT:USDT",
    "TUT/USDT:USDT",
    "AERO/USDT:USDT",
    "BLUE/USDT:USDT",
    "FORM/USDT:USDT",
    "BANANAS31/USDT:USDT",
    "BCH/USDT:USDT",

    "FLOKI/USDT:USDT",
    "ADA/USDT:USDT",
    "XLM/USDT:USDT",
    "PEPE/USDT:USDT",
    "TRX/USDT:USDT",
    "XRP/USDT:USDT",
    "DOGE/USDT:USDT", 
    "ETH/USDT:USDT",
    "BTC/USDT:USDT",
]

# Strategy parameters - FIXED VALUES
BOT_RES = "2m"
RSI_RES_LIST = ["1m", "5m", "15m", "30m", "1h", "2h", "1d"]
RSI_LEN = 14
THRESH_BUY = 30  # FIXED: Changed from 100 to 30 (more reasonable)
TP_PERC = 0.015  # 0.5% take profit
STEP_PERC = 0.02  # 2% step between orders
MAX_ORDERS = 10  # Orders per signal
ORDER_SIZE_USD = 6.0  # Fixed 6 USDT per order

# Risk management
EMERGENCY_STOP_LOSS = 0.12  # 10% emergency stop loss
MAX_TOTAL_EXPOSURE = 0.9  # Use max 90% of total buying power

# Data settings
LOOKBACK_PERIODS = 200
UPDATE_INTERVAL = 30
PERFORMANCE_INTERVAL = 10
MIN_RSI_TIMEFRAMES = 4  # FIXED: Require at least 4 timeframes instead of 7

# --------------------------------------------------------------------------- #

class PaperTradingBot:
    def __init__(self):
        # Initialize exchange for data only
        self.exchange = ccxt.bitget({
            'apiKey': API_KEY,
            'secret': API_SECRET,
            'sandbox': False,
            'enableRateLimit': True,
            'options': {'defaultType': 'future'},
            'timeout': 30000
        })
        
        # Paper Trading State
        self.balance = STARTING_BALANCE
        self.equity = STARTING_BALANCE
        self.total_pnl = 0.0
        self.is_running = False
        self.total_collateral_used = 0.0
        
        # Available buying power with leverage
        self.max_buying_power = STARTING_BALANCE * LEVERAGE * MAX_TOTAL_EXPOSURE
        
        # Trading state for each pair
        self.positions = {}
        self.open_orders = {}
        self.last_signals = {}
        self.order_id_counter = 1000
        self.trade_history = []
        
        # Initialize state for each pair
        for pair in PAIRS:
            self.positions[pair] = {
                'size': 0.0,
                'entry_price': 0.0,
                'unrealized_pnl': 0.0,
                'collateral_used': 0.0
            }
            self.open_orders[pair] = []
            self.last_signals[pair] = 0

    async def initialize(self):
        """Initialize the paper trading bot"""
        try:
            logger.info("🚀 Initializing Paper Trading Bot...")
            logger.info(f"📊 Starting Balance: ${self.balance:.2f} USDT")
            logger.info(f"⚡ Leverage: {LEVERAGE}x")
            logger.info(f"💰 Max Buying Power: ${self.max_buying_power:.2f}")
            logger.info(f"🎯 Orders per signal: {MAX_ORDERS}")
            logger.info(f"💵 Order size: ${ORDER_SIZE_USD} USDT each")
            logger.info(f"📈 RSI Threshold: {THRESH_BUY}")
            logger.info(f"🔧 Min RSI Timeframes: {MIN_RSI_TIMEFRAMES}")
            
            # Load markets for data
            await self.exchange.load_markets()
            
            # Test data connection with real-time data only
            test_pair = PAIRS[0]
            test_price = await self.get_current_price(test_pair)
            if test_price > 0:
                logger.info(f"✅ Real-time data connection successful")
                logger.info(f"📈 {test_pair} current price: ${test_price:.6f}")
            else:
                logger.error("❌ Failed to connect to real-time data")
                return False
                
            logger.info("✅ Paper Trading Bot initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize bot: {e}")
            return False

    def calculate_available_collateral(self) -> float:
        """Calculate available collateral for new orders"""
        available = self.balance - self.total_collateral_used
        return max(0, available)

    def calculate_available_buying_power(self) -> float:
        """Calculate remaining buying power"""
        used_buying_power = self.total_collateral_used * LEVERAGE
        available_buying_power = self.max_buying_power - used_buying_power
        return max(0, available_buying_power)

    async def get_current_price(self, pair: str) -> float:
        """Get current price - REAL-TIME DATA ONLY"""
        try:
            ticker = await self.exchange.fetch_ticker(pair)
            price = float(ticker['last'])
            if price <= 0:
                logger.error(f"❌ Invalid price received for {pair}: {price}")
                return 0.0
            return price
        except Exception as e:
            logger.error(f"❌ Failed to get real-time price for {pair}: {e}")
            return 0.0

    async def fetch_ohlcv_data(self, pair: str, timeframe: str, limit: int = LOOKBACK_PERIODS) -> pd.DataFrame:
        """Fetch OHLCV data with extended limits for better data availability"""
        try:
            # FIXED: Extended limits for longer timeframes
            if timeframe in ['1h', '2h', '1d']:
                extended_limit = min(limit * 3, 1000)
            else:
                extended_limit = limit
                
            ohlcv = await self.exchange.fetch_ohlcv(pair, timeframe, limit=extended_limit)
            if not ohlcv:
                logger.error(f"❌ No OHLCV data received for {pair} {timeframe}")
                return pd.DataFrame()
                
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            df['ohlc4'] = (df['open'] + df['high'] + df['low'] + df['close']) / 4
            
            if df.empty:
                logger.error(f"❌ Empty dataframe for {pair} {timeframe}")
                return pd.DataFrame()
                
            logger.debug(f"✅ Fetched {len(df)} candles for {pair} {timeframe}")
            return df
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch real-time OHLCV data for {pair} {timeframe}: {e}")
            return pd.DataFrame()

    def calculate_rsi(self, prices: pd.Series, period: int = RSI_LEN) -> pd.Series:
        """Calculate RSI"""
        if len(prices) < period:
            return pd.Series(index=prices.index)
        try:
            rsi = talib.RSI(prices.values, timeperiod=period)
            return pd.Series(rsi, index=prices.index)
        except Exception as e:
            logger.error(f"❌ Error calculating RSI: {e}")
            return pd.Series(index=prices.index)

    async def calculate_multi_timeframe_rsi(self, pair: str) -> Dict[str, float]:
        """Calculate RSI for all timeframes - FLEXIBLE VERSION"""
        rsi_values = {}
        
        try:
            base_df = await self.fetch_ohlcv_data(pair, '1m', limit=500)
            if base_df.empty:
                logger.error(f"❌ No base data for RSI calculation: {pair}")
                return {}
            
            for timeframe in RSI_RES_LIST:
                try:
                    if timeframe == '1m':
                        df = base_df
                    else:
                        resample_rule = timeframe.replace('m', 'T').replace('h', 'H').replace('d', 'D')
                        df = base_df.resample(resample_rule).agg({
                            'open': 'first',
                            'high': 'max', 
                            'low': 'min',
                            'close': 'last',
                            'volume': 'sum'
                        }).dropna()
                    
                    if len(df) >= RSI_LEN:
                        rsi = self.calculate_rsi(df['close'])
                        if not rsi.empty and not pd.isna(rsi.iloc[-1]):
                            rsi_values[timeframe] = rsi.iloc[-1]
                            logger.debug(f"✅ RSI for {pair} {timeframe}: {rsi.iloc[-1]:.2f}")
                        else:
                            logger.debug(f"⚠️ Invalid RSI for {pair} {timeframe}")
                    else:
                        logger.debug(f"⚠️ Insufficient data for RSI calculation: {pair} {timeframe} (got {len(df)}, need {RSI_LEN})")
                        
                except Exception as e:
                    logger.error(f"❌ Error calculating RSI for {pair} {timeframe}: {e}")
                    
        except Exception as e:
            logger.error(f"❌ Error in multi-timeframe RSI for {pair}: {e}")
            
        return rsi_values

    def generate_order_id(self) -> str:
        """Generate unique order ID"""
        self.order_id_counter += 1
        return f"PAPER_{self.order_id_counter}"

    async def place_limit_orders(self, pair: str, current_price: float):
        """Place step limit orders with improved capacity management"""
        try:
            if current_price <= 0:
                logger.error(f"❌ Invalid price for placing orders: {pair} - {current_price}")
                return
                
            available_collateral = self.calculate_available_collateral()
            available_buying_power = self.calculate_available_buying_power()
            
            # Calculate how many orders we can actually place
            total_collateral_needed = ORDER_SIZE_USD * MAX_ORDERS
            total_position_value = ORDER_SIZE_USD * LEVERAGE * MAX_ORDERS
            
            if available_collateral < total_collateral_needed:
                max_possible_orders = int(available_collateral / ORDER_SIZE_USD)
                if max_possible_orders == 0:
                    logger.warning(f"❌ No collateral available for {pair} (${available_collateral:.2f})")
                    return
                else:
                    logger.info(f"⚠️  Limited orders for {pair}: {max_possible_orders} instead of {MAX_ORDERS}")
                    orders_to_place = max_possible_orders
            else:
                orders_to_place = MAX_ORDERS
            
            if available_buying_power < total_position_value:
                max_orders_by_power = int(available_buying_power / (ORDER_SIZE_USD * LEVERAGE))
                orders_to_place = min(orders_to_place, max_orders_by_power)
                if orders_to_place == 0:
                    logger.warning(f"❌ No buying power available for {pair}")
                    return
            
            orders_placed = 0
            for i in range(orders_to_place):
                limit_price = current_price * (1 - STEP_PERC * i)
                quantity = ORDER_SIZE_USD / limit_price
                
                order = {
                    'id': self.generate_order_id(),
                    'pair': pair,
                    'side': 'buy',
                    'type': 'limit',
                    'quantity': quantity,
                    'price': limit_price,
                    'collateral': ORDER_SIZE_USD,
                    'position_value': ORDER_SIZE_USD * LEVERAGE,
                    'timestamp': datetime.now(),
                    'filled': False
                }
                
                self.open_orders[pair].append(order)
                orders_placed += 1
                
            logger.info(f"✅ Placed {orders_placed} limit orders for {pair}")
            logger.info(f"💰 Collateral reserved: ${ORDER_SIZE_USD * orders_placed:.2f}")
            logger.info(f"⚡ Position value ({LEVERAGE}x): ${ORDER_SIZE_USD * LEVERAGE * orders_placed:.2f}")
            
        except Exception as e:
            logger.error(f"❌ Error placing limit orders for {pair}: {e}")

    async def check_order_fills(self, pair: str):
        """Check if any limit orders should be filled"""
        try:
            current_price = await self.get_current_price(pair)
            if current_price <= 0:
                logger.error(f"❌ Invalid price for checking fills: {pair}")
                return
                
            filled_orders = []
            
            for order in self.open_orders[pair]:
                if not order['filled'] and current_price <= order['price']:
                    # Order gets filled
                    available_collateral = self.calculate_available_collateral()
                    
                    if available_collateral >= order['collateral']:
                        # Reserve collateral
                        self.total_collateral_used += order['collateral']
                        
                        # Update position
                        pos = self.positions[pair]
                        total_cost = pos['entry_price'] * pos['size'] + order['price'] * order['quantity']
                        total_size = pos['size'] + order['quantity']
                        
                        pos['entry_price'] = total_cost / total_size if total_size > 0 else order['price']
                        pos['size'] = total_size
                        pos['collateral_used'] += order['collateral']
                        
                        order['filled'] = True
                        filled_orders.append(order)
                        
                        # Record trade
                        trade = {
                            'timestamp': datetime.now(),
                            'pair': pair,
                            'side': 'buy',
                            'quantity': order['quantity'],
                            'price': order['price'],
                            'collateral': order['collateral'],
                            'leverage': LEVERAGE,
                            'type': 'entry'
                        }
                        self.trade_history.append(trade)
                        
                        logger.info(f"✅ Order filled: {pair} {order['quantity']:.6f} @ ${order['price']:.6f}")
            
            # Remove filled orders
            self.open_orders[pair] = [o for o in self.open_orders[pair] if not o['filled']]
            
        except Exception as e:
            logger.error(f"❌ Error checking order fills for {pair}: {e}")

    async def check_take_profit(self, pair: str):
        """Check and execute take profit"""
        try:
            pos = self.positions[pair]
            if pos['size'] == 0:
                return
                
            current_price = await self.get_current_price(pair)
            if current_price <= 0:
                logger.error(f"❌ Invalid price for TP/SL check: {pair}")
                return
                
            entry_price = pos['entry_price']
            
            if entry_price > 0:
                tp_price = entry_price * (1 + TP_PERC)
                sl_price = entry_price * (1 - EMERGENCY_STOP_LOSS)
                
                if current_price >= tp_price:
                    await self.close_position(pair, pos['size'], current_price, "Take Profit")
                elif current_price <= sl_price:
                    await self.close_position(pair, pos['size'], current_price, "Stop Loss")
                    
        except Exception as e:
            logger.error(f"❌ Error checking take profit for {pair}: {e}")

    async def close_position(self, pair: str, size: float, exit_price: float, reason: str):
        """Close position and calculate PnL"""
        try:
            pos = self.positions[pair]
            if size <= 0 or pos['size'] <= 0:
                return
                
            # Calculate PnL with leverage
            price_change = (exit_price - pos['entry_price']) / pos['entry_price']
            leveraged_pnl = price_change * pos['collateral_used'] * LEVERAGE
            
            # Return collateral to balance
            self.total_collateral_used -= pos['collateral_used']
            
            # Add PnL to balance
            self.balance += leveraged_pnl
            self.total_pnl += leveraged_pnl
            
            # Record trade
            trade = {
                'timestamp': datetime.now(),
                'pair': pair,
                'side': 'sell',
                'quantity': size,
                'price': exit_price,
                'entry_price': pos['entry_price'],
                'pnl': leveraged_pnl,
                'leverage': LEVERAGE,
                'type': 'exit',
                'reason': reason
            }
            self.trade_history.append(trade)
            
            logger.info(f"🎯 {reason} executed for {pair}")
            logger.info(f"💰 PnL: ${leveraged_pnl:.2f} | Exit: ${exit_price:.6f}")
            
            # Reset position
            self.positions[pair] = {
                'size': 0.0,
                'entry_price': 0.0,
                'unrealized_pnl': 0.0,
                'collateral_used': 0.0
            }
            
            # Cancel remaining orders
            self.open_orders[pair] = []
            
        except Exception as e:
            logger.error(f"❌ Error closing position for {pair}: {e}")

    async def update_unrealized_pnl(self):
        """Update unrealized PnL for all positions"""
        try:
            total_unrealized = 0.0
            
            for pair in PAIRS:
                pos = self.positions[pair]
                if pos['size'] > 0:
                    current_price = await self.get_current_price(pair)
                    if current_price > 0:
                        price_change = (current_price - pos['entry_price']) / pos['entry_price']
                        unrealized_pnl = price_change * pos['collateral_used'] * LEVERAGE
                        pos['unrealized_pnl'] = unrealized_pnl
                        total_unrealized += unrealized_pnl
                    else:
                        logger.error(f"❌ Failed to get price for PnL update: {pair}")
                        pos['unrealized_pnl'] = 0.0
                else:
                    pos['unrealized_pnl'] = 0.0
            
            self.equity = self.balance + total_unrealized
            
        except Exception as e:
            logger.error(f"❌ Error updating unrealized PnL: {e}")

    async def check_buy_signal(self, pair: str) -> bool:
        """Check if buy signal is present - FLEXIBLE VERSION"""
        try:
            current_time = time.time()
            if current_time - self.last_signals[pair] < 300:  # 5 minutes cooldown
                return False
            
            # Check if we already have position or orders
            if self.positions[pair]['size'] > 0 or len(self.open_orders[pair]) > 0:
                return False
            
            # Calculate RSI for all timeframes
            rsi_values = await self.calculate_multi_timeframe_rsi(pair)
            
            # FIXED: Flexible requirement - at least MIN_RSI_TIMEFRAMES needed
            if not rsi_values or len(rsi_values) < MIN_RSI_TIMEFRAMES:
                logger.debug(f"⚠️ Insufficient RSI data for {pair} - only {len(rsi_values)} timeframes available")
                return False
            
            # Check if available RSI values are below threshold
            valid_rsi_count = len(rsi_values)
            below_threshold_count = sum(1 for rsi in rsi_values.values() if rsi < THRESH_BUY)
            
            # FIXED: Signal if at least 80% of available RSI values are below threshold
            buy_signal = below_threshold_count >= (valid_rsi_count * 0.8)
            
            if buy_signal:
                self.last_signals[pair] = current_time
                logger.info(f"🚀 Buy signal for {pair}! RSI Count: {valid_rsi_count}, Below threshold: {below_threshold_count}")
                logger.info(f"📊 RSI Values: {rsi_values}")
                
            return buy_signal
            
        except Exception as e:
            logger.error(f"❌ Error checking buy signal for {pair}: {e}")
            return False

    async def process_pair(self, pair: str):
        """Process one trading pair"""
        try:
            # Check for order fills
            await self.check_order_fills(pair)
            
            # Check for take profit/stop loss
            await self.check_take_profit(pair)
            
            # Check for new buy signals
            if await self.check_buy_signal(pair):
                current_price = await self.get_current_price(pair)
                if current_price > 0:
                    await self.place_limit_orders(pair, current_price)
                else:
                    logger.error(f"❌ Cannot place orders for {pair} - invalid price")
                    
        except Exception as e:
            logger.error(f"❌ Error processing pair {pair}: {e}")

    async def trading_loop(self):
        """Main trading loop"""
        logger.info("🚀 Starting paper trading loop...")
        
        while self.is_running:
            try:
                # Update unrealized PnL
                await self.update_unrealized_pnl()
                
                # Process each pair
                for pair in PAIRS:
                    await self.process_pair(pair)
                    await asyncio.sleep(0.5)
                
                # Print status
                await self.print_status()
                
                # Wait before next iteration
                await asyncio.sleep(UPDATE_INTERVAL)
                
            except Exception as e:
                logger.error(f"❌ Error in trading loop: {e}")
                await asyncio.sleep(UPDATE_INTERVAL)

    async def print_status(self):
        """Print current status"""
        try:
            available_collateral = self.calculate_available_collateral()
            available_buying_power = self.calculate_available_buying_power()
            
            print(f"\n{'='*100}")
            print(f"📊 PAPER TRADING STATUS - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*100}")
            print(f"💰 Balance: ${self.balance:.2f} USDT")
            print(f"📈 Equity: ${self.equity:.2f} USDT")
            print(f"💸 Total PnL: ${self.total_pnl:.2f} USDT")
            print(f"📊 ROI: {((self.equity - STARTING_BALANCE) / STARTING_BALANCE * 100):.2f}%")
            print(f"💵 Available Collateral: ${available_collateral:.2f}")
            print(f"⚡ Available Buying Power: ${available_buying_power:.2f}")
            print(f"🎯 Total Trades: {len([t for t in self.trade_history if t['type'] == 'exit'])}")
            print(f"🔧 RSI Threshold: {THRESH_BUY} | Min Timeframes: {MIN_RSI_TIMEFRAMES}")
            print(f"{'='*100}")
            
            for pair in PAIRS:
                try:
                    pos = self.positions[pair]
                    orders = len(self.open_orders[pair])
                    current_price = await self.get_current_price(pair)
                    
                    if current_price > 0:
                        status = "📈 LONG" if pos['size'] > 0 else "⏳ WAIT"
                        print(f"{pair:<20} | ${current_price:>10.6f} | {status} | "
                              f"Size: {pos['size']:>10.4f} | PnL: ${pos['unrealized_pnl']:>8.2f} | "
                              f"Orders: {orders}")
                    else:
                        print(f"{pair:<20} | PRICE ERROR | ❌ NO DATA")
                          
                except Exception as e:
                    print(f"{pair:<20} | ERROR: {str(e)[:30]}")
            
            print(f"{'='*100}")
            
        except Exception as e:
            logger.error(f"❌ Error printing status: {e}")


    def calculate_performance_metrics(self):
        """Aggregate realized and unrealized performance per pair."""
        metrics = {}
        realized_pnl = defaultdict(float)
        collateral_used = defaultdict(float)
        trade_counts = defaultdict(int)

        for trade in self.trade_history:
            pair = trade.get('pair')
            if pair not in PAIRS:
                continue
            trade_type = trade.get('type')
            if trade_type == 'exit':
                realized_pnl[pair] += trade.get('pnl', 0.0)
                trade_counts[pair] += 1
            elif trade_type == 'entry':
                collateral_used[pair] += trade.get('collateral', 0.0)

        total_realized = 0.0
        total_unrealized = 0.0

        for pair in PAIRS:
            pos = self.positions[pair]
            unrealized = pos.get('unrealized_pnl', 0.0)
            total_unrealized += unrealized

            realized = realized_pnl[pair]
            total_realized += realized

            invested = collateral_used[pair]
            if invested == 0 and trade_counts[pair] > 0:
                invested = pos.get('collateral_used', 0.0) or (ORDER_SIZE_USD * LEVERAGE)

            roi = ((realized + unrealized) / invested * 100) if invested > 0 else 0.0

            metrics[pair] = {
                'realized': realized,
                'unrealized': unrealized,
                'open_size': pos.get('size', 0.0),
                'entry_price': pos.get('entry_price', 0.0),
                'collateral': invested,
                'trades': trade_counts[pair],
                'roi': roi,
            }

        overall = {
            'realized': total_realized,
            'unrealized': total_unrealized,
            'equity': self.equity,
            'roi': ((self.equity - STARTING_BALANCE) / STARTING_BALANCE * 100),
            'trades': sum(trade_counts.values()),
        }

        return metrics, overall

    def print_performance_report(self):
        """Print strategy performance per pair to the terminal."""
        try:
            metrics, overall = self.calculate_performance_metrics()
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print()
            print("-" * 100)
            print(f"7RSI STRATEGY PERFORMANCE SNAPSHOT - {timestamp}")
            print("-" * 100)
            print(f"Strategy Realized PnL: ${overall['realized']:.2f} | Unrealized: ${overall['unrealized']:.2f}")
            print(f"Strategy Equity: ${overall['equity']:.2f} | ROI: {overall['roi']:.2f}% | Closed Trades: {overall['trades']}")
            print("-" * 100)
            for pair in PAIRS:
                data = metrics[pair]
                status = 'OPEN' if data['open_size'] > 0 else 'FLAT'
                print(
                    f"{pair:<20} | {status:<4} | Realized: ${data['realized']:>8.2f} | "
                    f"Unrealized: ${data['unrealized']:>8.2f} | ROI: {data['roi']:>6.2f}% | Trades: {data['trades']}"
                )
            print("-" * 100)
        except Exception as e:
            logger.error(f"[PERF] Error printing performance report: {e}")

    async def performance_loop(self):
        """Continuously emit performance snapshots."""
        try:
            while self.is_running:
                self.print_performance_report()
                await asyncio.sleep(PERFORMANCE_INTERVAL)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[PERF] Error in performance loop: {e}")

    async def start(self):
        """Start the paper trading bot."""
        if not await self.initialize():
            logger.error("Failed to initialize bot")
            return

        self.is_running = True
        logger.info("Paper Trading Bot started successfully")

        performance_task = asyncio.create_task(self.performance_loop())

        try:
            await self.trading_loop()
        except KeyboardInterrupt:
            logger.info("Bot stopped by user")
        finally:
            self.is_running = False
            performance_task.cancel()
            try:
                await performance_task
            except asyncio.CancelledError:
                pass
            await self.stop()

    async def stop(self):
        """Stop the bot"""
        self.is_running = False
        try:
            await self.exchange.close()
            logger.info("🛑 Paper Trading Bot stopped")
            
            # Final summary
            final_roi = ((self.equity - STARTING_BALANCE) / STARTING_BALANCE * 100)
            logger.info(f"📊 Final Balance: ${self.equity:.2f}")
            logger.info(f"💰 Total PnL: ${self.total_pnl:.2f}")
            logger.info(f"📈 ROI: {final_roi:.2f}%")
            
        except Exception as e:
            logger.error(f"❌ Error during cleanup: {e}")

def main():
    """Main function"""
    print(f"🖥️  Platform: {sys.platform}")
    print(f"📊 Starting Paper Trading Bot with ${STARTING_BALANCE} and {LEVERAGE}x leverage")
    print(f"🎯 REAL-TIME DATA ONLY - NO SIMULATED DATA")
    print(f"🔧 RSI Threshold: {THRESH_BUY} | Min Timeframes: {MIN_RSI_TIMEFRAMES}")
    
    bot = PaperTradingBot()
    
    try:
        asyncio.run(bot.start())
    except KeyboardInterrupt:
        logger.info("👋 Shutting down...")

if __name__ == "__main__":
    main()
