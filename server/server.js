require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const xssClean = require('xss-clean');
const { apiLimiter } = require('./security/rate-limit');
const adminRoutes = require('./routes/admin');
const { initDB } = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.disable('x-powered-by');
app.use(helmet());
app.use(xssClean());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use('/api', apiLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.NODE_ENV==='production', sameSite: 'lax', maxAge: 1000*60*60*8 }
}));
(async ()=>{
  await initDB();
  const staticRoot = path.resolve(__dirname, '..', 'public');
  app.use(express.static(staticRoot, { extensions: ['html'] }));
  app.use('/api/admin', adminRoutes);
  app.get('*', (req, res) => res.sendFile(path.join(staticRoot, 'index.html')));
  app.listen(PORT, ()=>console.log(`✅ Server running on port ${PORT}`));
})();