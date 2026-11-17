const service = require('./categorias.service');

exports.getAll = async (req, res, next) => {
  try {
    const categorias = await service.getAll();
    res.json(categorias);
  } catch (error) { next(error); }
};