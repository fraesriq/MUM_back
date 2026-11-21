const crypto = require('node:crypto');
const repositoryModule = require('./archivos.repository');
const { createR2Service } = require('../../storage/r2.service');
const { createR2Config } = require('../../config/r2');
const { createArchivoSchema } = require('./archivos.validation');

const allowedContentTypes = {
  foto: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' },
  logo: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' },
  video: { 'video/mp4': 'mp4', 'video/webm': 'webm' },
  plano: { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
};

function operationalError(message, status = 400) { return Object.assign(new Error(message), { status }); }
function compatibleContentType(tipo, contentType) { return allowedContentTypes[tipo]?.[contentType]; }
function createObjectKey(tipo, contentType, now = new Date(), uuid = crypto.randomUUID()) {
  const extension = compatibleContentType(tipo, contentType);
  if (!extension) throw operationalError('El tipo de archivo no es compatible con el contenido indicado.');
  return `archivos/${tipo}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${uuid}.${extension}`;
}
function isManagedKey(key) { return /^archivos\/(foto|video|plano|logo)\/\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f-]{36}\.(jpg|png|webp|avif|mp4|webm|pdf)$/.test(key); }
function isExpectedManagedKey(key, tipo, contentType) {
  const extension = compatibleContentType(tipo, contentType);
  return Boolean(extension) && new RegExp(`^archivos/${tipo}/\\d{4}/(0[1-9]|1[0-2])/[0-9a-f-]{36}\\.${extension}$`).test(key);
}
function withoutPrivateFields(archivo, url, expiresIn) {
  const { ruta, permiso, id_fuente, en_galeria_general, ...publicArchivo } = archivo;
  return { ...publicArchivo, url, url_expires_in: expiresIn };
}
function grantIsValid(grant, { applicationClientId, tipo, contentType, size }, allowConfirmed = false) {
  if (!grant || grant.application_public_id !== applicationClientId || grant.tipo !== tipo || grant.content_type !== contentType || Number(grant.size_bytes) !== size) return false;
  return allowConfirmed && grant.confirmed_at ? true : new Date(grant.expires_at) >= new Date();
}

function createArchivosService({ repository = repositoryModule, r2Service = createR2Service(), getR2Config = createR2Config(), now = () => new Date(), createUuid = crypto.randomUUID } = {}) {
  const config = () => getR2Config();
  const assertSize = (size) => { if (size > config().maxFileSizeBytes) throw operationalError('El tamaño del archivo supera el máximo configurado.'); };
  const mapPublicArchivo = async (archivo) => withoutPrivateFields(archivo, await r2Service.createPresignedDownload(archivo.ruta), config().signedDownloadTtlSeconds);
  return {
    requestUpload: async ({ tipo, content_type: contentType, tamanio_bytes: size, application_client_id: applicationClientId }) => {
      assertSize(size);
      if (!applicationClientId) throw operationalError('No fue posible identificar la aplicación que solicita la carga.', 403);
      const key = createObjectKey(tipo, contentType, now(), createUuid());
      const expiresIn = config().signedUploadTtlSeconds;
      await repository.createUploadGrant({ objectKey: key, applicationClientId, tipo, contentType, size, expiresAt: new Date(now().getTime() + (expiresIn * 1000)) });
      return {
        object_key: key,
        upload_url: await r2Service.createPresignedUpload({ key, contentType, contentLength: size }),
        expires_in: expiresIn,
        required_headers: { 'Content-Type': contentType },
        signed_headers: ['content-type', 'content-length'],
        expected_size_bytes: size,
      };
    },
    confirmUpload: async ({ object_key: key, content_type: contentType, tamanio_bytes: size, application_client_id: applicationClientId, ...metadata }) => {
      if (!isManagedKey(key) || !isExpectedManagedKey(key, metadata.tipo, contentType)) throw operationalError('La clave del objeto no pertenece al espacio administrado de archivos.');
      assertSize(size);
      const grant = await repository.findUploadGrant(key);
      if (!grantIsValid(grant, { applicationClientId, tipo: metadata.tipo, contentType, size }, true)) throw operationalError('La carga no pertenece a la aplicación solicitante o sus datos no coinciden.', 403);
      const existing = await repository.findByRuta(key);
      if (existing && grant.confirmed_at && existing.tipo === metadata.tipo) return existing;
      if (grant.confirmed_at) throw operationalError('La confirmación de carga no tiene un registro de archivo consistente.', 409);
      if (!grantIsValid(grant, { applicationClientId, tipo: metadata.tipo, contentType, size })) throw operationalError('La autorización de carga expiró.', 409);
      const object = await r2Service.headObject(key);
      if (object.ContentType !== contentType) throw operationalError('El tipo de contenido almacenado no coincide con la solicitud.');
      if (object.ContentLength !== size) throw operationalError('El tamaño almacenado no coincide con la solicitud.');
      assertSize(object.ContentLength);
      try {
        const result = await repository.insertWithGrantConfirmation({ objectKey: key, applicationClientId, tipo: metadata.tipo, contentType, size, metadata });
        if (result.state === 'created' || result.state === 'existing') return result.item;
        if (result.state === 'expired_grant') throw operationalError('La autorización de carga expiró.', 409);
        if (result.state === 'invalid_grant' || result.state === 'missing_grant') throw operationalError('La carga no pertenece a la aplicación solicitante o sus datos no coinciden.', 403);
        throw operationalError('Existe una referencia de archivo incompatible para esta carga.', 409);
      } catch (error) {
        if (error.status) throw error;
        try {
          await r2Service.deleteObject(key);
        } catch (cleanupError) {
          let taskUpdated;
          try { taskUpdated = await repository.recordCleanupTask({ objectKey: key, reason: 'fallo_confirmacion', lastError: 'No se pudo eliminar el objeto después de fallar su registro.' }); } catch (taskError) { throw operationalError('No se pudo actualizar la tarea de limpieza preexistente; requiere revisión operativa.', 503); }
          if (!taskUpdated) throw operationalError('No se encontró la tarea de limpieza preexistente; requiere revisión operativa.', 503);
          throw operationalError('No se pudo registrar el archivo y el objeto quedó pendiente de limpieza operativa.', 409);
        }
        let taskCompleted;
        try { taskCompleted = await repository.completeCleanupTask(key); } catch (taskError) { throw operationalError('El objeto cargado fue eliminado, pero no se pudo cerrar su tarea de limpieza.', 503); }
        if (!taskCompleted) throw operationalError('El objeto cargado fue eliminado, pero no se encontró su tarea de limpieza preexistente.', 503);
        throw operationalError('No se pudo registrar el archivo; el objeto cargado fue eliminado.', 409);
      }
    },
    getAll: (filters) => repository.findAll(filters),
    getById: async (id) => { const item = await repository.findById(id); if (!item) throw operationalError('Archivo no encontrado', 404); return item; },
    update: async (id, patch) => {
      const item = await repository.findById(id);
      if (!item) throw operationalError('Archivo no encontrado', 404);
      const validation = createArchivoSchema.safeParse({
        id_fuente: item.id_fuente,
        tipo: item.tipo,
        titulo: item.titulo,
        texto_alt: item.texto_alt,
        credito: item.credito,
        permiso: item.permiso,
        en_galeria_general: Boolean(item.en_galeria_general),
        orden_galeria: item.orden_galeria,
        ...patch,
      });
      if (!validation.success) throw operationalError(validation.error.issues[0].message);
      return repository.update(id, patch);
    },
    remove: async (id) => {
      const item = await repository.deleteWithCleanup(id);
      if (!item) throw operationalError('Archivo no encontrado', 404);
      try {
        await r2Service.deleteObject(item.ruta);
      } catch (error) {
        let taskUpdated;
        try { taskUpdated = await repository.recordCleanupTask({ objectKey: item.ruta, reason: 'archivo_eliminado', lastError: 'No se pudo eliminar el objeto en R2.' }); } catch (taskError) { throw operationalError('No se pudo actualizar la tarea de limpieza; requiere revisión operativa.', 503); }
        if (!taskUpdated) throw operationalError('No se encontró la tarea de limpieza preexistente; requiere revisión operativa.', 503);
        throw operationalError('La referencia fue eliminada, pero el objeto quedó pendiente de limpieza operativa.', 409);
      }
      let taskCompleted;
      try { taskCompleted = await repository.completeCleanupTask(item.ruta); } catch (error) { throw operationalError('El objeto fue eliminado, pero falta cerrar su tarea de limpieza operativa.', 503); }
      if (!taskCompleted) throw operationalError('El objeto fue eliminado, pero no se encontró su tarea de limpieza preexistente.', 503);
      return { deleted: true };
    },
    processCleanup: async ({ limit }) => {
      const tasks = await repository.listPendingCleanupTasks(limit);
      const result = { processed: 0, deleted: 0, failed: 0 };
      for (const task of tasks) {
        result.processed += 1;
        try {
          await r2Service.deleteObject(task.object_key);
          const completed = await repository.completeCleanupTask(task.object_key);
          if (!completed) throw operationalError('No se encontró la tarea de limpieza preexistente; requiere revisión operativa.', 503);
          result.deleted += 1;
        } catch (error) {
          if (error.status) throw error;
          let taskUpdated;
          try { taskUpdated = await repository.recordCleanupTask({ objectKey: task.object_key, reason: task.reason, lastError: 'No se pudo eliminar el objeto en R2 durante la limpieza.' }); } catch (taskError) { throw operationalError('No se pudo actualizar una tarea de limpieza; requiere revisión operativa.', 503); }
          if (!taskUpdated) throw operationalError('No se encontró una tarea de limpieza preexistente; requiere revisión operativa.', 503);
          result.failed += 1;
        }
      }
      return result;
    },
    getPublicGallery: async (filters) => {
      const result = await repository.findPublicGallery(filters);
      return { ...result, items: await Promise.all(result.items.map(mapPublicArchivo)) };
    },
    getPublicGalleryById: async (id) => {
      const item = await repository.findPublicGalleryById(id);
      if (!item) throw operationalError('Archivo no encontrado', 404);
      return mapPublicArchivo(item);
    },
    mapPublicFiles: async (items) => Promise.all(items.map(mapPublicArchivo)),
  };
}

module.exports = { allowedContentTypes, createObjectKey, isManagedKey, createArchivosService, ...createArchivosService() };
