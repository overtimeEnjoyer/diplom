import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

function sanitizePathSegment(segment) {
  return String(segment || '')
    .replace(/[^a-zA-Z0-9._/-]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 200);
}

async function createSupabaseUploadUrl(objectPath, contentType) {
  const { supabaseUrl, supabaseServiceRoleKey, supabaseStorageBucket } = env;
  if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseStorageBucket) {
    throw ApiError.internal('Supabase Storage is not configured');
  }

  const path = sanitizePathSegment(objectPath);
  const url = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/upload/sign/${supabaseStorageBucket}/${path}`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ upsert: false }),
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw ApiError.internal(`Supabase upload sign failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return {
    provider: 'supabase',
    bucket: supabaseStorageBucket,
    path,
    uploadUrl: data.url,
    token: data.token,
    contentType: contentType || 'application/octet-stream',
    expiresIn: 3600,
  };
}

async function createS3PresignedPut(objectPath, contentType) {
  const { s3Bucket, s3Region, s3AccessKeyId, s3SecretAccessKey } = env;
  if (!s3Bucket || !s3Region || !s3AccessKeyId || !s3SecretAccessKey) {
    throw ApiError.internal('AWS S3 is not configured');
  }

  let S3Client;
  let PutObjectCommand;
  let getSignedUrl;
  try {
    ({ S3Client } = await import('@aws-sdk/client-s3'));
    ({ PutObjectCommand } = await import('@aws-sdk/client-s3'));
    ({ getSignedUrl } = await import('@aws-sdk/s3-request-presigner'));
  } catch {
    throw ApiError.internal('Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner for S3 uploads');
  }

  const path = sanitizePathSegment(objectPath);
  const client = new S3Client({
    region: s3Region,
    credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey },
  });

  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: path,
    ContentType: contentType || 'application/octet-stream',
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  return {
    provider: 's3',
    bucket: s3Bucket,
    path,
    uploadUrl,
    contentType: contentType || 'application/octet-stream',
    expiresIn: 3600,
  };
}

/**
 * Presigned upload URL (thesis: direct upload to BaaS storage, bypassing FaaS body limit).
 */
export async function createPresignedUpload(user, { filename, contentType, folder = 'uploads' } = {}) {
  if (!filename) throw ApiError.badRequest('filename is required');

  const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
  const objectPath = `${folder}/user-${user.id}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

  if (env.uploadProvider === 's3') {
    return createS3PresignedPut(objectPath, contentType);
  }

  try {
    return await createSupabaseUploadUrl(objectPath, contentType);
  } catch (primaryErr) {
    const canFallback =
      env.s3Bucket && env.s3Region && env.s3AccessKeyId && env.s3SecretAccessKey;
    if (!canFallback) throw primaryErr;
    console.warn('[uploads] Supabase presign failed, falling back to S3:', primaryErr.message);
    return createS3PresignedPut(objectPath, contentType);
  }
}
