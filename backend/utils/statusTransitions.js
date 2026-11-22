/**
 * Service Status State Machine & Transition Validation Engine
 * Enforces valid lifecycle state transitions across all 10 repair states (Module 6).
 */

const VALID_STATUSES = [
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
];

/**
 * Permitted transitions map:
 * Defines which states can legally transition to which next states.
 */
const ALLOWED_TRANSITIONS = {
  RECEIVED: [
    'UNDER_DIAGNOSIS',
    'CANCELLED'
  ],
  UNDER_DIAGNOSIS: [
    'WAITING_FOR_CUSTOMER_APPROVAL',
    'WAITING_FOR_SPARE_PARTS',
    'IN_PROGRESS', // Only if zero-cost or pre-approved
    'UNREPAIRABLE',
    'CANCELLED'
  ],
  WAITING_FOR_CUSTOMER_APPROVAL: [
    'IN_PROGRESS', // Customer approved estimate
    'WAITING_FOR_SPARE_PARTS',
    'CANCELLED', // Customer rejected estimate and cancelled
    'UNREPAIRABLE'
  ],
  WAITING_FOR_SPARE_PARTS: [
    'IN_PROGRESS', // Spare parts arrived
    'WAITING_FOR_CUSTOMER_APPROVAL', // Parts costs changed, needs revision
    'UNREPAIRABLE', // Parts obsolete / unavailable
    'CANCELLED'
  ],
  IN_PROGRESS: [
    'QUALITY_CHECK', // Repair finished, moving to testing
    'WAITING_FOR_SPARE_PARTS', // Additional component needed mid-repair
    'WAITING_FOR_CUSTOMER_APPROVAL', // Additional damage found, revised estimate
    'UNREPAIRABLE', // Motherboard unrepairable during rework
    'CANCELLED'
  ],
  QUALITY_CHECK: [
    'READY_FOR_DELIVERY', // Testing passed
    'IN_PROGRESS' // QC failed, back to workbench
  ],
  READY_FOR_DELIVERY: [
    'DELIVERED', // Customer paid and took device
    'QUALITY_CHECK' // Re-inspection
  ],
  DELIVERED: [
    // Terminal state - Device has been handed over.
    // If returning later, a new service request or warranty claim is opened!
  ],
  CANCELLED: [
    // Terminal state
  ],
  UNREPAIRABLE: [
    'READY_FOR_DELIVERY' // Returned unrepairable to customer intake desk
  ]
};

/**
 * Validates whether a status transition is permitted
 * @param {string} currentStatus - Current ticket status
 * @param {string} nextStatus - Desired new status
 * @returns {{ valid: boolean, error?: string }}
 */
const validateStatusTransition = (currentStatus, nextStatus) => {
  if (!VALID_STATUSES.includes(nextStatus)) {
    return {
      valid: false,
      error: `Invalid target status "${nextStatus}". Allowed statuses: ${VALID_STATUSES.join(', ')}`
    };
  }

  if (currentStatus === nextStatus) {
    return {
      valid: false,
      error: `Service ticket is already in status "${currentStatus}".`
    };
  }

  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(nextStatus)) {
    return {
      valid: false,
      error: `Illegal state transition from "${currentStatus}" to "${nextStatus}". Permitted next states from "${currentStatus}" are: [${allowedNext.join(', ') || 'None (Terminal state)'}].`
    };
  }

  return { valid: true };
};

module.exports = {
  VALID_STATUSES,
  ALLOWED_TRANSITIONS,
  validateStatusTransition
};
