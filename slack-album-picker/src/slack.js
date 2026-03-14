const { App } = require("@slack/bolt");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  port: process.env.PORT || 3000
});

function buildPickerBlocks(userId, deadline) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `This week's album picker is <@${userId}>.\nRespond within 24 hours.`
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "I'm in" },
          action_id: "accept_pick"
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Skip me this week" },
          style: "danger",
          action_id: "skip_me"
        }
      ]
    }
  ];
}

module.exports = {
  app,
  buildPickerBlocks
};
