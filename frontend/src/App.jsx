import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Bot, CheckCircle2, Focus, Inbox, Mail, MessageCircle, Plus, Search, Settings, Sparkles, Star, Zap } from 'lucide-react';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const sourceMeta = {
  instagram: { label: 'Instagram', icon: FaInstagram, colour: '#E1306C' },
  facebook: { label: 'Facebook', icon: FaFacebook, colour: '#1877F2' },
  whatsapp: { label: 'WhatsApp', icon: FaWhatsapp, colour: '#25D366' },
  email: { label: 'Email', icon: Mail, colour: '#4B8BFF' },
  sms: { label: 'SMS', icon: MessageCircle, colour: '#34C759' }
};

export default function App() {
  const [auth, setAuth] = useState(() =>
    JSON.parse(localStorage.getItem('onepoint_auth') || 'null')
  );

  function setAuthAndStore(next) {
    localStorage.setItem('onepoint_auth', JSON.stringify(next));
    setAuth(next);
  }

  if (!auth?.token) return <LoginScreen onLogin={setAuthAndStore} />;

  return (
    <MobileInbox
      auth={auth}
      onLogout={() => {
        localStorage.removeItem('onepoint_auth');
        setAuth(null);
      }}
    />
  );
}

function MobileInbox({ auth, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [screen, setScreen] = useState('inbox');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [draft, setDraft] = useState('');

  const headers = {
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json'
  };

  async function load() {
    const [messageRes, connectorRes] = await Promise.all([
      fetch(`${API}/api/messages`, { headers }),
      fetch(`${API}/api/connectors`, { headers })
    ]);

    if (messageRes.status === 401) return onLogout();

    setMessages(await messageRes.json());
    setConnectors(await connectorRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  const counts = {
    unread: messages.filter((m) => !m.read && !m.archived).length,
    priority: messages.filter((m) => ['urgent', 'high'].includes(m.priority) && !m.archived).length,
    sales: messages.filter((m) => m.intent === 'sales' && !m.archived).length
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const haystack = `${m.senderName} ${m.senderHandle} ${m.text} ${m.intent} ${m.source}`.toLowerCase();

      const matchesSearch = haystack.includes(query.toLowerCase());

      const matchesFilter =
        filter === 'all'
          ? !m.archived
          : filter === 'unread'
          ? !m.read && !m.archived
          : filter === 'priority'
          ? ['urgent', 'high'].includes(m.priority) && !m.archived
          : filter === 'sales'
          ? m.intent === 'sales' && !m.archived
          : true;

      return matchesSearch && matchesFilter;
    });
  }, [messages, query, filter]);

  async function toggleConnector(source, enabled) {
    await fetch(`${API}/api/connectors/${source}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ enabled })
    });

    await load();
  }

  async function addDemoMessage() {
    const examples = [
      {
        source: 'whatsapp',
        senderName: 'Sarah Smith',
        senderHandle: 'WhatsApp',
        text: 'Hey, are we still meeting for lunch today?',
        conversationId: 'demo-wa',
        sourceMessageId: crypto.randomUUID()
      },
      {
        source: 'instagram',
        senderName: 'james.reels',
        senderHandle: '@james.reels',
        text: 'Sent you a reel by @explore',
        conversationId: 'demo-ig',
        sourceMessageId: crypto.randomUUID()
      },
      {
        source: 'email',
        senderName: 'Water Gardens',
        senderHandle: 'email',
        text: 'Your booking is confirmed 🎉',
        conversationId: 'demo-email',
        sourceMessageId: crypto.randomUUID()
      }
    ];

    await fetch(`${API}/api/messages/mock`, {
      method: 'POST',
      headers,
      body: JSON.stringify(examples[Math.floor(Math.random() * examples.length)])
    });

    await load();
  }

  async function generateReplies(message) {
    const res = await fetch(`${API}/api/ai/suggest-replies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, tone: 'friendly' })
    });

    const data = await res.json();
    setSuggestions(data.suggestions || []);
  }

  if (screen === 'apps') {
    return (
      <PhoneShell>
        <Header title="Manage apps" onBack={() => setScreen('inbox')} />
        <p className="subText">Choose which apps you want to see in your unified inbox.</p>

        <div className="appList">
          {connectors.map((connector) => {
            const meta = sourceMeta[connector.source] || sourceMeta.email;
            const Icon = meta.icon;

            return (
              <div className="appToggle" key={connector.source}>
                <div className="appIcon" style={{ background: meta.colour }}>
                  <Icon />
                </div>

                <div>
                  <strong>{meta.label}</strong>
                  <span>{connector.connected ? 'Connected' : 'Demo mode'}</span>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={connector.enabled}
                    onChange={(e) => toggleConnector(connector.source, e.target.checked)}
                  />
                  <span />
                </label>
              </div>
            );
          })}
        </div>

        <PrivacyNote />
      </PhoneShell>
    );
  }

  if (selectedMessage) {
    const meta = sourceMeta[selectedMessage.source] || sourceMeta.email;
    const Icon = meta.icon;

    return (
      <PhoneShell>
        <Header title={selectedMessage.senderName} onBack={() => setSelectedMessage(null)} />

        <div className="chatHeader">
          <div className="appIcon" style={{ background: meta.colour }}>
            <Icon />
          </div>
          <div>
            <strong>{selectedMessage.senderName}</strong>
            <span>{meta.label}</span>
          </div>
        </div>

        <div className="chatArea">
          <div className="incomingBubble">{selectedMessage.text}</div>

          {draft && <div className="outgoingBubble">{draft}</div>}
        </div>

        <div className="aiReplyBox">
          <div className="aiReplyTitle">
            <Sparkles size={16} />
            AI Reply Suggestions
            <button onClick={() => generateReplies(selectedMessage)}>See more</button>
          </div>

          {suggestions.length === 0 && (
            <button className="suggestion" onClick={() => generateReplies(selectedMessage)}>
              Generate AI replies
            </button>
          )}

          {suggestions.map((s) => (
            <button className="suggestion" key={s} onClick={() => setDraft(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="messageComposer">
          <button>
            <Plus size={18} />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
          />
          <button className="sendBtn">➤</button>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div className="topBar">
        <button className="menuBtn">☰</button>
        <h1>Inbox</h1>
        <Search size={20} />
        <div className="profileDot">{auth.user?.name?.[0] || 'U'}</div>
      </div>

      <div className="filterChips">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All <b>{messages.filter((m) => !m.archived).length}</b>
        </Chip>
        <Chip active={filter === 'unread'} onClick={() => setFilter(filter === 'unread' ? 'all' : 'unread')}>
          Unread <b>{counts.unread}</b>
        </Chip>
        <Chip active={filter === 'priority'} onClick={() => setFilter(filter === 'priority' ? 'all' : 'priority')}>
          Priority <b>{counts.priority}</b>
        </Chip>
        <Chip active={filter === 'sales'} onClick={() => setFilter(filter === 'sales' ? 'all' : 'sales')}>
          Sales <b>{counts.sales}</b>
        </Chip>
      </div>

      <section className="connectedCard">
        <div className="sectionHeader">
          <strong>Connected apps</strong>
          <button onClick={() => setScreen('apps')}>Manage</button>
        </div>

        <div className="connectedApps">
          {connectors.slice(0, 5).map((connector) => {
            const meta = sourceMeta[connector.source] || sourceMeta.email;
            const Icon = meta.icon;

            return (
              <div className="miniApp" key={connector.source}>
                <div className="appIcon" style={{ background: meta.colour }}>
                  <Icon />
                </div>
                <span>{meta.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="searchCard">
        <Search size={17} />
        <input
          placeholder="Search messages, people, keywords..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Settings size={17} />
      </div>

      <div className="messageFeed">
        {filteredMessages.map((message) => {
          const meta = sourceMeta[message.source] || sourceMeta.email;
          const Icon = meta.icon;

          return (
            <button
              className="mobileMessageRow"
              key={message.id}
              onClick={() => setSelectedMessage(message)}
            >
              <div className="appIcon" style={{ background: meta.colour }}>
                <Icon />
              </div>

              <div className="mobileMessageBody">
                <div>
                  <strong>{message.senderName}</strong>
                  {!message.read && <span className="unreadDot" />}
                </div>
                <p>{message.text}</p>
                <small>{meta.label} · {timeAgo(message.receivedAt)}</small>
              </div>

              <Star size={17} className="rowStar" />
            </button>
          );
        })}
      </div>

      <button className="floatingPlus" onClick={addDemoMessage}>
        +
      </button>

      <BottomNav screen={screen} setScreen={setScreen} />
    </PhoneShell>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('Samuel');
  const [email, setEmail] = useState('demo@onepoint.app');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');

    const body = mode === 'login' ? { email, password } : { name, email, password };

    const res = await fetch(`${API}/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) return setError(data.error || 'Login failed');

    onLogin(data);
  }

  return (
    <main className="loginPage">
      <form className="loginBox" onSubmit={submit}>
        <Sparkles />
        <h1>OnePoint Inbox</h1>
        <p>Your unified AI inbox.</p>

        {mode === 'register' && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        )}

        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />

        {error && <div className="errorBox">{error}</div>}

        <button>{mode === 'login' ? 'Login' : 'Create account'}</button>

        <small>Demo: demo@onepoint.app / password123</small>

        <button type="button" className="ghostBtn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Create a new account' : 'Back to login'}
        </button>
      </form>
    </main>
  );
}

function PhoneShell({ children }) {
  return <main className="phoneApp">{children}</main>;
}

function Header({ title, onBack }) {
  return (
    <div className="screenHeader">
      <button onClick={onBack}>‹</button>
      <h2>{title}</h2>
      <span />
    </div>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button className={active ? 'chip active' : 'chip'} onClick={onClick}>
      {children}
    </button>
  );
}

function BottomNav({ screen, setScreen }) {
  return (
    <nav className="bottomNav">
      <button className={screen === 'inbox' ? 'active' : ''} onClick={() => setScreen('inbox')}>
        <Inbox size={19} />
        Inbox
      </button>
      <button>
        <Bot size={19} />
        AI
      </button>
      <button>
        <Zap size={19} />
        Compose
      </button>
      <button>
        <Search size={19} />
        Search
      </button>
      <button onClick={() => setScreen('apps')}>
        <Settings size={19} />
        Settings
      </button>
    </nav>
  );
}

function PrivacyNote() {
  return (
    <div className="privacyNote">
      <CheckCircle2 size={14} />
      Your data is private and secure.
    </div>
  );
}

function timeAgo(iso) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}