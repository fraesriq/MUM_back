const service = require('./galeria.service');

exports.getAll = async (req, res, next) => {
  try { res.json(await service.getAll(req.query)); } catch (e) { next(e); }
};
exports.getById = async (req, res, next) => {
  try { res.json(await service.getById(req.params.id)); } catch (e) { next(e); }
};
