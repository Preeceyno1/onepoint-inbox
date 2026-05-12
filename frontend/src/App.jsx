import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { io } from 'socket.io-client';
import { Bell, CheckCheck, Clock, Lock, Mail, Search, Send, Smartphone, Sparkles, Star, Tag, UserRound, Zap } from 'lucide-react';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const sourceMeta = {
  instagram: { label: 'Instagram', icon: FaInstagram, className: 'ig' },
  facebook: { label: 'Facebook', icon: FaFacebook, className: 'fb' },
  whatsapp: { label: 'WhatsApp', icon: FaWhatsapp, className: 'wa' },
  email: { label: 'Email', icon: Mail, className: 'email' },
  sms: { label: 'SMS', icon: Smartphone, className: 'sms' }
};
const priorityLabel = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('onepoint_auth') || 'null'));
  if (!auth?.token) return <LoginScreen onLogin={setAuthAndStore} />;
  function setAuthAndStore(next) { localStorage.setItem('onepoint_auth', JSON.stringify(next)); setAuth(next); }
  return <InboxApp auth={auth} onLogout={() => { localStorage.removeItem('onepoint_auth'); setAuth(null); }} />;
}

function InboxApp({ auth, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [analytics, setAnalytics] = useState({ total: 0, unread: 0, urgent: 0, sales: 0, sources: [] });
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [tone, setTone] = useState('friendly');
  const [livePulse, setLivePulse] = useState(false);
  const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };

  async function load() {
    const [messageRes, connectorRes, analyticsRes] = await Promise.all([
      fetch(`${API}/api/messages`, { headers }),
      fetch(`${API}/api/connectors`, { headers }),
      fetch(`${API}/api/analytics`, { headers })
    ]);
    if (messageRes.status === 401) return onLogout();
    const nextMessages = await messageRes.json();
    setMessages(nextMessages);
    setConnectors(await connectorRes.json());
    setAnalytics(await analyticsRes.json());
    setSelected((current) => current ? nextMessages.find((m) => m.id === current.id) || nextMessages[0] : nextMessages[0]);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const socket = io(API, { auth: { token: auth.token } });
    socket.on('inbox:changed', () => { setLivePulse(true); load(); setTimeout(() => setLivePulse(false), 900); });
    return () => socket.close();
  }, [auth.token]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key.toLowerCase() === 'r') document.querySelector('textarea')?.focus();
      if (e.key.toLowerCase() === 'm' && selected && !selected.read) markRead(selected);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [selected]);

  const filtered = useMemo(() => messages.filter((m) => {
    const haystack = `${m.senderName} ${m.senderHandle} ${m.text} ${m.intent} ${m.priority}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || m.source === filter || (filter === 'unread' && !m.read) || (filter === 'priority' && ['urgent','high'].includes(m.priority)) || (filter === 'sales' && m.intent === 'sales');
    return matchesQuery && matchesFilter;
  }), [messages, query, filter]);

  async function toggleConnector(source, enabled) { await fetch(`${API}/api/connectors/${source}`, { method: 'PATCH', headers, body: JSON.stringify({ enabled }) }); await load(); }
  async function markRead(message) { await fetch(`${API}/api/messages/${message.id}/read`, { method: 'POST', headers }); await load(); }
  async function updateMessage(id, patch) { await fetch(`${API}/api/messages/${id}`, { method: 'PATCH', headers, body: JSON.stringify(patch) }); await load(); }
  async function addDemoMessage() {
    const examples = [
      { source:'instagram', senderName:'Ava Stone', senderHandle:'@ava.stone', text:'How much is the black set and can I collect today?', conversationId:'demo-1', sourceMessageId:crypto.randomUUID() },
      { source:'whatsapp', senderName:'Chris Morgan', senderHandle:'+44 7700 900456', text:'Urgent: I put the wrong delivery address on my order.', conversationId:'demo-2', sourceMessageId:crypto.randomUUID() },
      { source:'facebook', senderName:'Sophie Lane', senderHandle:'Facebook user', text:'Do you have any more photos before I buy?', conversationId:'demo-3', sourceMessageId:crypto.randomUUID() }
    ];
    await fetch(`${API}/api/messages/mock`, { method:'POST', headers, body: JSON.stringify(examples[Math.floor(Math.random()*examples.length)]) });
  }

  return <main className="appShell">
    <motion.aside className="sidebar" initial={{opacity:0,x:-24}} animate={{opacity:1,x:0}} transition={{duration:.35}}>
      <div className="brand"><div className="brandIcon"><Bell /></div><div><h1>OnePoint Inbox</h1><p>Signed in as {auth.user.name}</p></div></div>
      <div className="liveStatus"><span className={livePulse ? 'liveDot pulse' : 'liveDot'} /> Live inbox updates active</div>
      <div className="statsGrid"><Stat label="Unread" value={analytics.unread}/><Stat label="Priority" value={analytics.urgent}/><Stat label="Sales leads" value={analytics.sales}/></div>
      <section className="card"><h2>Message feeds</h2><p className="hint">Toggle demo or real feeds without disconnecting accounts.</p><div className="connectorList">
        {connectors.map(c => { const meta = sourceMeta[c.source] || sourceMeta.email; const Icon = meta.icon; return <motion.label className="connector" key={c.source} title={c.limitation} whileHover={{x:4}}><span className={`sourceIcon ${meta.className}`}><Icon size={16}/></span><span><strong>{meta.label}</strong><small>{c.connected?'Connected':`Demo: ${c.authMode}`}</small></span><input type="checkbox" checked={c.enabled} onChange={e=>toggleConnector(c.source,e.target.checked)}/></motion.label>; })}
      </div></section>
      <section className="card"><h2>Smart views</h2>{[['all','All inboxes'],['priority','Needs attention'],['sales','Sales leads'],['unread','Unread only']].map(([id,label])=><motion.button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)} whileTap={{scale:.96}}>{label}</motion.button>)}{connectors.filter(c=>c.enabled).map(c=><motion.button key={c.source} className={filter===c.source?'active':''} onClick={()=>setFilter(c.source)} whileTap={{scale:.96}}>{sourceMeta[c.source]?.label || c.source}</motion.button>)}</section>
      <section className="card shortcutsCard"><h2>Shortcuts</h2><p><kbd>R</kbd> Quick reply</p><p><kbd>M</kbd> Mark read</p><button onClick={onLogout}>Logout</button></section>
    </motion.aside>

    <motion.section className="inbox" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.35,delay:.08}}>
      <div className="toolbar"><div className="searchBox"><Search size={18}/><input placeholder="Search across every selected app..." value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="demoButton" onClick={addDemoMessage}><Zap size={16}/> Add live demo message</button></div>
      <div className="messageList"><AnimatePresence mode="popLayout">{filtered.map(message=><MessageRow key={message.id} message={message} selected={selected?.id===message.id} onClick={()=>setSelected(message)}/>)}</AnimatePresence>{filtered.length===0 && <motion.div className="empty inboxZero" initial={{opacity:0,scale:.94}} animate={{opacity:1,scale:1}}>🎉 You’re all caught up<br/><small>Zero inbox achieved</small></motion.div>}</div>
    </motion.section>

    <section className="reader"><AnimatePresence mode="wait">{selected ? <MessageReader key={selected.id} message={selected} tone={tone} setTone={setTone} onRead={()=>markRead(selected)} onUpdate={updateMessage} headers={headers}/> : <motion.div className="empty readerEmpty" initial={{opacity:0}} animate={{opacity:1}}>Select a message to open the smart reply workspace.</motion.div>}</AnimatePresence></section>
  </main>;
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login'); const [name, setName] = useState('Samuel'); const [email, setEmail] = useState('demo@onepoint.app'); const [password, setPassword] = useState('password123'); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setError(''); const body = mode === 'login' ? { email, password } : { name, email, password }; const res = await fetch(`${API}/api/auth/${mode}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) return setError(data.error || 'Login failed'); onLogin(data); }
  return <main className="loginShell"><motion.form className="loginCard" onSubmit={submit} initial={{opacity:0,y:20,scale:.98}} animate={{opacity:1,y:0,scale:1}}><div className="brandIcon"><Lock/></div><h1>OnePoint Inbox</h1><p>Your live command centre for every customer message.</p>{mode==='register' && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"/>}<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password"/>{error && <div className="error">{error}</div>}<button>{mode==='login'?'Login':'Create account'}</button><small>Demo login: demo@onepoint.app / password123</small><button type="button" className="ghost" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Create a new account':'Back to login'}</button></motion.form></main>;
}
function Stat({ label, value }) { return <motion.div className="stat" whileHover={{y:-3,scale:1.03}}><strong>{value}</strong><span>{label}</span></motion.div>; }
function MessageRow({ message, selected, onClick }) { const meta = sourceMeta[message.source] || sourceMeta.email; const Icon = meta.icon; return <motion.button layout className={`messageRow ${selected?'selected':''} ${!message.read?'unread':''}`} onClick={onClick} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.96}} whileHover={{scale:1.015,y:-2}} whileTap={{scale:.985}} transition={{duration:.16}}><div className="avatar">{message.avatar}</div><div className="messageContent"><div className="messageTop"><strong>{message.senderName}</strong><span>{timeAgo(message.receivedAt)}</span></div><p>{message.text}</p><div className="messageBottom"><span className={`sourceIcon ${meta.className}`}><Icon size={14}/></span>{meta.label}<span className={`chip ${message.priority}`}>{priorityLabel[message.priority] || message.priority}</span><span className="chip"><Tag size={12}/>{message.intent}</span></div></div></motion.button>; }
function MessageReader({ message, tone, setTone, onRead, onUpdate, headers }) { const meta = sourceMeta[message.source] || sourceMeta.email; const Icon = meta.icon; const [draft,setDraft]=useState(''); const [suggestions,setSuggestions]=useState([]); const [note,setNote]=useState(''); useEffect(()=>{setDraft('');setSuggestions([])},[message.id]); async function suggestReplies(){const res=await fetch(`${API}/api/ai/suggest-replies`,{method:'POST',headers,body:JSON.stringify({message,tone})}); const data=await res.json(); setSuggestions(data.suggestions || []);} async function addNote(){ if(!note.trim()) return; await fetch(`${API}/api/messages/${message.id}/notes`,{method:'POST',headers,body:JSON.stringify({note})}); setNote(''); }
return <motion.article className="readerCard" initial={{opacity:0,x:24,scale:.98}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0,x:24,scale:.98}} transition={{duration:.22}}><div className="readerHeader"><div className="avatar large">{message.avatar}</div><div><h2>{message.senderName}</h2><p>{message.senderHandle}</p></div><span className={`sourcePill ${meta.className}`}><Icon size={16}/>{meta.label}</span></div><div className="bubble">{message.text}</div><div className="readerActions"><button disabled={message.read} onClick={onRead}><CheckCheck size={18}/>{message.read?'Read':'Mark read + sync'}</button><button onClick={()=>onUpdate(message.id,{priority:message.priority==='urgent'?'normal':'urgent'})}><Star size={18}/>Priority</button><button onClick={()=>onUpdate(message.id,{snoozedUntil:new Date(Date.now()+1000*60*60*2).toISOString()})}><Clock size={18}/>Snooze 2h</button></div><section className="aiPanel"><div className="aiTitle"><Sparkles size={18}/><h3>AI reply assistant</h3></div><div className="toneRow"><select value={tone} onChange={e=>setTone(e.target.value)}><option value="friendly">Friendly</option><option value="professional">Professional</option><option value="sales">Sales</option><option value="short">Short</option></select><button onClick={suggestReplies}>Generate replies</button></div><div className="suggestions">{suggestions.map(s=><button key={s} onClick={()=>setDraft(s)}>{s}</button>)}</div><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write or choose a reply..."/><button className="sendButton"><Send size={17}/>Demo send reply</button></section><section className="contactPanel"><h3><UserRound size={17}/> Contact notes</h3><div className="notes">{message.notes?.map((n,i)=><p key={i}>{n}</p>)}{!message.notes?.length && <p className="hint">No notes yet.</p>}</div><div className="noteInput"><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Add internal note..."/><button onClick={addNote}>Add</button></div></section></motion.article> }
function timeAgo(iso){const minutes=Math.max(1,Math.round((Date.now()-new Date(iso).getTime())/60000)); if(minutes<60)return `${minutes}m`; const hours=Math.round(minutes/60); if(hours<24)return `${hours}h`; return `${Math.round(hours/24)}d`;}
