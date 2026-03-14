{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 CREATE TABLE IF NOT EXISTS rounds (\
  id INTEGER PRIMARY KEY AUTOINCREMENT,\
  channel_id TEXT NOT NULL,\
  selected_user_id TEXT NOT NULL,\
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'skipped', 'expired')),\
  message_ts TEXT NOT NULL,\
  deadline_at TEXT NOT NULL,\
  created_at TEXT NOT NULL,\
  updated_at TEXT NOT NULL\
);\
\
CREATE TABLE IF NOT EXISTS winner_history (\
  id INTEGER PRIMARY KEY AUTOINCREMENT,\
  channel_id TEXT NOT NULL,\
  user_id TEXT NOT NULL,\
  picked_at TEXT NOT NULL,\
  round_id INTEGER NOT NULL,\
  FOREIGN KEY(round_id) REFERENCES rounds(id)\
);\
\
CREATE INDEX IF NOT EXISTS idx_rounds_status_deadline\
ON rounds(status, deadline_at);\
\
CREATE INDEX IF NOT EXISTS idx_winner_history_channel_picked\
ON winner_history(channel_id, picked_at);}
