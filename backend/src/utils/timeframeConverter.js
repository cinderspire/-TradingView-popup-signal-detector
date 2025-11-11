// Convert 1m candles to higher timeframes (5m, 15m, 1h, 4h, 1d)

export class TimeframeConverter {
  constructor() {
    this.timeframeMinutes = {
      '1m': 1,
      '2m': 2,
      '3m': 3,
      '5m': 5,
      '10m': 10,
      '15m': 15,
      '30m': 30,
      '45m': 45,
      '1h': 60,
      '2h': 120,
      '3h': 180,
      '4h': 240,
      '6h': 360,
      '8h': 480,
      '1d': 1440,
      '2d': 2880
    };
  }

  /**
   * Convert 1m OHLCV candles to higher timeframe
   * @param {Array} candles1m - Array of 1m candles [timestamp, open, high, low, close, volume]
   * @param {String} targetTimeframe - Target timeframe (5m, 15m, 1h, 4h, 1d)
   * @returns {Array} Converted candles
   */
  convert(candles1m, targetTimeframe) {
    if (!candles1m || candles1m.length === 0) return [];
    if (targetTimeframe === '1m') return candles1m;

    const minutes = this.timeframeMinutes[targetTimeframe];
    if (!minutes) throw new Error(`Invalid timeframe: ${targetTimeframe}`);

    const converted = [];
    let currentCandle = null;
    let startTime = null;

    for (const candle of candles1m) {
      const [timestamp, open, high, low, close, volume] = candle;
      const candleTime = new Date(timestamp);

      // Calculate period start time
      const periodStart = this.getPeriodStart(candleTime, minutes);

      // If new period, save previous and start new
      if (!startTime || periodStart.getTime() !== startTime.getTime()) {
        if (currentCandle) {
          converted.push(currentCandle);
        }

        currentCandle = [
          periodStart.getTime(),
          open,
          high,
          low,
          close,
          volume
        ];
        startTime = periodStart;
      } else {
        // Update current candle
        currentCandle[2] = Math.max(currentCandle[2], high); // high
        currentCandle[3] = Math.min(currentCandle[3], low);  // low
        currentCandle[4] = close;                            // close
        currentCandle[5] += volume;                          // volume
      }
    }

    // Push last candle
    if (currentCandle) {
      converted.push(currentCandle);
    }

    return converted;
  }

  /**
   * Get period start time for a given timestamp and timeframe
   */
  getPeriodStart(date, minutes) {
    const ms = date.getTime();
    const periodMs = minutes * 60 * 1000;
    const periodStart = Math.floor(ms / periodMs) * periodMs;
    return new Date(periodStart);
  }

  /**
   * Batch convert 1m data to all timeframes
   */
  convertToAllTimeframes(candles1m) {
    return {
      '1m': candles1m,
      '2m': this.convert(candles1m, '2m'),
      '3m': this.convert(candles1m, '3m'),
      '5m': this.convert(candles1m, '5m'),
      '10m': this.convert(candles1m, '10m'),
      '15m': this.convert(candles1m, '15m'),
      '30m': this.convert(candles1m, '30m'),
      '45m': this.convert(candles1m, '45m'),
      '1h': this.convert(candles1m, '1h'),
      '2h': this.convert(candles1m, '2h'),
      '3h': this.convert(candles1m, '3h'),
      '4h': this.convert(candles1m, '4h'),
      '6h': this.convert(candles1m, '6h'),
      '8h': this.convert(candles1m, '8h'),
      '1d': this.convert(candles1m, '1d'),
      '2d': this.convert(candles1m, '2d')
    };
  }

  /**
   * Get timeframe in milliseconds
   */
  getTimeframeMs(timeframe) {
    return this.timeframeMinutes[timeframe] * 60 * 1000;
  }
}

export default TimeframeConverter;
