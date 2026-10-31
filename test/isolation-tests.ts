import bcrypt from 'bcryptjs';
import { db, initDatabase, query, queryOne } from '../src/server/db.js';
import { generateToken } from '../src/server/auth.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 7 GESTÃO DE TERREIROS (7Teknologia) — TESTES');
  console.log('   Isolamento Multi-tenant, Segurança & Persistência');
  console.log('====================================================\n');

  await initDatabase();

  // Test 1: PostgreSQL Engine and Tables
  console.log('--- 1. VERIFICAÇÃO DO BANCO DE DADOS POSTGRESQL ---');
  const pgVersion = await queryOne<any>('SELECT version()');
  assert(!!pgVersion?.version, 'PostgreSQL engine operational', pgVersion?.version);

  const tables = await query<any>(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  const tableNames = tables.map(t => t.table_name);
  assert(tableNames.includes('tenants'), 'Tabela tenants presente');
  assert(tableNames.includes('memberships'), 'Tabela memberships presente');
  assert(tableNames.includes('members'), 'Tabela members presente');
  assert(tableNames.includes('financial_transactions'), 'Tabela financial_transactions presente');
  assert(tableNames.includes('rituals'), 'Tabela rituals presente');
  assert(tableNames.includes('ritual_registrations'), 'Tabela ritual_registrations presente');
  assert(tableNames.includes('audit_logs'), 'Tabela audit_logs presente');

  // Test 2: Multi-Tenants Seeded
  console.log('\n--- 2. MULTI-TENANCY: DOIS TERREIROS INDEPENDENTES ---');
  const tenantA = await queryOne<any>("SELECT * FROM tenants WHERE id = 'tenant-aruanda'");
  const tenantB = await queryOne<any>("SELECT * FROM tenants WHERE id = 'tenant-penabranca'");
  assert(tenantA?.slug === 'pai-benedito-aruanda', 'Terreiro A configurado: Pai Benedito');
  assert(tenantB?.slug === 'caboclo-pena-branca', 'Terreiro B configurado: Pena Branca');

  // Test 3: Authenticated Users & Password Hashing
  console.log('\n--- 3. AUTENTICAÇÃO E HASH SEGURO BCRYPT ---');
  const userDirigenteA = await queryOne<any>("SELECT * FROM users WHERE email = 'dirigente@aruanda.org'");
  const userDirigenteB = await queryOne<any>("SELECT * FROM users WHERE email = 'dirigente@penabranca.org'");
  const userMembroA = await queryOne<any>("SELECT * FROM users WHERE email = 'membro@aruanda.org'");
  const superAdmin = await queryOne<any>("SELECT * FROM users WHERE email = 'admin@7teknologia.com'");

  assert(await bcrypt.compare('aruanda123', userDirigenteA.password_hash), 'Senha Dirigente Terreiro A válida via bcrypt');
  assert(await bcrypt.compare('penabranca123', userDirigenteB.password_hash), 'Senha Dirigente Terreiro B válida via bcrypt');
  assert(await bcrypt.compare('wrongpassword', userDirigenteA.password_hash) === false, 'Senha incorreta é rejeitada');
  assert(superAdmin.is_superadmin === true, 'Superadmin 7Teknologia possui flag global');

  // Test 4: Memberships Verification
  console.log('\n--- 4. VÍNCULOS DE PERMISSÃO (MEMBERSHIPS) ---');
  const memDirA = await queryOne<any>(
    'SELECT * FROM memberships WHERE user_id = $1 AND tenant_id = $2',
    [userDirigenteA.id, tenantA.id]
  );
  assert(memDirA?.role === 'dirigente', 'Usuário A é Dirigente do Terreiro A');

  const memDirBInA = await queryOne<any>(
    'SELECT * FROM memberships WHERE user_id = $1 AND tenant_id = $2',
    [userDirigenteB.id, tenantA.id]
  );
  assert(!memDirBInA, 'Dirigente do Terreiro B NÃO possui vínculo com Terreiro A');

  // Test 5: Strict Data Isolation (Cross-Tenant Boundary)
  console.log('\n--- 5. PROVA DE ISOLAMENTO RIGOROSO ENTRE TENANTS ---');
  // Tenant A members
  const membersA = await query<any>('SELECT * FROM members WHERE tenant_id = $1', [tenantA.id]);
  const membersB = await query<any>('SELECT * FROM members WHERE tenant_id = $1', [tenantB.id]);
  assert(membersA.length > 0, `Terreiro A possui ${membersA.length} membros`);
  assert(membersB.length > 0, `Terreiro B possui ${membersB.length} membros`);

  const crossLeak = membersA.some(mA => membersB.some(mB => mB.id === mA.id));
  assert(!crossLeak, 'Nenhum membro compartilhado ou vazado entre tenants');

  // Attempting to select Tenant A's financial transactions with Tenant B's tenant_id filter returns 0 rows
  const forgedQuery = await query<any>(
    "SELECT * FROM financial_transactions WHERE tenant_id = 'tenant-penabranca' AND id = 'txn_1'"
  );
  assert(forgedQuery.length === 0, 'Transação do Terreiro A invisível sob o tenant_id do Terreiro B');

  // Test 6: Financial Integrity and Balance Calculations
  console.log('\n--- 6. INTEGRIDADE FINANCEIRA E CÁLCULO DE CAIXA ---');
  const acc = await queryOne<any>("SELECT * FROM financial_accounts WHERE id = 'acc_banco_inter'");
  assert(Number(acc.current_balance) > 0, `Saldo atual do Banco Inter: R$ ${acc.current_balance}`);

  // Test 7: Public Ritual & Registration Code Flow
  console.log('\n--- 7. RITUAIS COLETIVOS E INSCRIÇÃO ---');
  const ritual = await queryOne<any>("SELECT * FROM rituals WHERE slug = 'trabalho-prosperidade-oxum-2026'");
  assert(!!ritual, 'Ritual público de Prosperidade com Oxum ativo');
  assert(Number(ritual.price) === 54.00, 'Valor de R$ 54,00 registrado com precisão decimal NUMERIC');

  const regs = await query<any>('SELECT * FROM ritual_registrations WHERE ritual_id = $1', [ritual.id]);
  assert(regs.length >= 3, `Inscrições registradas para o ritual: ${regs.length}`);

  // Test 8: Audit Log Persistence
  console.log('\n--- 8. TRILHA DE AUDITORIA PERSISTENTE ---');
  const auditLogs = await query<any>('SELECT * FROM audit_logs WHERE tenant_id = $1', [tenantA.id]);
  assert(auditLogs.length > 0, `Logs de auditoria gravados para Terreiro A: ${auditLogs.length}`);

  console.log('\n====================================================');
  console.log(`🏁 RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
