/**
 * Cryptographic Utility for Securing Sensitive Information at Rest
 * Used to encrypt device unlock PINs and passwords so they are never stored in plaintext.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'bytenotes_secure_pin_key_2026').digest();
const IV_LENGTH = 16;

/**
 * Encrypts a plaintext string (e.g. device unlock PIN)
 * Returns string format: "iv:encryptedData" in hex
 */
function encryptPin(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted hex string back to plaintext
 */
function decryptPin(encryptedText) {
  if (!encryptedText) return null;
  try {
    const textParts = encryptedText.split(':');
    if (textParts.length !== 2) {
      // If it's already masked or older plaintext, return as is or masked
      return encryptedText;
    }
    const iv = Buffer.from(textParts[0], 'hex');
    const encrypted = textParts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '••••••••';
  }
}

/**
 * Masks a PIN/password for display (e.g. "•••• 1234" or "••••••••")
 */
function maskPin(pin) {
  if (!pin) return null;
  const plain = decryptPin(pin);
  if (!plain) return null;
  if (plain.length <= 4) return '••••';
  return '••••' + plain.slice(-2);
}

module.exports = {
  encryptPin,
  decryptPin,
  maskPin
};
