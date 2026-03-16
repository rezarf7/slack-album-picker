const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rounds (
      id SERIAL PRIMARY KEY,
      channel_id TEXT NOT NULL,
      selected_user_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending','accepted','skipped','expired','submitted')),
      message_ts TEXT NOT NULL,
      deadline_at TIMESTAMPTZ NOT NULL,
      reminder_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS winner_history (
      id SERIAL PRIMARY KEY,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      picked_at TIMESTAMPTZ NOT NULL,
      round_id INTEGER NOT NULL REFERENCES rounds(id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nominations (
      id SERIAL PRIMARY KEY,
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      picker_user_id TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT NOT NULL,
      spotify_url TEXT,
      spotify_image_url TEXT,
      apple_url TEXT,
      apple_image_url TEXT,
      submitted_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    ALTER TABLE rounds
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rounds_status_deadline
    ON rounds(status, deadline_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_winner_history_channel_picked
    ON winner_history(channel_id, picked_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nominations_round_id
    ON nominations(round_id);
  `);
}

function now() {
  return new Date().toISOString();
}

module.exports = {
  async init() {
    await init();
  },

  async createRound({ channelId, selectedUserId, status, messageTs, deadlineAt }) {
    const result = await pool.query(
      `
      INSERT INTO rounds (
        channel_id, selected_user_id, status, message_ts, deadline_at, reminder_sent_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [channelId, selectedUserId, status, messageTs, deadlineAt, null, now(), now()]
    );

    return result.rows[0].id;
  },

  async updateRoundStatus(roundId, status) {
    await pool.query(
      `
      UPDATE rounds
      SET status = $1, updated_at = $2
      WHERE id = $3
      `,
      [status, now(), roundId]
    );
  },

  async markReminderSent(roundId) {
    await pool.query(
      `
      UPDATE rounds
      SET reminder_sent_at = $1, updated_at = $2
      WHERE id = $3
      `,
      [now(), now(), roundId]
    );
  },

  async getPendingRoundByMessageTs(messageTs) {
    const result = await pool.query(
      `
      SELECT *
      FROM rounds
      WHERE message_ts = $1
      AND status = 'pending'
      LIMIT 1
      `,
      [messageTs]
    );

    return result.rows[0] || null;
  },

  async getRoundById(roundId) {
    const result = await pool.query(
      `
      SELECT *
      FROM rounds
      WHERE id = $1
      LIMIT 1
      `,
      [roundId]
    );

    return result.rows[0] || null;
  },

  async getExpiredPendingRounds(currentIso) {
    const result = await pool.query(
      `
      SELECT *
      FROM rounds
      WHERE status = 'pending'
      AND deadline_at <= $1
      `,
      [currentIso]
    );

    return result.rows;
  },

  async getRoundsNeedingReminder(currentIso, reminderWindowHours = 12) {
    const result = await pool.query(
      `
      SELECT *
      FROM rounds
      WHERE status = 'pending'
        AND reminder_sent_at IS NULL
        AND deadline_at > $1::timestamptz
        AND deadline_at <= ($1::timestamptz + ($2 || ' hours')::interval)
      `,
      [currentIso, reminderWindowHours]
    );

    return result.rows;
  },

  async addWinnerHistory({ channelId, userId, roundId, pickedAt }) {
    await pool.query(
      `
      INSERT INTO winner_history (channel_id, user_id, picked_at, round_id)
      VALUES ($1, $2, $3, $4)
      `,
      [channelId, userId, pickedAt, roundId]
    );
  },

  async getRecentWinnerIds(channelId, sinceIso) {
    const result = await pool.query(
      `
      SELECT DISTINCT user_id
      FROM winner_history
      WHERE channel_id = $1
      AND picked_at >= $2
      `,
      [channelId, sinceIso]
    );

    return result.rows.map((r) => r.user_id);
  },

  async createNomination({
    roundId,
    pickerUserId,
    artist,
    album,
    spotifyUrl,
    spotifyImageUrl,
    appleUrl,
    appleImageUrl
  }) {
    const result = await pool.query(
      `
      INSERT INTO nominations (
        round_id, picker_user_id, artist, album,
        spotify_url, spotify_image_url, apple_url, apple_image_url,
        submitted_at, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
      `,
      [
        roundId,
        pickerUserId,
        artist,
        album,
        spotifyUrl || null,
        spotifyImageUrl || null,
        appleUrl || null,
        appleImageUrl || null,
        now(),
        now()
      ]
    );

    return result.rows[0].id;
  },

  async findExistingNomination(artist, album) {
    const result = await pool.query(
      `
      SELECT *
      FROM nominations
      WHERE LOWER(TRIM(artist)) = LOWER(TRIM($1))
        AND LOWER(TRIM(album)) = LOWER(TRIM($2))
      ORDER BY submitted_at ASC
      LIMIT 1
      `,
      [artist, album]
    );

    return result.rows[0] || null;
  }
};
