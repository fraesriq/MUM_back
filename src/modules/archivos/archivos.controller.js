const service = require('./archivos.service');

exports.requestUpload = async (req, res, next) => { try { res.status(201).json(await service.requestUpload({ ...req.body, application_client_id: req.application.clientId })); } catch (error) { next(error); } };
exports.confirmUpload = async (req, res, next) => { try { res.status(201).json(await service.confirmUpload({ ...req.body, application_client_id: req.application.clientId })); } catch (error) { next(error); } };
exports.processCleanup = async (req, res, next) => { try { res.json(await service.processCleanup(req.body)); } catch (error) { next(error); } };
exports.getAll = async (req, res, next) => { try { res.json(await service.getAll(req.query)); } catch (error) { next(error); } };
exports.getById = async (req, res, next) => { try { res.json(await service.getById(req.params.id)); } catch (error) { next(error); } };
exports.update = async (req, res, next) => { try { res.json(await service.update(req.params.id, req.body)); } catch (error) { next(error); } };
exports.remove = async (req, res, next) => { try { res.json(await service.remove(req.params.id)); } catch (error) { next(error); } };
