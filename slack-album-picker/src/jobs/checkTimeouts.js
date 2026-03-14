require("dotenv").config();
const db = require("../db");
const { app } = require("../slack");
const { runNewPick } = require("../picker");

(async () => {
  try {
    await db.init();

    const expired = await db.getExpiredPendingRounds(new Date().toISOString());

    for (const round of expired) {
      await db.updateRoundStatus(round.id, "expired");

      await app.client.chat.postMessage({
        channel: round.channel_id,
        text: `<@${round.selected_user_id}> timed out. Rerolling...`
      });

      await runNewPick({
        client: app.client,
        channelId: round.channel_id,
        prefixText: "Timeout reroll: ",
        excludeUserIds: [round.selected_user_id]
      });
    }

    console.log("Timeout check complete");
    process.exit(0);
  } catch (err) {
    console.error("checkTimeouts failed:", err);
    process.exit(1);
  }
})();
