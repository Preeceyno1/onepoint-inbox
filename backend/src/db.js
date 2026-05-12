import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function now(offsetMs = 0) { return new Date(Date.now() - offsetMs).toISOString(); }

function starterDb() {
  const userId = uuid();
  return {
    users: [{ id: userId, name: 'Samuel', email: 'demo@onepoint.app', passwordHash: bcrypt.hashSync('password123', 10), createdAt: new Date().toISOString() }],
    connectors: [
      { id: uuid(), userId, source: 'instagram', enabled: true, connected: false, authMode: 'OAuth + Instagram professional account', limitation: 'Requires Meta app review and messaging permissions.' },
      { id: uuid(), userId, source: 'facebook', enabled: true, connected: false, authMode: 'OAuth + Page access token', limitation: 'Works best for Facebook Page / business messaging.' },
      { id: uuid(), userId, source: 'whatsapp', enabled: true, connected: false, authMode: 'WhatsApp Cloud API', limitation: 'Requires Business phone number and Cloud API token.' },
      { id: uuid(), userId, source: 'email', enabled: true, connected: true, authMode: 'Gmail / Microsoft OAuth', limitation: 'Demo connector only in this starter.' },
      { id: uuid(), userId, source: 'sms', enabled: false, connected: false, authMode: 'Twilio / SMS provider', limitation: 'Requires a provider number.' }
    ],
    messages: [
      { id: uuid(), userId, source: 'instagram', sourceMessageId: 'mock-ig-001', conversationId: 'ig-thread-1', senderName: 'Mia Carter', senderHandle: '@mia.carter', text: 'Hi! Is the blue hoodie still available? I can pay today if you still have medium.', receivedAt: now(1000*60*4), read: false, priority: 'high', intent: 'sales', avatar: 'MC', assignedTo: 'Me', snoozedUntil: null, notes: ['Potential buyer. Reply quickly.'] },
      { id: uuid(), userId, source: 'whatsapp', sourceMessageId: 'mock-wa-001', conversationId: 'wa-thread-4', senderName: 'Jordan Lee', senderHandle: '+44 7700 900123', text: 'Can you confirm the delivery address before you send it out please?', receivedAt: now(1000*60*16), read: false, priority: 'urgent', intent: 'support', avatar: 'JL', assignedTo: 'Me', snoozedUntil: null, notes: [] },
      { id: uuid(), userId, source: 'facebook', sourceMessageId: 'mock-fb-001', conversationId: 'fb-thread-8', senderName: 'Daniel Brooks', senderHandle: 'Facebook user', text: 'Can you send me more details please?', receivedAt: now(1000*60*32), read: false, priority: 'normal', intent: 'lead', avatar: 'DB', assignedTo: 'Unassigned', snoozedUntil: null, notes: [] },
      { id: uuid(), userId, source: 'email', sourceMessageId: 'mock-email-001', conversationId: 'email-thread-2', senderName: 'Support Lead', senderHandle: 'support@example.com', text: 'Reminder: review the supplier quote before 5pm.', receivedAt: now(1000*60*60*2), read: true, priority: 'normal', intent: 'admin', avatar: 'SL', assignedTo: 'Me', snoozedUntil: null, notes: [] }
    ]
  };
}

export function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(starterDb(), null, 2));
}
export function readDb() { ensureDb(); return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
export function writeDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
export function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }
