/**
 * Device Controller
 * Manages device registration, hardware specifications, intake photographs, and multi-visit repair history (Module 3).
 */

const DeviceModel = require('../models/deviceModel');
const CustomerModel = require('../models/customerModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class DeviceController {
  /**
   * @route   POST /api/devices
   * @desc    Register a new customer device
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async createDevice(req, res, next) {
    try {
      let {
        customerId,
        deviceType,
        brand,
        model,
        serialNumber,
        processor,
        ram,
        storage,
        operatingSystem,
        physicalCondition,
        accessoriesReceived,
        passwordPin
      } = req.body;

      if (req.user.role === 'CUSTOMER') {
        customerId = req.user.customer_profile_id;
      }

      if (!customerId || !deviceType || !brand || !model || !serialNumber) {
        return errorResponse(res, 400, 'Customer ID, Device Type, Brand, Model, and Serial Number are required.');
      }

      // 1. Verify customer exists
      const customer = await CustomerModel.findById(customerId);
      if (!customer) {
        return errorResponse(res, 404, `Customer with ID ${customerId} does not exist.`);
      }

      // 2. Check if a device with this serial number has already been registered (Real-World Scenario 1)
      const existingDevices = await DeviceModel.findBySerialNumber(serialNumber);
      if (existingDevices.length > 0) {
        const matched = existingDevices.find((d) => d.customer_id === parseInt(customerId, 10));
        if (matched) {
          // The same customer is bringing in their previously registered device
          const history = await DeviceModel.getRepairHistory(matched.id);
          return successResponse(
            res,
            200,
            `Device already registered to this customer. Loaded existing hardware profile with ${history.length} previous service visit(s).`,
            {
              device: matched,
              isExisting: true,
              previousVisits: history.length
            }
          );
        }
      }

      // 3. Register new device
      const deviceId = await DeviceModel.createDevice({
        customerId,
        deviceType,
        brand,
        model,
        serialNumber,
        processor,
        ram,
        storage,
        operatingSystem,
        physicalCondition,
        accessoriesReceived,
        passwordPin
      });

      const newDevice = await DeviceModel.findById(deviceId);

      return successResponse(res, 201, 'Device registered successfully', {
        device: newDevice,
        isExisting: false
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/devices
   * @desc    Get devices with search and filter (auto-filtered for customers)
   * @access  Protected
   */
  static async getDevices(req, res, next) {
    try {
      const { search, limit = 50, page = 1 } = req.query;
      let customerId = req.query.customerId || null;

      if (req.user.role === 'CUSTOMER') {
        customerId = req.user.customer_profile_id;
      }

      const result = await DeviceModel.listDevices({
        customerId,
        search,
        limit: parseInt(limit, 10),
        page: parseInt(page, 10)
      });

      return successResponse(res, 200, 'Devices retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/devices/:id
   * @desc    Get device specifications, intake attachments, and owner info
   * @access  Protected
   */
  static async getDeviceById(req, res, next) {
    try {
      const { id } = req.params;
      const device = await DeviceModel.findById(id);

      if (!device) {
        return errorResponse(res, 404, `Device with ID ${id} was not found.`);
      }

      // Fetch intake photos/attachments
      const attachments = await DeviceModel.getAttachments(id);

      return successResponse(res, 200, 'Device details retrieved successfully', {
        device,
        attachments
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/devices/customer/:customerId
   * @desc    Get all devices owned by a specific customer
   * @access  Protected
   */
  static async getDevicesByCustomer(req, res, next) {
    try {
      const { customerId } = req.params;
      const customer = await CustomerModel.findById(customerId);

      if (!customer) {
        return errorResponse(res, 404, `Customer with ID ${customerId} was not found.`);
      }

      const devices = await CustomerModel.getDevices(customerId);

      return successResponse(res, 200, 'Customer devices retrieved successfully', {
        customer_id: customerId,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        devices
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/devices/:id
   * @desc    Update device specifications, unlock PIN, or condition
   * @access  Protected (ADMIN, RECEPTIONIST, TECHNICIAN)
   */
  static async updateDevice(req, res, next) {
    try {
      const { id } = req.params;
      const device = await DeviceModel.findById(id);

      if (!device) {
        return errorResponse(res, 404, `Device with ID ${id} was not found.`);
      }

      const {
        deviceType,
        brand,
        model,
        serialNumber,
        processor,
        ram,
        storage,
        operatingSystem,
        physicalCondition,
        accessoriesReceived,
        passwordPin
      } = req.body;

      await DeviceModel.updateDevice(id, {
        deviceType: deviceType || device.device_type,
        brand: brand || device.brand,
        model: model || device.model,
        serialNumber: serialNumber || device.serial_number,
        processor: processor !== undefined ? processor : device.processor,
        ram: ram !== undefined ? ram : device.ram,
        storage: storage !== undefined ? storage : device.storage,
        operatingSystem: operatingSystem !== undefined ? operatingSystem : device.operating_system,
        physicalCondition: physicalCondition !== undefined ? physicalCondition : device.physical_condition,
        accessoriesReceived: accessoriesReceived !== undefined ? accessoriesReceived : device.accessories_received,
        passwordPin: passwordPin !== undefined ? passwordPin : device.password_pin
      });

      const updatedDevice = await DeviceModel.findById(id);

      return successResponse(res, 200, 'Device specifications updated successfully', {
        device: updatedDevice
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/devices/:id/attachments
   * @desc    Upload device intake photos documenting pre-existing condition (Scenario 11)
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async uploadIntakePhotos(req, res, next) {
    try {
      const { id } = req.params;
      const { serviceRequestId, caption } = req.body;

      const device = await DeviceModel.findById(id);
      if (!device) {
        return errorResponse(res, 404, `Device with ID ${id} was not found.`);
      }

      if (!req.files || req.files.length === 0) {
        return errorResponse(res, 400, 'Please select at least one photograph to upload.');
      }

      const savedAttachments = [];

      for (const file of req.files) {
        const filePath = `/uploads/devices/${file.filename}`;
        const attachmentId = await DeviceModel.addAttachment({
          deviceId: id,
          serviceRequestId: serviceRequestId || null,
          fileName: file.originalname,
          filePath,
          fileType: file.mimetype,
          caption: caption || 'Intake condition photograph',
          uploadedBy: req.user.id
        });

        savedAttachments.push({
          id: attachmentId,
          fileName: file.originalname,
          filePath,
          caption: caption || 'Intake condition photograph'
        });
      }

      return successResponse(res, 201, `${savedAttachments.length} intake photo(s) uploaded successfully`, {
        device_id: id,
        attachments: savedAttachments
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/devices/:id/history
   * @desc    Get complete historical repair timeline of this hardware device (Scenario 1 & 11)
   * @access  Protected
   */
  static async getDeviceHistory(req, res, next) {
    try {
      const { id } = req.params;
      const device = await DeviceModel.findById(id);

      if (!device) {
        return errorResponse(res, 404, `Device with ID ${id} was not found.`);
      }

      const repairHistory = await DeviceModel.getRepairHistory(id);
      const attachments = await DeviceModel.getAttachments(id);

      return successResponse(res, 200, 'Device repair history retrieved successfully', {
        device,
        total_visits: repairHistory.length,
        history: repairHistory,
        attachments
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DeviceController;
