-- ==============================================================================
-- BYTENOTES: INITIAL SEED DATA
-- Default Admin, Receptionist, Technician, Walk-in Customer & Sample Inventory
-- ==============================================================================

USE `bytenotes_db`;

-- Note: Default password for all seed accounts is: Password@123
-- Verified bcrypt hash: $2a$10$9IIpc3ikRfAjfi61SW2EpuqqYwc1kr3Q6KiI8TJP52cgXYVvPR3e.

-- 1. Insert Default Admin User
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `first_name`, `last_name`, `phone`, `is_active`)
VALUES (
  1,
  'admin',
  'admin@bytenotes.com',
  '$2a$10$9IIpc3ikRfAjfi61SW2EpuqqYwc1kr3Q6KiI8TJP52cgXYVvPR3e.',
  'ADMIN',
  'ByteNotes',
  'Administrator',
  '9876543210',
  TRUE
) ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- 2. Insert Default Receptionist User
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `first_name`, `last_name`, `phone`, `is_active`)
VALUES (
  2,
  'receptionist1',
  'reception@bytenotes.com',
  '$2a$10$9IIpc3ikRfAjfi61SW2EpuqqYwc1kr3Q6KiI8TJP52cgXYVvPR3e.',
  'RECEPTIONIST',
  'Anita',
  'Sharma',
  '9876543211',
  TRUE
) ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- 3. Insert Default Technician User & Profile
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `first_name`, `last_name`, `phone`, `is_active`)
VALUES (
  3,
  'tech_rahul',
  'rahul.tech@bytenotes.com',
  '$2a$10$9IIpc3ikRfAjfi61SW2EpuqqYwc1kr3Q6KiI8TJP52cgXYVvPR3e.',
  'TECHNICIAN',
  'Rahul',
  'Verma',
  '9876543212',
  TRUE
) ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

INSERT INTO `technicians` (`id`, `user_id`, `employee_code`, `specialization`, `experience_years`, `max_active_tickets`, `status`)
VALUES (
  1,
  3,
  'TECH-001',
  'Chip-level Motherboard & Laptop Display Repair',
  5,
  6,
  'AVAILABLE'
) ON DUPLICATE KEY UPDATE `employee_code` = `employee_code`;

-- 4. Insert Default Suppliers
INSERT INTO `suppliers` (`id`, `name`, `contact_person`, `phone`, `email`, `address`, `gst_number`, `is_active`)
VALUES
  (1, 'SuperTech Hardware Distributors', 'Vikas Gupta', '9811223344', 'sales@supertechhardware.com', 'Nehru Place, New Delhi', '07AAAAA0000A1Z5', TRUE),
  (2, 'Apex Silicon & Display Imports', 'Pooja Nair', '9822334455', 'orders@apexsilicon.com', 'SP Road, Bangalore', '29BBBBB1111B1Z2', TRUE)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- 5. Insert Initial Spare Parts Inventory
INSERT INTO `inventory` (`id`, `part_name`, `part_number`, `category`, `supplier_id`, `cost_price`, `selling_price`, `quantity_in_stock`, `reorder_threshold`, `location_bin`, `is_active`)
VALUES
  (1, 'Crucial BX500 500GB 2.5 Inch SATA SSD', 'SKU-SSD-500GB', 'STORAGE', 1, 2200.00, 3100.00, 15, 3, 'Bin-A1', TRUE),
  (2, 'Kingston NV2 1TB M.2 NVMe PCIe 4.0 SSD', 'SKU-SSD-1TB-NVME', 'STORAGE', 1, 4100.00, 5600.00, 8, 2, 'Bin-A2', TRUE),
  (3, 'Crucial 8GB DDR4 3200MHz Laptop RAM (SODIMM)', 'SKU-RAM-8GB-DDR4', 'RAM', 1, 1350.00, 1950.00, 20, 5, 'Bin-B1', TRUE),
  (4, 'Generic 15.6 Inch Full HD 30-Pin Slim LED Screen', 'SKU-DISP-156-FHD', 'DISPLAY', 2, 2800.00, 4200.00, 4, 2, 'Bin-D1', TRUE),
  (5, 'Thermal Grizzly Kryonaut Thermal Paste (1g)', 'SKU-THRM-GRZ-1G', 'FAN_HEATSINK', 2, 450.00, 750.00, 25, 5, 'Bin-C3', TRUE),
  (6, 'HP 65W Blue-Pin Laptop Power Adapter (Original)', 'SKU-ADPT-HP-65W', 'POWER_SUPPLY', 1, 950.00, 1600.00, 6, 2, 'Bin-P1', TRUE)
ON DUPLICATE KEY UPDATE `part_number` = `part_number`;
