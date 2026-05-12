export async function markWhatsAppRead(messageId) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return { demo: true };
  const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }) });
  if (!res.ok) throw new Error(`WhatsApp read sync failed: ${await res.text()}`);
  return res.json();
}
