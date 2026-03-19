-- Drop the status column from maintenance_records.
-- Records are always completed (they log work already done),
-- so this column was always 'completed' and provides no value.
ALTER TABLE maintenance_records
DROP COLUMN status;