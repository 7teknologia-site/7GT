import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess, requireRole } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const announcementsRouter = Router();

announcementsRouter.use(authenticateToken);
announcementsRouter.use(verifyTenantAccess);

// List announcements
announcementsRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  try {
    const list = await query<any>(
      `SELECT a.*, u.full_name as author_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id
       WHERE a.tenant_id = $1
       ORDER BY a.is_pinned DESC, a.created_at DESC`,
      [tenantId]
    );
    res.json(list);
  } catch (err: any) {
    console.error('Announcements error:', err);
    res.status(500).json({ error: 'Erro ao carregar comunicados.' });
  }
});

// Create announcement
announcementsRouter.post('/', requireRole(['dirigente', 'admin_casa']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const { title, content, target_audience = 'todos', priority = 'normal', is_pinned = false } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Título e conteúdo são obrigatórios.' });
  }

  const id = `anc_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await query(
      `INSERT INTO announcements (id, tenant_id, title, content, target_audience, priority, is_pinned, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, tenantId, title, content, target_audience, priority, is_pinned, user.id]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'ANNOUNCEMENT_POSTED',
      entityType: 'announcements',
      entityId: id,
      details: { title, target_audience, priority }
    });

    const created = await queryOne('SELECT * FROM announcements WHERE id = $1', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('Create announcement error:', err);
    res.status(500).json({ error: 'Erro ao publicar comunicado: ' + err.message });
  }
});

// LGPD Routes
export const lgpdRouter = Router();

lgpdRouter.use(authenticateToken);
lgpdRouter.use(verifyTenantAccess);

lgpdRouter.get('/requests', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  try {
    const requests = await query<any>(
      `SELECT * FROM lgpd_requests WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(requests);
  } catch (err: any) {
    console.error('LGPD error:', err);
    res.status(500).json({ error: 'Erro ao listar solicitações de privacidade.' });
  }
});

lgpdRouter.post('/requests', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const { requester_name, requester_email, request_type, notes } = req.body;

  if (!requester_name || !requester_email || !request_type) {
    return res.status(400).json({ error: 'Preencha os dados da solicitação LGPD.' });
  }

  const id = `lgpd_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await query(
      `INSERT INTO lgpd_requests (id, tenant_id, requester_name, requester_email, request_type, response_notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, tenantId, requester_name, requester_email, request_type, notes || null]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'LGPD_REQUEST_LOGGED',
      entityType: 'lgpd_requests',
      entityId: id,
      details: { requester_name, requester_email, request_type }
    });

    const item = await queryOne('SELECT * FROM lgpd_requests WHERE id = $1', [id]);
    res.status(201).json(item);
  } catch (err: any) {
    console.error('Create LGPD request error:', err);
    res.status(500).json({ error: 'Erro ao registrar solicitação LGPD.' });
  }
});
