const { z } = require('zod');

const TIPOS = ['foto', 'video', 'plano', 'logo'];
const PERMISOS = ['pendiente', 'autorizado', 'rechazado'];
const textoNoVacio = (nombre, maximo) => z.string().trim()
  .min(1, `${nombre} es obligatorio`)
  .max(maximo, `${nombre} no puede superar ${maximo} caracteres`);
const enteroPositivo = (nombre) => z.string()
  .regex(/^\d+$/, `${nombre} debe ser un entero positivo`)
  .transform(Number)
  .refine((value) => value > 0, `${nombre} debe ser mayor que cero`);
const galeriaFields = {
  id_fuente: z.number().int('id_fuente debe ser entero').positive('id_fuente debe ser positivo').nullable().optional(),
  tipo: z.enum(TIPOS),
  titulo: textoNoVacio('El título', 200),
  ruta: textoNoVacio('La ruta', 1024),
  texto_alt: textoNoVacio('El texto alternativo', 500).nullable().optional(),
  credito: textoNoVacio('El crédito', 200),
  permiso: z.enum(PERMISOS),
  en_galeria_general: z.boolean(),
  orden_galeria: z.number().int('orden_galeria debe ser entero').min(0, 'orden_galeria no puede ser negativo').max(65535, 'orden_galeria no puede superar 65535').nullable().optional(),
};
const requiereTextoAlternativo = (data, ctx) => {
  if (data.tipo !== 'video' && (!data.texto_alt || !data.texto_alt.trim())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['texto_alt'], message: 'El texto alternativo es obligatorio para archivos que no son video' });
  }
};

const createGaleriaSchema = z.object({
  ...galeriaFields,
  permiso: z.enum(PERMISOS).optional().default('pendiente'),
  en_galeria_general: z.boolean().optional().default(false),
}).strict().superRefine(requiereTextoAlternativo);

const updateGaleriaSchema = z.object({
  id_fuente: galeriaFields.id_fuente,
  tipo: galeriaFields.tipo.optional(),
  titulo: galeriaFields.titulo.optional(),
  ruta: galeriaFields.ruta.optional(),
  texto_alt: galeriaFields.texto_alt,
  credito: galeriaFields.credito.optional(),
  permiso: galeriaFields.permiso.optional(),
  en_galeria_general: galeriaFields.en_galeria_general.optional(),
  orden_galeria: galeriaFields.orden_galeria,
}).strict().refine((data) => Object.keys(data).length > 0, 'Debe enviar al menos un campo para actualizar');

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser numérico').transform(Number),
});

const listQuerySchema = z.object({
  tipo: z.enum(TIPOS).optional(),
  page: enteroPositivo('page').optional().default(1),
  limit: enteroPositivo('limit').refine((value) => value <= 100, 'limit no puede superar 100').optional().default(20),
}).strict();

module.exports = { createGaleriaSchema, updateGaleriaSchema, idParamSchema, listQuerySchema, TIPOS, PERMISOS };
