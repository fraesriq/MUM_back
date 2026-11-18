const repository = require('./categorias.repository');

exports.getAll = async () => repository.findAll();