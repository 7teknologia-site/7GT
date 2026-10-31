import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const adminRouter = Router();

adminRouter.use(authenticateToken);

// Superadmin guard
adminRouter.use((req: AuthenticatedRequest, res, next) => {
  if (!req.user?.is_superadmin) {
    return res.status(403).json({ error: 'Acesso restrito à administração da 7Teknologia.' });
  }
  next();
});

// Global SaaS Metrics
adminRouter.get('/overview', async (req: AuthenticatedRequest, res) => {
  try {
    const totalTenants = await queryOne<any>('SELECT COUNT(*) as count FROM tenants');
    const activeTenants = await queryOne<any>('SELECT COUNT(*) as count FROM tenants WHERE is_active = true');
    const totalMembers = await queryOne<any>('SELECT COUNT(*) as count FROM members');
    const totalRituals = await queryOne<any>('SELECT COUNT(*) as count FROM rituals');

    const mrrCalc = await queryOne<any>(
      `SELECT COALESCE(SUM(p.price_monthly), 0) as mrr
       FROM tenants t
       JOIN plans p ON p.id = t.plan_id
       WHERE t.is_active = true`
    );

    const plans = await query<any>('SELECT * FROM plans ORDER BY price_monthly ASC');

    const tenants = await query<any>(
      `SELECT t.*, p.name as plan_name, p.price_monthly, p.code as plan_code,
              (SELECT COUNT(*) FROM members m WHERE m.tenant_id = t.id) as members_count,
              (SELECT COUNT(*) FROM rituals r WHERE r.tenant_id = t.id) as rituals_count
       FROM tenants t
       LEFT JOIN plans p ON p.id = t.plan_id
       ORDER BY t.created_at DESC`
    );

    res.json({
      metrics: {
        totalTenants: Number(totalTenants?.count || 0),
        activeTenants: Number(activeTenants?.count || 0),
        totalMembers: Number(totalMembers?.count || 0),
        totalRituals: Number(totalRituals?.count || 0),
        mrr: Number(mrrCalc?.mrr || 0)
      },
      plans,
      tenants
    });
  } catch (err: any) {
    console.error('Superadmin overview error:', err);
    res.status(500).json({ error: 'Erro ao carregar dados do SaaS.' });
  }
});

// Update tenant plan
adminRouter.post('/tenants/:id/plan', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { plan_id } = req.body;
  const user = req.user!;

  try {
    await query('UPDATE tenants SET plan_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [plan_id, id]);

    await recordAuditLog({
      tenantId: id,
      actorId: user.id,
      actorName: user.full_name,
      action: 'TENANT_PLAN_CHANGED',
      entityType: 'tenants',
      entityId: id,
      details: { newPlanId: plan_id }
    });

    res.json({ success: true, message: 'Plano atualizado com sucesso.' });
  } catch (err: any) {
    console.error('Update tenant plan error:', err);
    res.status(500).json({ error: 'Erro ao alterar plano do terreiro.' });
  }
});

// Toggle tenant status
adminRouter.post('/tenants/:id/toggle-status', async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  const user = req.user!;

  try {
    await query('UPDATE tenants SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [is_active, id]);

    await recordAuditLog({
      tenantId: id,
      actorId: user.id,
      actorName: user.full_name,
      action: 'TENANT_STATUS_TOGGLED',
      entityType: 'tenants',
      entityId: id,
      details: { is_active }
    });

    res.json({ success: true, message: 'Status do terreiro atualizado.' });
  } catch (err: any) {
    console.error('Toggle status error:', err);
    res.status(500).json({ error: 'Erro ao alterar status.' });
  }
});
