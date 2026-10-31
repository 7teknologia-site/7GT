import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_DIR = path.resolve(process.cwd(), 'data/terreiros.db');

// Ensure parent data directory exists
if (!fs.existsSync(path.dirname(DB_DIR))) {
  fs.mkdirSync(path.dirname(DB_DIR), { recursive: true });
}

let pgliteInstance: PGlite | null = null;

export function getDb(): PGlite {
  if (!pgliteInstance) {
    if (fs.existsSync(DB_DIR)) {
      const pidFile = path.join(DB_DIR, 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
        } catch (e) {
          console.warn('[DB] Não foi possível remover postmaster.pid residual:', e);
        }
      }
    }
    try {
      pgliteInstance = new PGlite(DB_DIR);
    } catch (err) {
      console.error('[DB FATAL] Falha ao abrir o banco de dados PostgreSQL. Preservando arquivos existentes intactos sem recriação ou exclusão destrutiva:', err);
      throw new Error(`Falha irrecuperável ao inicializar cluster PGlite: ${err instanceof Error ? err.message : String(err)}. Nenhuma alteração destrutiva foi permitida.`);
    }
  }
  return pgliteInstance;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (pgliteInstance) {
    try { await pgliteInstance.close(); } catch (e) {}
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (pgliteInstance) {
    try { await pgliteInstance.close(); } catch (e) {}
  }
  process.exit(0);
});

export const db: PGlite = new Proxy({} as PGlite, {
  get(_target, prop) {
    const realDb = getDb();
    const val = (realDb as any)[prop];
    if (typeof val === 'function') {
      return val.bind(realDb);
    }
    return val;
  }
});

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await db.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  await db.query(sql, params);
}

export async function withTransaction<T>(callback: (client: typeof db) => Promise<T>): Promise<T> {
  await db.query('BEGIN');
  try {
    const result = await callback(db);
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

export async function initDatabase() {
  console.log('[DB] Initializing PostgreSQL database with schema...');
  const schemaPath = path.resolve(process.cwd(), 'src/server/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  await db.exec(schemaSql);
  console.log('[DB] Schema verified.');

  // Check if initial seeding is needed
  const planCount = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM plans');
  if (parseInt(planCount?.count || '0', 10) === 0) {
    console.log('[DB] Seeding foundational SaaS plans...');
    await seedPlans();
    console.log('[DB] Foundational SaaS plans configured.');

    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      console.log('[DB] PRODUÇÃO ATIVA: Criação de credenciais e registros de demonstração foi bloqueada.');
      await seedProductionSuperadmin();
    } else {
      console.log('[DB] AMBIENTE DE DESENVOLVIMENTO/TESTES: Populando terreiros e dados de demonstração...');
      await seedDemoData();
      console.log('[DB] Dados de demonstração carregados com sucesso.');
    }
  }
}

export async function seedPlans() {
  const plans = [
    {
      id: 'plan_essencial',
      code: 'essencial',
      name: 'Essencial',
      price: 39.90,
      max_members: 30,
      max_rituals: 2,
      features: JSON.stringify({ crm: true, financeiro: true, rituais: true, estoque: false, relatorios_avancados: false })
    },
    {
      id: 'plan_gestao',
      code: 'gestao',
      name: 'Gestão',
      price: 79.90,
      max_members: 100,
      max_rituals: 5,
      features: JSON.stringify({ crm: true, financeiro: true, rituais: true, estoque: true, relatorios_avancados: true })
    },
    {
      id: 'plan_completo',
      code: 'completo',
      name: 'Completo',
      price: 129.90,
      max_members: 300,
      max_rituals: 15,
      features: JSON.stringify({ crm: true, financeiro: true, rituais: true, estoque: true, relatorios_avancados: true, whatsapp_auto: true })
    },
    {
      id: 'plan_personalizado',
      code: 'personalizado',
      name: 'Personalizado',
      price: 249.90,
      max_members: 1000,
      max_rituals: 50,
      features: JSON.stringify({ crm: true, financeiro: true, rituais: true, estoque: true, relatorios_avancados: true, multi_filiais: true })
    }
  ];

  for (const p of plans) {
    await query(
      `INSERT INTO plans (id, code, name, price_monthly, max_members, max_rituals_per_month, features_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.code, p.name, p.price, p.max_members, p.max_rituals, p.features]
    );
  }
}

async function seedProductionSuperadmin() {
  const prodEmail = process.env.INITIAL_SUPERADMIN_EMAIL?.trim();
  const prodPass = process.env.INITIAL_SUPERADMIN_PASSWORD;
  if (prodEmail && prodPass && prodPass.length >= 12) {
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(prodPass, salt);
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, is_superadmin, is_active)
       VALUES ($1, $2, $3, $4, true, true) ON CONFLICT (email) DO NOTHING`,
      ['usr_superadmin_prod', prodEmail, hash, 'Administrador 7Teknologia']
    );
    console.log(`[DB] Superadministrador inicial provisionado com sucesso para: ${prodEmail}`);
  }
}

async function seedDemoData() {

  // 2. Tenants (Two realistic distinct Terreiros for isolation testing)
  const tenantA = {
    id: 'tenant-aruanda',
    slug: 'pai-benedito-aruanda',
    name: 'Terreiro Pai Benedito de Aruanda',
    legal_name: 'Associação Beneficente e Religiosa Pai Benedito de Aruanda',
    cnpj: '45.892.123/0001-90',
    email: 'contato@aruanda.org',
    phone: '(11) 98765-4321',
    city: 'São Paulo',
    state: 'SP',
    plan_id: 'plan_gestao'
  };

  const tenantB = {
    id: 'tenant-penabranca',
    slug: 'caboclo-pena-branca',
    name: 'Tenda Espírita Caboclo Pena Branca',
    legal_name: 'Sociedade Espiritualista Pena Branca',
    cnpj: '33.456.789/0001-12',
    email: 'secretaria@penabranca.org',
    phone: '(21) 97654-3210',
    city: 'Niterói',
    state: 'RJ',
    plan_id: 'plan_essencial'
  };

  for (const t of [tenantA, tenantB]) {
    await query(
      `INSERT INTO tenants (id, slug, name, legal_name, document_cnpj, email, phone, address_city, address_state, plan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.slug, t.name, t.legal_name, t.cnpj, t.email, t.phone, t.city, t.state, t.plan_id]
    );

    await query(
      `INSERT INTO tenant_settings (tenant_id, default_pix_key, pix_key_type, pix_recipient_name, whatsapp_contact)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id) DO NOTHING`,
      [t.id, t.cnpj, 'cnpj', t.legal_name, t.phone]
    );

    await query(
      `INSERT INTO tenant_branding (tenant_id, primary_color, secondary_color, accent_color, house_tradition, tagline)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (tenant_id) DO NOTHING`,
      [t.id, '#0e382b', '#1b4d3e', '#c5a059', 'Umbanda de Luz', 'Caridade, Amor e Respeito aos Guias']
    );
  }

  // 3. Password hashes
  const salt = await bcrypt.genSalt(10);
  const hashAdmin = await bcrypt.hash('admin123', salt);
  const hashAruanda = await bcrypt.hash('aruanda123', salt);
  const hashPena = await bcrypt.hash('penabranca123', salt);

  // Users
  const users = [
    {
      id: 'usr_superadmin',
      email: 'admin@7teknologia.com',
      password: hashAdmin,
      name: 'Administrador 7Teknologia',
      is_superadmin: true
    },
    {
      id: 'usr_dirigente_aruanda',
      email: 'dirigente@aruanda.org',
      password: hashAruanda,
      name: 'Mãe Mariana d’Oxum',
      is_superadmin: false
    },
    {
      id: 'usr_financeiro_aruanda',
      email: 'financeiro@aruanda.org',
      password: hashAruanda,
      name: 'Carlos Eduardo (Financeiro)',
      is_superadmin: false
    },
    {
      id: 'usr_membro_aruanda',
      email: 'membro@aruanda.org',
      password: hashAruanda,
      name: 'Juliana Silva',
      is_superadmin: false
    },
    {
      id: 'usr_dirigente_penabranca',
      email: 'dirigente@penabranca.org',
      password: hashPena,
      name: 'Pai Ogunté de Oxóssi',
      is_superadmin: false
    }
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, is_superadmin)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email, u.password, u.name, u.is_superadmin]
    );
  }

  // Memberships
  const memberships = [
    { id: 'mem_1', user_id: 'usr_superadmin', tenant_id: 'tenant-aruanda', role: 'dirigente' },
    { id: 'mem_2', user_id: 'usr_dirigente_aruanda', tenant_id: 'tenant-aruanda', role: 'dirigente' },
    { id: 'mem_3', user_id: 'usr_financeiro_aruanda', tenant_id: 'tenant-aruanda', role: 'financeiro' },
    { id: 'mem_4', user_id: 'usr_membro_aruanda', tenant_id: 'tenant-aruanda', role: 'membro' },
    { id: 'mem_5', user_id: 'usr_dirigente_penabranca', tenant_id: 'tenant-penabranca', role: 'dirigente' }
  ];

  for (const m of memberships) {
    await query(
      `INSERT INTO memberships (id, user_id, tenant_id, role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, tenant_id) DO NOTHING`,
      [m.id, m.user_id, m.tenant_id, m.role]
    );
  }

  // 4. CRM Pipeline Stages for Tenant A
  const stages = [
    { id: 'stage_1', name: 'Novo Contato', order_index: 1, color: '#3b82f6', is_terminal: false },
    { id: 'stage_2', name: 'Primeiro Contato Feito', order_index: 2, color: '#8b5cf6', is_terminal: false },
    { id: 'stage_3', name: 'Informações Fornecidas', order_index: 3, color: '#eab308', is_terminal: false },
    { id: 'stage_4', name: 'Inscrito em Evento/Gira', order_index: 4, color: '#06b6d4', is_terminal: false },
    { id: 'stage_5', name: 'Compareceu ao Terreiro', order_index: 5, color: '#10b981', is_terminal: false },
    { id: 'stage_6', name: 'Em Acompanhamento / Ingresso', order_index: 6, color: '#f59e0b', is_terminal: false },
    { id: 'stage_7', name: 'Membro Integrado', order_index: 7, color: '#059669', is_terminal: true }
  ];

  for (const st of stages) {
    await query(
      `INSERT INTO crm_pipeline_stages (id, tenant_id, name, order_index, color, is_terminal)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [st.id, 'tenant-aruanda', st.name, st.order_index, st.color, st.is_terminal]
    );
    // Also add to Tenant B with separate IDs
    await query(
      `INSERT INTO crm_pipeline_stages (id, tenant_id, name, order_index, color, is_terminal)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [`b_${st.id}`, 'tenant-penabranca', st.name, st.order_index, st.color, st.is_terminal]
    );
  }

  // 5. Financial Categories for Tenant A
  const categories = [
    // Revenue
    { id: 'cat_mensalidades', name: 'Mensalidades da Corrente', type: 'revenue', color: '#10b981' },
    { id: 'cat_doacoes', name: 'Doações Espontâneas', type: 'revenue', color: '#34d399' },
    { id: 'cat_rituais', name: 'Inscrições em Rituais a Distância', type: 'revenue', color: '#6ee7b7' },
    { id: 'cat_eventos', name: 'Festa e Rifas Beneficentes', type: 'revenue', color: '#a7f3d0' },
    // Expense
    { id: 'cat_aluguel', name: 'Aluguel do Imóvel', type: 'expense', color: '#ef4444' },
    { id: 'cat_energia', name: 'Energia Elétrica e Água', type: 'expense', color: '#f87171' },
    { id: 'cat_materiais', name: 'Velas, Ervas e Defumadores', type: 'expense', color: '#fb923c' },
    { id: 'cat_manutencao', name: 'Manutenção Predial e Pintura', type: 'expense', color: '#f43f5e' },
    { id: 'cat_alimentacao', name: 'Alimentação Comunitária', type: 'expense', color: '#fbbf24' }
  ];

  for (const c of categories) {
    await query(
      `INSERT INTO financial_categories (id, tenant_id, name, type, color, is_system)
       VALUES ($1, $2, $3, $4, $5, true) ON CONFLICT (id) DO NOTHING`,
      [c.id, 'tenant-aruanda', c.name, c.type, c.color]
    );
  }

  // 6. Financial Accounts for Tenant A
  await query(
    `INSERT INTO financial_accounts (id, tenant_id, name, type, bank_name, initial_balance, current_balance)
     VALUES 
     ('acc_banco_inter', 'tenant-aruanda', 'Banco Inter - Conta Corrente Principal', 'bank', 'Banco Inter', 5000.00, 8450.00),
     ('acc_caixa_fisico', 'tenant-aruanda', 'Caixa Pequeno Terreiro (Físico)', 'cash', 'Cofre da Casa', 300.00, 680.00),
     ('acc_reserva_rituais', 'tenant-aruanda', 'Conta PIX Rituais e Oferendas', 'pix', 'Nubank', 1200.00, 3950.00)
     ON CONFLICT (id) DO NOTHING`
  );

  // 7. Initial Members for Tenant A
  const members = [
    {
      id: 'mbr_1',
      tenant_id: 'tenant-aruanda',
      name: 'Mariana de Oliveira (Mãe Mariana)',
      role: 'Sacerdotisa / Dirigente',
      email: 'mariana.oxum@aruanda.org',
      phone: '(11) 98111-2233',
      status: 'active',
      date: '2015-04-23'
    },
    {
      id: 'mbr_2',
      tenant_id: 'tenant-aruanda',
      name: 'Antônio Ferreira (Capitão da Casa)',
      role: 'Pai Pequeno / Capitão',
      email: 'antonio.ogum@gmail.com',
      phone: '(11) 98222-3344',
      status: 'active',
      date: '2016-08-10'
    },
    {
      id: 'mbr_3',
      tenant_id: 'tenant-aruanda',
      name: 'Carlos Eduardo Santos',
      role: 'Ogã Curimbeiro / Tesoureiro',
      email: 'carlos.edu@aruanda.org',
      phone: '(11) 98333-4455',
      status: 'active',
      date: '2018-01-15'
    },
    {
      id: 'mbr_4',
      tenant_id: 'tenant-aruanda',
      name: 'Juliana Aparecida Silva',
      role: 'Médium de Desenvolvimento',
      email: 'juliana.silva@gmail.com',
      phone: '(11) 98444-5566',
      status: 'in_training',
      date: '2023-02-01'
    },
    {
      id: 'mbr_5',
      tenant_id: 'tenant-aruanda',
      name: 'Robson Lima dos Santos',
      role: 'Cambono',
      email: 'robson.santos@gmail.com',
      phone: '(11) 98555-6677',
      status: 'active',
      date: '2021-05-19'
    }
  ];

  for (const m of members) {
    await query(
      `INSERT INTO members (id, tenant_id, full_name, role_in_house, email, phone, status, entry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.tenant_id, m.name, m.role, m.email, m.phone, m.status, m.date]
    );
  }

  // 8. CRM Contacts for Tenant A
  await query(
    `INSERT INTO crm_contacts (id, tenant_id, full_name, email, phone, stage_id, relationship_type, source, notes)
     VALUES 
     ('crm_1', 'tenant-aruanda', 'Lucas Mendonça', 'lucas.mendonca@gmail.com', '(11) 97123-4567', 'stage_5', 'visitante', 'indicacao', 'Assistiu à gira de Caboclos em setembro, muito respeitoso. Quer saber datas de gira de cura.'),
     ('crm_2', 'tenant-aruanda', 'Fernanda Camargo', 'fernanda.c@hotmail.com', '(11) 97234-5678', 'stage_4', 'inscrito_evento', 'redes_sociais', 'Inscrita na Festa das Crianças de Ibeji.'),
     ('crm_3', 'tenant-aruanda', 'Marcos Vinicius Alves', 'm.alves@outlook.com', '(11) 97345-6789', 'stage_6', 'em_ingresso', 'formulario', 'Interesse no desenvolvimento mediúnico. Realizou primeira entrevista com a Dirigente.'),
     ('crm_4', 'tenant-aruanda', 'Beatriz Nogueira', 'beatriz.nog@uol.com.br', '(11) 97456-7890', 'stage_1', 'visitante', 'whatsapp', 'Pediu informações sobre passes e horário de atendimento.')
     ON CONFLICT (id) DO NOTHING`
  );

  // 9. Calendar Events for Tenant A
  await query(
    `INSERT INTO events (id, tenant_id, title, type, description, start_time, end_time, location, max_attendees, is_public)
     VALUES 
     ('evt_1', 'tenant-aruanda', 'Gira Pública de Pretos Velhos', 'gira_publica', 'Atendimento fraterno com os Vovôs e Vovós da Aruanda. Passe, bênção das ervas e descarrego.', '2026-10-31 19:30:00+00', '2026-10-31 22:30:00+00', 'Templo Principal', 80, true),
     ('evt_2', 'tenant-aruanda', 'Sessão Fechada de Desenvolvimento Mediúnico', 'gira_fechada', 'Instruções doutrinárias, alinhamento de guias e passe magnético para corrente interna.', '2026-11-04 20:00:00+00', '2026-11-04 22:00:00+00', 'Templo Principal', 35, false),
     ('evt_3', 'tenant-aruanda', 'Grande Louvação a Pai Ogum & Feijoada Beneficente', 'festa_anual', 'Cerimônia festiva com toques sagrados, seguida de almoço com arrecadação para o teto do terreiro.', '2026-11-15 11:00:00+00', '2026-11-15 17:00:00+00', 'Salão Comunitário', 150, true)
     ON CONFLICT (id) DO NOTHING`
  );

  // 10. Ritual Coletivo a Distância (Tenant A)
  await query(
    `INSERT INTO rituals (id, tenant_id, slug, title, subtitle, description, spiritual_guidance, ritual_date, cutoff_date, is_paid, price, max_participants, current_participants, status, pix_key, pix_recipient_name, whatsapp_phone)
     VALUES 
     ('rtl_prosperidade', 'tenant-aruanda', 'trabalho-prosperidade-oxum-2026', 
      'Trabalho Coletivo de Prosperidade e Abertura de Caminhos com Mamãe Oxum', 
      'Firmeza sagrada no congá com entrega de oferendas de caridade e irradiação a distância para sua vida financeira e pessoal.',
      'Ritual consagrado realizado pelo corpo sacerdotal do Terreiro Pai Benedito de Aruanda. Os nomes de todos os inscritos são firmados no alguidar dourado de Mamãe Oxum com mel, alfazema, sementes de girassol e velas amarelas aromáticas.',
      'No dia 12 de Novembro, às 20h, mantenha uma vela branca ou amarela acesa em sua casa e beba um copo de água fluidificada enquanto sintoniza suas orações com a corrente.',
      '2026-11-12 23:00:00+00', '2026-11-11 23:59:00+00', true, 54.00, 100, 3, 'published',
      '45.892.123/0001-90', 'Assoc Pai Benedito Aruanda', '(11) 98765-4321')
     ON CONFLICT (id) DO NOTHING`
  );

  // Registrations for the ritual
  await query(
    `INSERT INTO ritual_registrations (id, tenant_id, ritual_id, registration_code, participant_name, participant_email, participant_phone, intentions_text, payment_method, payment_status, amount_paid, manual_receipt_url, review_notes)
     VALUES 
     ('reg_1', 'tenant-aruanda', 'rtl_prosperidade', 'REG-OXUM-8491', 'Clara Meirelles', 'clara.meirelles@gmail.com', '(11) 99881-1223', 'Pedindo saúde para minha mãe e abertura de novos clientes para minha loja de artesanato.', 'pix_manual', 'confirmed', 54.00, 'https://storage.7teknologia.com/receipts/comp_8491.pdf', 'Comprovante conferido no extrato bancário por Carlos.'),
     ('reg_2', 'tenant-aruanda', 'rtl_prosperidade', 'REG-OXUM-8492', 'Rodrigo Peixoto', 'rodrigo.px@gmail.com', '(21) 98772-3344', 'Harmonia em família e proteção contra inveja no trabalho.', 'pix_manual', 'under_review', 54.00, 'https://storage.7teknologia.com/receipts/comp_8492.jpg', 'Comprovante anexado pelo WhatsApp aguardando conferência do financeiro.'),
     ('reg_3', 'tenant-aruanda', 'rtl_prosperidade', 'REG-OXUM-8493', 'Tatiane Farias', 'tati.farias@outlook.com', '(11) 97663-4455', 'Equilíbrio emocional e gratidão a Oxum.', 'gateway_card', 'confirmed', 54.00, NULL, 'Pago via Checkout Mercado Pago.')
     ON CONFLICT (id) DO NOTHING`
  );

  // 11. Financial Transactions
  await query(
    `INSERT INTO financial_transactions (id, tenant_id, account_id, category_id, type, amount, description, due_date, payment_date, status, payment_method, payer_or_payee)
     VALUES
     ('txn_1', 'tenant-aruanda', 'acc_banco_inter', 'cat_mensalidades', 'revenue', 2500.00, 'Mensalidades da Corrente - Outubro/2026', '2026-10-10', '2026-10-09', 'completed', 'pix', 'Membros da Corrente'),
     ('txn_2', 'tenant-aruanda', 'acc_reserva_rituais', 'cat_rituais', 'revenue', 108.00, 'Inscrições Ritual Oxum (Clara & Tatiane)', '2026-10-20', '2026-10-20', 'completed', 'pix', 'Participantes Rituais'),
     ('txn_3', 'tenant-aruanda', 'acc_banco_inter', 'cat_doacoes', 'revenue', 450.00, 'Doações espontâneas na gira de cura', '2026-10-18', '2026-10-18', 'completed', 'dinheiro', 'Assistência Pública'),
     ('txn_4', 'tenant-aruanda', 'acc_banco_inter', 'cat_aluguel', 'expense', 1800.00, 'Aluguel do Imóvel do Templo (Mês Outubro)', '2026-10-05', '2026-10-05', 'completed', 'transferencia', 'Imobiliária Alvorada'),
     ('txn_5', 'tenant-aruanda', 'acc_banco_inter', 'cat_energia', 'expense', 432.50, 'Conta de Energia Elétrica (Enel)', '2026-10-15', '2026-10-14', 'completed', 'boleto', 'Enel Distribuição SP'),
     ('txn_6', 'tenant-aruanda', 'acc_caixa_fisico', 'cat_materiais', 'expense', 260.00, 'Compra de 30 caixas de velas de 7 dias e ervas frescas', '2026-10-22', '2026-10-22', 'completed', 'pix', 'Casa de Ervas São Jorge'),
     ('txn_7', 'tenant-aruanda', 'acc_banco_inter', 'cat_manutencao', 'expense', 750.00, 'Conserto calha telhado e troca de lâmpadas do salão', '2026-11-05', NULL, 'pending', 'pix', 'Eletricista Sebastião')
     ON CONFLICT (id) DO NOTHING`
  );

  // 12. Inventory Items
  await query(
    `INSERT INTO inventory_items (id, tenant_id, name, category, unit, quantity, min_quantity, unit_cost, supplier_name, storage_location)
     VALUES
     ('inv_1', 'tenant-aruanda', 'Vela Branca de 7 Dias', 'velas', 'un', 48.00, 20.00, 7.50, 'Fábrica São Sebastião', 'Armário do Congá'),
     ('inv_2', 'tenant-aruanda', 'Vela Bicolor Vermelha e Preta', 'velas', 'un', 14.00, 15.00, 8.20, 'Fábrica São Sebastião', 'Prateleira Esquerda'),
     ('inv_3', 'tenant-aruanda', 'Defumador em Pó Aruanda (Ervas Puras)', 'defumacao', 'kg', 8.50, 4.00, 32.00, 'Casa de Ervas Pai Joaquim', 'Depósito de Materiais'),
     ('inv_4', 'tenant-aruanda', 'Alfazema Líquida Concentrada', 'ervas_essencias', 'litro', 3.00, 5.00, 24.00, 'Distribuidora Flora Mística', 'Prateleira dos Médiuns'),
     ('inv_5', 'tenant-aruanda', 'Pólvora para Descarrego Litúrgico', 'liturgia', 'un', 2.00, 3.00, 18.00, 'Armazém Tradicional', 'Armário Trancado de Ferro')
     ON CONFLICT (id) DO NOTHING`
  );

  // 13. Tenant B (Caboclo Pena Branca) Data for Cross-Tenant Proof
  await query(
    `INSERT INTO members (id, tenant_id, full_name, role_in_house, email, phone, status, entry_date)
     VALUES 
     ('mbr_pena_1', 'tenant-penabranca', 'Pai Ogunté de Oxóssi', 'Babalorixá Dirigente', 'dirigente@penabranca.org', '(21) 97654-3210', 'active', '2010-06-12'),
     ('mbr_pena_2', 'tenant-penabranca', 'Severino do Nascimento', 'Pai Pequeno', 'severino@penabranca.org', '(21) 97111-2222', 'active', '2012-09-01')
     ON CONFLICT (id) DO NOTHING`
  );

  await query(
    `INSERT INTO financial_accounts (id, tenant_id, name, type, bank_name, initial_balance, current_balance)
     VALUES ('acc_pena_1', 'tenant-penabranca', 'Banco do Brasil - Conta Tenda', 'bank', 'Banco do Brasil', 2000.00, 3100.00)
     ON CONFLICT (id) DO NOTHING`
  );

  await query(
    `INSERT INTO financial_categories (id, tenant_id, name, type, color, is_system)
     VALUES ('cat_pena_mens', 'tenant-penabranca', 'Mensalidade Irmandade', 'revenue', '#10b981', true)
     ON CONFLICT (id) DO NOTHING`
  );

  await query(
    `INSERT INTO financial_transactions (id, tenant_id, account_id, category_id, type, amount, description, due_date, payment_date, status, payment_method)
     VALUES ('txn_pena_1', 'tenant-penabranca', 'acc_pena_1', 'cat_pena_mens', 'revenue', 980.00, 'Mensalidades Pena Branca', '2026-10-15', '2026-10-15', 'completed', 'pix')
     ON CONFLICT (id) DO NOTHING`
  );

  // 14. Initial Announcements
  await query(
    `INSERT INTO announcements (id, tenant_id, title, content, target_audience, priority, is_pinned)
     VALUES 
     ('anc_1', 'tenant-aruanda', 'Preparação para a Gira de Pretos Velhos no Sábado', 'Pedimos a todos os médiuns da corrente que cheguem com 45 minutos de antecedência para a defumação e recolhimento no congá. Não esquecer toalhas brancas limpas e velas votivas.', 'corrente', 'alta', true),
     ('anc_2', 'tenant-aruanda', 'Mutirão de Limpeza e Pintura do Salão Anexo', 'No próximo domingo às 09h realizaremos o mutirão voluntário. Quem puder trazer materiais de pintura ou contribuir com o lanche comunitário, favor avisar o irmão Robson.', 'todos', 'normal', false)
     ON CONFLICT (id) DO NOTHING`
  );

  // 15. Initial Audit Log
  await query(
    `INSERT INTO audit_logs (id, tenant_id, actor_name, action, entity_type, entity_id, details_json)
     VALUES 
     ('aud_init_1', 'tenant-aruanda', 'Sistema 7Teknologia', 'TENANT_PROVISIONED', 'tenants', 'tenant-aruanda', '{"status": "active", "plan": "gestao"}'::jsonb),
     ('aud_init_2', 'tenant-aruanda', 'Carlos Eduardo (Financeiro)', 'FINANCIAL_TRANSACTION_APPROVED', 'financial_transactions', 'txn_1', '{"amount": 2500, "type": "revenue"}'::jsonb)
     ON CONFLICT (id) DO NOTHING`
  );
}
