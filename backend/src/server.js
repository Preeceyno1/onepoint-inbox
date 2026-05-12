import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { readDb, writeDb, publicUser } from './db.js';
import { markWhatsAppRead } from './connectors/whatsapp.js';
import { markFacebookOrInstagramRead, normaliseMetaWebhook } from './connectors/meta.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' } });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEMO_EMAIL = 'demo@onepoint.app';

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

function tokenFor(user) { return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' }); }
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Invalid token' }); }
}
function demoUserId() { return readDb().users.find(u => u.email === DEMO_EMAIL)?.id || readDb().users[0]?.id; }
function emitInbox(userId) { io.to(userId).emit('inbox:changed'); }
function visibleMessages(db, userId) {
  const enabled = new Set(db.connectors.filter(c => c.userId === userId && c.enabled).map(c => c.source));
  return db.messages.filter(m => m.userId === userId && enabled.has(m.source)).sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt));
}
function infer(text='') {
  const priority = /urgent|today|asap|complaint|refund|address|available|pay/i.test(text) ? 'high' : 'normal';
  const intent = /price|available|buy|pay|order|collect/i.test(text) ? 'sales' : /refund|problem|delivery|address|issue/i.test(text) ? 'support' : 'general';
  return { priority, intent };
}
function normaliseMessage(userId, message) {
  const { priority, intent } = infer(message.text || '');
  return { id: uuid(), userId, read: false, priority, intent, assignedTo: 'Unassigned', notes: [], snoozedUntil: null, avatar: message.senderName?.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() || '??', receivedAt: new Date().toISOString(), ...message };
}

io.use((socket, next) => {
  try { socket.user = jwt.verify(socket.handshake.auth?.token, JWT_SECRET); next(); } catch { next(new Error('unauthorized')); }
});
io.on('connection', socket => socket.join(socket.user.sub));

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  const db = readDb();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'Email already registered' });
  const user = { id: uuid(), name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), createdAt: new Date().toISOString() };
  db.users.push(user);
  for (const source of ['instagram','facebook','whatsapp','email','sms']) db.connectors.push({ id: uuid(), userId: user.id, source, enabled: source !== 'sms', connected: source === 'email', authMode: source === 'whatsapp' ? 'WhatsApp Cloud API' : source === 'sms' ? 'Twilio / SMS provider' : 'OAuth', limitation: 'Connect real provider credentials in production.' });
  writeDb(db);
  res.status(201).json({ user: publicUser(user), token: tokenFor(user) });
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid login' });
  res.json({ user: publicUser(user), token: tokenFor(user) });
});
app.get('/api/auth/me', auth, (req, res) => {
  const user = readDb().users.find(u => u.id === req.user.sub);
  res.json({ user: publicUser(user) });
});

app.get('/api/connectors', auth, (req, res) => res.json(readDb().connectors.filter(c => c.userId === req.user.sub)));
app.patch('/api/connectors/:source', auth, (req, res) => {
  const db = readDb();
  const connector = db.connectors.find(c => c.userId === req.user.sub && c.source === req.params.source);
  if (!connector) return res.status(404).json({ error: 'Unknown connector' });
  connector.enabled = Boolean(req.body.enabled);
  writeDb(db); emitInbox(req.user.sub); res.json(connector);
});
app.get('/api/messages', auth, (req, res) => res.json(visibleMessages(readDb(), req.user.sub)));
app.get('/api/analytics', auth, (req, res) => {
  const db = readDb(); const visible = visibleMessages(db, req.user.sub);
  res.json({ total: visible.length, unread: visible.filter(m=>!m.read).length, urgent: visible.filter(m=>['urgent','high'].includes(m.priority)).length, sales: visible.filter(m=>m.intent==='sales').length, sources: db.connectors.filter(c=>c.userId===req.user.sub).map(c=>({ source:c.source, enabled:c.enabled, count: visible.filter(m=>m.source===c.source).length })) });
});
app.post('/api/messages/mock', auth, (req, res) => {
  const db = readDb(); const msg = normaliseMessage(req.user.sub, req.body); db.messages.unshift(msg); writeDb(db); emitInbox(req.user.sub); res.status(201).json(msg);
});
app.post('/api/messages/:id/read', auth, async (req, res) => {
  const db = readDb(); const msg = db.messages.find(m => m.userId === req.user.sub && m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  msg.read = true; writeDb(db); emitInbox(req.user.sub);
  try { if (msg.source === 'whatsapp') await markWhatsAppRead(msg.sourceMessageId); if (msg.source === 'facebook' || msg.source === 'instagram') await markFacebookOrInstagramRead(msg); res.json({ ...msg, syncedToSource: true }); }
  catch (error) { res.status(502).json({ ...msg, syncedToSource: false, syncError: error.message }); }
});
app.patch('/api/messages/:id', auth, (req, res) => {
  const db = readDb(); const msg = db.messages.find(m => m.userId === req.user.sub && m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  Object.assign(msg, req.body); writeDb(db); emitInbox(req.user.sub); res.json(msg);
});
app.post('/api/messages/:id/notes', auth, (req, res) => {
  const db = readDb(); const msg = db.messages.find(m => m.userId === req.user.sub && m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  const note = String(req.body.note || '').trim(); if (!note) return res.status(400).json({ error: 'Note is required' });
  msg.notes.push(note); writeDb(db); emitInbox(req.user.sub); res.json(msg);
});
app.post('/api/ai/suggest-replies', auth, (req, res) => {
  const { message, tone = 'friendly' } = req.body; const text = message?.text || '';
  const templates = {
    friendly: [`Thanks for messaging! Yes, I can help with that.`, `Hi ${message?.senderName?.split(' ')[0] || 'there'}, thanks for reaching out — let me check this for you now.`, `Absolutely, I’ll sort that for you.`],
    professional: [`Thanks for your message. I’ll review this and come back to you shortly.`, `Hello, thank you for getting in touch. I can assist with this.`, `I’ve received your message and will confirm the details shortly.`],
    sales: [`Yes, it’s available. Would you like me to reserve it for you?`, `Thanks for asking — I can send the details and payment options now.`, `Great timing, I can help you place the order today.`],
    short: [`Yes, no problem.`, `I’ll check now.`, `Thanks — I’ll confirm shortly.`]
  };
  const smart = /available|price|pay|buy|collect/i.test(text) ? 'sales' : tone;
  res.json({ tone: smart, suggestions: templates[smart] || templates.friendly });
});

app.get('/webhooks/meta', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.META_VERIFY_TOKEN) return res.status(200).send(req.query['hub.challenge']);
  res.sendStatus(403);
});
app.post('/webhooks/meta', (req, res) => {
  const userId = demoUserId(); const db = readDb();
  for (const entry of req.body.entry || []) { const msg = normaliseMetaWebhook(entry, userId); if (msg) db.messages.unshift(normaliseMessage(userId, msg)); }
  writeDb(db); emitInbox(userId); res.sendStatus(200);
});
app.post('/webhooks/whatsapp', (req, res) => {
  const userId = demoUserId(); const value = req.body?.entry?.[0]?.changes?.[0]?.value; const incoming = value?.messages?.[0]; const contact = value?.contacts?.[0];
  if (incoming) { const db = readDb(); db.messages.unshift(normaliseMessage(userId, { source: 'whatsapp', sourceMessageId: incoming.id, conversationId: incoming.from, senderName: contact?.profile?.name || incoming.from, senderHandle: incoming.from, text: incoming.text?.body || '[Unsupported WhatsApp message type]' })); writeDb(db); emitInbox(userId); }
  res.sendStatus(200);
});

const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`OnePoint Inbox backend running on http://localhost:${port}`));
