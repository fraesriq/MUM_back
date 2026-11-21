const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createR2Config } = require('../config/r2');

function createR2Service({ getConfig = createR2Config(), clientFactory, signer = getSignedUrl, commands } = {}) {
  const commandSet = commands || { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand };
  let client;
  const getClient = () => {
    if (!client) {
      const config = getConfig();
      client = (clientFactory || ((options) => new S3Client(options)))({
        region: config.region,
        endpoint: config.endpoint,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      });
    }
    return client;
  };
  const commandInput = (key, contentType, contentLength) => {
    const config = getConfig();
    return { Bucket: config.bucketName, Key: key, ...(contentType ? { ContentType: contentType } : {}), ...(contentLength !== undefined ? { ContentLength: contentLength } : {}) };
  };

  return {
    createPresignedUpload: ({ key, contentType, contentLength }) => signer(getClient(), new commandSet.PutObjectCommand(commandInput(key, contentType, contentLength)), {
      expiresIn: getConfig().signedUploadTtlSeconds,
      signableHeaders: new Set(['content-type', 'content-length']),
    }),
    createPresignedDownload: (key) => signer(getClient(), new commandSet.GetObjectCommand(commandInput(key)), { expiresIn: getConfig().signedDownloadTtlSeconds }),
    headObject: (key) => getClient().send(new commandSet.HeadObjectCommand(commandInput(key))),
    deleteObject: (key) => getClient().send(new commandSet.DeleteObjectCommand(commandInput(key))),
  };
}

module.exports = { createR2Service };
