/**
 * Invoice PDF & Printable Statement Service
 * Generates formatted downloadable invoice documents.
 */

const fs = require('fs');
const path = require('path');

class PdfService {
  /**
   * Generates a printable HTML/PDF invoice receipt and persists to uploads/invoices
   */
  static async generateInvoiceFile(invoiceData) {
    const fileName = `${invoiceData.invoice_number}.html`;
    const invoiceDir = path.join(__dirname, '../uploads/invoices');
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const filePath = path.join(invoiceDir, fileName);
    const publicUrl = `/uploads/invoices/${fileName}`;

    const itemsHtml = invoiceData.items
      .map(
        (it, idx) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>${it.description}</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${it.item_type}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${it.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(it.unit_price).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${parseFloat(it.total_price).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const paymentsHtml = (invoiceData.payments || [])
      .map(
        (p) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${p.payment_reference}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${p.payment_date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${p.payment_method}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${p.payment_type}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold;">₹${parseFloat(p.amount).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoiceData.invoice_number}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1f2937; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
    .badge { padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; }
    .paid { background-color: #dcfce7; color: #15803d; }
    .unpaid { background-color: #fee2e2; color: #b91c1c; }
    .partial { background-color: #fef3c7; color: #b45309; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background-color: #f8fafc; padding: 12px 10px; text-align: left; font-size: 13px; text-transform: uppercase; color: #64748b; }
    .totals { width: 350px; margin-left: auto; margin-top: 20px; }
    .totals tr td { padding: 6px 10px; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="background-color: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
  </div>
  
  <div class="header">
    <div>
      <h1 style="color: #2563eb; margin: 0;">ByteNotes</h1>
      <p style="margin: 2px 0; color: #64748b;">Computer Service Center & IT Solutions</p>
      <p style="margin: 2px 0; font-size: 13px;">108 Tech Park Avenue, Silicon Valley Road, Bengaluru</p>
      <p style="margin: 2px 0; font-size: 13px;">GSTIN: 29ABCDE1234F1Z5 | Phone: +91 98765 43210</p>
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0; color: #111827;">TAX INVOICE</h2>
      <p style="margin: 4px 0; font-weight: bold; font-size: 16px;">${invoiceData.invoice_number}</p>
      <p style="margin: 2px 0; font-size: 13px;">Date: ${invoiceData.invoice_date}</p>
      <p style="margin: 2px 0; font-size: 13px;">Ticket: <strong>${invoiceData.ticket_number}</strong></p>
      <span class="badge ${invoiceData.payment_status.toLowerCase()}">${invoiceData.payment_status}</span>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 25px;">
    <div>
      <h4 style="margin: 0 0 5px 0; color: #4b5563; text-transform: uppercase; font-size: 12px;">Billed To:</h4>
      <p style="margin: 0; font-weight: bold; font-size: 15px;">${invoiceData.customer_name}</p>
      <p style="margin: 2px 0; font-size: 13px;">Phone: ${invoiceData.customer_phone}</p>
      <p style="margin: 2px 0; font-size: 13px;">Email: ${invoiceData.customer_email || 'N/A'}</p>
      <p style="margin: 2px 0; font-size: 13px;">${invoiceData.customer_address || ''}</p>
    </div>
    <div style="text-align: right;">
      <h4 style="margin: 0 0 5px 0; color: #4b5563; text-transform: uppercase; font-size: 12px;">Serviced Device:</h4>
      <p style="margin: 0; font-weight: bold; font-size: 14px;">${invoiceData.device_brand} ${invoiceData.device_model}</p>
      <p style="margin: 2px 0; font-size: 13px;">Type: ${invoiceData.device_type} | S/N: ${invoiceData.device_serial}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>Item Description</th>
        <th style="text-align: center; width: 80px;">Type</th>
        <th style="text-align: center; width: 60px;">Qty</th>
        <th style="text-align: right; width: 100px;">Rate</th>
        <th style="text-align: right; width: 120px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <table style="margin: 0;">
      <tr>
        <td>Subtotal:</td>
        <td style="text-align: right; font-weight: bold;">₹${parseFloat(invoiceData.subtotal).toFixed(2)}</td>
      </tr>
      <tr>
        <td>Discount:</td>
        <td style="text-align: right; color: #16a34a;">-₹${parseFloat(invoiceData.discount_amount).toFixed(2)}</td>
      </tr>
      <tr>
        <td>GST (${parseFloat(invoiceData.tax_rate).toFixed(1)}%):</td>
        <td style="text-align: right;">₹${parseFloat(invoiceData.tax_amount).toFixed(2)}</td>
      </tr>
      <tr style="border-top: 2px solid #111827; border-bottom: 2px solid #111827;">
        <td style="font-weight: bold; font-size: 16px;">Total Amount:</td>
        <td style="text-align: right; font-weight: bold; font-size: 16px; color: #2563eb;">₹${parseFloat(invoiceData.total_amount).toFixed(2)}</td>
      </tr>
      <tr>
        <td>Paid Amount:</td>
        <td style="text-align: right; color: #15803d; font-weight: bold;">₹${parseFloat(invoiceData.paid_amount).toFixed(2)}</td>
      </tr>
      <tr style="background-color: #fef2f2;">
        <td style="font-weight: bold; color: #b91c1c;">Balance Due:</td>
        <td style="text-align: right; font-weight: bold; color: #b91c1c;">₹${parseFloat(invoiceData.balance_amount).toFixed(2)}</td>
      </tr>
    </table>
  </div>

  ${(invoiceData.payments && invoiceData.payments.length > 0) ? `
  <div style="margin-top: 30px;">
    <h4 style="margin: 0 0 10px 0; color: #4b5563; font-size: 13px; text-transform: uppercase;">Payment Transactions</h4>
    <table style="margin-top: 5px;">
      <thead>
        <tr>
          <th>Ref #</th>
          <th>Date</th>
          <th>Mode</th>
          <th>Type</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${paymentsHtml}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 12px; color: #6b7280; text-align: center;">
    <p style="margin: 2px;">Thank you for choosing ByteNotes! Goods once sold or serviced are covered under ByteNotes warranty policy.</p>
    <p style="margin: 2px;">This is a computer-generated tax invoice. No signature is required.</p>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(filePath, htmlContent, 'utf8');
    return publicUrl;
  }
}

module.exports = PdfService;
