const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { login, me } = require('../controller/authcontroller');

router.post('/login', login);
router.get('/me', authMiddleware, me);

module.exports = router;
