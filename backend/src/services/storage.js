const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

function read(filePath) {
  const fullPath = path.join(DATA_DIR, filePath);
  try {
    const raw = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(filePath, data) {
  const fullPath = path.join(DATA_DIR, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { read, write };
