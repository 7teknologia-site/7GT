import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../db.js';
import { AuthenticatedRequest, authenticateToken, verifyTenantAccess, requireRole } from '../auth.js';
import { recordAuditLog } from '../audit.js';

export const eventsRouter = Router();

eventsRouter.use(authenticateToken);
eventsRouter.use(verifyTenantAccess);

// List events
eventsRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { month, type } = req.query;

  let sql = `
    SELECT e.*, 
           (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id = e.id) as attendees_count,
           (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id = e.id AND a.checkin_at IS NOT NULL) as checkedin_count
    FROM events e
    WHERE e.tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (type && type !== 'all') {
    params.push(type);
    sql += ` AND e.type = $${params.length}`;
  }

  sql += ` ORDER BY e.start_time ASC`;

  try {
    const events = await query(sql, params);
    res.json(events);
  } catch (err: any) {
    console.error('List events error:', err);
    res.status(500).json({ error: 'Erro ao listar eventos.' });
  }
});

// Create event
eventsRouter.post('/', requireRole(['dirigente', 'admin_casa', 'responsavel_area']), async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const user = req.user!;
  const {
    title,
    type = 'gira_publica',
    description,
    start_time,
    end_time,
    location = 'Templo Principal',
    max_attendees = 100,
    is_public = true
  } = req.body;

  if (!title || !start_time || !end_time) {
    return res.status(400).json({ error: 'Título, horário de início e fim são obrigatórios.' });
  }

  const id = `evt_${crypto.randomUUID().slice(0, 8)}`;

  try {
    await query(
      `INSERT INTO events (
        id, tenant_id, title, type, description, start_time, end_time, location, max_attendees, is_public, organizer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, tenantId, title, type, description || null, start_time, end_time, location, max_attendees, is_public, user.id]
    );

    await recordAuditLog({
      tenantId,
      actorId: user.id,
      actorName: user.full_name,
      action: 'EVENT_CREATED',
      entityType: 'events',
      entityId: id,
      details: { title, type, start_time }
    });

    const created = await queryOne('SELECT * FROM events WHERE id = $1', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Erro ao cadastrar evento: ' + err.message });
  }
});

// Check-in attendee
eventsRouter.post('/:id/checkin', async (req: AuthenticatedRequest, res) => {
  const tenantId = req.activeTenantId!;
  const { id } = req.params;
  const { name, email, phone, member_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome do participante é obrigatório.' });
  }

  try {
    // AUDIT RULE: Ensure event belongs to active tenant
    const event = await queryOne<any>(
      'SELECT id, title FROM events WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (!event) {
      return res.status(404).json({ error: 'Gira ou evento não encontrado neste terreiro.' });
    }

    const attendeeId = `att_${crypto.randomUUID().slice(0, 8)}`;

    await query(
      `INSERT INTO event_attendees (id, tenant_id, event_id, name, email, phone, member_id, status, checkin_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'attended', CURRENT_TIMESTAMP)`,
      [attendeeId, tenantId, id, name, email || null, phone || null, member_id || null]
    );

    res.status(201).json({ success: true, attendeeId, message: 'Presença confirmada!' });
  } catch (err: any) {
    console.error('Checkin error:', err);
    res.status(500).json({ error: 'Erro ao registrar presença: ' + err.message });
  }
});
