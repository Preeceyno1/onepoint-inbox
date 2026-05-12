export async function markFacebookOrInstagramRead(msg) {
  if (!process.env.META_PAGE_ACCESS_TOKEN) return { demo: true };
  // Real Meta implementation depends on the exact Page / IG professional account setup and approved permissions.
  return { demo: true, message: 'Meta read sync placeholder reached', source: msg.source };
}

export function normaliseMetaWebhook(entry, userId) {
  const messaging = entry.messaging?.[0] || entry.changes?.[0]?.value?.messaging?.[0];
  if (!messaging?.message) return null;
  return {
    userId,
    source: entry.object === 'instagram' ? 'instagram' : 'facebook',
    sourceMessageId: messaging.message.mid,
    conversationId: messaging.sender?.id || entry.id,
    senderName: messaging.sender?.id || 'Meta user',
    senderHandle: messaging.sender?.id || 'Meta user',
    text: messaging.message.text || '[Unsupported Meta message type]'
  };
}
