import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Inbox,
  Mail,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Star,
  Trash2,
  X
} from 'lucide-react';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const sourceMeta = {
  all: { label: 'All', icon: Sparkles, colour: '#6655ff' },
  instagram: { label: 'Instagram', icon: FaInstagram, colour: '#E1306C' },
  facebook: { label: 'Facebook', icon: FaFacebook, colour: '#1877F2' },
  whatsapp: { label: 'WhatsApp', icon: FaWhatsapp, colour: '#25D366' },
  email: { label: 'Email', icon: Mail, colour: '#4B8BFF' },
  sms: { label: 'iMessage', icon: MessageCircle, colour: '#34C759' }
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
  const [selectedSource, setSelectedSource] = useState('all');
  const [folder, setFolder] = useState('inbox');
  const [query, setQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sentMessages, setSentMessages] = useState([]);
  const [draftMessages, setDraftMessages] = useState([]);
  const [deletedMessages, setDeletedMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [replyDraft, setReplyDraft] = useState('');

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

  async function toggleConnector(source, enabled) {
    await fetch(`${API}/api/connectors/${source}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ enabled })
    });

    await load();
  }

  async function archiveMessage(message) {
    await fetch(`${API}/api/messages/${message.id}/archive`, {
      method: 'POST',
      headers
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
        senderHandle: 'Email',
        text: 'Your booking is confirmed 🎉',
        conversationId: 'demo-email',
        sourceMessageId: crypto.randomUUID()
      },
      {
        source: 'facebook',
        senderName: 'Mark Johnson',
        senderHandle: 'Facebook',
        text: 'Can you send me the report when you have a moment?',
        conversationId: 'demo-fb',
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

  const enabledSources = connectors.filter((c) => c.enabled).map((c) => c.source);

  const filteredMessages = useMemo(() => {
    if (folder === 'sent') return sentMessages;
    if (folder === 'drafts') return draftMessages;
    if (folder === 'deleted') return deletedMessages;

    return messages.filter((message) => {
      const metaText = `${message.senderName} ${message.senderHandle} ${message.text} ${message.source}`.toLowerCase();

      const matchesQuery = metaText.includes(query.toLowerCase());

      const matchesSource =
        selectedSource === 'all' || message.source === selectedSource;

      const sourceIsEnabled =
        selectedSource === 'all'
          ? enabledSources.includes(message.source)
          : true;

      const matchesFolder =
        folder === 'archive'
          ? message.archived
          : !message.archived;

      return matchesQuery && matchesSource && sourceIsEnabled && matchesFolder;
    });
  }, [messages, sentMessages, draftMessages, deletedMessages, query, selectedSource, folder, enabledSources]);

  if (selectedMessage) {
    const meta = sourceMeta[selectedMessage.source] || sourceMeta.email;
    const Icon = meta.icon;

    return (
      <PhoneShell>
        <div className="chatTop">
          <button onClick={() => setSelectedMessage(null)}>
            <ChevronLeft />
          </button>

          <div className="chatPerson">
            <div className="appIcon" style={{ background: meta.colour }}>
              <Icon />
            </div>
            <div>
              <strong>{selectedMessage.senderName}</strong>
              <span>{meta.label}</span>
            </div>
          </div>

          <button>
            <Trash2 />
          </button>
        </div>

        <div className="chatArea">
          <div className="incomingBubble">{selectedMessage.text}</div>
          {replyDraft && <div className="outgoingBubble">{replyDraft}</div>}
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

          {suggestions.map((suggestion) => (
            <button
              className="suggestion"
              key={suggestion}
              onClick={() => setReplyDraft(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="messageComposer">
          <button>
            <Plus size={18} />
          </button>
          <input
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="Type a message..."
          />
          <button className="sendBtn">➤</button>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        folder={folder}
        setFolder={(nextFolder) => {
          setFolder(nextFolder);
          setMenuOpen(false);
        }}
        onLogout={onLogout}
      />

      <div className="topBar">
        <button className="menuBtn" onClick={() => setMenuOpen(true)}>
          <Menu />
        </button>

        <h1>{folderLabel(folder)}</h1>

        <Search size={20} />

        <div className="profileDot">{auth.user?.name?.[0] || 'U'}</div>
      </div>

      <div className="sourceScroller">
        <SourceCard
          source="all"
          active={selectedSource === 'all'}
          onClick={() => setSelectedSource('all')}
        />

        {connectors.map((connector) => (
          <SourceCard
            key={connector.source}
            source={connector.source}
            active={selectedSource === connector.source}
            enabled={connector.enabled}
            onClick={() =>
              setSelectedSource(selectedSource === connector.source ? 'all' : connector.source)
            }
            onToggle={(enabled) => toggleConnector(connector.source, enabled)}
          />
        ))}
      </div>

      <section className="connectedCard">
        <div className="sectionHeader">
          <strong>Connected apps</strong>
          <button>Manage</button>
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
        {filteredMessages.map((message) => (
          <SwipeMessageRow
            key={message.id}
            message={message}
            onOpen={() => setSelectedMessage(message)}
            onArchive={() => archiveMessage(message)}
          />
        ))}

        {filteredMessages.length === 0 && (
          <div className="emptyState">
            <Inbox />
            <strong>No messages here</strong>
            <span>Try another folder or app filter.</span>
          </div>
        )}
      </div>

      <button className="floatingPlus" onClick={() => setComposeOpen(true)}>
        +
      </button>

      <BottomNav
        folder={folder}
        setFolder={setFolder}
        openCompose={() => setComposeOpen(true)}
      />

      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSend={(message) => {
            setSentMessages((current) => [message, ...current]);
            setComposeOpen(false);
          }}
          onDraft={(message) => {
            setDraftMessages((current) => [message, ...current]);
            setComposeOpen(false);
          }}
        />
      )}
    </PhoneShell>
  );
}

function SourceCard({ source, active, enabled = true, onClick, onToggle }) {
  const meta = sourceMeta[source] || sourceMeta.email;
  const Icon = meta.icon;

  return (
    <button className={`sourceCard ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="appIcon" style={{ background: meta.colour }}>
        <Icon />
      </div>

      <span>{meta.label}</span>

      {source !== 'all' && (
        <label className="tinySwitch" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span />
        </label>
      )}
    </button>
  );
}

function SwipeMessageRow({ message, onOpen, onArchive }) {
  const [startX, setStartX] = useState(null);
  const [offset, setOffset] = useState(0);

  const meta = sourceMeta[message.source] || sourceMeta.email;
  const Icon = meta.icon;

  function handleTouchStart(e) {
    setStartX(e.touches[0].clientX);
  }

  function handleTouchMove(e) {
    if (startX === null) return;
    const diff = e.touches[0].clientX - startX;
    if (diff < 0) setOffset(Math.max(diff, -110));
  }

  function handleTouchEnd() {
    if (offset < -80) {
      onArchive();
    }
    setOffset(0);
    setStartX(null);
  }

  return (
    <div className="swipeWrap">
      <div className="archiveBehind">
        <Archive size={18} />
        Archive
      </div>

      <button
        className="mobileMessageRow"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onOpen}
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
    </div>
  );
}

function SideMenu({ open, onClose, folder, setFolder, onLogout }) {
  return (
    <>
      {open && <div className="menuOverlay" onClick={onClose} />}

      <aside className={`sideMenu ${open ? 'open' : ''}`}>
        <div className="menuHeader">
          <h2>OnePoint</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <MenuItem icon={Inbox} label="Inbox" active={folder === 'inbox'} onClick={() => setFolder('inbox')} />
        <MenuItem icon={Archive} label="Archived" active={folder === 'archive'} onClick={() => setFolder('archive')} />
        <MenuItem icon={Send} label="Sent" active={folder === 'sent'} onClick={() => setFolder('sent')} />
        <MenuItem icon={FileText} label="Drafts" active={folder === 'drafts'} onClick={() => setFolder('drafts')} />
        <MenuItem icon={Trash2} label="Deleted" active={folder === 'deleted'} onClick={() => setFolder('deleted')} />
        <MenuItem icon={Bot} label="AI Assistant" active={false} onClick={onClose} />
        <MenuItem icon={Settings} label="Settings" active={false} onClick={onClose} />

        <button className="logoutBtn" onClick={onLogout}>
          Logout
        </button>
      </aside>
    </>
  );
}

function MenuItem({ icon: Icon, label, active, onClick }) {
  return (
    <button className={`menuItem ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={18} />
      {label}
    </button>
  );
}

function ComposeModal({ onClose, onSend, onDraft }) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');

  const composed = {
    id: crypto.randomUUID(),
    senderName: to || 'New message',
    senderHandle: 'Sent',
    text: message || 'Empty message',
    source: 'email',
    receivedAt: new Date().toISOString(),
    read: true
  };

  return (
    <div className="modalOverlay">
      <div className="composeModal">
        <div className="composeTop">
          <strong>New message</strong>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message..."
        />

        <div className="composeActions">
          <button className="draftBtn" onClick={() => onDraft(composed)}>
            Save draft
          </button>
          <button className="sendButton" onClick={() => onSend(composed)}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ folder, setFolder, openCompose }) {
  return (
    <nav className="bottomNav">
      <button className={folder === 'inbox' ? 'active' : ''} onClick={() => setFolder('inbox')}>
        <Inbox size={19} />
        Inbox
      </button>
      <button>
        <Bot size={19} />
        AI
      </button>
      <button onClick={openCompose}>
        <Plus size={19} />
        Compose
      </button>
      <button>
        <Search size={19} />
        Search
      </button>
      <button>
        <Settings size={19} />
        Settings
      </button>
    </nav>
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

function folderLabel(folder) {
  const labels = {
    inbox: 'Inbox',
    archive: 'Archived',
    sent: 'Sent',
    drafts: 'Drafts',
    deleted: 'Deleted'
  };

  return labels[folder] || 'Inbox';
}

function timeAgo(iso) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}