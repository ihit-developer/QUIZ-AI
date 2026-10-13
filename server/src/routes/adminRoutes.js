const express = require('express');
const router = express.Router();
const {
  getAdminStats,
  getUsers,
  toggleBlockUser,
  updateUser,
  deleteUser,
  getAuditLogs,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/users', getUsers);
router.put('/users/:userId/block', toggleBlockUser);
router.put('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
