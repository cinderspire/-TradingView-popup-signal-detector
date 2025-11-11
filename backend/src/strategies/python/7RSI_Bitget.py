import ccxt
import pandas as pd
import numpy as np
import time
from datetime import datetime
import logging

# Logging yapılandırması
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BitgetRSITradingBot:
    def __init__(self):
        # Gerçek Bitget Futures API yapılandırması
        self.exchange = ccxt.bitget({
            'apiKey': 'bg_08acd10c4fb4ed325a00ddb3a1e5846c',
            'secret': 'fda21998d91137353398f1586479e64ed4a6306b0017f69a69aea7920f78a3b1',
            'password': '1453Fatih',
            'sandbox': False,
            'enableRateLimit': True,
            'options': {
                'defaultType': 'swap',  # Futures trading için
            }
        })
        
        # Bitget futures için doğru sembol formatları - CoinGecko verilerine göre[6]
        self.pairs = [
'SPX/USDT:USDT',
'SHM/USDT:USDT',
'AXL/USDT:USDT',
'SNT/USDT:USDT',
'RVN/USDT:USDT',
'MYX/USDT:USDT',
'HOUSE/USDT:USDT',
'KAIA/USDT:USDT',
'LAUNCHCOIN/USDT:USDT',
'SYRUP/USDT:USDT',
'HYPE/USDT:USDT',
'/USDT:USDT'
        ]
        
        # Pine Script'ten tam parametreler[1]
        self.strategy_params = {
            'src': 'close',
            'bot_res': '1',  # Pine Script'te "1" (1 dakika)[1]
            'srcin_bot': 'ohlc4',
            'trade_direction': 'Long Bot',
            'rsi_timeframes': ['1m', '5m', '15m', '30m', '1h', '2h', '1d'],  # Pine Script zaman dilimleri[1]
            'rsi_lengths': [14, 14, 14, 14, 14, 14, 14],  # Tüm RSI uzunlukları 14[1]
            'long_profit_perc': 0.5,  # longProfitPerc = 0.5%[1]
            'step_orders_perc': 2.0,  # st_long_orders = 2.0%[1]
            'rsi_low_thresholds': [100, 100, 100, 100, 100, 100, 100],  # Default 100 (devre dışı)[1]
            'short_profit_perc': 0.5,  # shortProfitPerc = 0.5%[1]
            'rsi_up_thresholds': [0, 0, 0, 0, 0, 0, 0],  # Default 0 (devre dışı)[1]
            'default_qty_percent': 5  # default_qty_value=5[1]
        }
        
        self.active_positions = {}
        self.pending_orders = {}
        
    def calculate_rsi(self, prices, period=14):
        """Pine Script rsi() fonksiyonu implementasyonu[1]"""
        if len(prices) < period + 1:
            return None
            
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[:period])
        avg_loss = np.mean(losses[:period])
        
        if avg_loss == 0:
            return 100
            
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        for i in range(period, len(deltas)):
            gain = gains[i]
            loss = losses[i]
            avg_gain = (avg_gain * (period - 1) + gain) / period
            avg_loss = (avg_loss * (period - 1) + loss) / period
            
            if avg_loss == 0:
                rsi = 100
            else:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))
                
        return rsi
    
    def get_market_data(self, symbol, timeframe='1m', limit=100):
        """Piyasa verilerini çekme"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            # Pine Script ohlc4 hesaplama[1]
            df['ohlc4'] = (df['open'] + df['high'] + df['low'] + df['close']) / 4
            
            return df
        except Exception as e:
            logger.error(f"Veri çekme hatası {symbol}: {e}")
            return None
    
    def calculate_multi_timeframe_rsi(self, symbol):
        """Pine Script 7 RSI hesaplama - security() fonksiyonu[1]"""
        rsi_values = {}
        
        # Pine Script: rsi1_sec = security(syminfo.tickerid, rsi1_res, rsi1)[1]
        timeframe_mapping = {
            '1m': '1m',    # rsi1_res = "1"[1]
            '5m': '5m',    # rsi2_res = "5"[1]
            '15m': '15m',  # rsi3_res = "15"[1]
            '30m': '30m',  # rsi4_res = "30"[1]
            '1h': '1h',    # rsi5_res = "60"[1]
            '2h': '2h',    # rsi6_res = "120"[1]
            '1d': '1d'     # rsi7_res = "1D"[1]
        }
        
        for i, timeframe in enumerate(self.strategy_params['rsi_timeframes']):
            try:
                data = self.get_market_data(symbol, timeframe_mapping[timeframe], 100)
                if data is not None and len(data) > self.strategy_params['rsi_lengths'][i]:
                    # Pine Script: rsi1 = rsi(src, rsi1_Len)[1]
                    rsi = self.calculate_rsi(data['close'].values, self.strategy_params['rsi_lengths'][i])
                    rsi_values[f'rsi{i+1}_sec'] = rsi
                    logger.info(f"RSI{i+1} ({timeframe}): {rsi}")
                else:
                    rsi_values[f'rsi{i+1}_sec'] = None
            except Exception as e:
                logger.error(f"RSI hesaplama hatası {symbol} {timeframe}: {e}")
                rsi_values[f'rsi{i+1}_sec'] = None
                
        return rsi_values
    
    def check_buy_signal(self, rsi_values):
        """Pine Script Buy sinyali kontrolü[1]"""
        # Pine Script: Buy = rsi1_low_signal and rsi2_low_signal and ... and rsi7_low_signal[1]
        buy_signals = []
        
        for i in range(7):
            rsi_key = f'rsi{i+1}_sec'
            threshold = self.strategy_params['rsi_low_thresholds'][i]
            
            if rsi_values.get(rsi_key) is not None:
                # Pine Script: rsi1_low_signal = rsi1_sec < rsi1_low[1]
                if threshold < 100:  # Eğer threshold 100'den küçükse aktif
                    signal = rsi_values[rsi_key] < threshold
                    buy_signals.append(signal)
                    logger.info(f"RSI{i+1} Low Signal: {rsi_values[rsi_key]} < {threshold} = {signal}")
                else:
                    buy_signals.append(True)  # Devre dışı, her zaman true
            else:
                buy_signals.append(False)
        
        # Tüm sinyaller true olmalı ve en az bir aktif sinyal olmalı
        result = all(buy_signals) and any(s for s in buy_signals if s is not True)
        logger.info(f"Buy Signal Result: {result}, Signals: {buy_signals}")
        return result
    
    def check_sell_signal(self, rsi_values):
        """Pine Script Sell sinyali kontrolü[1]"""
        # Pine Script: Sell = rsi1_up_signal and rsi2_up_signal and ... and rsi7_up_signal[1]
        sell_signals = []
        
        for i in range(7):
            rsi_key = f'rsi{i+1}_sec'
            threshold = self.strategy_params['rsi_up_thresholds'][i]
            
            if rsi_values.get(rsi_key) is not None:
                # Pine Script: rsi1_up_signal = rsi1_sec > rsi1_up[1]
                if threshold > 0:  # Eğer threshold 0'dan büyükse aktif
                    signal = rsi_values[rsi_key] > threshold
                    sell_signals.append(signal)
                    logger.info(f"RSI{i+1} Up Signal: {rsi_values[rsi_key]} > {threshold} = {signal}")
                else:
                    sell_signals.append(True)  # Devre dışı, her zaman true
            else:
                sell_signals.append(False)
        
        result = all(sell_signals) and any(s for s in sell_signals if s is not True)
        logger.info(f"Sell Signal Result: {result}, Signals: {sell_signals}")
        return result
    
    def calculate_position_size(self, symbol, current_price):
        """Pine Script default_qty_value=5 implementasyonu[1]"""
        try:
            balance = self.exchange.fetch_balance()
            available_balance = balance['USDT']['free']
            
            # Pine Script: default_qty_value=5 (equity'nin %5'i)[1]
            order_size_usd = available_balance * (self.strategy_params['default_qty_percent'] / 100)
            position_size = order_size_usd / current_price
            
            # Minimum lot size kontrolü
            market = self.exchange.markets[symbol]
            min_amount = market['limits']['amount']['min']
            
            return max(position_size, min_amount)
        except Exception as e:
            logger.error(f"Pozisyon büyüklüğü hesaplama hatası: {e}")
            return 0
    
    def place_grid_orders(self, symbol, src_bot_price, direction='long'):
        """Pine Script grid emirleri - Long0-Long19 implementasyonu[1]"""
        try:
            position_size = self.calculate_position_size(symbol, src_bot_price)
            
            if direction == 'long':
                # Pine Script: st_long_orders = 2.0% * 0.01[1]
                st_long_orders = self.strategy_params['step_orders_perc'] / 100
                
                orders_placed = []
                
                # Pine Script: strategy.order(id="Long0", long=true, limit=src_bot)[1]
                try:
                    order = self.exchange.create_limit_buy_order(
                        symbol=symbol,
                        amount=position_size,
                        price=src_bot_price
                    )
                    orders_placed.append(order)
                    logger.info(f"Long0 emri yerleştirildi: {symbol} @ {src_bot_price}")
                except Exception as e:
                    logger.error(f"Long0 emri hatası: {e}")
                
                # Pine Script: Long1-Long19 emirleri[1]
                for i in range(1, 20):
                    try:
                        # Pine Script: longEntryPrice1 = src_bot * (1 - (st_long_orders))[1]
                        entry_price = src_bot_price * (1 - (st_long_orders * i))
                        
                        order = self.exchange.create_limit_buy_order(
                            symbol=symbol,
                            amount=position_size,
                            price=entry_price
                        )
                        
                        orders_placed.append(order)
                        logger.info(f"Long{i} emri yerleştirildi: {symbol} @ {entry_price}")
                    except Exception as e:
                        logger.error(f"Long{i} emri hatası: {e}")
                
                return orders_placed
                
        except Exception as e:
            logger.error(f"Grid emirleri yerleştirme hatası {symbol}: {e}")
            return []
    
    def manage_take_profit(self, symbol):
        """Pine Script take profit yönetimi[1]"""
        try:
            positions = self.exchange.fetch_positions([symbol])
            
            for position in positions:
                if position['size'] > 0:  # Long pozisyon
                    # Pine Script: longExitPrice = strategy.position_avg_price * (1 + longProfitPerc)[1]
                    avg_price = position['entryPrice']
                    exit_price = avg_price * (1 + self.strategy_params['long_profit_perc'] / 100)
                    
                    # Pine Script: strategy.order(id="exit_Long", long=false, limit=longExitPrice)[1]
                    self.exchange.create_limit_sell_order(
                        symbol=symbol,
                        amount=position['size'],
                        price=exit_price
                    )
                    logger.info(f"Long take profit emri: {symbol} @ {exit_price}")
                    
        except Exception as e:
            logger.error(f"Take profit yönetimi hatası {symbol}: {e}")
    
    def run_strategy(self):
        """Pine Script ana strateji döngüsü[1]"""
        logger.info("7-RSI Bitget Futures Bot başlatılıyor...")
        
        try:
            self.exchange.load_markets()
            logger.info("Piyasalar yüklendi")
            
            # Mevcut sembol listesini kontrol et ve logla
            available_symbols = list(self.exchange.markets.keys())
            logger.info(f"Toplam mevcut sembol sayısı: {len(available_symbols)}")
            
            valid_pairs = []
            for pair in self.pairs:
                if pair in available_symbols:
                    valid_pairs.append(pair)
                    logger.info(f"Geçerli sembol bulundu: {pair}")
                else:
                    logger.warning(f"Sembol bulunamadı: {pair}")
            
            if not valid_pairs:
                logger.error("Hiçbir geçerli sembol bulunamadı!")
                logger.info("İlk 20 mevcut sembol:")
                for i, symbol in enumerate(available_symbols[:20]):
                    logger.info(f"  {i+1}. {symbol}")
                return
            
            logger.info(f"Toplam geçerli sembol: {len(valid_pairs)}")
            
            while True:
                for symbol in valid_pairs:
                    try:
                        # Pine Script: if (strategy.position_size == 0)[1]
                        positions = self.exchange.fetch_positions([symbol])
                        has_position = any(pos['size'] != 0 for pos in positions)
                        
                        # Pine Script: src_bot = security(syminfo.tickerid, bot_res, srcin_bot)[1]
                        current_data = self.get_market_data(symbol, '1m', 1)
                        if current_data is None:
                            continue
                            
                        src_bot_price = current_data['ohlc4'].iloc[-1]
                        
                        # 7 RSI hesapla
                        rsi_values = self.calculate_multi_timeframe_rsi(symbol)
                        
                        logger.info(f"\n=== {symbol} ===")
                        logger.info(f"src_bot (OHLC4): {src_bot_price}")
                        logger.info(f"Pozisyon var mı: {has_position}")
                        
                        if not has_position:
                            # Pine Script: longOK = (tradeDirection == "Long Bot")[1]
                            if (self.strategy_params['trade_direction'] == 'Long Bot'):
                                buy_signal = self.check_buy_signal(rsi_values)
                                if buy_signal:
                                    logger.info(f"🟢 BUY SİNYALİ TESPİT EDİLDİ: {symbol}")
                                    self.place_grid_orders(symbol, src_bot_price, 'long')
                                else:
                                    logger.info(f"❌ Buy sinyali yok: {symbol}")
                            
                            # Pine Script: shortOK = (tradeDirection == "Short Bot")[1]
                            elif (self.strategy_params['trade_direction'] == 'Short Bot'):
                                sell_signal = self.check_sell_signal(rsi_values)
                                if sell_signal:
                                    logger.info(f"🔴 SELL SİNYALİ TESPİT EDİLDİ: {symbol}")
                                    # Short emirleri burada eklenebilir
                                else:
                                    logger.info(f"❌ Sell sinyali yok: {symbol}")
                        
                        else:
                            # Pine Script: if (strategy.position_size > 0) exit_Long[1]
                            self.manage_take_profit(symbol)
                            logger.info(f"📊 Pozisyon yönetiliyor: {symbol}")
                        
                    except Exception as e:
                        logger.error(f"Strateji hatası {symbol}: {e}")
                        continue
                
                logger.info("\n⏳ Sonraki iterasyon için 60 saniye bekleniyor...")
                time.sleep(60)  # Pine Script bot_res="1" (1 dakika)[1]
                
        except KeyboardInterrupt:
            logger.info("Bot kullanıcı tarafından durduruldu")
        except Exception as e:
            logger.error(f"Kritik hata: {e}")

# Ana çalıştırma
if __name__ == "__main__":
    bot = BitgetRSITradingBot()
    
    print("=== 7-RSI Bitget Futures Trading Bot ===")
    print(f"API Key: {bot.exchange.apiKey[:10]}...")
    print(f"Trading Pairs: {bot.pairs}")
    print(f"Pine Script Parametreleri:")
    print(f"  - default_qty_value: {bot.strategy_params['default_qty_percent']}%")
    print(f"  - longProfitPerc: {bot.strategy_params['long_profit_perc']}%")
    print(f"  - st_long_orders: {bot.strategy_params['step_orders_perc']}%")
    print(f"  - tradeDirection: {bot.strategy_params['trade_direction']}")
    print(f"  - RSI timeframes: {bot.strategy_params['rsi_timeframes']}")
    print("=" * 50)
    
    bot.run_strategy()
