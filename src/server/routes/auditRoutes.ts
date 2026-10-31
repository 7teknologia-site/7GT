import { Router } from 'express';
import { query } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess, requireRole } from '../auth.js';

export const auditRouter = Router();

auditRouter.use(authenticateToken);
auditRouter.use(verifyTenantAccess);

auditRouter.get('/', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { action, entityType, limit = 50 } = req.query;

  let sql = `
    SELECT id, tenant_id, actor_id, actor_name, action, entity_type, entity_id, details_json, created_at
    FROM audit_logs
    WHERE tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (action) {
    params.push(action);
    sql += ` AND action = $${params.length}`;
  }

  if (entityType) {
    params.push(entityType);
    sql += ` AND entity_type = $${params.length}`;
  }

  params.push(Number(limit));
  sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  try {
    const logs = await query(sql, params);
    res.json(logs);
  } catch (err: any) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Erro ao carregar registros de auditoria.' });
  }
});
