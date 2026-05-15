import pg from 'pg';
import { v4 as uuid } from 'uuid';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function testDatabase() {
  const result = await pool.query('SELECT NOW()');
  return result.rows[0];
}

export async function getMessages(userId) {
  const result = await pool.query(
    `
    SELECT * FROM messages
WHERE user_id = $1
ORDER BY received_at DESC
    `,
    [userId]
  );

  return result.rows;
}

export async function createMessage(message) {
  const id = uuid();

  const result = await pool.query(
    `
    INSERT INTO messages (
      id,
      user_id,
      source,
      source_message_id,
      conversation_id,
      sender_name,
      sender_handle,
      text,
      priority,
      intent,
      avatar,
      assigned_to
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
    )
    RETURNING *
    `,
    [
      id,
      message.userId,
      message.source,
      message.sourceMessageId || '',
      message.conversationId || '',
      message.senderName || '',
      message.senderHandle || '',
      message.text || '',
      message.priority || 'normal',
      message.intent || 'general',
      message.avatar || '??',
      message.assignedTo || 'Unassigned'
    ]
  );

  return result.rows[0];
}

export async function markMessageRead(id) {
  const result = await pool.query(
    `
    UPDATE messages
    SET read = true
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}

export async function addMessageNote(messageId, note) {
  await pool.query(
    `
    INSERT INTO notes (
      id,
      message_id,
      note
    )
    VALUES ($1,$2,$3)
    `,
    [
      uuid(),
      messageId,
      note
    ]
  );
}
export async function archiveMessage(id) {
  const result = await pool.query(
    `
    UPDATE messages
    SET archived = true
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}

export async function moveMessageToFolder(messageId, folderId) {
  const result = await pool.query(
    `
    UPDATE messages
    SET folder_id = $1, archived = false
    WHERE id = $2
    RETURNING *
    `,
    [folderId, messageId]
  );

  return result.rows[0];
}

export async function getFolders(userId) {
  const result = await pool.query(
    `
    SELECT *
    FROM folders
    WHERE user_id = $1
    ORDER BY created_at ASC
    `,
    [userId]
  );

  return result.rows;
}

export async function createFolder(userId, name, parentId = null) {
  const id = uuid();

  const result = await pool.query(
    `
    INSERT INTO folders (
      id,
      user_id,
      name,
      parent_id
    )
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [id, userId, name, parentId]
  );

  return result.rows[0];
}