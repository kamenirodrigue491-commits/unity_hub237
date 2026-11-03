const crypto = require('crypto');
const db = require('../db');
const { sendEmail } = require('./emailService');

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getFrontendBase() {
  return (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '');
}

async function ensureResetTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)
  `);
}

async function createResetToken(userId) {
  await ensureResetTable();
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.query(
    `UPDATE password_reset_tokens SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
}

async function sendResetEmail(user, rawToken) {
  const resetUrl = `${getFrontendBase()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const messageBody = [
    `Hello ${user.name},`,
    '',
    'We received a request to reset your Unity Hub password.',
    '',
    `Reset your password here (link expires in 1 hour):`,
    resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  return sendEmail({
    recipientEmail: user.email,
    recipientName: user.name,
    senderName: 'Unity Hub',
    subject: 'Reset your Unity Hub password',
    messageBody,
    opportunityTitle: null,
    company: null,
  });
}

async function requestPasswordReset(email) {
  const User = require('../models/User');
  const user = await User.findOne({ email });
  if (!user) {
    return { sent: false, reason: 'not_found' };
  }

  const hasPassword = await User.hasPassword(user.id);
  if (!hasPassword) {
    return { sent: false, reason: 'oauth_only' };
  }

  const rawToken = await createResetToken(user.id);
  const emailResult = await sendResetEmail(user, rawToken);
  return { sent: true, emailStatus: emailResult.status };
}

async function resetPasswordWithToken(rawToken, newPassword) {
  await ensureResetTable();
  const tokenHash = hashToken(rawToken);

  const result = await db.query(
    `SELECT prt.*, u.email, u.name
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1
       AND prt.used_at IS NULL
       AND prt.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  if (!result.rows.length) {
    return { ok: false, error: 'Invalid or expired reset link' };
  }

  const row = result.rows[0];
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(12);
  const hashed = await bcrypt.hash(newPassword, salt);

  await db.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hashed, row.user_id]
  );
  await db.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
    [row.id]
  );

  const { revokeAllSessions } = require('../utils/authTokens');
  await revokeAllSessions(row.user_id);

  return { ok: true };
}

module.exports = {
  ensureResetTable,
  requestPasswordReset,
  resetPasswordWithToken,
};
