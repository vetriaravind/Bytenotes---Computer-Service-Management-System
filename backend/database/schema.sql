-- ==============================================================================
-- BYTENOTES: COMPUTER SERVICE CENTER MANAGEMENT SYSTEM
-- Complete Normalized MySQL Database Schema
-- Database: bytenotes_db
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `bytenotes_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `bytenotes_db`;

-- Set strict SQL mode and disable foreign key checks temporarily during setup
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE (Core Authentication & System Accounts)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('ADMIN', 'RECEPTIONIST', 'TECHNICIAN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  `first_name` VARCHAR(50) NOT NULL,
  `last_name` VARCHAR(50) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `reset_password_token` VARCHAR(255) NULL,
  `reset_password_expires` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. CUSTOMERS TABLE (Walk-in & Registered Customers)
-- Prevents duplicate walk-ins via unique phone constraint.
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL UNIQUE,
  `first_name` VARCHAR(50) NOT NULL,
  `last_name` VARCHAR(50) NOT NULL,
  `phone` VARCHAR(20) NOT NULL UNIQUE,
  `email` VARCHAR(100) NULL,
  `alt_phone` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `city` VARCHAR(50) NULL,
  `state` VARCHAR(50) NULL,
  `postal_code` VARCHAR(20) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_customers_phone` (`phone`),
  INDEX `idx_customers_name` (`last_name`, `first_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. TECHNICIANS TABLE (Employee & Skill Profiles)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `technicians`;
CREATE TABLE `technicians` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `employee_code` VARCHAR(30) NOT NULL UNIQUE,
  `specialization` VARCHAR(100) NULL,
  `experience_years` INT NOT NULL DEFAULT 0,
  `max_active_tickets` INT NOT NULL DEFAULT 5,
  `status` ENUM('AVAILABLE', 'BUSY', 'ON_LEAVE', 'INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_technicians_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_technicians_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. DEVICES TABLE (Customer Assets Brought for Service)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `device_type` ENUM('LAPTOP', 'DESKTOP', 'PRINTER', 'MONITOR', 'OTHER') NOT NULL,
  `brand` VARCHAR(50) NOT NULL,
  `model` VARCHAR(100) NOT NULL,
  `serial_number` VARCHAR(100) NOT NULL,
  `processor` VARCHAR(100) NULL,
  `ram` VARCHAR(50) NULL,
  `storage` VARCHAR(100) NULL,
  `operating_system` VARCHAR(50) NULL,
  `physical_condition` TEXT NULL,
  `accessories_received` TEXT NULL,
  `password_pin` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_devices_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_devices_customer` (`customer_id`),
  INDEX `idx_devices_serial` (`serial_number`),
  INDEX `idx_devices_brand_model` (`brand`, `model`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. DEVICE ATTACHMENTS TABLE (Intake Condition Photos & Evidence)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `device_attachments`;
CREATE TABLE `device_attachments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `device_id` INT NOT NULL,
  `service_request_id` INT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `file_type` VARCHAR(50) NOT NULL,
  `caption` VARCHAR(255) NULL,
  `uploaded_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_attachments_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_attachments_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_attachments_device` (`device_id`),
  INDEX `idx_attachments_ticket` (`service_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. SERVICE REQUESTS TABLE (Central Repair Job Tickets)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `service_requests`;
CREATE TABLE `service_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_number` VARCHAR(30) NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `device_id` INT NOT NULL,
  `reported_issue` TEXT NOT NULL,
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM(
    'RECEIVED',
    'UNDER_DIAGNOSIS',
    'WAITING_FOR_CUSTOMER_APPROVAL',
    'WAITING_FOR_SPARE_PARTS',
    'IN_PROGRESS',
    'QUALITY_CHECK',
    'READY_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'UNREPAIRABLE'
  ) NOT NULL DEFAULT 'RECEIVED',
  `estimated_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `final_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `expected_delivery_date` DATE NULL,
  `actual_delivery_date` DATETIME NULL,
  `cancellation_reason` TEXT NULL,
  `unrepairable_reason` TEXT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_requests_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_requests_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_requests_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_requests_ticket` (`ticket_number`),
  INDEX `idx_requests_status` (`status`),
  INDEX `idx_requests_customer` (`customer_id`),
  INDEX `idx_requests_device` (`device_id`),
  INDEX `idx_requests_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. SERVICE ASSIGNMENTS TABLE (Technician Assignments & Reassignment History)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `service_assignments`;
CREATE TABLE `service_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `service_request_id` INT NOT NULL,
  `technician_id` INT NOT NULL,
  `assigned_by` INT NOT NULL,
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('ASSIGNED', 'ACCEPTED', 'REJECTED', 'TRANSFERRED', 'COMPLETED') NOT NULL DEFAULT 'ASSIGNED',
  `technician_notes` TEXT NULL,
  `rejection_reason` TEXT NULL,
  `is_current` BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT `fk_assignments_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_assignments_technician` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_assignments_assigner` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_assignments_lookup` (`service_request_id`, `is_current`),
  INDEX `idx_assignments_tech` (`technician_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. DIAGNOSIS REPORTS TABLE (Root-Cause Findings & Technical Diagnostics)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `diagnosis_reports`;
CREATE TABLE `diagnosis_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `service_request_id` INT NOT NULL,
  `technician_id` INT NOT NULL,
  `findings` TEXT NOT NULL,
  `root_cause` TEXT NOT NULL,
  `recommended_action` TEXT NOT NULL,
  `estimated_hours` DECIMAL(4, 1) NOT NULL DEFAULT 1.0,
  `estimated_labour_cost` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_diagnosis_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_diagnosis_tech` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_diagnosis_request` (`service_request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. STATUS HISTORY TABLE (Complete Lifecycle State Audit Log)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `status_history`;
CREATE TABLE `status_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `service_request_id` INT NOT NULL,
  `previous_status` VARCHAR(50) NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `changed_by` INT NOT NULL,
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_history_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_history_changer` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_history_request_time` (`service_request_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. REPAIR ESTIMATES TABLE (Quotation, Pricing & Customer Approval Gate)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `repair_estimates`;
CREATE TABLE `repair_estimates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `service_request_id` INT NOT NULL,
  `version_number` INT NOT NULL DEFAULT 1,
  `labour_charge` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `parts_total` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_estimate` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED') NOT NULL DEFAULT 'PENDING',
  `customer_notes` TEXT NULL,
  `rejection_reason` TEXT NULL,
  `response_date` DATETIME NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_estimates_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_estimates_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_estimates_request` (`service_request_id`),
  INDEX `idx_estimates_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 11. ESTIMATE ITEMS TABLE (Granular Line Items in Estimates)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `estimate_items`;
CREATE TABLE `estimate_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `estimate_id` INT NOT NULL,
  `inventory_id` INT NULL,
  `description` VARCHAR(255) NOT NULL,
  `item_type` ENUM('PART', 'LABOUR') NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  CONSTRAINT `fk_est_items_estimate` FOREIGN KEY (`estimate_id`) REFERENCES `repair_estimates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_est_items_estimate` (`estimate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 12. SUPPLIERS TABLE (Hardware Vendors & Parts Distributors)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `contact_person` VARCHAR(100) NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NULL,
  `address` TEXT NULL,
  `gst_number` VARCHAR(30) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_suppliers_name` (`name`),
  INDEX `idx_suppliers_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 13. INVENTORY TABLE (Spare Parts & Hardware Components Catalog)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `inventory`;
CREATE TABLE `inventory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `part_name` VARCHAR(100) NOT NULL,
  `part_number` VARCHAR(50) NOT NULL UNIQUE,
  `category` ENUM(
    'STORAGE',
    'RAM',
    'DISPLAY',
    'MOTHERBOARD',
    'KEYBOARD',
    'POWER_SUPPLY',
    'FAN_HEATSINK',
    'CABLE_CONNECTOR',
    'ACCESSORY',
    'OTHER'
  ) NOT NULL,
  `supplier_id` INT NULL,
  `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `selling_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `quantity_in_stock` INT NOT NULL DEFAULT 0,
  `reorder_threshold` INT NOT NULL DEFAULT 3,
  `location_bin` VARCHAR(50) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inventory_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_inventory_sku` (`part_number`),
  INDEX `idx_inventory_category` (`category`),
  INDEX `idx_inventory_stock` (`quantity_in_stock`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 14. STOCK TRANSACTIONS TABLE (Audit Trail for All Inventory Movements)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `stock_transactions`;
CREATE TABLE `stock_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `inventory_id` INT NOT NULL,
  `transaction_type` ENUM(
    'PURCHASE',
    'USED_IN_REPAIR',
    'RETURNED_BY_CUSTOMER',
    'DAMAGED_WRITE_OFF',
    'RESTOCKED_FROM_SUPPLIER',
    'ADJUSTMENT'
  ) NOT NULL,
  `quantity` INT NOT NULL,
  `unit_cost` DECIMAL(10, 2) NOT NULL,
  `reference_id` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_stock_inventory` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_stock_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_stock_inventory` (`inventory_id`),
  INDEX `idx_stock_type` (`transaction_type`),
  INDEX `idx_stock_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 15. REPAIR PARTS TABLE (Parts Consumed on a Given Service Ticket)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `repair_parts`;
CREATE TABLE `repair_parts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `service_request_id` INT NOT NULL,
  `inventory_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_cost` DECIMAL(10, 2) NOT NULL,
  `unit_price` DECIMAL(10, 2) NOT NULL,
  `total_price` DECIMAL(10, 2) NOT NULL,
  `used_by` INT NOT NULL,
  `used_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_repair_parts_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_repair_parts_inventory` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_repair_parts_user` FOREIGN KEY (`used_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_repair_parts_request` (`service_request_id`),
  INDEX `idx_repair_parts_inventory` (`inventory_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 16. INVOICES TABLE (Billing & Financial Statements)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `invoices`;
CREATE TABLE `invoices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_number` VARCHAR(30) NOT NULL UNIQUE,
  `service_request_id` INT NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  `tax_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `balance_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
  `invoice_date` DATE NOT NULL,
  `due_date` DATE NULL,
  `pdf_path` VARCHAR(255) NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_invoices_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_invoices_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_invoices_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_invoices_number` (`invoice_number`),
  INDEX `idx_invoices_customer` (`customer_id`),
  INDEX `idx_invoices_status` (`payment_status`),
  INDEX `idx_invoices_date` (`invoice_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 17. INVOICE ITEMS TABLE (Line Items Itemized on Invoices)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `invoice_items`;
CREATE TABLE `invoice_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` INT NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `item_type` ENUM('LABOUR', 'PART', 'DIAGNOSTIC_FEE', 'OTHER') NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  CONSTRAINT `fk_inv_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_inv_items_invoice` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 18. PAYMENTS TABLE (Advance, Partial & Full Financial Transactions)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_reference` VARCHAR(50) NOT NULL UNIQUE,
  `invoice_id` INT NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `payment_method` ENUM('CASH', 'UPI', 'CARD', 'BANK_TRANSFER') NOT NULL,
  `transaction_id` VARCHAR(100) NULL,
  `payment_type` ENUM('ADVANCE', 'PARTIAL', 'FINAL_SETTLEMENT') NOT NULL DEFAULT 'FINAL_SETTLEMENT',
  `notes` TEXT NULL,
  `received_by` INT NOT NULL,
  `payment_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_payments_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_receiver` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_payments_invoice` (`invoice_id`),
  INDEX `idx_payments_date` (`payment_date`),
  INDEX `idx_payments_method` (`payment_method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 19. NOTIFICATIONS TABLE (In-App Messaging & System Alerts)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('INFO', 'SUCCESS', 'WARNING', 'ALERT', 'STATUS_UPDATE') NOT NULL DEFAULT 'INFO',
  `reference_module` VARCHAR(50) NULL,
  `reference_id` VARCHAR(50) NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_notifications_user_read` (`user_id`, `is_read`),
  INDEX `idx_notifications_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 20. FEEDBACK TABLE (Customer Ratings, Reviews & Service Complaints)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `feedback`;
CREATE TABLE `feedback` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `service_request_id` INT NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `rating` INT NOT NULL,
  `comments` TEXT NULL,
  `is_complaint` BOOLEAN NOT NULL DEFAULT FALSE,
  `resolution_notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_feedback_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_feedback_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_feedback_rating` (`rating`),
  INDEX `idx_feedback_complaint` (`is_complaint`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 21. WARRANTIES TABLE (Repair Guarantee Tracking & Verification)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `warranties`;
CREATE TABLE `warranties` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `warranty_code` VARCHAR(30) NOT NULL UNIQUE,
  `service_request_id` INT NOT NULL,
  `device_id` INT NOT NULL,
  `warranty_period_days` INT NOT NULL DEFAULT 90,
  `start_date` DATE NOT NULL,
  `expiry_date` DATE NOT NULL,
  `terms` TEXT NULL,
  `status` ENUM('ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_warranties_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_warranties_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_warranties_code` (`warranty_code`),
  INDEX `idx_warranties_device_status` (`device_id`, `status`),
  INDEX `idx_warranties_expiry` (`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks after table creation
SET FOREIGN_KEY_CHECKS = 1;
