const { z } = require('zod');

const TIPOS = ['foto', 'video', 'plano', 'logo'];
const PERMISOS = ['pendiente', 'autorizado', 'rechazado'];
const textoNoVacio = (nombre, maximo) => z.string().trim().min(1, `${nombre} es obligatorio`).max(maximo, `${nombre} no puede superar ${maximo} caracteres`);
const enteroPositivo = (nombre) => z.string().regex(/^\d+$/, `${nombre} debe ser un entero positivo`).transform(Number).refine((value) => value > 0, `${nombre} debe ser mayor que cero`);

const metadataFields = {
  id_fuente: z.number().int('id_fuente debe ser entero').positive('id_fuente debe ser positivo').nullable().optional(),
  tipo: z.enum(TIPOS),
  titulo: textoNoVacio('El título', 200),
  texto_alt: textoNoVacio('El texto alternativo', 500).nullable().optional(),
  credito: textoNoVacio('El crédito', 200),
  permiso: z.enum(PERMISOS),
  en_galeria_general: z.boolean(),
  orden_galeria: z.number().int('orden_galeria debe ser entero').min(0, 'orden_galeria no puede ser negativo').max(65535, 'orden_galeria no puede superar 65535').nullable().optional(),
};
const requireAltText = (data, ctx) => {
  if (data.tipo !== 'video' && (!data.texto_alt || !data.texto_alt.trim())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['texto_alt'], message: 'El texto alternativo es obligatorio para archivos que no son video' });
  }
};
const createArchivoSchema = z.object({
  ...metadataFields,
  permiso: z.enum(PERMISOS).optional().default('pendiente'),
  en_galeria_general: z.boolean().optional().default(false),
}).strict().superRefine(requireAltText);
const updateArchivoSchema = z.object({
  id_fuente: metadataFields.id_fuente,
  titulo: metadataFields.titulo.optional(),
  texto_alt: metadataFields.texto_alt,
  credito: metadataFields.credito.optional(),
  permiso: metadataFields.permiso.optional(),
  en_galeria_general: metadataFields.en_galeria_general.optional(),
  orden_galeria: metadataFields.orden_galeria,
}).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');
const uploadSchema = z.object({
  tipo: z.enum(TIPOS),
  content_type: z.string().trim().min(1, 'content_type es obligatorio'),
  tamanio_bytes: z.number().int('tamanio_bytes debe ser entero').positive('tamanio_bytes debe ser mayor que cero'),
}).strict();
const confirmUploadSchema = z.object({
  object_key: z.string().trim().min(1, 'object_key es obligatorio'),
  content_type: z.string().trim().min(1, 'content_type es obligatorio'),
  tamanio_bytes: z.number().int('tamanio_bytes debe ser entero').positive('tamanio_bytes debe ser mayor que cero'),
  ...metadataFields,
  permiso: z.enum(PERMISOS).optional().default('pendiente'),
  en_galeria_general: z.boolean().optional().default(false),
}).strict().superRefine(requireAltText);
const idParamSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/, 'El identificador debe ser un entero positivo').transform(Number).refine(Number.isSafeInteger, 'El identificador debe ser un entero positivo'),
}).strict();
const listQuerySchema = z.object({
  tipo: z.enum(TIPOS).optional(),
  page: enteroPositivo('page').optional().default(1),
  limit: enteroPositivo('limit').refine((value) => value <= 100, 'limit no puede superar 100').optional().default(20),
}).strict();
const cleanupSchema = z.object({
  limit: z.number().int('limit debe ser entero').min(1, 'limit debe ser mayor que cero').max(100, 'limit no puede superar 100').optional().default(20),
}).strict();

module.exports = { TIPOS, PERMISOS, createArchivoSchema, updateArchivoSchema, uploadSchema, confirmUploadSchema, idParamSchema, listQuerySchema, cleanupSchema };
