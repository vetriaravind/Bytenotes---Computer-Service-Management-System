/**
 * Inventory Controller
 * Manages spare parts catalog, supplier restocking, low-stock alerts & parts consumption (Module 8).
 */

const InventoryModel = require('../models/inventoryModel');
const ServiceRequestModel = require('../models/serviceRequestModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class InventoryController {
  static async getParts(req, res, next) {
    try {
      const { category = '', lowStockOnly = 'false', search = '', page = 1, limit = 20 } = req.query;

      const result = await InventoryModel.listParts({
        category,
        lowStockOnly: lowStockOnly === 'true',
        search,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });

      return successResponse(res, 200, 'Inventory parts catalog retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async getPartById(req, res, next) {
    try {
      const { id } = req.params;
      const part = await InventoryModel.findById(id);
      if (!part) return errorResponse(res, 404, `Part with ID ${id} was not found.`);

      const transactions = await InventoryModel.getTransactionHistory(id);

      return successResponse(res, 200, 'Part details retrieved successfully', {
        part,
        transactions
      });
    } catch (error) {
      next(error);
    }
  }

  static async createPart(req, res, next) {
    try {
      const { partName, partNumber, category, supplierId, costPrice, sellingPrice, quantityInStock, reorderThreshold, locationBin } = req.body;

      if (!partName || !partNumber || !category) {
        return errorResponse(res, 400, 'Part Name, Part Number (SKU), and Category are required.');
      }

      const partId = await InventoryModel.createPart({
        partName,
        partNumber,
        category,
        supplierId,
        costPrice,
        sellingPrice,
        quantityInStock,
        reorderThreshold,
        locationBin
      });

      const newPart = await InventoryModel.findById(partId);

      return successResponse(res, 201, 'Spare part registered in catalog successfully', {
        part: newPart
      });
    } catch (error) {
      next(error);
    }
  }

  static async restockPart(req, res, next) {
    try {
      const { id } = req.params;
      const { quantity, unitCost, referenceId, notes } = req.body;

      if (!quantity || !unitCost) {
        return errorResponse(res, 400, 'Restock quantity and unitCost are required.');
      }

      await InventoryModel.restock({
        inventoryId: id,
        quantity,
        unitCost,
        referenceId,
        notes,
        createdBy: req.user.id
      });

      const updated = await InventoryModel.findById(id);

      return successResponse(res, 200, `Successfully restocked ${quantity} unit(s).`, {
        part: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Consume part on a repair ticket (Scenario 8)
   */
  static async consumePart(req, res, next) {
    try {
      const { serviceRequestId, inventoryId, quantity = 1, notes } = req.body;

      if (!serviceRequestId || !inventoryId) {
        return errorResponse(res, 400, 'Service Request ID and Inventory ID are required.');
      }

      const ticket = await ServiceRequestModel.findById(serviceRequestId);
      if (!ticket) return errorResponse(res, 404, `Ticket with ID ${serviceRequestId} not found.`);

      if (['DELIVERED', 'CANCELLED', 'UNREPAIRABLE'].includes(ticket.status)) {
        return errorResponse(res, 400, `Cannot install parts on ticket in status "${ticket.status}".`);
      }

      const result = await InventoryModel.consumePartForRepair({
        serviceRequestId,
        inventoryId,
        quantity,
        usedBy: req.user.id,
        notes
      });

      return successResponse(res, 201, `Successfully installed ${result.quantityUsed}x "${result.partName}" on ticket #${serviceRequestId}. Inventory automatically decremented (Scenario 8).`, {
        consumption: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async recordAdjustment(req, res, next) {
    try {
      const { inventoryId, type, quantity, reason } = req.body;

      if (!inventoryId || !type || !quantity || !reason) {
        return errorResponse(res, 400, 'Inventory ID, adjustment type (DAMAGED_WRITE_OFF / RETURNED_BY_CUSTOMER), quantity, and reason are required.');
      }

      await InventoryModel.recordAdjustment({
        inventoryId,
        type,
        quantity,
        reason,
        createdBy: req.user.id
      });

      const updated = await InventoryModel.findById(inventoryId);

      return successResponse(res, 200, 'Inventory adjustment recorded successfully', {
        part: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTicketParts(req, res, next) {
    try {
      const { serviceRequestId } = req.params;
      const parts = await InventoryModel.getPartsUsedOnTicket(serviceRequestId);

      return successResponse(res, 200, 'Installed parts retrieved successfully', {
        service_request_id: serviceRequestId,
        total_parts: parts.length,
        parts
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSuppliers(req, res, next) {
    try {
      const suppliers = await InventoryModel.listSuppliers();
      return successResponse(res, 200, 'Suppliers retrieved successfully', {
        total: suppliers.length,
        suppliers
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSupplier(req, res, next) {
    try {
      const { name, contactPerson, phone, email, address, gstNumber } = req.body;
      if (!name || !phone) return errorResponse(res, 400, 'Supplier Name and primary Phone are required.');

      const supplierId = await InventoryModel.createSupplier({ name, contactPerson, phone, email, address, gstNumber });
      return successResponse(res, 201, 'Supplier registered successfully', { supplierId });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InventoryController;
