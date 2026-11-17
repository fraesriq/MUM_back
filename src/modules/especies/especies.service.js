const repository = require('./especies.repository');

exports.getAll = async (filtros) => repository.findAll(filtros);
exports.getBySlug = async (slug) => repository.findBySlug(slug);