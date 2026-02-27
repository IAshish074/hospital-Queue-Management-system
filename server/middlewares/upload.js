const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Auto-create folder if missing
const uploadPath = path.join(__dirname, '..', 'public', 'images', 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const unique = uuidv4();
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

module.exports = upload;
