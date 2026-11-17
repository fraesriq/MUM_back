const repository = require('./lugares.repository');

exports.getAll = async () => repository.findAll();
exports.getBySlug = async (slug) => repository.findBySlug(slug);