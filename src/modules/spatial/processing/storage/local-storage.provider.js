const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const STORAGE_DIR = path.join(__dirname, "../../../../../uploads/blueprint-imports");

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const PROVIDER_NAME = "local";

async function save(buffer, originalFilename) {
  const storageKey = `${crypto.randomUUID()}${path.extname(originalFilename)}`;

  await fs.promises.writeFile(path.join(STORAGE_DIR, storageKey), buffer);

  return { storageProvider: PROVIDER_NAME, storageKey };
}

function getAbsolutePath(storageKey) {
  return path.join(STORAGE_DIR, storageKey);
}

async function exists(storageKey) {
  try {
    await fs.promises.access(getAbsolutePath(storageKey));
    return true;
  } catch {
    return false;
  }
}

async function read(storageKey) {
  return fs.promises.readFile(getAbsolutePath(storageKey));
}

module.exports = {
  name: PROVIDER_NAME,
  save,
  getAbsolutePath,
  exists,
  read,
};
