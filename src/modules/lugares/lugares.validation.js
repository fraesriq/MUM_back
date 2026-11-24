const { z } = require('zod');

const positiveId = (name) => z.number().int(`${name} debe ser entero`).refine(Number.isSafeInteger, `${name} debe ser seguro`).positive(`${name} debe ser positivo`);
const parsedPositive = (name) => z.string().regex(/^\d+$/, `${name} debe ser un entero positivo`).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0, `${name} debe ser un entero positivo seguro`);
const orden = z.number().int('orden debe ser entero').min(0, 'orden no puede ser negativo').max(65535, 'orden no puede superar 65535');
const fields = {
  id_comuna: positiveId('id_comuna'),
  id_coordenada: positiveId('id_coordenada').nullable().optional(),
  id_fuente: positiveId('id_fuente').nullable().optional(),
  slug: z.string().min(2, 'El slug debe tener al menos 2 caracteres').max(180, 'El slug no puede superar 180 caracteres').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug debe usar minúsculas y guiones'),
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(150, 'El nombre no puede superar 150 caracteres'),
  descripcion: z.string().trim().min(1, 'La descripción es obligatoria').max(10000, 'La descripción no puede superar 10000 caracteres'),
  orden: orden.optional().default(1),
};
const createLugarSchema = z.object(fields).strict();
const updateLugarSchema = z.object({ ...fields, id_comuna: fields.id_comuna.optional(), slug: fields.slug.optional(), nombre: fields.nombre.optional(), descripcion: fields.descripcion.optional(), orden: orden.optional() }).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');
const approvalLugarSchema = z.object({ estado: z.enum(['aprobado', 'rechazado']) }).strict();
const idParamSchema = z.object({ id: parsedPositive('id') }).strict();
const managementQuerySchema = z.object({
  page: parsedPositive('page').optional().default(1),
  limit: parsedPositive('limit').refine((value) => value <= 100, 'limit no puede superar 100').optional().default(20),
  estado: z.enum(['pendiente', 'aprobado', 'rechazado']).optional(),
  comuna_id: parsedPositive('comuna_id').optional(),
}).strict();

module.exports = { createLugarSchema, updateLugarSchema, approvalLugarSchema, idParamSchema, managementQuerySchema };
