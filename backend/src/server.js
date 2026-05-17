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
import OpenAI from 'openai';
import {
  testDatabase,
  getMessages,
  createMessage,
  markMessageRead,
  addMessageNote,
  archiveMessage,
  moveMessageToFolder,
  getFolders,
  createFolder
} from './database.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEMO_EMAIL = 'demo@onepoint.app';

app.use(cors({ origin: '*' }));
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
app.get('/api/db-health', async (_, res) => {
  try {
    const result = await testDatabase();
    res.json({ ok: true, databaseTime: result.now });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
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
app.get('/api/messages', auth, async (req, res) => {
  const messages = await getMessages(req.user.sub);
  res.json(messages.map(dbMessageToFrontend));
});
app.get('/api/analytics', auth, (req, res) => {
  const db = readDb(); const visible = visibleMessages(db, req.user.sub);
  res.json({ total: visible.length, unread: visible.filter(m=>!m.read).length, urgent: visible.filter(m=>['urgent','high'].includes(m.priority)).length, sales: visible.filter(m=>m.intent==='sales').length, sources: db.connectors.filter(c=>c.userId===req.user.sub).map(c=>({ source:c.source, enabled:c.enabled, count: visible.filter(m=>m.source===c.source).length })) });
});
app.post('/api/messages/mock', auth, async (req, res) => {
  const msg = normaliseMessage(req.user.sub, req.body);
  const saved = await createMessage(msg);
  emitInbox(req.user.sub);
  res.status(201).json(dbMessageToFrontend(saved));
});
app.post('/api/messages/:id/read', auth, async (req, res) => {
  const msg = await markMessageRead(req.params.id);

  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }

  emitInbox(req.user.sub);
  res.json({ ...dbMessageToFrontend(msg), syncedToSource: true });
});
app.patch('/api/messages/:id', auth, (req, res) => {
  const db = readDb(); const msg = db.messages.find(m => m.userId === req.user.sub && m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  Object.assign(msg, req.body); writeDb(db); emitInbox(req.user.sub); res.json(msg);
});
app.post('/api/messages/:id/notes', auth, async (req, res) => {
  const note = String(req.body.note || '').trim();

  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }

  await addMessageNote(req.params.id, note);
  emitInbox(req.user.sub);

  res.json({ ok: true });
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
async function askOpenAI(instruction, input) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing from backend/.env');
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: instruction
      },
      {
        role: 'user',
        content: input
      }
    ]
  });

  return completion.choices?.[0]?.message?.content || '';
}
app.post('/api/ai/suggest-replies', auth, async (req, res) => {
  try {
    const { message, tone = 'friendly' } = req.body;

    const prompt = `
Customer message:f
${message?.text || ''}

Customer name:
${message?.senderName || 'Customer'}

Tone:
${tone}

Create exactly 3 short reply options.
Return each reply on a new line.
Do not number them.
`;

    const output = await askOpenAI(
      'You are an expert customer service and sales reply assistant.',
      prompt
    );

    const suggestions = output
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 3);

    res.json({ suggestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI reply generation failed' });
  }
});

app.post('/api/ai/improve-reply', auth, async (req, res) => {
  try {
    const { text = '', mode = 'grammar' } = req.body;

    if (!text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const instructions = {
      grammar: 'Fix spelling, grammar and punctuation while keeping the same meaning.',
      punctuation: 'Improve only punctuation, spacing and sentence flow.',
      professional: 'Rewrite in a clear, professional business tone.',
      friendly: 'Rewrite in a warm, friendly and natural tone.',
      short: 'Make this reply shorter while keeping the meaning.',
      persuasive: 'Rewrite to sound more persuasive and sales-focused without being pushy.',
      apology: 'Rewrite as a polite apology response that sounds sincere.'
    };

    const improved = await askOpenAI(
      instructions[mode] || instructions.grammar,
      text
    );

    res.json({
      mode,
      improved
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI improvement failed' });
  }
});

app.post('/api/ai/summarise-message', auth, async (req, res) => {
  try {
    const { message } = req.body;

    const summary = await askOpenAI(
      'Summarise this customer message in one short useful sentence for a business owner.',
      message?.text || ''
    );

    res.json({ summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI summary failed' });
  }
});
function dbMessageToFrontend(row) {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    sourceMessageId: row.source_message_id,
    conversationId: row.conversation_id,
    senderName: row.sender_name,
    senderHandle: row.sender_handle,
    text: row.text,
    receivedAt: row.received_at,
    read: row.read,
    archived: row.archived,
    folderId: row.folder_id,
    priority: row.priority,
    intent: row.intent,
    avatar: row.avatar,
    assignedTo: row.assigned_to,
    snoozedUntil: row.snoozed_until,
    notes: []
  };
}
app.get('/api/folders', auth, async (req, res) => {
  const folders = await getFolders(req.user.sub);
  res.json(folders);
});

app.post('/api/folders', auth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const parentId = req.body.parentId || null;

  if (!name) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const folder = await createFolder(req.user.sub, name, parentId);
  res.status(201).json(folder);
});

app.post('/api/messages/:id/archive', auth, async (req, res) => {
  const msg = await archiveMessage(req.params.id);

  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }

  emitInbox(req.user.sub);
  res.json(dbMessageToFrontend(msg));
});

app.post('/api/messages/:id/move-folder', auth, async (req, res) => {
  const folderId = req.body.folderId || null;

  const msg = await moveMessageToFolder(req.params.id, folderId);

  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }

  emitInbox(req.user.sub);
  res.json(dbMessageToFrontend(msg));
});
const port = process.env.PORT || 4000;
app.get('/api/user-items/:type', auth, (req, res) => {
  const db = readDb();
  db.userItems ||= [];

  const items = db.userItems
    .filter((item) => item.userId === req.user.sub && item.type === req.params.type)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((item) => item.data);

  res.json(items);
});

app.post('/api/user-items/:type', auth, (req, res) => {
  const db = readDb();
  db.userItems ||= [];

  const item = {
    id: uuid(),
    userId: req.user.sub,
    type: req.params.type,
    data: req.body,
    createdAt: new Date().toISOString()
  };

  db.userItems.push(item);
  writeDb(db);

  res.json(item.data);
});

app.delete('/api/user-items/:type/:id', auth, (req, res) => {
  const db = readDb();
  db.userItems ||= [];

  db.userItems = db.userItems.filter(
    (item) =>
      !(
        item.userId === req.user.sub &&
        item.type === req.params.type &&
        item.data?.id === req.params.id
      )
  );

  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/message-flags/:flagType', auth, (req, res) => {
  const db = readDb();
  db.messageFlags ||= [];

  const flags = db.messageFlags
    .filter((flag) => flag.userId === req.user.sub && flag.flagType === req.params.flagType)
    .map((flag) => flag.messageId);

  res.json(flags);
});

app.post('/api/message-flags/:flagType/:messageId', auth, (req, res) => {
  const db = readDb();
  db.messageFlags ||= [];

  const exists = db.messageFlags.some(
    (flag) =>
      flag.userId === req.user.sub &&
      flag.flagType === req.params.flagType &&
      flag.messageId === req.params.messageId
  );

  if (!exists) {
    db.messageFlags.push({
      id: uuid(),
      userId: req.user.sub,
      flagType: req.params.flagType,
      messageId: req.params.messageId,
      createdAt: new Date().toISOString()
    });
  }

  writeDb(db);
  res.json({ ok: true });
});

app.delete('/api/message-flags/:flagType/:messageId', auth, (req, res) => {
  const db = readDb();
  db.messageFlags ||= [];

  db.messageFlags = db.messageFlags.filter(
    (flag) =>
      !(
        flag.userId === req.user.sub &&
        flag.flagType === req.params.flagType &&
        flag.messageId === req.params.messageId
      )
  );

  writeDb(db);
  res.json({ ok: true });
});

app.get('/api/follow-ups', auth, (req, res) => {
  const db = readDb();
  db.followUps ||= [];

  const followUps = db.followUps
    .filter((item) => item.userId === req.user.sub && !item.completed)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

  res.json(followUps);
});

app.post('/api/follow-ups', auth, (req, res) => {
  const db = readDb();
  db.followUps ||= [];

  const followUp = {
    id: uuid(),
    userId: req.user.sub,
    message_id: req.body.messageId,
    sender_name: req.body.senderName,
    message_text: req.body.text,
    source: req.body.source,
    due_at: req.body.dueAt,
    completed: false,
    created_at: new Date().toISOString()
  };

  db.followUps.push(followUp);
  writeDb(db);

  res.json(followUp);
});

app.patch('/api/follow-ups/:id/complete', auth, (req, res) => {
  const db = readDb();
  db.followUps ||= [];

  db.followUps = db.followUps.map((item) =>
    item.id === req.params.id && item.userId === req.user.sub
      ? { ...item, completed: true }
      : item
  );

  writeDb(db);
  res.json({ ok: true });
});
server.listen(port, () => console.log(`OnePoint Inbox backend running on http://localhost:${port}`));
