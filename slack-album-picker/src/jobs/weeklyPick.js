require("dotenv").config();
const { app } = require("../slack");
const { runNewPick } = require("../picker");

(async () => {
  await runNewPick({
    client: app.client,
    channelId: process.env.SLACK_CHANNEL_ID
  });

  console.log("Weekly pick done");
  process.exit(0);
})();
