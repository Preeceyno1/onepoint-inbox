import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bell,
  ChevronLeft,
  FileText,
  Inbox,
  Mail,
  Menu,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
  Zap
} from 'lucide-react';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const sourceMeta = {
  all: { label: 'All', icon: Sparkles, colour: '#7c4dff' },
  whatsapp: { label: 'WhatsApp', icon: FaWhatsapp, colour: '#25D366' },
  instagram: { label: 'Instagram', icon: FaInstagram, colour: '#E1306C' },
  email: { label: 'Email', icon: Mail, colour: '#3B82F6' },
  sms: { label: 'iMessage', icon: MessageCircle, colour: '#34C759' },
  facebook: { label: 'Messenger', icon: FaFacebook, colour: '#7B61FF' }
};

const demoPeople = [
  { name: 'Sarah Smith', avatar: 'SS' },
  { name: 'James Lee', avatar: 'JL' },
  { name: 'David Brown', avatar: 'DB' },
  { name: 'Mark Johnson', avatar: 'MJ' },
  { name: 'Water Gardens', avatar: 'WG' }
];

function analyseMessage(message) {
  const text = `${message.text || ''} ${message.senderName || ''}`.toLowerCase();

  let score = 20;
  let type = 'General';
  let action = 'Review message';
  let reason = 'No urgent action detected';

  if (/urgent|asap|today|now|wrong|complaint|refund|problem|issue|help/.test(text)) {
    score += 45;
    type = 'Priority';
    action = 'Reply quickly';
    reason = 'This may need immediate attention';
  }

  if (/price|cost|buy|available|order|book|booking|quote|pay|collect|reserve/.test(text)) {
    score += 35;
    type = 'Sales lead';
    action = 'Send offer or booking info';
    reason = 'This looks like a money-making opportunity';
  }

  if (/tomorrow|later|next week|remind|follow up|let you know/.test(text)) {
    score += 20;
    type = 'Follow-up';
    action = 'Create follow-up reminder';
    reason = 'This message may need resurfacing later';
  }

  if (/thanks|thank you|perfect|great|ok|okay/.test(text)) {
    score -= 15;
    type = 'Low priority';
    action = 'Archive if finished';
    reason = 'This looks like a completed conversation';
  }

  score = Math.max(1, Math.min(99, score));

  return { score, type, action, reason };
}

export default function App() {
  const [auth, setAuth] = useState(() =>
    JSON.parse(localStorage.getItem('onepoint_auth') || 'null')
  );

  function setAuthAndStore(next) {
    localStorage.setItem('onepoint_auth', JSON.stringify(next));
    setAuth(next);
  }

  if (!auth?.token) {
    return <LoginScreen onLogin={setAuthAndStore} />;
  }

  return (
    <OnePointMobile
      auth={auth}
      onLogout={() => {
        localStorage.removeItem('onepoint_auth');
        setAuth(null);
      }}
    />
  );
}

function OnePointMobile({ auth, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [connectors, setConnectors] = useState([]);

  const [sourceFilter, setSourceFilter] = useState('all');
  const [smartFilter, setSmartFilter] = useState('all');

  const [folder, setFolder] = useState('inbox');
  const [query, setQuery] = useState('');

  const [screen, setScreen] = useState('inbox');
  const [selectedMessage, setSelectedMessage] = useState(null);

  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const [sentMessages, setSentMessages] = useState([]);
  const [draftMessages, setDraftMessages] = useState([]);
  const [deletedMessages, setDeletedMessages] = useState([]);

  const [deletedIds, setDeletedIds] = useState([]);
  const [starredIds, setStarredIds] = useState([]);

  const [replyDraft, setReplyDraft] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const [calmMode, setCalmMode] = useState(false);
  const [inboxMode, setInboxMode] = useState('personal');

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

    const nextMessages = await messageRes.json();
    const nextConnectors = await connectorRes.json();

    setMessages(Array.isArray(nextMessages) ? nextMessages : []);
    setConnectors(Array.isArray(nextConnectors) ? nextConnectors : []);
  }

  useEffect(() => {
    load();
  }, []);

  const enabledSources = useMemo(
    () => connectors.filter((c) => c.enabled).map((c) => c.source),
    [connectors]
  );

  const liveMessages = useMemo(
    () => messages.filter((m) => !deletedIds.includes(m.id)),
    [messages, deletedIds]
  );

  const counts = useMemo(() => {
    const live = liveMessages.filter((m) => !m.archived);

    return {
      all: live.length,
      unread: live.filter((m) => !m.read).length,
      priority: live.filter((m) => analyseMessage(m).score >= 65).length,
      mentions: live.filter((m) => /@|mention|tag/i.test(m.text || '')).length,
      groups: live.filter((m) => /team|group|everyone|meeting/i.test(m.text || '')).length,
      archived: liveMessages.filter((m) => m.archived).length,
      sent: sentMessages.length,
      drafts: draftMessages.length,
      deleted: deletedMessages.length
    };
  }, [liveMessages, sentMessages, draftMessages, deletedMessages]);

  const visibleMessages = useMemo(() => {
    if (folder === 'sent') return sentMessages;
    if (folder === 'drafts') return draftMessages;
    if (folder === 'deleted') return deletedMessages;

    let result = liveMessages.filter((message) => {
      const text = `${message.senderName} ${message.senderHandle} ${message.text} ${message.source}`.toLowerCase();
      const intelligence = analyseMessage(message);

      const matchesQuery = text.includes(query.toLowerCase());
      const matchesSource = sourceFilter === 'all' || message.source === sourceFilter;
      const sourceAllowed = sourceFilter === 'all' ? enabledSources.includes(message.source) : true;
      const matchesFolder = folder === 'archive' ? message.archived : !message.archived;

      const matchesSmart =
        smartFilter === 'all'
          ? true
          : smartFilter === 'unread'
          ? !message.read
          : smartFilter === 'priority'
          ? intelligence.score >= 65
          : smartFilter === 'mentions'
          ? /@|mention|tag/i.test(message.text || '')
          : smartFilter === 'groups'
          ? /team|group|everyone|meeting/i.test(message.text || '')
          : true;

      const matchesMode =
        inboxMode === 'business'
          ? /price|cost|buy|available|order|book|booking|quote|pay|collect|reserve|project|customer|client|report|delivery|address/i.test(
              message.text || ''
            )
          : true;

      return matchesQuery && matchesSource && sourceAllowed && matchesFolder && matchesSmart && matchesMode;
    });

    if (calmMode) {
      result = result.filter((message) => analyseMessage(message).score >= 55);
    }

    return result.sort((a, b) => analyseMessage(b).score - analyseMessage(a).score);
  }, [
    liveMessages,
    sentMessages,
    draftMessages,
    deletedMessages,
    query,
    sourceFilter,
    enabledSources,
    folder,
    smartFilter,
    calmMode,
    inboxMode
  ]);

  async function toggleConnector(source, enabled) {
    await fetch(`${API}/api/connectors/${source}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ enabled })
    });

    await load();
  }

  async function archiveMessage(message) {
    if (folder === 'sent' || folder === 'drafts' || folder === 'deleted') return;

    await fetch(`${API}/api/messages/${message.id}/archive`, {
      method: 'POST',
      headers
    });

    await load();
  }

  function deleteMessage(message) {
    setDeletedMessages((current) => [{ ...message, deletedAt: new Date().toISOString() }, ...current]);
    setDeletedIds((current) => [...current, message.id]);

    if (folder === 'drafts') {
      setDraftMessages((current) => current.filter((m) => m.id !== message.id));
    }

    if (folder === 'sent') {
      setSentMessages((current) => current.filter((m) => m.id !== message.id));
    }

    setSelectedMessage(null);
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
        senderName: 'David Brown',
        senderHandle: 'Email',
        text: 'Project Update – Next Steps',
        conversationId: 'demo-email',
        sourceMessageId: crypto.randomUUID()
      },
      {
        source: 'facebook',
        senderName: 'Mark Johnson',
        senderHandle: 'Messenger',
        text: 'Can you send me the report when you have a moment?',
        conversationId: 'demo-fb',
        sourceMessageId: crypto.randomUUID()
      },
      {
        source: 'sms',
        senderName: 'Mom',
        senderHandle: 'iMessage',
        text: 'Don’t forget dinner at 7pm ❤️',
        conversationId: 'demo-sms',
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
    const response = await fetch(`${API}/api/ai/suggest-replies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        tone: 'friendly'
      })
    });

    const data = await response.json();
    setAiSuggestions(data.suggestions || []);
  }

  function sendCompose(message) {
    setSentMessages((current) => [message, ...current]);
    setComposeOpen(false);
    setScreen('sent');
    setFolder('sent');
  }

  function saveDraft(message) {
    setDraftMessages((current) => [message, ...current]);
    setComposeOpen(false);
    setScreen('drafts');
    setFolder('drafts');
  }

  function toggleStar(id) {
    setStarredIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  if (selectedMessage) {
    return (
      <PhoneShell>
        <ChatScreen
          message={selectedMessage}
          onBack={() => {
            setSelectedMessage(null);
            setReplyDraft('');
            setAiSuggestions([]);
          }}
          onDelete={() => deleteMessage(selectedMessage)}
          replyDraft={replyDraft}
          setReplyDraft={setReplyDraft}
          suggestions={aiSuggestions}
          onGenerate={() => generateReplies(selectedMessage)}
        />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <SideMenu
        open={sideMenuOpen}
        onClose={() => setSideMenuOpen(false)}
        auth={auth}
        folder={folder}
        setFolder={(nextFolder) => {
          setFolder(nextFolder);
          setScreen(nextFolder);
          setSideMenuOpen(false);
        }}
        counts={counts}
        onLogout={onLogout}
      />

      {screen === 'inbox' && (
        <InboxScreen
          auth={auth}
          connectors={connectors}
          messages={visibleMessages}
          counts={counts}
          query={query}
          setQuery={setQuery}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          smartFilter={smartFilter}
          setSmartFilter={setSmartFilter}
          onToggleConnector={toggleConnector}
          onOpenMenu={() => setSideMenuOpen(true)}
          onOpenMessage={setSelectedMessage}
          onArchive={archiveMessage}
          onDelete={deleteMessage}
          onStar={toggleStar}
          starredIds={starredIds}
          onAddDemo={addDemoMessage}
          setScreen={setScreen}
          calmMode={calmMode}
          setCalmMode={setCalmMode}
          inboxMode={inboxMode}
          setInboxMode={setInboxMode}
        />
      )}

      {screen === 'ai' && (
        <AiAssistantScreen
          messages={liveMessages}
          setSmartFilter={setSmartFilter}
          setScreen={setScreen}
        />
      )}

      {screen === 'search' && (
        <SearchScreen
          query={query}
          setQuery={setQuery}
          messages={visibleMessages}
          onOpenMessage={setSelectedMessage}
          onDelete={deleteMessage}
        />
      )}

      {screen === 'contacts' && <ContactsScreen people={demoPeople} />}

      {screen === 'settings' && (
        <SettingsScreen
          auth={auth}
          connectors={connectors}
          onToggleConnector={toggleConnector}
          onLogout={onLogout}
        />
      )}

      {['archive', 'sent', 'drafts', 'deleted'].includes(screen) && (
        <FolderScreen
          title={folderTitle(screen)}
          messages={visibleMessages}
          onBack={() => {
            setScreen('inbox');
            setFolder('inbox');
          }}
          onOpenMessage={setSelectedMessage}
          onArchive={archiveMessage}
          onDelete={deleteMessage}
          starredIds={starredIds}
          onStar={toggleStar}
        />
      )}

      <BottomNav
        screen={screen}
        setScreen={(next) => {
          setScreen(next);
          if (next === 'inbox') setFolder('inbox');
        }}
        onCompose={() => setComposeOpen(true)}
      />

      <button className="floatingCompose" onClick={() => setComposeOpen(true)}>
        <Plus />
      </button>

      {composeOpen && (
        <ComposeModal
          auth={auth}
          onClose={() => setComposeOpen(false)}
          onSend={sendCompose}
          onDraft={saveDraft}
        />
      )}
    </PhoneShell>
  );
}

function InboxScreen({
  auth,
  messages = [],
  connectors = [],
  counts,
  query,
  setQuery,
  sourceFilter,
  setSourceFilter,
  smartFilter,
  setSmartFilter,
  onToggleConnector,
  onOpenMenu,
  onOpenMessage,
  onArchive,
  onDelete,
  onStar,
  starredIds,
  onAddDemo,
  setScreen,
  calmMode,
  setCalmMode,
  inboxMode,
  setInboxMode
}) {
  return (
    <>
      <div className="statusBar">
        <span>9:41</span>
        <span>▮▮▮ Wi-Fi ▰</span>
      </div>

      <header className="mainHeader">
        <button className="iconButton" onClick={onOpenMenu}>
          <Menu />
        </button>

        <div>
          <h1>Inbox</h1>
          <p>All your messages in one place</p>
        </div>

        <button className="roundButton" onClick={() => setScreen('search')}>
          <Search />
        </button>

        <button className="roundButton" onClick={() => setScreen('ai')}>
          <Sparkles />
        </button>

        <div className="avatarProfile">
          {auth.user?.name?.[0] || 'U'}
          <span />
        </div>
      </header>

      <div className="onePointCommand">
        <button
          className={calmMode ? 'commandButton active' : 'commandButton'}
          onClick={() => setCalmMode(!calmMode)}
        >
          <Sparkles size={15} />
          What needs me?
        </button>

        <button
          className="commandButton"
          onClick={() => setInboxMode(inboxMode === 'business' ? 'personal' : 'business')}
        >
          {inboxMode === 'business' ? 'Business mode' : 'Personal mode'}
        </button>
      </div>

      <div className="smartChips">
        <FilterChip active={smartFilter === 'all'} onClick={() => setSmartFilter('all')}>
          All <b>{counts.all}</b>
        </FilterChip>

        <FilterChip active={smartFilter === 'unread'} onClick={() => setSmartFilter(smartFilter === 'unread' ? 'all' : 'unread')}>
          Unread <b>{counts.unread}</b>
        </FilterChip>

        <FilterChip active={smartFilter === 'priority'} onClick={() => setSmartFilter(smartFilter === 'priority' ? 'all' : 'priority')}>
          ⭐ Priority <b>{counts.priority}</b>
        </FilterChip>

        <FilterChip active={smartFilter === 'mentions'} onClick={() => setSmartFilter(smartFilter === 'mentions' ? 'all' : 'mentions')}>
          @ Mentions <b>{counts.mentions}</b>
        </FilterChip>

        <FilterChip active={smartFilter === 'groups'} onClick={() => setSmartFilter(smartFilter === 'groups' ? 'all' : 'groups')}>
          <Users size={13} /> Groups
        </FilterChip>
      </div>

      <section className="connectedHeader">
        <strong>Connected apps</strong>
        <button onClick={() => setScreen('settings')}>Manage</button>
      </section>

      <div className="sourceRail">
        <SourceCard
          source="all"
          active={sourceFilter === 'all'}
          onClick={() => setSourceFilter('all')}
        />

        {connectors.map((connector) => (
          <SourceCard
            key={connector.source}
            source={connector.source}
            active={sourceFilter === connector.source}
            enabled={connector.enabled}
            onClick={() =>
              setSourceFilter(sourceFilter === connector.source ? 'all' : connector.source)
            }
            onToggle={(enabled) => onToggleConnector(connector.source, enabled)}
          />
        ))}

        <button className="sourceCard addAppCard" onClick={() => setScreen('settings')}>
          <Plus />
          <span>Add app</span>
        </button>
      </div>

      <div className="searchBox">
        <Search size={18} />
        <input
          placeholder="Search messages, people or content..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button>
          <Settings size={17} />
        </button>
      </div>

      <div className="messageList">
        {messages.map((message) => (
          <SwipeMessageRow
            key={message.id}
            message={message}
            onOpen={() => onOpenMessage(message)}
            onArchive={() => onArchive(message)}
            onDelete={() => onDelete(message)}
            onStar={() => onStar(message.id)}
            starred={starredIds.includes(message.id)}
          />
        ))}

        {messages.length === 0 && <EmptyState />}
      </div>

      <div className="aiBanner">
        <div className="aiIconBox">
          <Sparkles />
        </div>
        <div>
          <strong>AI Assistant</strong>
          <p>Summarize, draft replies or get instant answers to your messages.</p>
        </div>
        <button onClick={() => setScreen('ai')}>Ask AI</button>
      </div>

      <button className="addDemoButton" onClick={onAddDemo}>
        Add demo message
      </button>
    </>
  );
}

function SourceCard({ source, active, enabled = true, onClick, onToggle }) {
  const meta = sourceMeta[source] || sourceMeta.email;
  const Icon = meta.icon;

  return (
    <button className={`sourceCard ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="sourceIcon" style={{ background: meta.colour }}>
        <Icon />
      </div>

      <strong>{meta.label}</strong>

      {source !== 'all' && (
        <>
          <small>{enabled ? 'Connected' : 'Off'}</small>
          <label className="miniSwitch" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span />
          </label>
        </>
      )}
    </button>
  );
}

function SwipeMessageRow({ message, onOpen, onArchive, onDelete, onStar, starred }) {
  const meta = sourceMeta[message.source] || sourceMeta.email;
  const Icon = meta.icon;
  const intelligence = analyseMessage(message);

  return (
    <div className="messageCard">
      <button className="messageRow newReadableRow" onClick={onOpen}>
        <div className="platformIcon" style={{ background: meta.colour }}>
          <Icon />
        </div>

        <div className="personAvatar">
          {initials(message.senderName)}
          {!message.read && <i />}
        </div>

        <div className="messageContent">
          <div className="messageTop">
            <strong>{message.senderName}</strong>
            {message.priority === 'high' || message.priority === 'urgent' ? (
              <span className="countPill">!</span>
            ) : null}
          </div>

          <p>{message.text}</p>

          <small>
            <span style={{ color: meta.colour }}>{meta.label}</span> · {timeAgo(message.receivedAt)}
          </small>

          <div className="intelligenceCard">
            <div>
              <strong>{intelligence.score}%</strong>
              <span>{intelligence.type}</span>
            </div>
            <p>{intelligence.action}</p>
          </div>
        </div>

        <button
          className={starred ? 'starButton active' : 'starButton'}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
        >
          <Star size={16} />
        </button>
      </button>

      <div className="messageQuickActions">
        <button
          className="quickAction archiveActionButton"
          type="button"
          onClick={onArchive}
        >
          <Archive size={15} />
          Archive
        </button>

        <button
          className="quickAction deleteActionButton"
          type="button"
          onClick={onDelete}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>
    </div>
  );
}

function ChatScreen({
  message,
  onBack,
  onDelete,
  replyDraft,
  setReplyDraft,
  suggestions,
  onGenerate
}) {
  const meta = sourceMeta[message.source] || sourceMeta.email;

  return (
    <>
      <div className="statusBar">
        <span>9:41</span>
        <span>▮▮▮ Wi-Fi ▰</span>
      </div>

      <header className="chatHeader">
        <button className="iconButton" onClick={onBack}>
          <ChevronLeft />
        </button>

        <div className="personAvatar large">
          {initials(message.senderName)}
        </div>

        <div className="chatTitle">
          <strong>{message.senderName}</strong>
          <span>{meta.label}</span>
        </div>

        <button className="iconButton">
          <Phone />
        </button>

        <button className="iconButton" onClick={onDelete}>
          <Trash2 />
        </button>
      </header>

      <main className="chatBody">
        <div className="dayMarker">Today</div>

        <div className="incomingBubble">
          {message.text}
          <small>12:30 PM</small>
        </div>

        {replyDraft && (
          <div className="outgoingBubble">
            {replyDraft}
            <small>12:31 PM ✓✓</small>
          </div>
        )}

        <div className="aiReplyPanel">
          <div className="aiReplyHead">
            <Sparkles size={15} />
            <strong>AI Reply Suggestions</strong>
            <button onClick={onGenerate}>See more</button>
          </div>

          {suggestions.length === 0 && (
            <button className="suggestionButton" onClick={onGenerate}>
              Generate smart replies
            </button>
          )}

          {suggestions.map((suggestion) => (
            <button
              className="suggestionButton"
              key={suggestion}
              onClick={() => setReplyDraft(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </main>

      <div className="chatComposer">
        <button>
          <Plus size={18} />
        </button>

        <input
          value={replyDraft}
          onChange={(e) => setReplyDraft(e.target.value)}
          placeholder="Type a message..."
        />

        <button>
          <Mic size={18} />
        </button>

        <button className="sendCircle">
          <Send size={17} />
        </button>
      </div>
    </>
  );
}

function ComposeModal({ auth, onClose, onSend, onDraft }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const message = {
    id: crypto.randomUUID(),
    senderName: to || 'Draft recipient',
    senderHandle: 'Sent',
    text: subject ? `${subject} — ${body}` : body || 'Empty message',
    source: 'email',
    receivedAt: new Date().toISOString(),
    read: true,
    priority: 'normal',
    intent: 'general',
    archived: false
  };

  return (
    <div className="modalOverlay">
      <section className="composeSheet">
        <div className="composeHeader">
          <button onClick={onClose}>Cancel</button>
          <h2>Compose</h2>
          <span />
        </div>

        <div className="composeField">
          <label>From</label>
          <span>{auth.user?.email || 'samuel@onepoint.app'}</span>
        </div>

        <div className="composeField">
          <label>To</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient" />
          <button>
            <Plus size={16} />
          </button>
        </div>

        <div className="composeField">
          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        </div>

        <textarea
          className="composeText"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
        />

        <div className="composeTools">
          <Paperclip />
          <Mail />
          <Sparkles />
          <Shield />

          <button className="sendCompose" onClick={() => onSend(message)}>
            <Send size={18} />
          </button>
        </div>

        <button className="saveDraftButton" onClick={() => onDraft(message)}>
          Save draft
        </button>
      </section>
    </div>
  );
}

function SideMenu({ open, onClose, auth, folder, setFolder, counts, onLogout }) {
  return (
    <>
      {open && <div className="menuBackdrop" onClick={onClose} />}

      <aside className={`sideMenu ${open ? 'open' : ''}`}>
        <div className="menuProfile">
          <div className="avatarProfile large">
            {auth.user?.name?.[0] || 'U'}
            <span />
          </div>
          <div>
            <strong>{auth.user?.name || 'Samuel Preece'}</strong>
            <p>{auth.user?.email || 'samuel@onepoint.app'}</p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <MenuItem icon={Inbox} label="Inbox" count={counts.all} active={folder === 'inbox'} onClick={() => setFolder('inbox')} />
        <MenuItem icon={Archive} label="Archived" count={counts.archived} active={folder === 'archive'} onClick={() => setFolder('archive')} />
        <MenuItem icon={Send} label="Sent" count={counts.sent} active={folder === 'sent'} onClick={() => setFolder('sent')} />
        <MenuItem icon={FileText} label="Drafts" count={counts.drafts} active={folder === 'drafts'} onClick={() => setFolder('drafts')} />
        <MenuItem icon={Trash2} label="Deleted" count={counts.deleted} active={folder === 'deleted'} onClick={() => setFolder('deleted')} />

        <button className="logoutButton" onClick={onLogout}>
          Logout
        </button>
      </aside>
    </>
  );
}

function MenuItem({ icon: Icon, label, count, active, onClick }) {
  return (
    <button className={`menuItem ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
      {typeof count === 'number' && <b>{count}</b>}
    </button>
  );
}

function AiAssistantScreen({ messages, setSmartFilter, setScreen }) {
  return (
    <ScreenPage title="AI Assistant">
      <p className="centerSub">How can I help you today?</p>

      <div className="aiGrid">
        <AiAction icon={FileText} title="Summarize unread messages" />
        <AiAction icon={Mail} title="Draft a reply" />
        <AiAction icon={Search} title="Find important info" />
        <AiAction
          icon={Zap}
          title="Smart prioritization"
          onClick={() => {
            setSmartFilter('priority');
            setScreen('inbox');
          }}
        />
      </div>

      <section className="recentPanel">
        <h3>Recent</h3>
        {messages.slice(0, 4).map((message) => (
          <div className="recentItem" key={message.id}>
            <span>{sourceMeta[message.source]?.label || 'Message'}</span>
            <p>{message.text}</p>
          </div>
        ))}
      </section>

      <div className="aiInput">
        <input placeholder="Ask me anything..." />
        <button>
          <Send size={16} />
        </button>
      </div>
    </ScreenPage>
  );
}

function SearchScreen({ query, setQuery, messages, onOpenMessage, onDelete }) {
  return (
    <ScreenPage title="Search">
      <div className="searchBox pageSearch">
        <Search size={18} />
        <input
          placeholder="Search messages, contacts, files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && <button onClick={() => setQuery('')}>×</button>}
      </div>

      <div className="messageList">
        {messages.map((message) => (
          <SwipeMessageRow
            key={message.id}
            message={message}
            onOpen={() => onOpenMessage(message)}
            onArchive={() => {}}
            onDelete={() => onDelete(message)}
            onStar={() => {}}
            starred={false}
          />
        ))}
      </div>
    </ScreenPage>
  );
}

function ContactsScreen({ people }) {
  return (
    <ScreenPage title="Contacts">
      <div className="contactsList">
        {people.map((person) => (
          <div className="contactCard" key={person.name}>
            <div className="personAvatar">{person.avatar}</div>
            <div>
              <strong>{person.name}</strong>
              <span>Recent conversation</span>
            </div>
            <button>
              <MessageCircle size={17} />
            </button>
          </div>
        ))}
      </div>
    </ScreenPage>
  );
}

function SettingsScreen({ auth, connectors, onToggleConnector, onLogout }) {
  return (
    <ScreenPage title="Settings">
      <section className="settingsCard">
        <h3>Account</h3>
        <SettingRow icon={UserRound} title="Profile" value={auth.user?.name || 'User'} />
        <SettingRow icon={Mail} title="Email" value={auth.user?.email || 'Account email'} />
        <SettingRow icon={Shield} title="Security" value="Change password" />
      </section>

      <section className="settingsCard">
        <h3>Connected Apps</h3>
        {connectors.map((connector) => {
          const meta = sourceMeta[connector.source] || sourceMeta.email;
          const Icon = meta.icon;

          return (
            <div className="settingsApp" key={connector.source}>
              <div className="sourceIcon small" style={{ background: meta.colour }}>
                <Icon />
              </div>
              <div>
                <strong>{meta.label}</strong>
                <span>{connector.enabled ? 'Connected' : 'Off'}</span>
              </div>
              <label className="miniSwitch">
                <input
                  type="checkbox"
                  checked={connector.enabled}
                  onChange={(e) => onToggleConnector(connector.source, e.target.checked)}
                />
                <span />
              </label>
            </div>
          );
        })}
      </section>

      <button className="logoutButton full" onClick={onLogout}>
        Logout
      </button>
    </ScreenPage>
  );
}

function FolderScreen({
  title,
  messages,
  onBack,
  onOpenMessage,
  onArchive,
  onDelete,
  starredIds,
  onStar
}) {
  return (
    <ScreenPage title={title} onBack={onBack}>
      <div className="messageList">
        {messages.map((message) => (
          <SwipeMessageRow
            key={message.id}
            message={message}
            onOpen={() => onOpenMessage(message)}
            onArchive={() => onArchive(message)}
            onDelete={() => onDelete(message)}
            onStar={() => onStar(message.id)}
            starred={starredIds.includes(message.id)}
          />
        ))}

        {messages.length === 0 && <EmptyState />}
      </div>
    </ScreenPage>
  );
}

function ScreenPage({ title, children, onBack }) {
  return (
    <>
      <div className="statusBar">
        <span>9:41</span>
        <span>▮▮▮ Wi-Fi ▰</span>
      </div>

      <header className="pageHeader">
        {onBack ? (
          <button className="iconButton" onClick={onBack}>
            <ChevronLeft />
          </button>
        ) : (
          <span />
        )}
        <h1>{title}</h1>
        <button className="iconButton">
          <MoreVertical />
        </button>
      </header>

      {children}
    </>
  );
}

function AiAction({ icon: Icon, title, onClick }) {
  return (
    <button className="aiAction" onClick={onClick}>
      <Icon size={20} />
      <span>{title}</span>
    </button>
  );
}

function SettingRow({ icon: Icon, title, value }) {
  return (
    <div className="settingRow">
      <Icon size={18} />
      <span>{title}</span>
      <b>{value}</b>
    </div>
  );
}

function FilterChip({ active, children, onClick }) {
  return (
    <button className={`filterChip ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="emptyState">
      <Inbox />
      <strong>No messages here</strong>
      <span>Try another folder, filter or connected app.</span>
    </div>
  );
}

function BottomNav({ screen, setScreen, onCompose }) {
  return (
    <nav className="bottomNav">
      <button className={screen === 'inbox' ? 'active' : ''} onClick={() => setScreen('inbox')}>
        <Inbox size={19} />
        Inbox
      </button>

      <button className={screen === 'ai' ? 'active' : ''} onClick={() => setScreen('ai')}>
        <Sparkles size={19} />
        AI
      </button>

      <button onClick={onCompose}>
        <Plus size={19} />
        Compose
      </button>

      <button className={screen === 'search' ? 'active' : ''} onClick={() => setScreen('search')}>
        <Search size={19} />
        Search
      </button>

      <button className={screen === 'contacts' ? 'active' : ''} onClick={() => setScreen('contacts')}>
        <Users size={19} />
        Contacts
      </button>

      <button className={screen === 'settings' ? 'active' : ''} onClick={() => setScreen('settings')}>
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

    const response = await fetch(`${API}/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) return setError(data.error || 'Login failed');

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

        <button
          type="button"
          className="ghostBtn"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Create a new account' : 'Back to login'}
        </button>
      </form>
    </main>
  );
}

function PhoneShell({ children }) {
  return <main className="phoneShell">{children}</main>;
}

function folderTitle(folder) {
  const titles = {
    archive: 'Archived',
    sent: 'Sent',
    drafts: 'Drafts',
    deleted: 'Deleted'
  };

  return titles[folder] || 'Inbox';
}

function initials(name = '') {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '??'
  );
}

function timeAgo(iso) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}