const { v4: uuidv4 } = require('uuid');

function generateOrderNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase();
  return `MT${year}${month}${day}${random}`;
}

module.exports = { generateOrderNo };
