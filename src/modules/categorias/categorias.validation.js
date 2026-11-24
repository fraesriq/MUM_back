const { z } = require('zod');

const categoriaFields = {
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80, 'El nombre no puede superar 80 caracteres'),
  slug: z.string().min(2, 'El slug debe tener al menos 2 caracteres').max(90, 'El slug no puede superar 90 caracteres').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug debe usar minúsculas y guiones'),
  orden: z.number().int('orden debe ser entero').min(0, 'orden no puede ser negativo').max(65535, 'orden no puede superar 65535'),
};

const createCategoriaSchema = z.object(categoriaFields).strict();
const updateCategoriaSchema = z.object({
  nombre: categoriaFields.nombre.optional(),
  slug: categoriaFields.slug.optional(),
  orden: categoriaFields.orden.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser numérico').transform(Number).refine((id) => id > 0, 'El id debe ser mayor que cero'),
}).strict();

module.exports = { createCategoriaSchema, updateCategoriaSchema, idParamSchema };
