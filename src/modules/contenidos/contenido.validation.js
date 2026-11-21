const { z } = require('zod');

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];

const createContenidoSchema = z.object({
  titulo: z.string().min(2).max(200).trim(),
  cuerpo: z.string().min(1),
  resumen: z.string().max(500).trim().optional().nullable(),
  autor_id: z.number().int().positive().optional().nullable(),
  estado: z.enum(ESTADOS).optional().default('pendiente'),
  enlace_app: z.string().max(300).trim().optional().nullable(),
});

const updateContenidoSchema = createContenidoSchema.partial();

const aprobarSchema = z.object({
  estado: z.enum(['aprobado', 'rechazado']),
  motivo: z.string().max(500).trim().optional().nullable(),
});

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const listQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
});

module.exports = { createContenidoSchema, updateContenidoSchema, aprobarSchema, idParamSchema, listQuerySchema, ESTADOS };