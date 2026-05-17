import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Clock,
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

function makeLocalReply(message) {
  const intel = analyseMessage(message);

  if (intel.type === 'Sales lead') {
    return `Hi ${message.senderName}, thanks for your message. Yes, I can help with that. I’ll send over the details, price and next steps now.`;
  }

  if (intel.type === 'Priority') {
    return `Hi ${message.senderName}, thanks for letting me know. I’ll look into this straight away and come back to you as soon as possible.`;
  }

  if (intel.type === 'Follow-up') {
    return `Hi ${message.senderName}, no problem. I’ll follow up with you again at the right time.`;
  }

  return `Hi ${message.senderName}, thanks for your message. I’ll come back to you shortly.`;
}

function generateQuickReplies(message) {
  const intel = analyseMessage(message);

  if (intel.type === 'Sales lead') {
    return [
      'I can send pricing over now.',
      'Happy to help — what package are you interested in?',
      'Would you like me to send more details?'
    ];
  }

  if (intel.type === 'Priority') {
    return [
      'I’ll look into this now.',
      'Thanks for letting me know.',
      'I’ll come back to you shortly.'
    ];
  }

  if (intel.type === 'Follow-up') {
    return [
      'Just following this up.',
      'Let me know if you still need help.',
      'Happy to continue this conversation.'
    ];
  }

  return [
    'Thanks for your message.',
    'Sounds good to me.',
    'I’ll get back to you shortly.'
  ];
}

function getRelationshipLevel(message, replyHistory = {}) {
  const replies = replyHistory[message.senderName] || 0;
  const score = analyseMessage(message).score;

  if (replies >= 6 || score >= 80) return 'hot';
  if (replies >= 3 || score >= 65) return 'warm';
  return 'normal';
}

function buildSmartMemory(messages = []) {
  const memory = {};

  messages.forEach((message) => {
    const name = message.senderName || 'Unknown';
    const text = (message.text || '').toLowerCase();

    if (!memory[name]) {
      memory[name] = {
        name,
        notes: [],
        sources: new Set(),
        messageCount: 0
      };
    }

    memory[name].messageCount += 1;
    memory[name].sources.add(message.source);

    if (/price|cost|buy|order|book|quote|collect/.test(text)) {
      memory[name].notes.push('Interested in buying or booking');
    }

    if (/urgent|problem|issue|wrong|refund/.test(text)) {
      memory[name].notes.push('May need careful support');
    }

    if (/tomorrow|later|next week|follow up/.test(text)) {
      memory[name].notes.push('May need follow-up');
    }
  });

  return Object.values(memory).map((item) => ({
    ...item,
    sources: Array.from(item.sources),
    notes: [...new Set(item.notes)].slice(0, 3)
  }));
}

function buildDailyBriefing(messages = [], followUps = []) {
  const live = messages.filter((m) => !m.archived);
  const urgent = live.filter((m) => analyseMessage(m).score >= 65);
  const sales = live.filter((m) => analyseMessage(m).type === 'Sales lead');
  const waiting = live.filter((m) => /sent|waiting|reply/i.test(m.text || ''));

  return {
    title: 'Today’s OnePoint Briefing',
    summary: `${urgent.length} need attention, ${sales.length} look like sales opportunities, ${followUps.length} follow-ups are active, and ${waiting.length} conversations may be waiting on replies.`,
    urgent,
    sales,
    followUps
  };
}

function buildWaitingOn(sentMessages = [], liveMessages = []) {
  return sentMessages
    .filter((sent) => {
      const hasReply = liveMessages.some(
        (message) =>
          message.senderName?.toLowerCase() === sent.senderName?.toLowerCase() &&
          new Date(message.receivedAt || 0) > new Date(sent.receivedAt || 0)
      );

      return !hasReply;
    })
    .map((sent) => ({
      ...sent,
      waitingSince: sent.receivedAt || new Date().toISOString()
    }));
}

function makeVoiceNoteSummary(message) {
  return {
    summary: `Voice note summary for ${message.senderName}: this appears to need a short, clear response.`,
    points: [
      'Main point detected',
      'Possible reply needed',
      'Can be handled quickly'
    ],
    suggestedReply: makeLocalReply(message)
  };
}

function detectMedia(message) {
  const text = (message.text || '').toLowerCase();

  if (message.mediaUrl) {
    return {
      type: message.mediaType || 'image',
      url: message.mediaUrl,
      title: message.mediaTitle || 'Media attachment'
    };
  }

  if (/reel|video|watch|clip|tiktok|youtube/.test(text)) {
    return {
      type: 'video',
      url: null,
      title: 'Video / reel preview'
    };
  }

  if (/voice note|voice message|audio/.test(text)) {
    return {
      type: 'voice',
      url: null,
      title: 'Voice note'
    };
  }

  if (/photo|image|picture|screenshot/.test(text)) {
    return {
      type: 'image',
      url: null,
      title: 'Image preview'
    };
  }

  return null;
}

function getContactPhoto(message = {}) {
  if (message.avatarUrl) return message.avatarUrl;
  if (message.profilePhoto) return message.profilePhoto;
  if (message.senderPhoto) return message.senderPhoto;

  const name = encodeURIComponent(message.senderName || 'User');

  return `https://ui-avatars.com/api/?name=${name}&background=7c4dff&color=fff&bold=true`;
}

function getPreferredSource(messages = []) {
  const counts = {};

  messages.forEach((message) => {
    counts[message.source] = (counts[message.source] || 0) + 1;
  });

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'email';
}

function getContactInsights(timeline = {}) {
  const messages = timeline.messages || [];
  const scores = messages.map((m) => analyseMessage(m).score);
  const topScore = scores.length ? Math.max(...scores) : 0;
  const salesCount = messages.filter((m) => analyseMessage(m).type === 'Sales lead').length;
  const followCount = messages.filter((m) => analyseMessage(m).type === 'Follow-up').length;
  const preferredSource = getPreferredSource(messages);

  return {
    topScore,
    salesCount,
    followCount,
    preferredSource,
    status:
      topScore >= 80
        ? 'High priority relationship'
        : topScore >= 65
        ? 'Warm contact'
        : 'Normal contact'
  };
}

export default function App() {
  const [auth, setAuth] = useState(() =>
    JSON.parse(localStorage.getItem('onepoint_auth') || 'null')
  );

  function getContactPhoto(message) {
  if (message.avatarUrl) return message.avatarUrl;
  if (message.profilePhoto) return message.profilePhoto;
  if (message.senderPhoto) return message.senderPhoto;

  const name = encodeURIComponent(message.senderName || 'User');
  return `https://ui-avatars.com/api/?name=${name}&background=7c4dff&color=fff&bold=true`;
}

function detectMedia(message) {
  const text = (message.text || '').toLowerCase();

  if (message.mediaUrl) {
    return {
      type: message.mediaType || 'image',
      url: message.mediaUrl,
      title: message.mediaTitle || 'Media attachment'
    };
  }

  if (/reel|video|watch|clip|tiktok|youtube/.test(text)) {
    return {
      type: 'video',
      url: null,
      title: 'Video / reel preview'
    };
  }

  if (/voice note|voice message|audio/.test(text)) {
    return {
      type: 'voice',
      url: null,
      title: 'Voice note'
    };
  }

  if (/photo|image|picture|screenshot/.test(text)) {
    return {
      type: 'image',
      url: null,
      title: 'Image preview'
    };
  }

  return null;
}

function getPreferredSource(messages = []) {
  const counts = {};

  messages.forEach((message) => {
    counts[message.source] = (counts[message.source] || 0) + 1;
  });

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'email';
}

function getContactInsights(timeline) {
  const messages = timeline.messages || [];
  const topScore = Math.max(...messages.map((m) => analyseMessage(m).score), 0);
  const salesCount = messages.filter((m) => analyseMessage(m).type === 'Sales lead').length;
  const followCount = messages.filter((m) => analyseMessage(m).type === 'Follow-up').length;
  const preferredSource = getPreferredSource(messages);

  return {
    topScore,
    salesCount,
    followCount,
    preferredSource,
    status:
      topScore >= 80
        ? 'High priority relationship'
        : topScore >= 65
        ? 'Warm contact'
        : 'Normal contact'
  };
}

  function setAuthAndStore(next) {
    localStorage.setItem('onepoint_auth', JSON.stringify(next));
    setAuth(next);
  }

  if (!auth?.token) return <LoginScreen onLogin={setAuthAndStore} />;

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
  const [followUps, setFollowUps] = useState([]);

  const [replyDraft, setReplyDraft] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [calmMode, setCalmMode] = useState(false);
  const [inboxMode, setInboxMode] = useState('personal');
  const [aiOutput, setAiOutput] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
const [teamMembers] = useState([
  { id: 'samuel', name: 'Samuel', avatar: 'S' },
  { id: 'sales', name: 'Sales', avatar: 'SA' },
  { id: 'support', name: 'Support', avatar: 'SU' },
  { id: 'admin', name: 'Admin', avatar: 'AD' }
]);
const [assignments, setAssignments] = useState(() =>
  JSON.parse(localStorage.getItem('onepoint_assignments') || '{}')
);
  const [smartActionsOpen, setSmartActionsOpen] = useState(null);
  const [voiceSummary, setVoiceSummary] = useState(null);
  const [theme, setTheme] = useState(() =>
  localStorage.getItem('onepoint_theme') || 'dark'
);

useEffect(() => {
  localStorage.setItem('onepoint_theme', theme);
}, [theme]);
  const [replyHistory, setReplyHistory] = useState(() =>
  JSON.parse(localStorage.getItem('onepoint_reply_history') || '{}')
);

useEffect(() => {
  localStorage.setItem('onepoint_assignments', JSON.stringify(assignments));
}, [assignments]);

  const headers = {
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json'
    
  };

  async function apiGet(path) {
    const res = await fetch(`${API}${path}`, { headers });
    if (res.status === 401) {
      onLogout();
      return null;
    }
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (res.status === 401) {
      onLogout();
      return null;
    }

    return res.json();
  }

  async function apiDelete(path) {
    const res = await fetch(`${API}${path}`, {
      method: 'DELETE',
      headers
    });

    if (res.status === 401) {
      onLogout();
      return null;
    }

    return res.json();
  }

  async function apiPatch(path, body = {}) {
    const res = await fetch(`${API}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });

    if (res.status === 401) {
      onLogout();
      return null;
    }

    return res.json();
  }

  async function load() {
  const nextMessages = await apiGet('/api/messages');
  const nextConnectors = await apiGet('/api/connectors');

  const incoming = Array.isArray(nextMessages) ? nextMessages : [];

if (messages.length && incoming.length > messages.length) {
  const newest = incoming[0];

  if (Notification.permission === 'granted') {
    new Notification(newest.senderName || 'New message', {
      body: newest.text || 'You received a message',
      icon: '/icon-192.png'
    });
  }
}

setMessages(incoming);
  setConnectors(Array.isArray(nextConnectors) ? nextConnectors : []);

  try {
    const sent = await apiGet('/api/user-items/sent');
    setSentMessages(Array.isArray(sent) ? sent : []);
  } catch {}

  try {
    const drafts = await apiGet('/api/user-items/drafts');
    setDraftMessages(Array.isArray(drafts) ? drafts : []);
  } catch {}

  try {
    const deleted = await apiGet('/api/user-items/deleted');
    setDeletedMessages(Array.isArray(deleted) ? deleted : []);
  } catch {}

  try {
    const deletedFlags = await apiGet('/api/message-flags/deleted');
    setDeletedIds(Array.isArray(deletedFlags) ? deletedFlags : []);
  } catch {}

  try {
    const starred = await apiGet('/api/message-flags/starred');
    setStarredIds(Array.isArray(starred) ? starred : []);
  } catch {}

  try {
    const follow = await apiGet('/api/follow-ups');

    setFollowUps(
      Array.isArray(follow)
        ? follow.map((item) => ({
            id: item.id,
            messageId: item.message_id,
            senderName: item.sender_name,
            text: item.message_text,
            source: item.source,
            dueAt: item.due_at,
            createdAt: item.created_at
          }))
        : []
    );
  } catch {}
}

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
  localStorage.setItem('onepoint_reply_history', JSON.stringify(replyHistory));
}, [replyHistory]);

  const enabledSources = useMemo(
    () => connectors.filter((c) => c.enabled).map((c) => c.source),
    [connectors]
  );

  const liveMessages = useMemo(
    () => messages.filter((m) => !deletedIds.includes(m.id)),
    [messages, deletedIds]
  );
const smartMemory = useMemo(() => {
  return buildSmartMemory(liveMessages);
}, [liveMessages]);

const dailyBriefing = useMemo(() => {
  return buildDailyBriefing(liveMessages, followUps);
}, [liveMessages, followUps]);

const waitingOn = useMemo(() => {
  return buildWaitingOn(sentMessages, liveMessages);
}, [sentMessages, liveMessages]);

  const customerTimelines = useMemo(() => {
    const grouped = {};

    liveMessages.forEach((m) => {
      const key = (m.senderName || 'Unknown').toLowerCase().trim();

      if (!grouped[key]) {
        grouped[key] = {
          name: m.senderName || 'Unknown',
          sources: new Set(),
          messages: [],
          score: 0
        };
      }

      grouped[key].sources.add(m.source);
      grouped[key].messages.push(m);
      grouped[key].score = Math.max(grouped[key].score, analyseMessage(m).score);
    });

    const memory = buildSmartMemory(liveMessages);

return Object.values(grouped)
  .map((item) => ({
    ...item,
    sources: Array.from(item.sources),
    memory: memory.find((m) => m.name === item.name),
    messages: item.messages.sort(
          (a, b) => new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0)
        )
      }))
      .sort((a, b) => b.score - a.score);
  }, [liveMessages]);

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
      deleted: deletedMessages.length,
      followups: followUps.length,
      waiting: waitingOn.length,
      timelines: customerTimelines.length
    };

  }, [liveMessages, sentMessages, draftMessages, deletedMessages, followUps, customerTimelines]);

  useEffect(() => {
  const badgeCount = counts.unread + counts.followups + counts.waiting;

  if ('setAppBadge' in navigator) {
    if (badgeCount > 0) {
      navigator.setAppBadge(badgeCount);
    } else {
      navigator.clearAppBadge();
    }
  }

  document.title = badgeCount > 0
    ? `(${badgeCount}) OnePoint Inbox`
    : 'OnePoint Inbox';
}, [counts.unread, counts.followups, counts.waiting]);

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

      const matchesTeam =
  teamFilter === 'all'
    ? true
    : assignments[message.id] === teamFilter;

return matchesQuery && matchesSource && sourceAllowed && matchesFolder && matchesSmart && matchesMode && matchesTeam;
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
    inboxMode,
    teamFilter,
    assignments
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

  async function deleteMessage(message) {
    await apiPost('/api/user-items/deleted', {
      ...message,
      deletedAt: new Date().toISOString()
    });

    await apiPost(`/api/message-flags/deleted/${message.id}`, {});

    if (folder === 'drafts') {
      await apiDelete(`/api/user-items/drafts/${message.id}`);
    }

    if (folder === 'sent') {
      await apiDelete(`/api/user-items/sent/${message.id}`);
    }

    setSelectedMessage(null);
    await load();
  }

  async function createFollowUp(message) {
    const exists = followUps.some((f) => f.messageId === message.id);
    if (exists) return;

    await apiPost('/api/follow-ups', {
      messageId: message.id,
      senderName: message.senderName,
      text: message.text,
      source: message.source,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    await load();
  }

  async function completeFollowUp(id) {
    await apiPatch(`/api/follow-ups/${id}/complete`);
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
        text: 'How much is this and can I collect today?',
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
    try {
      const response = await fetch(`${API}/api/ai/suggest-replies`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          tone: 'friendly'
        })
      });

      const data = await response.json();

      if (data.suggestions?.length) {
        setAiSuggestions(data.suggestions);
        return;
      }
    } catch {}

    setAiSuggestions([
      makeLocalReply(message),
      `Thanks ${message.senderName}, I’ll check this and come back to you shortly.`,
      `Hi ${message.senderName}, that’s no problem. I’ll sort this for you.`
    ]);
  }
  function openSmartActions(message) {
  setSmartActionsOpen(message);
}

function closeSmartActions() {
  setSmartActionsOpen(null);
}

function replyLikeMe(message) {
  setReplyDraft(makeLocalReply(message));
  setSelectedMessage(message);
  closeSmartActions();
}

function showVoiceSummary(message) {
  setVoiceSummary(makeVoiceNoteSummary(message));
  closeSmartActions();
}
    function summarizeUnread() {
    const unread = liveMessages.filter((m) => !m.read && !m.archived);

    if (!unread.length) {
      setAiOutput('You have no unread messages. Everything looks clear.');
      return;
    }

    const priority = unread.filter((m) => analyseMessage(m).score >= 65);
    const sales = unread.filter((m) => analyseMessage(m).type === 'Sales lead');
    const follow = unread.filter((m) => analyseMessage(m).type === 'Follow-up');

    setAiOutput(
      `Unread summary: ${unread.length} unread messages. ${priority.length} need attention, ${sales.length} look like sales opportunities, and ${follow.length} may need follow-up.`
    );
  }

  function draftBestReply() {
    const top = [...liveMessages].sort(
      (a, b) => analyseMessage(b).score - analyseMessage(a).score
    )[0];

    if (!top) {
      setAiOutput('No message found to draft a reply for.');
      return;
    }

    setAiOutput(`Suggested reply to ${top.senderName}: ${makeLocalReply(top)}`);
  }
   
  function assignMessage(messageId, memberId) {
  setAssignments((current) => ({
    ...current,
    [messageId]: memberId
  }));
}

  function prioritizeInbox() {
    setSmartFilter('priority');
    setCalmMode(true);
    setScreen('inbox');

    setAiOutput(
      'Priority mode is now active. I am showing only the messages most likely to need you.'
    );
  }

  async function sendCompose(message) {
  const outgoingMessage = {
    ...message,
    id: message.id || crypto.randomUUID(),
    receivedAt: message.receivedAt || new Date().toISOString(),
    read: true,
    archived: false
  };

  setSentMessages((current) => [outgoingMessage, ...current]);

  setComposeOpen(false);
  setScreen('sent');
  setFolder('sent');

  try {
    await apiPost('/api/user-items/sent', outgoingMessage);
    await load();
  } catch (error) {
    console.warn('Backend save failed, message kept locally', error);
  }
}

  async function saveDraft(message) {
  const draftMessage = {
    ...message,
    id: message.id || crypto.randomUUID(),
    receivedAt: message.receivedAt || new Date().toISOString(),
    read: true,
    archived: false
  };

  setDraftMessages((current) => [draftMessage, ...current]);

  setComposeOpen(false);
  setScreen('drafts');
  setFolder('drafts');

  try {
    await apiPost('/api/user-items/drafts', draftMessage);
    await load();
  } catch (error) {
    console.warn('Backend draft save failed, draft kept locally', error);
  }
}

  async function toggleStar(id) {
    if (starredIds.includes(id)) {
      await apiDelete(`/api/message-flags/starred/${id}`);
    } else {
      await apiPost(`/api/message-flags/starred/${id}`, {});
    }

    await load();
  }

  async function requestNotifications() {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications.');
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      new Notification('OnePoint Inbox notifications enabled');
    }
  }

  if (selectedMessage) {
    return (
      <PhoneShell theme={theme}>
        <ChatScreen
          message={selectedMessage}
          onBack={() => {
            setSelectedMessage(null);
            setReplyDraft('');
            setAiSuggestions([]);
          }}
          onDelete={() => deleteMessage(selectedMessage)}
          onFollowUp={() => createFollowUp(selectedMessage)}
          replyDraft={replyDraft}
          setReplyDraft={setReplyDraft}
          suggestions={aiSuggestions}
          onGenerate={() => generateReplies(selectedMessage)}
        />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell theme={theme}>
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
          onFollowUp={createFollowUp}
          onStar={toggleStar}
          starredIds={starredIds}
          onAddDemo={addDemoMessage}
          setScreen={setScreen}
          calmMode={calmMode}
          setCalmMode={setCalmMode}
          inboxMode={inboxMode}
          setInboxMode={setInboxMode}
          openSmartActions={openSmartActions}
          teamMembers={teamMembers}
          teamFilter={teamFilter}
          setTeamFilter={setTeamFilter}
          assignments={assignments}
          assignMessage={assignMessage}
          onQuickReply={(message, reply) => {
          setReplyDraft(reply);
          setSelectedMessage(message);
}}
        />
      )}

      {screen === 'ai' && (
        <AiAssistantScreen
          messages={liveMessages}
          aiOutput={aiOutput}
          summarizeUnread={summarizeUnread}
          draftBestReply={draftBestReply}
          prioritizeInbox={prioritizeInbox}
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

      {screen === 'contacts' && (
        <ContactsScreen people={demoPeople} timelines={customerTimelines} />
      )}

      {screen === 'settings' && (
        <SettingsScreen
  auth={auth}
  connectors={connectors}
  onToggleConnector={toggleConnector}
  onLogout={onLogout}
  requestNotifications={requestNotifications}
  theme={theme}
  setTheme={setTheme}
/>
      )}

      {screen === 'followups' && (
        <FollowUpsScreen
          followUps={followUps}
          onComplete={completeFollowUp}
          onBack={() => {
            setScreen('inbox');
            setFolder('inbox');
          }}
        />
      )}

{screen === 'waiting' && (
  <WaitingOnScreen
    waitingOn={waitingOn}
    onBack={() => {
      setScreen('inbox');
      setFolder('inbox');
    }}
    onFollowUp={createFollowUp}
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
          onFollowUp={createFollowUp}
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

      <button
        className="floatingCompose"
        onClick={() => setComposeOpen(true)}
      >
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
      {smartActionsOpen && (
  <SmartActionsModal
    message={smartActionsOpen}
    onClose={closeSmartActions}
    onReplyLikeMe={() => replyLikeMe(smartActionsOpen)}
    onFollowUp={() => {
      createFollowUp(smartActionsOpen);
      closeSmartActions();
    }}
    onVoiceSummary={() => showVoiceSummary(smartActionsOpen)}
    onArchive={() => {
      archiveMessage(smartActionsOpen);
      closeSmartActions();
    }}
    onDelete={() => {
      deleteMessage(smartActionsOpen);
      closeSmartActions();
    }}
  />
)}

{voiceSummary && (
  <VoiceSummaryModal
    summary={voiceSummary}
    onClose={() => setVoiceSummary(null)}
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
  onFollowUp,
  onStar,
  starredIds,
  onAddDemo,
  setScreen,
  calmMode,
  setCalmMode,
  inboxMode,
  setInboxMode,
  teamMembers,
  teamFilter,
  setTeamFilter,
  assignments,
  onQuickReply,
  assignMessage
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

<div className="teamFilterBar">
  <button
    className={teamFilter === 'all' ? 'active' : ''}
    onClick={() => setTeamFilter('all')}
  >
    All team
  </button>

  {teamMembers.map((member) => (
    <button
      key={member.id}
      className={teamFilter === member.id ? 'active' : ''}
      onClick={() => setTeamFilter(member.id)}
    >
      {member.name}
    </button>
  ))}
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
  onFollowUp={() => onFollowUp(message)}
  onSmartActions={() => openSmartActions(message)}
  onStar={() => onStar(message.id)}
  starred={starredIds.includes(message.id)}
  teamMembers={teamMembers}
  assignedTo={assignments[message.id]}
  onQuickReply={onQuickReply}
  assignMessage={(memberId) => assignMessage(message.id, memberId)}
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

function SwipeMessageRow({
  message,
  onOpen,
  onQuickReply,
  onArchive,
  onDelete,
  onFollowUp,
  onSmartActions,
  onStar,
  starred,
  teamMembers = [],
  assignedTo,
  assignMessage
}) {
  const meta = sourceMeta[message.source] || sourceMeta.email;
  const Icon = meta.icon;
  const replyHistory = JSON.parse(localStorage.getItem('onepoint_reply_history') || '{}');
  const intelligence = analyseMessage(message, replyHistory[message.senderName] || 0);
  const media = detectMedia(message);
  const photo = getContactPhoto(message);
  const relationshipLevel = getRelationshipLevel(message, {});
  const quickReplies = generateQuickReplies(message);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
const moreQuickReplies = [
  ...quickReplies,
  'Is there anything else I can help with?',
  'Let me know if you have any other questions!'
];

const [touchStartX, setTouchStartX] = useState(null);
const [touchEndX, setTouchEndX] = useState(null);
const [swipeOffset, setSwipeOffset] = useState(0);

function handleSwipeEnd() {
  if (touchStartX === null || touchEndX === null) return;

  const distance = touchStartX - touchEndX;

  if (distance > 90) {
    onArchive?.();
  }

  if (distance < -90) {
    onFollowUp?.();
  }

  setSwipeOffset(0);
  setTouchStartX(null);
  setTouchEndX(null);
}

  return (
    <div className="messageCard">
      <div
  className="messageRow newReadableRow"
  style={{
  transform: `translateX(${swipeOffset}px)`
}}
  role="button"
  tabIndex={0}
  onClick={onOpen}
  onTouchStart={(e) => setTouchStartX(e.changedTouches[0].screenX)}
  onTouchMove={(e) => {
  const currentX = e.changedTouches[0].screenX;
  setTouchEndX(currentX);

  if (touchStartX !== null) {
    const diff = currentX - touchStartX;

    if (diff < 0) {
      setSwipeOffset(Math.max(diff, -80));
    }

    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 80));
    }
  }
}}
  onTouchEnd={handleSwipeEnd}
  onContextMenu={(e) => {
    e.preventDefault();
    onSmartActions?.();
  }}
  onDoubleClick={(e) => {
    e.preventDefault();
    onSmartActions?.();
  }}
>
        <div className="platformIcon" style={{ background: meta.colour }}>
          <Icon />
        </div>

        <div className={`personAvatar photoAvatar relationshipAvatar ${relationshipLevel}`}>
        <img src={photo} alt={message.senderName || 'Contact'} />
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
          {media && (
  <button
    className={`mediaPreview ${media.type}`}
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      alert(`${media.title} would open here when connected to the real platform.`);
    }}
  >
    <span>{media.type === 'voice' ? '🎙️' : media.type === 'video' ? '▶' : '🖼️'}</span>
    <small>{media.title}</small>
  </button>
)}

          <div className="tinyPriorityBadge">
  {intelligence.score}%
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
      </div>

<div className="messageControlRow">
  <div className="assignedRow">
    <select
      value={assignedTo || ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => assignMessage?.(e.target.value)}
    >
      <option value="">Unassigned</option>

      {teamMembers.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </select>
  </div>

  <div className="messageQuickActions">
    <button
      className="quickAction archiveActionButton"
      type="button"
      title="Archive"
      onClick={onArchive}
    >
      <Archive size={15} />
    </button>

    <button
      className="quickAction followActionButton"
      type="button"
      title="Follow up"
      onClick={onFollowUp}
    >
      <Clock size={15} />
    </button>

    <button
      className="quickAction deleteActionButton"
      type="button"
      title="Delete"
      onClick={onDelete}
    >
      <Trash2 size={15} />
    </button>
  </div>
</div>

<div className="quickReplyDropdownWrap">
  <button
    className="quickReplyDropdownButton"
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      setQuickRepliesOpen(!quickRepliesOpen);
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Sparkles size={15} />
      AI Quick Replies
    </span>

    <span>{quickRepliesOpen ? '⌃' : '⌄'}</span>
  </button>

  {quickRepliesOpen && (
    <div className="quickReplyDropdown">
      {moreQuickReplies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickReply?.(message, reply);
          }}
        >
          {reply}
        </button>
      ))}
    </div>
  )}
</div>
    </div>
  );
}

function ChatScreen({
  message,
  onBack,
  onDelete,
  onFollowUp,
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

        <button className="iconButton" onClick={onFollowUp}>
          <Clock />
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
function SmartActionsModal({
  message,
  onClose,
  onReplyLikeMe,
  onFollowUp,
  onVoiceSummary,
  onArchive,
  onDelete
}) {
  return (
    <div className="modalOverlay">
      <section className="smartActionSheet">
        <div className="composeHeader">
          <button onClick={onClose}>Cancel</button>
          <h2>Smart Actions</h2>
          <span />
        </div>

        <div className="smartActionPerson">
          <div className="personAvatar">{initials(message.senderName)}</div>
          <div>
            <strong>{message.senderName}</strong>
            <span>{message.text}</span>
          </div>
        </div>

        <button className="smartActionButton" onClick={onReplyLikeMe}>
          <Sparkles size={18} />
          Reply like me
        </button>

        <button className="smartActionButton" onClick={onFollowUp}>
          <Clock size={18} />
          Set follow-up
        </button>

        <button className="smartActionButton" onClick={onVoiceSummary}>
          <Mic size={18} />
          Summarise voice/video note
        </button>

        <button className="smartActionButton" onClick={onArchive}>
          <Archive size={18} />
          Archive
        </button>

        <button className="smartActionButton danger" onClick={onDelete}>
          <Trash2 size={18} />
          Delete
        </button>
      </section>
    </div>
  );
}

function VoiceSummaryModal({ summary, onClose }) {
  return (
    <div className="modalOverlay">
      <section className="smartActionSheet">
        <div className="composeHeader">
          <button onClick={onClose}>Close</button>
          <h2>AI Summary</h2>
          <span />
        </div>

        <p className="voiceSummaryText">{summary.summary}</p>

        <div className="voicePoints">
          {summary.points.map((point) => (
            <div key={point}>• {point}</div>
          ))}
        </div>

        <div className="suggestionButton">
          {summary.suggestedReply}
        </div>
      </section>
    </div>
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

        <MenuItem
          icon={Inbox}
          label="Inbox"
          count={counts.all}
          active={folder === 'inbox'}
          onClick={() => setFolder('inbox')}
        />

        <MenuItem
          icon={Clock}
          label="Follow-ups"
          count={counts.followups}
          active={folder === 'followups'}
          onClick={() => setFolder('followups')}
        />

        <MenuItem
          icon={Send}
          label="Waiting On"
          count={counts.waiting}
          active={folder === 'waiting'}
          onClick={() => setFolder('waiting')}
        />

        <MenuItem
          icon={Users}
          label="Timelines"
          count={counts.timelines}
          active={false}
          onClick={onClose}
        />

        <MenuItem
          icon={Archive}
          label="Archived"
          count={counts.archived}
          active={folder === 'archive'}
          onClick={() => setFolder('archive')}
        />

        <MenuItem
          icon={Send}
          label="Sent"
          count={counts.sent}
          active={folder === 'sent'}
          onClick={() => setFolder('sent')}
        />

        <MenuItem
          icon={FileText}
          label="Drafts"
          count={counts.drafts}
          active={folder === 'drafts'}
          onClick={() => setFolder('drafts')}
        />

        <MenuItem
          icon={Trash2}
          label="Deleted"
          count={counts.deleted}
          active={folder === 'deleted'}
          onClick={() => setFolder('deleted')}
        />

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

function AiAssistantScreen({ aiOutput, summarizeUnread, draftBestReply, prioritizeInbox }) {
  return (
    <ScreenPage title="AI Assistant">
      <p className="centerSub">How can I help you today?</p>

      <div className="aiGrid">
        <AiAction
          icon={FileText}
          title="Summarize unread messages"
          onClick={summarizeUnread}
        />

        <AiAction
          icon={Mail}
          title="Draft best reply"
          onClick={draftBestReply}
        />

        <AiAction
          icon={Search}
          title="Find important info"
          onClick={summarizeUnread}
        />

        <AiAction
          icon={Zap}
          title="Smart prioritization"
          onClick={prioritizeInbox}
        />
      </div>

      {aiOutput && (
        <section className="recentPanel">
          <h3>AI Result</h3>
          <p>{aiOutput}</p>
        </section>
      )}

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
            onFollowUp={() => {}}
            onStar={() => {}}
            starred={false}
          />
        ))}
      </div>
    </ScreenPage>
  );
}

function ContactsScreen({ people, timelines }) {
  const [selectedTimeline, setSelectedTimeline] = useState(null);

  if (selectedTimeline) {
    return (
      <ScreenPage title={selectedTimeline.name} onBack={() => setSelectedTimeline(null)}>
        <section className="timelineProfileCard contactIntelligenceHeader">
  <div className={`personAvatar large photoAvatar relationshipAvatar ${getContactInsights(selectedTimeline).topScore >= 80 ? 'hot' : getContactInsights(selectedTimeline).topScore >= 65 ? 'warm' : 'normal'}`}>
    <img
      src={getContactPhoto(selectedTimeline.messages[0])}
      alt={selectedTimeline.name}
    />
  </div>

  <div>
    <h3>{selectedTimeline.name}</h3>

    <p>
      {selectedTimeline.messages.length} messages across{' '}
      {selectedTimeline.sources.length} apps
    </p>

    <div className="contactInsightPills">
      <div className="relationshipSummary">
  <div>
    <strong>Mood</strong>
    <span>
      {getContactInsights(selectedTimeline).topScore >= 80
        ? '😊 Positive'
        : getContactInsights(selectedTimeline).topScore >= 65
        ? '🙂 Active'
        : '😐 Neutral'}
    </span>
  </div>

  <div>
    <strong>Last topic</strong>
    <span>
      {selectedTimeline.messages[0]?.text?.slice(0, 42) || 'No recent topic'}
    </span>
  </div>

  <div>
    <strong>Suggested action</strong>
    <span>
      {getContactInsights(selectedTimeline).followCount > 0
        ? 'Follow up tomorrow'
        : getContactInsights(selectedTimeline).salesCount > 0
        ? 'Send pricing/details'
        : 'Keep relationship warm'}
    </span>
  </div>
</div>
      <span>
        {getContactInsights(selectedTimeline).topScore}% priority
      </span>

      <span>
        {getContactInsights(selectedTimeline).status}
      </span>

      <span>
        Prefers{' '}
        {sourceMeta[getContactInsights(selectedTimeline).preferredSource]?.label || 'Email'}
      </span>
    </div>
  </div>
</section>

        <section className="timelineSources">
          {selectedTimeline.sources.map((source) => {
            const meta = sourceMeta[source] || sourceMeta.email;
            const Icon = meta.icon;

            return (
              <div className="timelineSourcePill" key={source}>
                <div className="sourceIcon small" style={{ background: meta.colour }}>
                  <Icon />
                </div>
                <span>{meta.label}</span>
              </div>
            );
          })}
        </section>

        <section className="smartMemoryCard">
          <h3>Smart Memory</h3>

          {selectedTimeline.memory?.notes?.length ? (
            selectedTimeline.memory.notes.map((note) => (
              <p key={note}>• {note}</p>
            ))
          ) : (
            <p>No memory notes yet. OnePoint will learn from future conversations.</p>
          )}
        </section>

        <section className="timelineThread">
          {selectedTimeline.messages.map((message) => {
            const meta = sourceMeta[message.source] || sourceMeta.email;
            const Icon = meta.icon;
            const intelligence = analyseMessage(message);

            return (
              <div className="timelineMessage" key={message.id}>
                <div className="timelineMarker" style={{ background: meta.colour }}>
                  <Icon size={14} />
                </div>

                <div className="timelineBubble">
                  <div>
                    <strong>{meta.label}</strong>
                    <span>{timeAgo(message.receivedAt)}</span>
                  </div>

                  <p>{message.text}</p>

                  <small>{intelligence.score}% · {intelligence.type}</small>
                </div>
              </div>
            );
          })}
        </section>
      </ScreenPage>
    );
  }

  return (
    <ScreenPage title="Timelines">
      <p className="centerSub">One person. Every app. One clean history.</p>

      <div className="contactsList">
        {timelines.map((item) => (
          <button
            className={`timelineContactCard ${item.score >= 80 ? 'hot' : item.score >= 65 ? 'warm' : ''}`}
            key={item.name}
            onClick={() => setSelectedTimeline(item)}
          >
            <div className="personAvatar">{initials(item.name)}</div>

            <div>
              <strong>{item.name}</strong>
              <span>{item.messages.length} messages · {item.sources.join(', ')}</span>
            </div>

            <b>{item.score}%</b>
          </button>
        ))}

        {!timelines.length &&
          people.map((person) => (
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

function FollowUpsScreen({ followUps, onComplete, onBack }) {
  return (
    <ScreenPage title="Follow-ups" onBack={onBack}>
      <div className="messageList">
        {followUps.map((item) => (
          <div className="messageCard" key={item.id}>
            <div className="messageContent">
              <strong>{item.senderName}</strong>
              <p>{item.text}</p>
              <small>Due {new Date(item.dueAt).toLocaleString()}</small>
            </div>

            <div className="messageQuickActions">
              <button
                className="quickAction archiveActionButton"
                onClick={() => onComplete(item.id)}
              >
                <CheckCircle2 size={15} />
                Done
              </button>
            </div>
          </div>
        ))}

        {!followUps.length && <EmptyState />}
      </div>
    </ScreenPage>
  );
}
function WaitingOnScreen({ waitingOn, onBack, onFollowUp }) {
  return (
    <ScreenPage title="Waiting On" onBack={onBack}>
      <p className="centerSub">
        People you have replied to but have not heard back from yet.
      </p>

      <div className="messageList">
        {waitingOn.map((message) => (
          <div className="messageCard" key={message.id}>
            <div className="messageContent">
              <strong>{message.senderName}</strong>
              <p>{message.text}</p>
              <small>Waiting since {timeAgo(message.waitingSince)}</small>
            </div>

            <div className="messageQuickActions">
              <button
                className="quickAction followActionButton"
                onClick={() => onFollowUp(message)}
              >
                <Clock size={15} />
                Follow up
              </button>
            </div>
          </div>
        ))}

        {!waitingOn.length && <EmptyState />}
      </div>
    </ScreenPage>
  );
}

function SettingsScreen({ auth, connectors, onToggleConnector, onLogout, requestNotifications, theme, setTheme }) {
  return (
    <ScreenPage title="Settings">
      <section className="settingsCard">
        <h3>Account</h3>
        <section className="settingsCard compactAppearance">
  <h3>Appearance</h3>

  <div className="themeCompactRow">
    <span>Dark</span>

    <button
      className={`themeSlider ${theme === 'light' ? 'light' : ''}`}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      <div className="sliderTrack">
        <div className="sliderThumb" />
      </div>
    </button>

    <span>Light</span>
  </div>
</section>
        <SettingRow icon={UserRound} title="Profile" value={auth.user?.name || 'User'} />
        <SettingRow icon={Mail} title="Email" value={auth.user?.email || 'Account email'} />
        <SettingRow icon={Shield} title="Security" value="Change password" />

        <button className="addDemoButton" onClick={requestNotifications}>
          Enable notifications
        </button>
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
  onFollowUp,
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
            onFollowUp={() => onFollowUp(message)}
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

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
        />

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

function PhoneShell({ children, theme = 'dark' }) {
  return <main className={`phoneShell ${theme === 'light' ? 'lightMode' : ''}`}>{children}</main>;
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