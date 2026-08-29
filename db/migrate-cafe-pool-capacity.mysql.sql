-- Café table + car wash share one seating pool (20 guests per slot combined).
-- Safe to re-run.
UPDATE services
   SET capacity = 20, updated_at = NOW(3)
 WHERE slug IN ('cafe-table-reservation', 'cafe-table-car-wash');
