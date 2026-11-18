const service = require('./lugares.service');

exports.getAll = async (req, res, next) => {
  try {
    const lugares = await service.getAll();
    res.json(lugares);
  } catch (error) { next(error); }
};

exports.getBySlug = async (req, res, next) => {
  try {
    const lugar = await service.getBySlug(req.params.slug);
    if (!lugar) return res.status(404).json({ message: 'Lugar no encontrado' });
    res.json(lugar);
  } catch (error) { next(error); }
};