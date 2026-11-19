module.exports = (err, req, res, next) => {
  console.error(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    message: status === 500 ? 'Error interno del servidor' : err.message || 'Error de solicitud',
  });
};
