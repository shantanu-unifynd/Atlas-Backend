const multer = require("multer");

// Buffers in memory only; the service computes the checksum and hands the
// buffer to the storage abstraction, which decides where bytes actually go.
// MIME-type acceptance is a business rule (see blueprintImport.service.js),
// not enforced here.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = upload;
