const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

/**
 * CSV EXPORT ROUTES
 *
 * Tüm sinyalleri CSV formatında indir
 * ORİJİNAL DOSYALARA DOKUNMAZ - sadece okur
 */

// @route   GET /api/export/signals-csv
// @desc    Export all signals to CSV (active + completed trades)
// @access  Public
router.get('/signals-csv', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, '../../../data/signals');
    const activePath = path.join(dataDir, 'active.json');
    const tradesPath = path.join(dataDir, 'completed_trades.json');
    const metadataPath = path.join(dataDir, 'metadata.json');

    console.log('📥 Starting CSV export...');

    // Read active signals
    let activeSignals = [];
    try {
      const activeData = await fs.readFile(activePath, 'utf8');
      activeSignals = JSON.parse(activeData);
      console.log(`✅ Loaded ${activeSignals.length} active signals`);
    } catch (err) {
      console.log('⚠️  No active signals file');
    }

    // Read completed trades
    let completedTrades = [];
    try {
      const tradesData = await fs.readFile(tradesPath, 'utf8');
      completedTrades = JSON.parse(tradesData);
      console.log(`✅ Loaded ${completedTrades.length} completed trades`);
    } catch (err) {
      console.log('⚠️  No completed trades file');
    }

    // Read metadata
    let metadata = {};
    try {
      const metaData = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metaData);
    } catch (err) {
      console.log('⚠️  No metadata file');
    }

    // Combine all signals
    const allSignals = [];

    // Add active signals
    for (const signal of activeSignals) {
      allSignals.push({
        type: 'SIGNAL',
        id: signal.id || '',
        strategy: signal.strategy || '',
        pair: signal.pair || '',
        direction: signal.direction || '',
        marketPosition: signal.marketPosition || '',
        entryPrice: signal.entry || signal.entryPrice || 0,
        exitPrice: signal.exitPrice || '',
        currentPrice: signal.currentPrice || '',
        currentPnL: signal.currentPnL || 0,
        contracts: signal.contracts || signal.positionSize || 0,
        stopLoss: signal.stopLoss || '',
        takeProfit: signal.takeProfit || '',
        status: signal.status || 'Active',
        createdAt: signal.createdAt || signal.timestamp || '',
        closedAt: signal.closedAt || '',
        ageHours: signal.ageHours || '',
        ageDays: signal.ageDays || '',
        source: signal.source || '',
        format: signal.format || ''
      });
    }

    // Add completed trades
    for (const trade of completedTrades) {
      allSignals.push({
        type: 'TRADE',
        id: trade.id || '',
        strategy: trade.strategy || '',
        pair: trade.pair || '',
        direction: trade.direction || '',
        marketPosition: '',
        entryPrice: trade.entryPrice || 0,
        exitPrice: trade.exitPrice || 0,
        currentPrice: '',
        currentPnL: trade.pnlPercent || 0,
        contracts: trade.amount || 0,
        stopLoss: '',
        takeProfit: '',
        status: 'Closed',
        createdAt: trade.entryTime || '',
        closedAt: trade.exitTime || '',
        ageHours: '',
        ageDays: '',
        source: 'Matched Trade',
        format: 'Trade'
      });
    }

    console.log(`📊 Total records to export: ${allSignals.length}`);

    // Generate CSV
    const csvLines = [];

    // Header
    csvLines.push([
      'Type',
      'ID',
      'Strategy',
      'Pair',
      'Direction',
      'Market Position',
      'Entry Price',
      'Exit Price',
      'Current Price',
      'PnL %',
      'Contracts',
      'Stop Loss',
      'Take Profit',
      'Status',
      'Created At',
      'Closed At',
      'Age Hours',
      'Age Days',
      'Source',
      'Format'
    ].join(','));

    // Data rows
    for (const signal of allSignals) {
      csvLines.push([
        signal.type,
        escapeCsv(signal.id),
        escapeCsv(signal.strategy),
        escapeCsv(signal.pair),
        escapeCsv(signal.direction),
        escapeCsv(signal.marketPosition),
        signal.entryPrice,
        signal.exitPrice,
        signal.currentPrice,
        signal.currentPnL,
        signal.contracts,
        signal.stopLoss,
        signal.takeProfit,
        escapeCsv(signal.status),
        escapeCsv(signal.createdAt),
        escapeCsv(signal.closedAt),
        signal.ageHours,
        signal.ageDays,
        escapeCsv(signal.source),
        escapeCsv(signal.format)
      ].join(','));
    }

    const csv = csvLines.join('\n');

    // Set headers for download
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `signals-export-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    console.log(`✅ CSV export complete: ${filename} (${allSignals.length} records)`);

    res.send(csv);

  } catch (error) {
    console.error('❌ CSV export error:', error);
    res.status(500).json({
      success: false,
      message: 'CSV export failed',
      error: error.message
    });
  }
});

// @route   GET /api/export/signals-json
// @desc    Export all signals to JSON
// @access  Public
router.get('/signals-json', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, '../../../data/signals');
    const activePath = path.join(dataDir, 'active.json');
    const tradesPath = path.join(dataDir, 'completed_trades.json');

    // Read files
    const activeData = await fs.readFile(activePath, 'utf8');
    const tradesData = await fs.readFile(tradesPath, 'utf8');

    const activeSignals = JSON.parse(activeData);
    const completedTrades = JSON.parse(tradesData);

    // Combine
    const exportData = {
      exportDate: new Date().toISOString(),
      activeSignals: activeSignals,
      completedTrades: completedTrades,
      counts: {
        active: activeSignals.length,
        completed: completedTrades.length,
        total: activeSignals.length + completedTrades.length
      }
    };

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `signals-export-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    res.json(exportData);

  } catch (error) {
    console.error('❌ JSON export error:', error);
    res.status(500).json({
      success: false,
      message: 'JSON export failed',
      error: error.message
    });
  }
});

// @route   GET /api/export/stats
// @desc    Get export statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, '../../../data/signals');
    const metadataPath = path.join(dataDir, 'metadata.json');

    const metaData = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(metaData);

    res.json({
      success: true,
      data: metadata
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
});

// Helper function to escape CSV values
function escapeCsv(value) {
  if (value === null || value === undefined) return '';

  const str = String(value);

  // If contains comma, quote, or newline - wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

module.exports = router;
