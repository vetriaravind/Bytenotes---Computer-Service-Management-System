/**
 * Multer File Upload Configuration
 * Handles device intake photos, damage evidence, and receipts.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const deviceUploadDir = path.join(__dirname, '../uploads/devices');
const invoiceUploadDir = path.join(__dirname, '../uploads/invoices');

[deviceUploadDir, invoiceUploadDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, deviceUploadDir);
  },
  filename: (req, file, cb) => {
    // Format: device-<deviceId>-<timestamp>-<random>.ext
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `device-${uniqueSuffix}${ext}`);
  }
});

// File filter: accept image formats only
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only JPEG, PNG, and WebP images are permitted for device photos.'), false);
  }
};

// Max file size: 5MB
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

module.exports = upload;
