import crypto from 'crypto';
import { query } from './db.js';

export async function recordAuditLog(params: {
  tenantId?: string | null;
  actorId?: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
}) {
  const id = `aud_${crypto.randomUUID().slice(0, 12)}`;
  try {
    await query(
      `INSERT INTO audit_logs (id, tenant_id, actor_id, actor_name, action, entity_type, entity_id, details_json, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
      [
        id,
        params.tenantId || null,
        params.actorId || null,
        params.actorName,
        params.action,
        params.entityType,
        params.entityId,
        JSON.stringify(params.details || {}),
        params.ipAddress || null
      ]
    );
  } catch (err) {
    console.error('[AUDIT_ERROR] Failed to record audit log:', err);
  }
}
