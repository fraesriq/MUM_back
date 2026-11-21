const { z } = require('zod');

const createGaleriaSchema = z.object({
  titulo: z.string().min(2).max(150).trim(),
  descripcion: z.string().max(500).trim().optional().nullable(),
  archivo_url: z.string().url('Debe ser una URL válida'),
  tipo_archivo: z.enum(['imagen', 'video', 'documento', 'audio']),
  mime_type: z.string().max(100).optional().nullable(),
  tamanio_bytes: z.number().int().nonnegative().optional().nullable(),
  activo: z.boolean().optional().default(true),
});

const updateGaleriaSchema = createGaleriaSchema.partial();

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser numérico').transform(Number),
});

const listQuerySchema = z.object({
  tipo_archivo: z.enum(['imagen', 'video', 'documento', 'audio']).optional(),
  activo: z.enum(['0', '1']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
});

module.exports = { createGaleriaSchema, updateGaleriaSchema, idParamSchema, listQuerySchema };