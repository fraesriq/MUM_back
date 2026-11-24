const { z } = require('zod');

const positiveId = z.string().regex(/^[1-9]\d*$/, 'El identificador debe ser un entero positivo').transform(Number).refine(Number.isSafeInteger, 'El identificador debe ser un entero positivo');
const coordinate = (min, max, name) => z.number().min(min, `${name} no puede ser menor que ${min}`).max(max, `${name} no puede ser mayor que ${max}`).refine((value) => Math.abs(value * 1e7 - Math.round(value * 1e7)) < 1e-8, `${name} puede tener hasta 7 decimales`);
const mapUrl = z.string().trim().max(1024, 'url_mapa no puede superar 1024 caracteres').url('url_mapa debe ser una URL válida').refine((value) => /^https?:\/\//i.test(value), 'url_mapa debe usar HTTP o HTTPS').nullable();
const fields = {
  latitud: coordinate(-90, 90, 'latitud'),
  longitud: coordinate(-180, 180, 'longitud'),
  url_mapa: mapUrl.optional().default(null),
  confirmada: z.boolean().optional().default(false),
};

const createCoordenadaSchema = z.object(fields).strict();
const updateCoordenadaSchema = z.object({
  latitud: fields.latitud.optional(), longitud: fields.longitud.optional(), url_mapa: mapUrl.optional(), confirmada: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');
const idParamSchema = z.object({ id: positiveId }).strict();
const paginationQuerySchema = z.object({
  page: positiveId.optional().default(1),
  limit: positiveId.refine((value) => value <= 100, 'limit no puede superar 100').optional().default(20),
}).strict();

module.exports = { createCoordenadaSchema, updateCoordenadaSchema, idParamSchema, paginationQuerySchema };
