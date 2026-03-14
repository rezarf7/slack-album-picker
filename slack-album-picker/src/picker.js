\f0\fs24 \cf0 const \{ App \} = require("@slack/bolt");\
require("dotenv").config();\
\
const app = new App(\{\
  token: process.env.SLACK_BOT_TOKEN,\
  signingSecret: process.env.SLACK_SIGNING_SECRET,\
  port: Number(process.env.PORT || 3000)\
\});\
\
function buildPickerBlocks(userId, deadlineIso) \{\
  const deadline = new Date(deadlineIso).toLocaleString("en-AU", \{\
    timeZone: "Australia/Sydney",\
    dateStyle: "medium",\
    timeStyle: "short"\
  \});\
\
  return [\
    \{\
      type: "section",\
      text: \{\
        type: "mrkdwn",\
        text:\
          `\uc0\u55356 \u57269  *This week's unskippable album picker is* <@$\{userId\}>.\\n` +\
          `You have 24 hours to respond.\\n` +\
          `Deadline: *$\{deadline\}*`\
      \}\
    \},\
    \{\
      type: "actions",\
      elements: [\
        \{\
          type: "button",\
          text: \{ type: "plain_text", text: "I'm in" \},\
          action_id: "accept_pick"\
        \},\
        \{\
          type: "button",\
          text: \{ type: "plain_text", text: "Skip me this week" \},\
          style: "danger",\
          action_id: "skip_me"\
        \}\
      ]\
    \}\
  ];\
\}\
\
module.exports = \{\
  app,\
  buildPickerBlocks\
\};}
