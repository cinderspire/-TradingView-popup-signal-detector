-- Performance Optimization Indexes
-- High-impact indexes for frequent queries

-- Signal Performance Indexes
CREATE INDEX IF NOT EXISTS "Signal_status_createdAt_idx" ON "Signal"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Signal_symbol_status_idx" ON "Signal"("symbol", "status");
CREATE INDEX IF NOT EXISTS "Signal_strategyId_status_idx" ON "Signal"("strategyId", "status");

-- Position Performance Indexes
CREATE INDEX IF NOT EXISTS "Position_userId_status_idx" ON "Position"("userId", "status");
CREATE INDEX IF NOT EXISTS "Position_symbol_status_idx" ON "Position"("symbol", "status");

-- Subscription Performance Indexes
CREATE INDEX IF NOT EXISTS "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
CREATE INDEX IF NOT EXISTS "Subscription_strategyId_status_idx" ON "Subscription"("strategyId", "status");

-- Transaction Performance Indexes
CREATE INDEX IF NOT EXISTS "Transaction_type_status_idx" ON "Transaction"("type", "status");

-- PaperTrade Performance Indexes
CREATE INDEX IF NOT EXISTS "PaperTrade_userId_status_idx" ON "PaperTrade"("userId", "status");
CREATE INDEX IF NOT EXISTS "PaperTrade_pair_status_idx" ON "PaperTrade"("pair", "status");

-- ExecutionLog Performance Indexes
CREATE INDEX IF NOT EXISTS "ExecutionLog_userId_executedAt_idx" ON "ExecutionLog"("userId", "executedAt" DESC);
CREATE INDEX IF NOT EXISTS "ExecutionLog_status_executedAt_idx" ON "ExecutionLog"("status", "executedAt" DESC);
