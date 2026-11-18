const service = require('./especies.service');

exports.getAll = async (req, res, next) => {
  try {
    const especies = await service.getAll({ categoria: req.query.categoria });
    res.json(especies);
  } catch (error) { next(error); }
};

exports.getBySlug = async (req, res, next) => {
  try {
    const especie = await service.getBySlug(req.params.slug);
    if (!especie) return res.status(404).json({ message: 'Especie no encontrada' });
    res.json(especie);
  } catch (error) { next(error); }
};
