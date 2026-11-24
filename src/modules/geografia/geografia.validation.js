const { z } = require('zod');

const idParamSchema = z.object({
  id: z.string()
    .regex(/^[1-9]\d*$/, 'El identificador debe ser un entero positivo')
    .transform(Number)
    .refine(Number.isSafeInteger, 'El identificador debe ser un entero positivo'),
});

module.exports = { idParamSchema };
