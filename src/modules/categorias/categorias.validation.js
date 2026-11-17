const { z } = require('zod');

const createCategoriaSchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .trim(),
  descripcion: z
    .string()
    .max(255, 'La descripción no puede superar 255 caracteres')
    .trim()
    .optional()
    .nullable(),
  activo: z.boolean().optional().default(true),
});

const updateCategoriaSchema = createCategoriaSchema.partial();

const idParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'El id debe ser numérico')
    .transform(Number),
});

module.exports = {
  createCategoriaSchema,
  updateCategoriaSchema,
  idParamSchema,
};