-- Add bookings.special_request (occasion / prep notes). Safe to re-run.

SET NAMES utf8mb4;

SET @eoe_sr := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'special_request'
);
SET @eoe_sql := IF(@eoe_sr = 0,
  'ALTER TABLE bookings ADD COLUMN special_request TEXT NULL AFTER notes',
  'SELECT ''special_request already exists'' AS migrate_special_request');
PREPARE eoe_stmt FROM @eoe_sql;
EXECUTE eoe_stmt;
DEALLOCATE PREPARE eoe_stmt;
