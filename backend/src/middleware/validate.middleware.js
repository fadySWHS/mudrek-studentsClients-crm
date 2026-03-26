const { validationResult } = require('express-validator');
const { error } = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'خطأ في البيانات المُدخلة', 422, errors.array());
  }
  next();
};

module.exports = validate;
