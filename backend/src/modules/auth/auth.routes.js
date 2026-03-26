const express = require('express');
const { body } = require('express-validator');
const { login, me } = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');

const router = express.Router();

router.post('/login',
  [
    body('email').isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
    body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
  ],
  validate,
  login
);

router.get('/me', authenticate, me);

module.exports = router;
