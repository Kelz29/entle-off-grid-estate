import { query, withTransaction } from "@/lib/db";
import type {
  MediaAssetBlob,
  MediaAssetRow,
  MediaKind,
  SiteContentOverlay,
  SiteSectionKey,
} from "./types";
import {
  mergeOverlay,
  revertUploadInOverlay,
  sanitizeOverlay,
} from "./resolve";

function parseJson(raw: unknown): unknown {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw;
  return {};
}

function bufferOf(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (typeof raw === "string") return Buffer.from(raw, "binary");
  return Buffer.alloc(0);
}

export async function getSiteContentOverlay(
  businessId: number
): Promise<{ overlay: SiteContentOverlay; updatedAt: string | null }> {
  const { rows } = await query<{ payload: unknown; updated_at: string }>(
    `SELECT payload, updated_at FROM site_content WHERE business_id = $1`,
    [businessId]
  );
  const row = rows[0];
  if (!row) return { overlay: {}, updatedAt: null };
  return {
    overlay: sanitizeOverlay(parseJson(row.payload)),
    updatedAt: row.updated_at ?? null,
  };
}

export async function saveSiteContentOverlay(
  businessId: number,
  patch: SiteContentOverlay,
  reset: SiteSectionKey[] = []
): Promise<{ overlay: SiteContentOverlay; updatedAt: string | null }> {
  const current = await getSiteContentOverlay(businessId);
  const next = mergeOverlay(current.overlay, patch, reset);
  const payload = JSON.stringify(next);
  await query(
    `INSERT INTO site_content (business_id, payload)
     VALUES ($1, $2)
     ON DUPLICATE KEY UPDATE payload = $2, updated_at = NOW(3)`,
    [businessId, payload]
  );
  return getSiteContentOverlay(businessId);
}

export async function revertMediaInContent(
  businessId: number,
  mediaId: string
): Promise<void> {
  const { overlay } = await getSiteContentOverlay(businessId);
  const next = revertUploadInOverlay(overlay, mediaId);
  await query(
    `INSERT INTO site_content (business_id, payload)
     VALUES ($1, $2)
     ON DUPLICATE KEY UPDATE payload = $2, updated_at = NOW(3)`,
    [businessId, JSON.stringify(next)]
  );
}

export async function sumMediaBytes(businessId: number): Promise<number> {
  const { rows } = await query<{ total: number | string | null }>(
    `SELECT COALESCE(SUM(byte_size), 0) AS total FROM media_assets WHERE business_id = $1`,
    [businessId]
  );
  return Number(rows[0]?.total ?? 0);
}

export async function listMediaAssets(
  businessId: number
): Promise<MediaAssetRow[]> {
  const { rows } = await query<MediaAssetRow>(
    `SELECT id, business_id, kind, original_name, mime_type, byte_size, sha256, created_at
       FROM media_assets
      WHERE business_id = $1
      ORDER BY created_at DESC`,
    [businessId]
  );
  return rows;
}

export async function getMediaAsset(
  id: string
): Promise<MediaAssetBlob | null> {
  const { rows } = await query<MediaAssetRow & { data: unknown }>(
    `SELECT id, business_id, kind, original_name, mime_type, byte_size, sha256, created_at, data
       FROM media_assets WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, data: bufferOf(row.data) };
}

export async function getMediaMeta(id: string): Promise<MediaAssetRow | null> {
  const { rows } = await query<MediaAssetRow>(
    `SELECT id, business_id, kind, original_name, mime_type, byte_size, sha256, created_at
       FROM media_assets WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertMediaIfQuotaAllows(input: {
  id: string;
  businessId: number;
  kind: MediaKind;
  originalName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  data: Buffer;
  quotaBytes: number;
}): Promise<{ ok: true; row: MediaAssetRow } | { ok: false; used: number; remaining: number }> {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT IGNORE INTO site_content (business_id, payload) VALUES ($1, '{}')`,
      [input.businessId]
    );
    await client.query(
      `SELECT business_id FROM site_content WHERE business_id = $1 FOR UPDATE`,
      [input.businessId]
    );
    const { rows } = await client.query<{ total: number | string | null }>(
      `SELECT COALESCE(SUM(byte_size), 0) AS total FROM media_assets WHERE business_id = $1`,
      [input.businessId]
    );
    const used = Number(rows[0]?.total ?? 0);
    const remaining = Math.max(0, input.quotaBytes - used);
    if (used + input.byteSize > input.quotaBytes) {
      return { ok: false as const, used, remaining };
    }
    await client.query(
      `INSERT INTO media_assets
        (id, business_id, kind, original_name, mime_type, byte_size, sha256, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.id,
        input.businessId,
        input.kind,
        input.originalName,
        input.mimeType,
        input.byteSize,
        input.sha256,
        input.data,
      ]
    );
    const { rows: created } = await client.query<MediaAssetRow>(
      `SELECT id, business_id, kind, original_name, mime_type, byte_size, sha256, created_at
         FROM media_assets WHERE id = $1`,
      [input.id]
    );
    return { ok: true as const, row: created[0] };
  });
}

export async function deleteMediaAsset(
  businessId: number,
  id: string
): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM media_assets WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  return rowCount > 0;
}
