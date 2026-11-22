/**
 * Service Ticket Identifier Generator
 * Formats standardized, collision-resistant ticket codes: BN-YYYY-XXXX
 * Example: BN-2026-0001
 */

const { query } = require('../config/db');

/**
 * Generates the next sequential ticket number for the current year
 * @returns {Promise<string>} Next ticket number e.g. "BN-2026-0001"
 */
const generateTicketNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const prefix = `BN-${year}-`;

  // Find the highest sequence number for the current year
  const sql = `
    SELECT ticket_number
    FROM service_requests
    WHERE ticket_number LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `;
  const rows = await query(sql, [`${prefix}%`]);

  let nextSequence = 1;

  if (rows.length > 0 && rows[0].ticket_number) {
    const lastTicket = rows[0].ticket_number;
    const parts = lastTicket.split('-');
    if (parts.length >= 3) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextSequence = lastSeq + 1;
      }
    }
  }

  const paddedSequence = String(nextSequence).padStart(4, '0');
  return `${prefix}${paddedSequence}`;
};

module.exports = {
  generateTicketNumber
};
