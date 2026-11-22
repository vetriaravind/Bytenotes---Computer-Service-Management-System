/**
 * ByteNotes: Computer Service Center Management System
 * Backend Server Entry Point
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables reliably regardless of current working directory
dotenv.config({ path: path.join(__dirname, '.env') });

const { testConnection, query } = require('./config/db');
const { successResponse, errorResponse } = require('./utils/apiResponse');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const diagnosisRoutes = require('./routes/diagnosisRoutes');
const estimateRoutes = require('./routes/estimateRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const billingRoutes = require('./routes/billingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const warrantyRoutes = require('./routes/warrantyRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. GLOBAL MIDDLEWARES
// ==========================================

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Vite default port
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static directory for uploaded device photographs and invoice PDFs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple request logger for development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ==========================================
// 2. HEALTH CHECK & DIAGNOSTIC ROUTES
// ==========================================

/**
 * @route   GET /api/health
 * @desc    Verify server status and MySQL database connectivity
 * @access  Public
 */
app.get('/api/health', async (req, res) => {
  try {
    // Ping MySQL to verify active connection
    const [result] = await query('SELECT 1 + 1 AS solution, NOW() AS db_time');
    
    return successResponse(res, 200, 'ByteNotes API & Database is fully operational', {
      service: 'ByteNotes API',
      version: '1.0.0',
      status: 'UP',
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: true,
        ping_result: result.solution,
        server_time: result.db_time
      }
    });
  } catch (error) {
    return errorResponse(res, 503, 'ByteNotes API is running but Database connection failed', {
      error_code: error.code || 'DB_ERROR',
      message: error.message
    });
  }
});

// Root welcome route
app.get('/', (req, res) => {
  return successResponse(res, 200, 'Welcome to ByteNotes Computer Service Center API. Use /api/health for diagnostics.');
});

// ==========================================
// 3. API ROUTE MOUNTING (Populated in next phases)
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/diagnosis', diagnosisRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/warranties', warrantyRoutes);
app.use('/api/analytics', analyticsRoutes);

// ==========================================
// 4. ERROR HANDLING MIDDLEWARES
// ==========================================
app.use(notFound);
app.use(errorHandler);

// ==========================================
// 5. SERVER BOOTSTRAP
// ==========================================
const startServer = async () => {
  // Test MySQL connection pool
  await testConnection();

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 ByteNotes Backend Server running in [${process.env.NODE_ENV || 'development'}] mode`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📁 Uploads Directory: http://localhost:${PORT}/uploads`);
    console.log(`====================================================`);
  });
};

startServer();

module.exports = app;
