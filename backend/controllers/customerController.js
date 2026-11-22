/**
 * Customer Controller
 * Manages customer registration, search, deduplication, and service history (Module 2).
 */

const CustomerModel = require('../models/customerModel');
const { successResponse, errorResponse } = require('../utils/apiResponse');

class CustomerController {
  /**
   * @route   POST /api/customers
   * @desc    Register a new customer (Prevents duplicate phone numbers)
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async createCustomer(req, res, next) {
    try {
      const { firstName, lastName, phone, email, altPhone, address, city, state, postalCode, notes } = req.body;

      if (!firstName || !lastName || !phone) {
        return errorResponse(res, 400, 'First name, last name, and primary phone number are required.');
      }

      // 1. Duplicate Prevention: Check if customer with this phone number already exists
      const existingCustomer = await CustomerModel.findByPhone(phone);
      if (existingCustomer) {
        return errorResponse(
          res,
          409,
          `A customer with phone number ${phone} is already registered as "${existingCustomer.first_name} ${existingCustomer.last_name}" (Customer ID: ${existingCustomer.id}).`,
          { existingCustomerId: existingCustomer.id }
        );
      }

      // 2. Create customer
      const customerId = await CustomerModel.createCustomer({
        firstName,
        lastName,
        phone,
        email,
        altPhone,
        address,
        city,
        state,
        postalCode,
        notes
      });

      const newCustomer = await CustomerModel.findById(customerId);

      return successResponse(res, 201, 'Customer registered successfully', {
        customer: newCustomer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/customers
   * @desc    Search and paginate customers (by name, phone, email)
   * @access  Protected (ADMIN, RECEPTIONIST, TECHNICIAN)
   */
  static async getCustomers(req, res, next) {
    try {
      const { search = '', page = 1, limit = 10 } = req.query;

      const result = await CustomerModel.searchCustomers({
        search,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });

      return successResponse(res, 200, 'Customers retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/customers/:id
   * @desc    Get customer details by ID with device summary
   * @access  Protected
   */
  static async getCustomerById(req, res, next) {
    try {
      const { id } = req.params;
      const customer = await CustomerModel.findById(id);

      if (!customer) {
        return errorResponse(res, 404, `Customer with ID ${id} was not found.`);
      }

      // Fetch devices owned by this customer
      const devices = await CustomerModel.getDevices(id);

      return successResponse(res, 200, 'Customer details retrieved successfully', {
        customer,
        devices
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PUT /api/customers/:id
   * @desc    Update customer details
   * @access  Protected (ADMIN, RECEPTIONIST)
   */
  static async updateCustomer(req, res, next) {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, altPhone, address, city, state, postalCode, notes } = req.body;

      const customer = await CustomerModel.findById(id);
      if (!customer) {
        return errorResponse(res, 404, `Customer with ID ${id} was not found.`);
      }

      await CustomerModel.updateCustomer(id, {
        firstName: firstName || customer.first_name,
        lastName: lastName || customer.last_name,
        email: email !== undefined ? email : customer.email,
        altPhone: altPhone !== undefined ? altPhone : customer.alt_phone,
        address: address !== undefined ? address : customer.address,
        city: city !== undefined ? city : customer.city,
        state: state !== undefined ? state : customer.state,
        postalCode: postalCode !== undefined ? postalCode : customer.postal_code,
        notes: notes !== undefined ? notes : customer.notes
      });

      const updatedCustomer = await CustomerModel.findById(id);

      return successResponse(res, 200, 'Customer information updated successfully', {
        customer: updatedCustomer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   DELETE /api/customers/:id
   * @desc    Delete customer record if no active service history exists
   * @access  Protected (ADMIN)
   */
  static async deleteCustomer(req, res, next) {
    try {
      const { id } = req.params;
      const customer = await CustomerModel.findById(id);
      if (!customer) {
        return errorResponse(res, 404, `Customer with ID ${id} was not found.`);
      }

      await CustomerModel.deleteCustomer(id);

      return successResponse(res, 200, `Customer "${customer.first_name} ${customer.last_name}" successfully removed.`);
    } catch (error) {
      return errorResponse(res, 400, error.message);
    }
  }

  /**
   * @route   GET /api/customers/:id/devices
   * @desc    Get all devices owned by a customer (Real-World Scenario 15)
   * @access  Protected
   */
  static async getCustomerDevices(req, res, next) {
    try {
      const { id } = req.params;
      const customer = await CustomerModel.findById(id);

      if (!customer) {
        return errorResponse(res, 404, `Customer with ID ${id} was not found.`);
      }

      const devices = await CustomerModel.getDevices(id);

      return successResponse(res, 200, 'Customer devices retrieved successfully', {
        customer_id: id,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        total: devices.length,
        devices
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/customers/:id/history
   * @desc    Get complete service and invoice history for a customer
   * @access  Protected
   */
  static async getCustomerHistory(req, res, next) {
    try {
      const { id } = req.params;
      const customer = await CustomerModel.findById(id);

      if (!customer) {
        return errorResponse(res, 404, `Customer with ID ${id} was not found.`);
      }

      const history = await CustomerModel.getServiceHistory(id);

      return successResponse(res, 200, 'Customer service history retrieved successfully', {
        customer_id: id,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        total_tickets: history.length,
        history
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CustomerController;
