import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess, requireRole } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const membersRouter = Router();

membersRouter.use(authenticateToken);
membersRouter.use(verifyTenantAccess);

// List members
membersRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { search, status, role } = req.query;

  let sql = `
    SELECT id, tenant_id, full_name, spiritual_name, email, phone, document_cpf, 
           birth_date, entry_date, status, role_in_house, emergency_contact, emergency_phone,
           consent_communication, created_at, updated_at
    FROM members
    WHERE tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (LOWER(full_name) LIKE LOWER($${params.length}) OR LOWER(spiritual_name) LIKE LOWER($${params.length}) OR email LIKE $${params.length} OR phone LIKE $${params.length})`;
  }

  if (status && status !== 'all') {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }

  if (role && role !== 'all') {
    params.push(role);
    sql += ` AND role_in_house = $${params.length}`;
  }

  sql += ` ORDER BY full_name ASC`;

  try {
    const members = await query(sql, params);
    res.json(members);
  } catch (err: any) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Erro ao buscar membros: ' + err.message });
  }
});

// Create member
membersRouter.post('/', requireRole(['dirigente', 'admin_casa']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const {
    full_name,
    spiritual_name,
    email,
    phone,
    document_cpf,
    birth_date,
    entry_date,
    status = 'active',
    role_in_house = 'Filho(a) de Fé',
    emergency_contact,
    emergency_phone,
    notes,
    consent_communication = true
  } = req.body;

  if (!full_name) {
    return res.status(400).json({ error: 'Nome completo é obrigatório.' });
  }

  const id = `mbr_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await query(
      `INSERT INTO members (
        id, tenant_id, full_name, spiritual_name, email, phone, document_cpf,
        birth_date, entry_date, status, role_in_house, emergency_contact, emergency_phone,
        notes, consent_communication
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id, tenantId, full_name, spiritual_name || null, email || null, phone || null, document_cpf || null,
        birth_date || null, entry_date || new Date().toISOString().slice(0, 10), status, role_in_house,
        emergency_contact || null, emergency_phone || null, notes || null, consent_communication
      ]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'MEMBER_CREATED',
      entityType: 'members',
      entityId: id,
      details: { full_name, role_in_house, status }
    });

    const newMember = await queryOne('SELECT * FROM members WHERE id = $1', [id]);
    res.status(201).json(newMember);
  } catch (err: any) {
    console.error('Create member error:', err);
    res.status(500).json({ error: 'Erro ao criar membro: ' + err.message });
  }
});

// Update member
membersRouter.put('/:id', requireRole(['dirigente', 'admin_casa']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;
  const user = req.user!;

  const existing = await queryOne('SELECT id FROM members WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (!existing) {
    return res.status(404).json({ error: 'Membro não encontrado neste terreiro.' });
  }

  const {
    full_name,
    spiritual_name,
    email,
    phone,
    document_cpf,
    birth_date,
    entry_date,
    status,
    role_in_house,
    emergency_contact,
    emergency_phone,
    notes,
    consent_communication
  } = req.body;

  try {
    await query(
      `UPDATE members SET
        full_name = COALESCE($1, full_name),
        spiritual_name = $2,
        email = $3,
        phone = $4,
        document_cpf = $5,
        birth_date = $6,
        entry_date = $7,
        status = COALESCE($8, status),
        role_in_house = COALESCE($9, role_in_house),
        emergency_contact = $10,
        emergency_phone = $11,
        notes = $12,
        consent_communication = COALESCE($13, consent_communication),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $14 AND tenant_id = $15`,
      [
        full_name, spiritual_name || null, email || null, phone || null, document_cpf || null,
        birth_date || null, entry_date || null, status, role_in_house, emergency_contact || null,
        emergency_phone || null, notes || null, consent_communication, id, tenantId
      ]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'MEMBER_UPDATED',
      entityType: 'members',
      entityId: id,
      details: { full_name, status, role_in_house }
    });

    const updated = await queryOne('SELECT * FROM members WHERE id = $1', [id]);
    res.json(updated);
  } catch (err: any) {
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Erro ao atualizar membro: ' + err.message });
  }
});

// Export members as CSV
membersRouter.get('/export/csv', requireRole(['dirigente', 'admin_casa', 'financeiro']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;

  try {
    const members = await query<any>(
      `SELECT full_name, spiritual_name, role_in_house, status, phone, email, entry_date
       FROM members WHERE tenant_id = $1 ORDER BY full_name ASC`,
      [tenantId]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'MEMBERS_EXPORT_CSV',
      entityType: 'members',
      entityId: tenantId,
      details: { count: members.length }
    });

    // Generate CSV string
    const headers = ['Nome Completo', 'Nome Espiritual', 'Cargo / Função', 'Status', 'Telefone', 'E-mail', 'Data de Ingresso'];
    const rows = members.map(m => [
      `"${(m.full_name || '').replace(/"/g, '""')}"`,
      `"${(m.spiritual_name || '').replace(/"/g, '""')}"`,
      `"${(m.role_in_house || '').replace(/"/g, '""')}"`,
      `"${(m.status || '').replace(/"/g, '""')}"`,
      `"${(m.phone || '').replace(/"/g, '""')}"`,
      `"${(m.email || '').replace(/"/g, '""')}"`,
      `"${(m.entry_date ? new Date(m.entry_date).toISOString().slice(0, 10) : '')}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="membros_terreiro.csv"');
    res.send('\uFEFF' + csvContent); // BOM for Excel UTF-8
  } catch (err: any) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Erro ao exportar membros.' });
  }
});
