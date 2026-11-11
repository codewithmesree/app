ALTER TABLE `payment_attempts`
    ADD COLUMN `captureLeaseToken` VARCHAR(36) NULL,
    ADD COLUMN `captureLeaseUntil` DATETIME(3) NULL,
    ADD INDEX `payment_attempts_captureLeaseUntil_idx`(`captureLeaseUntil`);
