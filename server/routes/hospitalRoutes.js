const express = require('express');
const { 
  addHospital, 
  getHospitals, 
  getHospitalById,
  addDoctorToHospital,
  removeDoctorFromHospital,
  addAdminToHospital,
  removeAdminFromHospital
} = require('../controllers/hospitalController');

const upload = require('../middlewares/upload');

const router = express.Router();

// Route to add a new hospital
router.post('/add', upload.single('image'), addHospital);

// Route to get all hospitals
router.get('/hospitalData', getHospitals);

// Route to get a hospital by ID
router.get('/:hospitalId', getHospitalById);

// Routes for adding/removing doctors
router.post('/add-doctor', addDoctorToHospital);
router.post('/remove-doctor', removeDoctorFromHospital);

// Routes for adding/removing admins
router.post('/add-admin', addAdminToHospital);
router.post('/remove-admin', removeAdminFromHospital);

module.exports = router;
