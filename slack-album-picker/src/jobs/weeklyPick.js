{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 require("dotenv").config();\
const \{ app \} = require("../slack");\
const \{ runNewPick \} = require("../picker");\
\
(async () => \{\
  try \{\
    await runNewPick(\{\
      client: app.client,\
      channelId: process.env.SLACK_CHANNEL_ID\
    \});\
    console.log("Weekly pick complete");\
    process.exit(0);\
  \} catch (err) \{\
    console.error("Weekly pick failed:", err.data || err.message || err);\
    process.exit(1);\
  \}\
\})();}