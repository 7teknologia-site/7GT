import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './src/server/db.js';
import { authRouter } from './src/server/routes/authRoutes.js';
import { dashboardRouter } from './src/server/routes/dashboardRoutes.js';
import { membersRouter } from './src/server/routes/membersRoutes.js';
import { crmRouter } from './src/server/routes/crmRoutes.js';
import { ritualsRouter } from './src/server/routes/ritualsRoutes.js';
import { financialRouter } from './src/server/routes/financialRoutes.js';
import { eventsRouter } from './src/server/routes/eventsRoutes.js';
import { inventoryRouter } from './src/server/routes/inventoryRoutes.js';
import { adminRouter } from './src/server/routes/adminRoutes.js';
import { settingsRouter } from './src/server/routes/settingsRoutes.js';
import { auditRouter } from './src/server/routes/auditRoutes.js';
import { announcementsRouter, lgpdRouter } from './src/server/routes/announcementsRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    product: '7 Gestão de Terreiros',
    developer: '7Teknologia',
    signature: 'Uma solução 7Teknologia.',
    version: '2.0.0-audited',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/members', membersRouter);
app.use('/api/crm', crmRouter);
app.use('/api/rituals', ritualsRouter);
app.use('/api/financial', financialRouter);
app.use('/api/events', eventsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/lgpd', lgpdRouter);

async function startServer() {
  try {
    // 1. Initialize PostgreSQL database and seed data
    await initDatabase();

    // 2. Setup Vite dev middleware in development
    if (process.env.NODE_ENV !== 'production') {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist/index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[7Teknologia] 7 Gestão de Terreiros running at http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();
