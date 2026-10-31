-- 7 Gestão de Terreiros (Uma solução 7Teknologia) - PostgreSQL Schema DDL
-- Multi-tenant architecture with strict tenant isolation, foreign keys, and indexes

-- 1. SaaS Global Catalog & Tenants
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_monthly NUMERIC(10, 2) NOT NULL,
  max_members INTEGER NOT NULL,
  max_rituals_per_month INTEGER NOT NULL,
  features_json JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  document_cnpj TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address_city TEXT,
  address_state TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  plan_id TEXT REFERENCES plans(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  default_pix_key TEXT,
  pix_key_type TEXT DEFAULT 'chave_aleatoria',
  pix_recipient_name TEXT,
  whatsapp_contact TEXT,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  currency TEXT DEFAULT 'BRL',
  allow_public_rituals BOOLEAN DEFAULT TRUE,
  auto_notify_whatsapp BOOLEAN DEFAULT TRUE,
  auto_notify_email BOOLEAN DEFAULT TRUE,
  settings_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_branding (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '#0e382b',
  secondary_color TEXT DEFAULT '#1b4d3e',
  accent_color TEXT DEFAULT '#c5a059',
  logo_url TEXT,
  banner_url TEXT,
  house_tradition TEXT DEFAULT 'Umbanda',
  tagline TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users, Memberships & Permissions
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_superadmin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'dirigente',
    'admin_casa',
    'financeiro',
    'responsavel_area',
    'responsavel_rituais',
    'responsavel_crm',
    'membro',
    'visitante'
  )),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tenant_id)
);

-- 3. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Members (Pessoas / Comunidade do Terreiro)
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  spiritual_name TEXT,
  email TEXT,
  phone TEXT,
  document_cpf TEXT,
  birth_date DATE,
  entry_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'in_training', 'licensed', 'inactive', 'honorary')),
  role_in_house TEXT DEFAULT 'Filho(a) de Fé',
  emergency_contact TEXT,
  emergency_phone TEXT,
  notes TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  consent_communication BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CRM (Contatos, Funil, Oportunidades, Atividades)
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  is_terminal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  stage_id TEXT REFERENCES crm_pipeline_stages(id) ON DELETE SET NULL,
  relationship_type TEXT DEFAULT 'visitante' CHECK (relationship_type IN (
    'visitante',
    'interessado',
    'inscrito_evento',
    'participante_ritual',
    'em_ingresso',
    'membro_ativo',
    'parceiro_fornecedor',
    'contato_administrativo'
  )),
  source TEXT DEFAULT 'indicacao',
  notes TEXT,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  consent_whatsapp BOOLEAN DEFAULT TRUE,
  consent_email BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('ligacao', 'conversa_whatsapp', 'atendimento', 'visita', 'email', 'participacao', 'tarefa_followup')),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Events & Calendar (Giras, Festas, Sessões, Reuniões)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gira_publica', 'gira_fechada', 'festa_anual', 'sessao_cura', 'estudo', 'mutirao', 'reuniao_admin')),
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  max_attendees INTEGER,
  is_public BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  organizer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_attendees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES crm_contacts(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('registered', 'confirmed', 'attended', 'cancelled')),
  checkin_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Rituais Coletivos a Distância
CREATE TABLE IF NOT EXISTS rituals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL,
  spiritual_guidance TEXT,
  ritual_date TIMESTAMP WITH TIME ZONE NOT NULL,
  cutoff_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_paid BOOLEAN DEFAULT TRUE,
  price NUMERIC(10, 2) DEFAULT 0.00,
  max_participants INTEGER DEFAULT 100,
  current_participants INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'completed', 'cancelled')),
  image_url TEXT,
  pix_key TEXT,
  pix_recipient_name TEXT,
  whatsapp_phone TEXT,
  cancellation_policy TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS ritual_registrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ritual_id TEXT NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  registration_code TEXT UNIQUE NOT NULL,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  participant_phone TEXT NOT NULL,
  intentions_text TEXT,
  payment_method TEXT DEFAULT 'pix_manual' CHECK (payment_method IN ('pix_manual', 'gateway_card', 'gateway_pix', 'gratuito')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'under_review', 'confirmed', 'rejected', 'refunded')),
  amount_paid NUMERIC(10, 2) DEFAULT 0.00,
  manual_receipt_url TEXT,
  receipt_filename TEXT,
  review_notes TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  confirmation_sent_whatsapp BOOLEAN DEFAULT FALSE,
  confirmation_sent_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Financeiro (Contas, Categorias, Lançamentos, Transferências, Fechamentos)
CREATE TABLE IF NOT EXISTS financial_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'bank' CHECK (type IN ('bank', 'cash', 'pix', 'gateway_reserve')),
  bank_name TEXT,
  account_number TEXT,
  initial_balance NUMERIC(12, 2) DEFAULT 0.00,
  current_balance NUMERIC(12, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  color TEXT DEFAULT '#10b981',
  parent_id TEXT REFERENCES financial_categories(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES financial_categories(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  payment_method TEXT DEFAULT 'pix' CHECK (payment_method IN ('pix', 'dinheiro', 'transferencia', 'boleto', 'cartao', 'outro')),
  payer_or_payee TEXT,
  receipt_url TEXT,
  ritual_id TEXT REFERENCES rituals(id) ON DELETE SET NULL,
  ritual_registration_id TEXT REFERENCES ritual_registrations(id) ON DELETE SET NULL,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_transfers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  destination_account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  transfer_date DATE NOT NULL,
  description TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_period_closures (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL, -- e.g. "2026-09"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_revenue NUMERIC(12, 2) NOT NULL,
  total_expense NUMERIC(12, 2) NOT NULL,
  net_result NUMERIC(12, 2) NOT NULL,
  closed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Estoque & Patrimônio
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'velas_defumadores',
  unit TEXT DEFAULT 'un' CHECK (unit IN ('un', 'kg', 'pacote', 'litro', 'caixa', 'rolo', 'metro')),
  quantity NUMERIC(10, 2) DEFAULT 0.00,
  min_quantity NUMERIC(10, 2) DEFAULT 5.00,
  unit_cost NUMERIC(10, 2) DEFAULT 0.00,
  supplier_name TEXT,
  storage_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida', 'ajuste_inventario', 'perda')),
  quantity NUMERIC(10, 2) NOT NULL,
  unit_cost NUMERIC(10, 2),
  notes TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Comunicação & Mural de Avisos
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT DEFAULT 'todos' CHECK (target_audience IN ('todos', 'corrente', 'dirigentes', 'novos_membros')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. LGPD & Privacidade
CREATE TABLE IF NOT EXISTS lgpd_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('exportacao', 'correcao', 'revogacao_consentimento', 'exclusao')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed', 'rejected')),
  response_notes TEXT,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance & tenant isolation
CREATE INDEX IF NOT EXISTS idx_memberships_user_tenant ON memberships(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_tenant ON members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tenant ON crm_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id, start_time);
CREATE INDEX IF NOT EXISTS idx_rituals_tenant ON rituals(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_ritual_reg_tenant ON ritual_registrations(tenant_id, ritual_id);
CREATE INDEX IF NOT EXISTS idx_fin_trans_tenant ON financial_transactions(tenant_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
