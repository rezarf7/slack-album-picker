{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 require("dotenv").config();\
const \{ app \} = require("./slack");\
const db = require("./db");\
const \{ runNewPick \} = require("./picker");\
\
app.action("accept_pick", async (\{ ack, body, client \}) => \{\
  await ack();\
\
  const round = db.getPendingRoundByMessageTs(body.message.ts);\
  if (!round) return;\
\
  if (body.user.id !== round.selected_user_id) \{\
    await client.chat.postEphemeral(\{\
      channel: body.channel.id,\
      user: body.user.id,\
      text: "Only the selected person can accept this round."\
    \});\
    return;\
  \}\
\
  db.updateRoundStatus(round.id, "accepted");\
\
  await client.chat.postEphemeral(\{\
    channel: body.channel.id,\
    user: body.user.id,\
    text: "Nice one \'97 you're locked in for this week."\
  \});\
\});\
\
app.action("skip_me", async (\{ ack, body, client \}) => \{\
  await ack();\
\
  const round = db.getPendingRoundByMessageTs(body.message.ts);\
  if (!round) return;\
\
  if (body.user.id !== round.selected_user_id) \{\
    await client.chat.postEphemeral(\{\
      channel: body.channel.id,\
      user: body.user.id,\
      text: "Only the selected person can skip this round."\
    \});\
    return;\
  \}\
\
  db.updateRoundStatus(round.id, "skipped");\
\
  await client.chat.postMessage(\{\
    channel: body.channel.id,\
    text: `\uc0\u8618 \u65039  <@$\{body.user.id\}> skipped this week. Rerolling...`\
  \});\
\
  await runNewPick(\{\
    client,\
    channelId: body.channel.id,\
    prefixText: "\uc0\u8618 \u65039  Reroll: ",\
    excludeUserIds: [body.user.id]\
  \});\
\});\
\
(async () => \{\
  await app.start();\
  console.log("\uc0\u9889 \u65039  Slack app is running");\
\})();}