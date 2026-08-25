-- Convert bookings.id from INT AUTO_INCREMENT → CHAR(36) UUID.
-- Safe to re-run: no-ops when id is already a string type.
-- Existing rows get new UUIDs (old numeric URLs / Yoco metadata stop matching).

SET NAMES utf8mb4;

SET @eoe_id_type := (
  SELECT DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bookings'
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

-- Already migrated (char / varchar / binary uuid)
SET @eoe_skip := IF(
  @eoe_id_type IN ('char', 'varchar', 'binary', 'varbinary'),
  1,
  0
);

SET @eoe_sql := IF(
  @eoe_skip = 1,
  'SELECT ''bookings.id already UUID-compatible'' AS migrate_bookings_uuid',
  'ALTER TABLE bookings ADD COLUMN id_uuid CHAR(36) NULL'
);
PREPARE eoe_stmt FROM @eoe_sql;
EXECUTE eoe_stmt;
DEALLOCATE PREPARE eoe_stmt;

SET @eoe_sql := IF(
  @eoe_skip = 1,
  'SELECT 1',
  'UPDATE bookings SET id_uuid = UUID() WHERE id_uuid IS NULL'
);
PREPARE eoe_stmt FROM @eoe_sql;
EXECUTE eoe_stmt;
DEALLOCATE PREPARE eoe_stmt;

SET @eoe_sql := IF(
  @eoe_skip = 1,
  'SELECT 1',
  'ALTER TABLE bookings DROP PRIMARY KEY, DROP COLUMN id, CHANGE id_uuid id CHAR(36) NOT NULL, ADD PRIMARY KEY (id)'
);
PREPARE eoe_stmt FROM @eoe_sql;
EXECUTE eoe_stmt;
DEALLOCATE PREPARE eoe_stmt;
