const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const doctorController = require('../controllers/doctorController');

router.post('/add', upload.single('image'), (req, res, next) => {
    console.log('Body:', req.body);
    console.log('File:', req.file);
    next();}, doctorController.addDoctor);
router.post('/hospital/:hospitalId',upload.single('image'), doctorController.getDoctorsByHospital);
router.get('/:doctorId', doctorController.getDoctorById);

module.exports = router;
