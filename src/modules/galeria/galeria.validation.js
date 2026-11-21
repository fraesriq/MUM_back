const { z } = require('zod');

const TIPOS = ['foto', 'video', 'plano', 'logo'];
const enteroPositivo = (nombre) => z.string()
  .regex(/^\d+$/, `${nombre} debe ser un entero positivo`)
  .transform(Number)
  .refine((value) => value > 0, `${nombre} debe ser mayor que cero`);

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser numérico').transform(Number),
});

const listQuerySchema = z.object({
  tipo: z.enum(TIPOS).optional(),
  page: enteroPositivo('page').optional().default(1),
  limit: enteroPositivo('limit').refine((value) => value <= 100, 'limit no puede superar 100').optional().default(20),
}).strict();

module.exports = { idParamSchema, listQuerySchema, TIPOS };
