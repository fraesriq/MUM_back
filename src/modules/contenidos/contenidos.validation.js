const { z } = require('zod');

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
const SECCIONES = ['inicio', 'proyecto', 'historia', 'visitantes', 'creditos', 'aplicacion'];
const enteroPositivo = (nombre) => z.string()
  .regex(/^\d+$/, `${nombre} debe ser un entero positivo`)
  .transform(Number)
  .refine((value) => value > 0, `${nombre} debe ser mayor que cero`);

const contenidoFields = {
  id_fuente: z.number().int('id_fuente debe ser entero').positive('id_fuente debe ser positivo').nullable().optional(),
  seccion: z.enum(SECCIONES),
  titulo: z.string().trim().min(1, 'El título es obligatorio').max(200, 'El título no puede superar 200 caracteres'),
  texto: z.string().trim().min(1, 'El texto es obligatorio'),
  orden: z.number().int('orden debe ser entero').min(0, 'orden no puede ser negativo').max(65535, 'orden no puede superar 65535'),
  estado: z.enum(ESTADOS),
};

const createContenidoSchema = z.object({
  ...contenidoFields,
  estado: z.enum(ESTADOS).optional().default('pendiente'),
}).strict();

const updateContenidoSchema = z.object({
  id_fuente: contenidoFields.id_fuente,
  seccion: contenidoFields.seccion.optional(),
  titulo: contenidoFields.titulo.optional(),
  texto: contenidoFields.texto.optional(),
  orden: contenidoFields.orden.optional(),
  estado: contenidoFields.estado.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');

const aprobarSchema = z.object({
  estado: z.enum(['aprobado', 'rechazado']),
}).strict();

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const listQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  seccion: z.enum(SECCIONES).optional(),
  page: enteroPositivo('page').optional().default(1),
  limit: enteroPositivo('limit').refine((value) => value <= 100, 'limit no puede superar 100').optional().default(20),
}).strict();

module.exports = { createContenidoSchema, updateContenidoSchema, aprobarSchema, idParamSchema, listQuerySchema, ESTADOS, SECCIONES };
