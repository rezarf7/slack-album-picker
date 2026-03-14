const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const db = new Database("./album-picker.db");

const schema = fs.readFileSync(
  path.join(__dirname, "..", "schema.sql"),
  "utf8"
);

db.exec(schema);

function now() {
  return new Date().toISOString();
}

module.exports = {
  createRound({ channelId, selectedUserId, status, messageTs, deadlineAt }) {
    const stmt = db.prepare(`
      INSERT INTO rounds (channel_id, selected_user_id, status, message_ts, deadline_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      channelId,
      selectedUserId,
      status,
      messageTs,
      deadlineAt,
      now(),
      now()
    );

    return result.lastInsertRowid;
  },

  updateRoundStatus(roundId, status) {
    db.prepare(`
      UPDATE rounds
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, now(), roundId);
  },

  getPendingRoundByMessageTs(messageTs) {
    return db.prepare(`
      SELECT *
      FROM rounds
      WHERE message_ts = ?
      AND status = 'pending'
      LIMIT 1
    `).get(messageTs);
  },

  getExpiredPendingRounds(currentIso) {
    return db.prepare(`
      SELECT *
      FROM rounds
      WHERE status = 'pending'
      AND deadline_at <= ?
    `).all(currentIso);
  },

  addWinnerHistory({ channelId, userId, roundId, pickedAt }) {
    db.prepare(`
      INSERT INTO winner_history (channel_id, user_id, picked_at, round_id)
      VALUES (?, ?, ?, ?)
    `).run(channelId, userId, pickedAt, roundId);
  },

  getRecentWinnerIds(channelId, sinceIso) {
    const rows = db.prepare(`
      SELECT DISTINCT user_id
      FROM winner_history
      WHERE channel_id = ?
      AND picked_at >= ?
    `).all(channelId, sinceIso);

    return rows.map(r => r.user_id);
  }
};
