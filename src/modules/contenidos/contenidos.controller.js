const service = require('./contenidos.service');

exports.getAprobados = async (req, res, next) => {
  try { res.json(await service.getAprobados(req.query)); } catch (e) { next(e); }
};
exports.getAll = async (req, res, next) => {
  try { res.json(await service.getAll(req.query)); } catch (e) { next(e); }
};
exports.getById = async (req, res, next) => {
  try { res.json(await service.getById(req.params.id)); } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try { res.status(201).json(await service.create(req.body)); } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  try { res.json(await service.update(req.params.id, req.body)); } catch (e) { next(e); }
};
exports.aprobar = async (req, res, next) => {
  try { res.json(await service.aprobar(req.params.id, req.body)); } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try { res.json(await service.remove(req.params.id)); } catch (e) { next(e); }
};