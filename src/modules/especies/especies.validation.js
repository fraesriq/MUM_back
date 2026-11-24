const { z } = require('zod');

const positiveId = (name) => z.number().int(`${name} debe ser entero`).refine(Number.isSafeInteger, `${name} debe ser seguro`).positive(`${name} debe ser positivo`);
const text = (name, max) => z.string().trim().min(1, `${name} es obligatorio`).max(max, `${name} no puede superar ${max} caracteres`);
const nullableText = (name, max) => text(name, max).nullable().optional();
const fields = {
  id_categoria: positiveId('id_categoria'),
  id_fuente: positiveId('id_fuente').nullable().optional(),
  slug: z.string().min(2, 'El slug debe tener al menos 2 caracteres').max(180, 'El slug no puede superar 180 caracteres').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug debe usar minúsculas y guiones'),
  nombre_comun: z.string().trim().min(2, 'El nombre común debe tener al menos 2 caracteres').max(150, 'El nombre común no puede superar 150 caracteres'),
  nombre_cientifico: z.string().trim().min(2, 'El nombre científico debe tener al menos 2 caracteres').max(200, 'El nombre científico no puede superar 200 caracteres').nullable().optional(),
  descripcion: text('La descripción', 10000),
  distribucion_geografica: nullableText('La distribución geográfica', 10000),
  habitat_ecosistema: nullableText('El hábitat o ecosistema', 10000),
  alimentacion: nullableText('La alimentación', 10000),
  habito: nullableText('El hábito', 10000),
  reproduccion: nullableText('La reproducción', 10000),
};
const createEspecieSchema = z.object(fields).strict();
const updateEspecieSchema = z.object(Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, key === 'id_categoria' || key === 'descripcion' ? value.optional() : value]))).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');
const approvalEspecieSchema = z.object({ estado: z.enum(['aprobado', 'rechazado']) }).strict();
const parsedPositive = (name) => z.string().regex(/^\d+$/, `${name} debe ser un entero positivo`).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0, `${name} debe ser un entero positivo seguro`);
const idParamSchema = z.object({ id: parsedPositive('id') }).strict();
const positiveQuery = (name) => parsedPositive(name);
const managementQuerySchema = z.object({
  page: positiveQuery('page').optional().default(1),
  limit: positiveQuery('limit').refine((value) => value <= 100, 'limit no puede superar 100').optional().default(20),
  estado: z.enum(['pendiente', 'aprobado', 'rechazado']).optional(),
  categoria_id: positiveQuery('categoria_id').optional(),
}).strict();

module.exports = {
  createEspecieSchema,
  updateEspecieSchema,
  approvalEspecieSchema,
  idParamSchema,
  managementQuerySchema,
};
