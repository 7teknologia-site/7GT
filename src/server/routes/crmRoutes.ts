import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const crmRouter = Router();

crmRouter.use(authenticateToken);
crmRouter.use(verifyTenantAccess);

// Get complete Kanban board: stages with their active contacts
crmRouter.get('/board', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;

  try {
    const stages = await query<any>(
      `SELECT id, name, order_index, color, is_terminal
       FROM crm_pipeline_stages
       WHERE tenant_id = $1
       ORDER BY order_index ASC`,
      [tenantId]
    );

    const contacts = await query<any>(
      `SELECT c.id, c.full_name, c.email, c.phone, c.stage_id, c.relationship_type, c.source, c.notes,
              c.consent_whatsapp, c.created_at,
              (SELECT COUNT(*) FROM crm_activities a WHERE a.contact_id = c.id AND a.is_completed = false) as pending_tasks_count
       FROM crm_contacts c
       WHERE c.tenant_id = $1 AND c.is_archived = false
       ORDER BY c.created_at DESC`,
      [tenantId]
    );

    // Group contacts into stages
    const board = stages.map(st => ({
      ...st,
      contacts: contacts.filter(c => c.stage_id === st.id)
    }));

    res.json(board);
  } catch (err: any) {
    console.error('CRM board error:', err);
    res.status(500).json({ error: 'Erro ao carregar funil do CRM: ' + err.message });
  }
});

// Move contact to another stage
crmRouter.post('/contacts/:id/move', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;
  const { targetStageId } = req.body;
  const user = req.user!;

  if (!targetStageId) {
    return res.status(400).json({ error: 'targetStageId é obrigatório.' });
  }

  try {
    const contact = await queryOne<any>(
      'SELECT id, full_name, stage_id FROM crm_contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado.' });
    }

    const stage = await queryOne<any>(
      'SELECT id, name FROM crm_pipeline_stages WHERE id = $1 AND tenant_id = $2',
      [targetStageId, tenantId]
    );

    if (!stage) {
      return res.status(404).json({ error: 'Etapa de destino inválida.' });
    }

    await query(
      'UPDATE crm_contacts SET stage_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
      [targetStageId, id, tenantId]
    );

    // Record activity
    const actId = `act_${crypto.randomUUID().slice(0, 8)}`;
    await query(
      `INSERT INTO crm_activities (id, tenant_id, contact_id, user_id, type, title, description, is_completed, completed_at)
       VALUES ($1, $2, $3, $4, 'tarefa_followup', $5, $6, true, CURRENT_TIMESTAMP)`,
      [actId, tenantId, id, user.id, `Avanço no Funil: ${stage.name}`, `Movido por ${user.full_name}`]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'CRM_CONTACT_MOVED_STAGE',
      entityType: 'crm_contacts',
      entityId: id,
      details: { previousStage: contact.stage_id, newStage: targetStageId, stageName: stage.name }
    });

    res.json({ success: true, newStageId: targetStageId, stageName: stage.name });
  } catch (err: any) {
    console.error('CRM move error:', err);
    res.status(500).json({ error: 'Erro ao mover contato: ' + err.message });
  }
});

// Create new contact
crmRouter.post('/contacts', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const {
    full_name,
    email,
    phone,
    stage_id,
    relationship_type = 'visitante',
    source = 'indicacao',
    notes,
    consent_whatsapp = true
  } = req.body;

  if (!full_name) {
    return res.status(400).json({ error: 'Nome do contato é obrigatório.' });
  }

  const id = `crm_${crypto.randomUUID().slice(0, 8)}`;

  try {
    // If no stage provided, use the first stage
    let targetStage = stage_id;
    if (!targetStage) {
      const firstStage = await queryOne<any>(
        'SELECT id FROM crm_pipeline_stages WHERE tenant_id = $1 ORDER BY order_index ASC LIMIT 1',
        [tenantId]
      );
      targetStage = firstStage?.id;
    }

    await query(
      `INSERT INTO crm_contacts (
        id, tenant_id, full_name, email, phone, stage_id, relationship_type, source, notes, consent_whatsapp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, tenantId, full_name, email || null, phone || null, targetStage || null, relationship_type, source, notes || null, consent_whatsapp]
    );

    // Initial activity
    await query(
      `INSERT INTO crm_activities (id, tenant_id, contact_id, user_id, type, title, description, is_completed, completed_at)
       VALUES ($1, $2, $3, $4, 'atendimento', 'Contato Registrado', 'Cadastro no CRM do terreiro', true, CURRENT_TIMESTAMP)`,
      [`act_${crypto.randomUUID().slice(0, 8)}`, tenantId, id, user.id]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'CRM_CONTACT_CREATED',
      entityType: 'crm_contacts',
      entityId: id,
      details: { full_name, relationship_type, source }
    });

    const newContact = await queryOne('SELECT * FROM crm_contacts WHERE id = $1', [id]);
    res.status(201).json(newContact);
  } catch (err: any) {
    console.error('Create CRM contact error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar contato no CRM: ' + err.message });
  }
});

// Contact 360 profile
crmRouter.get('/contacts/:id', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;

  try {
    const contact = await queryOne<any>(
      `SELECT c.*, s.name as stage_name, s.color as stage_color
       FROM crm_contacts c
       LEFT JOIN crm_pipeline_stages s ON s.id = c.stage_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId]
    );

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado.' });
    }

    const activities = await query<any>(
      `SELECT a.*, u.full_name as author_name
       FROM crm_activities a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.contact_id = $1 AND a.tenant_id = $2
       ORDER BY a.created_at DESC`,
      [id, tenantId]
    );

    res.json({ contact, activities });
  } catch (err: any) {
    console.error('CRM 360 error:', err);
    res.status(500).json({ error: 'Erro ao carregar perfil do contato.' });
  }
});

// Add activity / task
crmRouter.post('/contacts/:id/activities', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;
  const user = req.user!;
  const { type, title, description, due_date, is_completed = false } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'Título e tipo de atividade são obrigatórios.' });
  }

  try {
    // AUDIT RULE: Ensure contact belongs to active tenant before inserting
    const contact = await queryOne<any>(
      'SELECT id FROM crm_contacts WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado neste terreiro.' });
    }

    const actId = `act_${crypto.randomUUID().slice(0, 8)}`;

    await query(
      `INSERT INTO crm_activities (id, tenant_id, contact_id, user_id, type, title, description, due_date, is_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [actId, tenantId, id, user.id, type, title, description || null, due_date || null, is_completed]
    );

    const act = await queryOne('SELECT * FROM crm_activities WHERE id = $1', [actId]);
    res.status(201).json(act);
  } catch (err: any) {
    console.error('Add activity error:', err);
    res.status(500).json({ error: 'Erro ao registrar atividade: ' + err.message });
  }
});
