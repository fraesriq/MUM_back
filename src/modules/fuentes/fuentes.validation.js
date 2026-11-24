const { z } = require('zod');

const idParamSchema = z.object({
  id: z.string()
    .regex(/^[1-9]\d*$/, 'El identificador debe ser un entero positivo')
    .transform(Number)
    .refine(Number.isSafeInteger, 'El identificador debe ser un entero positivo'),
}).strict();

const nullableText = (max, field) => z.string().trim().min(1, `${field} no puede estar vacío`).max(max, `${field} no puede superar ${max} caracteres`).nullable();
const fuenteFields = {
  titulo: z.string().trim().min(1, 'El título no puede estar vacío').max(255, 'El título no puede superar 255 caracteres'),
  tipo: z.enum(['ficha', 'documento', 'institucion', 'web', 'otro']),
  autor_institucion: z.string().trim().max(200, 'autor_institucion no puede superar 200 caracteres').nullable().optional().default(null),
  archivo_original: nullableText(500, 'archivo_original').optional().default(null),
  url: z.httpUrl().nullable().optional().default(null),
  verificada: z.boolean().optional().default(false),
};

const createFuenteSchema = z.object(fuenteFields).strict();
const updateFuenteSchema = z.object({
  titulo: fuenteFields.titulo.optional(),
  tipo: fuenteFields.tipo.optional(),
  autor_institucion: z.string().trim().max(200, 'autor_institucion no puede superar 200 caracteres').nullable().optional(),
  archivo_original: nullableText(500, 'archivo_original').optional(),
  url: z.httpUrl().nullable().optional(),
  verificada: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');

module.exports = { createFuenteSchema, updateFuenteSchema, idParamSchema };
