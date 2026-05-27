import { v4 as uuidv4 } from 'uuid';

/** Strapi 5 compatible documentId — stable UUID per entity. */
export function ensureDocumentId(entity) {
  if (!entity.documentId) {
    entity.documentId = uuidv4();
  }
  return entity.documentId;
}

export function toStrapiEntity(row, extra = {}) {
  if (!row) return null;
  const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
  const documentId = plain.documentId || plain.document_id;
  return {
    id: plain.id,
    documentId,
    ...extra,
    createdAt: plain.createdAt || plain.created_at,
    updatedAt: plain.updatedAt || plain.updated_at,
    publishedAt: plain.publishedAt || plain.published_at || null,
    locale: plain.locale || null,
  };
}

export function strapiSingle(data, meta = {}) {
  return { data: data ? toStrapiEntity(data) : null, meta };
}

export function strapiCollection(rows, meta = {}) {
  return {
    data: (rows || []).map((r) => toStrapiEntity(r)),
    meta,
  };
}
