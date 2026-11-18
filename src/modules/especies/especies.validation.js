const { z } = require('zod');

const createEspecieSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .trim(),
  nombre_cientifico: z
    .string()
    .max(150, 'El nombre científico no puede superar 150 caracteres')
    .trim()
    .optional()
    .nullable(),
  descripcion: z
    .string()
    .max(500, 'La descripción no puede superar 500 caracteres')
    .trim()
    .optional()
    .nullable(),
  categoria_id: z
    .number({ required_error: 'La categoría es obligatoria' })
    .int('categoria_id debe ser entero')
    .positive('categoria_id debe ser positivo'),
  activo: z.boolean().optional().default(true),
});

const updateEspecieSchema = createEspecieSchema.partial();

const idParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'El id debe ser numérico')
    .transform(Number),
});

module.exports = {
  createEspecieSchema,
  updateEspecieSchema,
  idParamSchema,
};