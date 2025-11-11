-- Add onboarding tables for user onboarding flow

-- UserOnboarding table
CREATE TABLE IF NOT EXISTS "UserOnboarding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL DEFAULT 'trader',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL,
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserOnboarding_userId_key" ON "UserOnboarding"("userId");
CREATE INDEX IF NOT EXISTS "UserOnboarding_userId_completed_idx" ON "UserOnboarding"("userId", "completed");

-- OnboardingStep table
CREATE TABLE IF NOT EXISTS "OnboardingStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "onboardingId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "action" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingStep_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "UserOnboarding"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "OnboardingStep_onboardingId_idx" ON "OnboardingStep"("onboardingId");
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingStep_onboardingId_stepId_key" ON "OnboardingStep"("onboardingId", "stepId");

-- ScheduledEmail table
CREATE TABLE IF NOT EXISTS "ScheduledEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ScheduledEmail_userId_sent_idx" ON "ScheduledEmail"("userId", "sent");
CREATE INDEX IF NOT EXISTS "ScheduledEmail_scheduledFor_sent_idx" ON "ScheduledEmail"("scheduledFor", "sent");

-- SystemLog table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS "SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");
CREATE INDEX IF NOT EXISTS "SystemLog_category_createdAt_idx" ON "SystemLog"("category", "createdAt");
