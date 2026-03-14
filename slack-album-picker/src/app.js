require("dotenv").config();
const { app } = require("./slack");
const db = require("./db");
const { runNewPick } = require("./picker");

app.action("accept_pick", async ({ ack, body, client }) => {
  await ack();

  setTimeout(async () => {
    try {
      const round = await db.getPendingRoundByMessageTs(body.message.ts);
      if (!round) return;

      if (body.user.id !== round.selected_user_id) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: "Only the selected person can accept this round."
        });
        return;
      }

      await db.updateRoundStatus(round.id, "accepted");

      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: "You're locked in for this week."
      });
    } catch (err) {
      console.error("accept_pick failed:", err);
    }
  }, 0);
});

app.action("skip_me", async ({ ack, body, client }) => {
  await ack();

  setTimeout(async () => {
    try {
      const round = await db.getPendingRoundByMessageTs(body.message.ts);
      if (!round) return;

      if (body.user.id !== round.selected_user_id) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: "Only the selected person can skip."
        });
        return;
      }

      await db.updateRoundStatus(round.id, "skipped");

      await client.chat.postMessage({
        channel: body.channel.id,
        text: `<@${body.user.id}> skipped this week. Rerolling...`
      });

      await runNewPick({
        client,
        channelId: body.channel.id,
        prefixText: "Reroll: ",
        excludeUserIds: [body.user.id]
      });
    } catch (err) {
      console.error("skip_me failed:", err);
    }
  }, 0);
});

(async () => {
  await db.init();
  await app.start();
  console.log("Slack app is running");
})();
