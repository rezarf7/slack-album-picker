{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const Database = require("better-sqlite3");\
const fs = require("fs");\
const path = require("path");\
require("dotenv").config();\
\
const dbPath = process.env.DATABASE_PATH || "./album-picker.db";\
const db = new Database(dbPath);\
\
const schema = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");\
db.exec(schema);\
\
function nowIso() \{\
  return new Date().toISOString();\
\}\
\
module.exports = \{\
  createRound(\{ channelId, selectedUserId, status, messageTs, deadlineAt \}) \{\
    const stmt = db.prepare(`\
      INSERT INTO rounds (channel_id, selected_user_id, status, message_ts, deadline_at, created_at, updated_at)\
      VALUES (?, ?, ?, ?, ?, ?, ?)\
    `);\
    const result = stmt.run(\
      channelId,\
      selectedUserId,\
      status,\
      messageTs,\
      deadlineAt,\
      nowIso(),\
      nowIso()\
    );\
    return result.lastInsertRowid;\
  \},\
\
  updateRoundStatus(roundId, status) \{\
    db.prepare(`\
      UPDATE rounds\
      SET status = ?, updated_at = ?\
      WHERE id = ?\
    `).run(status, nowIso(), roundId);\
  \},\
\
  getPendingRoundByMessageTs(messageTs) \{\
    return db.prepare(`\
      SELECT *\
      FROM rounds\
      WHERE message_ts = ? AND status = 'pending'\
      ORDER BY id DESC\
      LIMIT 1\
    `).get(messageTs);\
  \},\
\
  getExpiredPendingRounds(currentIso) \{\
    return db.prepare(`\
      SELECT *\
      FROM rounds\
      WHERE status = 'pending'\
        AND deadline_at <= ?\
      ORDER BY deadline_at ASC\
    `).all(currentIso);\
  \},\
\
  addWinnerHistory(\{ channelId, userId, roundId, pickedAt \}) \{\
    db.prepare(`\
      INSERT INTO winner_history (channel_id, user_id, picked_at, round_id)\
      VALUES (?, ?, ?, ?)\
    `).run(channelId, userId, pickedAt, roundId);\
  \},\
\
  getRecentWinnerIds(channelId, sinceIso) \{\
    const rows = db.prepare(`\
      SELECT DISTINCT user_id\
      FROM winner_history\
      WHERE channel_id = ?\
        AND picked_at >= ?\
    `).all(channelId, sinceIso);\
\
    return rows.map(r => r.user_id);\
  \}\
\};}