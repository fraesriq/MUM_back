const { z } = require('zod');

const idParamSchema = z.object({
  id: z.string()
    .regex(/^[1-9]\d*$/, 'El identificador debe ser un entero positivo')
    .transform(Number)
    .refine(Number.isSafeInteger, 'El identificador debe ser un entero positivo'),
}).strict();

const nombre = z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre no puede superar 100 caracteres');
const regionSchema = z.object({ nombre }).strict();
const provinceFields = { id_region: z.number().int().positive().safe('El identificador de región debe ser un entero positivo'), nombre };
const provinciaSchema = z.object(provinceFields).strict();
const updateRegionSchema = z.object({ nombre: nombre.optional() }).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');
const updateProvinciaSchema = z.object({ id_region: provinceFields.id_region.optional(), nombre: nombre.optional() }).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');

module.exports = { idParamSchema, regionSchema, provinciaSchema, updateRegionSchema, updateProvinciaSchema };
