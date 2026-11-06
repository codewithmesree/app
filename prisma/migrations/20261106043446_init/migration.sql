-- CreateTable
CREATE TABLE `demo_sessions` (
    `id` VARCHAR(30) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,

    UNIQUE INDEX `demo_sessions_tokenHash_key`(`tokenHash`),
    INDEX `demo_sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `traveller_preferences` (
    `id` VARCHAR(30) NOT NULL,
    `sessionId` VARCHAR(30) NOT NULL,
    `homeCountry` CHAR(2) NOT NULL,
    `displayCurrency` CHAR(3) NOT NULL,
    `destinations` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `traveller_preferences_sessionId_key`(`sessionId`),
    INDEX `traveller_preferences_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_connections` (
    `id` VARCHAR(30) NOT NULL,
    `sessionId` VARCHAR(30) NOT NULL,
    `status` ENUM('NOT_LINKED', 'LINKING_IN_PROGRESS', 'LINKED', 'LINKING_FAILED', 'CONNECTION_EXPIRED', 'RECONNECTION_REQUIRED') NOT NULL DEFAULT 'NOT_LINKED',
    `providerMandateId` VARCHAR(255) NULL,
    `institutionName` VARCHAR(255) NULL,
    `maskedAccountNumber` VARCHAR(50) NULL,
    `accountType` VARCHAR(50) NULL,
    `isSimulated` BOOLEAN NOT NULL DEFAULT true,
    `authorizedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_connections_sessionId_key`(`sessionId`),
    INDEX `bank_connections_sessionId_idx`(`sessionId`),
    INDEX `bank_connections_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `merchants` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NULL,
    `category` VARCHAR(40) NOT NULL,
    `description` VARCHAR(500) NULL,
    `countryCode` CHAR(2) NULL,
    `displayCurrency` CHAR(3) NOT NULL,
    `supportedMethods` JSON NOT NULL,
    `demoQrIdentifier` VARCHAR(100) NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `merchants_slug_key`(`slug`),
    UNIQUE INDEX `merchants_demoQrIdentifier_key`(`demoQrIdentifier`),
    INDEX `merchants_isActive_category_idx`(`isActive`, `category`),
    INDEX `merchants_countryCode_isActive_idx`(`countryCode`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `currency_quotes` (
    `id` VARCHAR(30) NOT NULL,
    `baseAmount` DECIMAL(20, 8) NOT NULL,
    `baseCurrency` CHAR(3) NOT NULL,
    `convertedAmount` DECIMAL(20, 8) NOT NULL,
    `quoteCurrency` CHAR(3) NOT NULL,
    `rate` DECIMAL(24, 12) NOT NULL,
    `source` VARCHAR(100) NOT NULL,
    `asOf` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `isIndicative` BOOLEAN NOT NULL DEFAULT true,

    INDEX `currency_quotes_baseCurrency_quoteCurrency_asOf_idx`(`baseCurrency`, `quoteCurrency`, `asOf`),
    INDEX `currency_quotes_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(30) NOT NULL,
    `demoSessionId` VARCHAR(30) NOT NULL,
    `merchantId` VARCHAR(30) NOT NULL,
    `currencyQuoteId` VARCHAR(30) NULL,
    `amount` DECIMAL(20, 8) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `homeCurrency` CHAR(3) NULL,
    `indicativeRate` DECIMAL(24, 12) NULL,
    `estimatedHomeAmount` DECIMAL(20, 8) NULL,
    `feeBreakdown` JSON NULL,
    `status` ENUM('CREATED', 'AWAITING_APPROVAL', 'CAPTURE_PENDING', 'COMPLETED', 'CANCELLED', 'FAILED', 'STATUS_UNKNOWN') NOT NULL DEFAULT 'CREATED',
    `quoteSnapshot` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `failureCode` VARCHAR(80) NULL,

    INDEX `transactions_demoSessionId_createdAt_idx`(`demoSessionId`, `createdAt`),
    INDEX `transactions_status_updatedAt_idx`(`status`, `updatedAt`),
    INDEX `transactions_merchantId_createdAt_idx`(`merchantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_attempts` (
    `id` VARCHAR(30) NOT NULL,
    `transactionId` VARCHAR(30) NOT NULL,
    `provider` ENUM('PAYPAL') NOT NULL DEFAULT 'PAYPAL',
    `environment` ENUM('SANDBOX') NOT NULL DEFAULT 'SANDBOX',
    `status` ENUM('CREATED', 'AWAITING_APPROVAL', 'APPROVED', 'CAPTURE_PENDING', 'COMPLETED', 'DENIED', 'CANCELLED', 'FAILED', 'STATUS_UNKNOWN') NOT NULL DEFAULT 'CREATED',
    `providerOrderId` VARCHAR(120) NULL,
    `providerCaptureId` VARCHAR(120) NULL,
    `amount` DECIMAL(20, 8) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `approvedAt` DATETIME(3) NULL,
    `captureRequestedAt` DATETIME(3) NULL,
    `capturedAt` DATETIME(3) NULL,
    `lastCheckedAt` DATETIME(3) NULL,
    `failureCode` VARCHAR(80) NULL,
    `providerStatus` VARCHAR(80) NULL,
    `reconciliationNeeded` BOOLEAN NOT NULL DEFAULT false,
    `reconciliationAttempts` INTEGER NOT NULL DEFAULT 0,

    INDEX `payment_attempts_transactionId_createdAt_idx`(`transactionId`, `createdAt`),
    INDEX `payment_attempts_reconciliationNeeded_updatedAt_idx`(`reconciliationNeeded`, `updatedAt`),
    UNIQUE INDEX `payment_attempts_provider_environment_providerOrderId_key`(`provider`, `environment`, `providerOrderId`),
    UNIQUE INDEX `payment_attempts_provider_environment_providerCaptureId_key`(`provider`, `environment`, `providerCaptureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_operations` (
    `id` VARCHAR(30) NOT NULL,
    `demoSessionId` VARCHAR(30) NOT NULL,
    `transactionId` VARCHAR(30) NOT NULL,
    `paymentAttemptId` VARCHAR(30) NULL,
    `operationType` ENUM('PAYPAL_CREATE', 'PAYPAL_CAPTURE') NOT NULL,
    `keyHash` VARCHAR(128) NOT NULL,
    `requestFingerprint` VARCHAR(128) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'UNKNOWN') NOT NULL DEFAULT 'IN_PROGRESS',
    `httpStatus` INTEGER NULL,
    `safeResult` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,

    INDEX `idempotency_operations_transactionId_operationType_createdAt_idx`(`transactionId`, `operationType`, `createdAt`),
    INDEX `idempotency_operations_status_updatedAt_idx`(`status`, `updatedAt`),
    UNIQUE INDEX `idempotency_operations_demoSessionId_operationType_keyHash_key`(`demoSessionId`, `operationType`, `keyHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaction_events` (
    `id` VARCHAR(30) NOT NULL,
    `transactionId` VARCHAR(30) NOT NULL,
    `paymentAttemptId` VARCHAR(30) NULL,
    `eventType` VARCHAR(80) NOT NULL,
    `fromStatus` VARCHAR(40) NULL,
    `toStatus` VARCHAR(40) NULL,
    `source` VARCHAR(40) NOT NULL,
    `requestId` VARCHAR(100) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `transaction_events_transactionId_createdAt_idx`(`transactionId`, `createdAt`),
    INDEX `transaction_events_paymentAttemptId_createdAt_idx`(`paymentAttemptId`, `createdAt`),
    INDEX `transaction_events_eventType_createdAt_idx`(`eventType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `traveller_preferences` ADD CONSTRAINT `traveller_preferences_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `demo_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_connections` ADD CONSTRAINT `bank_connections_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `demo_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_demoSessionId_fkey` FOREIGN KEY (`demoSessionId`) REFERENCES `demo_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_currencyQuoteId_fkey` FOREIGN KEY (`currencyQuoteId`) REFERENCES `currency_quotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_operations` ADD CONSTRAINT `idempotency_operations_demoSessionId_fkey` FOREIGN KEY (`demoSessionId`) REFERENCES `demo_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_operations` ADD CONSTRAINT `idempotency_operations_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_operations` ADD CONSTRAINT `idempotency_operations_paymentAttemptId_fkey` FOREIGN KEY (`paymentAttemptId`) REFERENCES `payment_attempts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_events` ADD CONSTRAINT `transaction_events_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaction_events` ADD CONSTRAINT `transaction_events_paymentAttemptId_fkey` FOREIGN KEY (`paymentAttemptId`) REFERENCES `payment_attempts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
