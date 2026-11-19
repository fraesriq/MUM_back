require('../config/zod');

const validate = (schema, property = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[property]);
  if (!result.success) {
    return res.status(400).json({
      error: 'Error de validación',
      details: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  req[property] = result.data;
  next();
};

module.exports = validate;
