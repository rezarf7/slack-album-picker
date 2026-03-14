require("dotenv").config();
const db = require("../db");
const { app } = require("../slack");
const { runNewPick } = require("../picker");

(async () => {
  try {
    await db.init();

    await runNewPick({
      client: app.client,
      channelId: process.env.SLACK_CHANNEL_ID
    });

    console.log("Weekly pick done");
    process.exit(0);
  } catch (err) {
    console.error("weeklyPick failed:", err);
    process.exit(1);
  }
})();
