app.action("skip_me", async ({ ack, body, client }) => {
  await ack();

  setTimeout(async () => {
    try {
      const round = db.getPendingRoundByMessageTs(body.message.ts);
      if (!round) return;

      if (body.user.id !== round.selected_user_id) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: "Only the selected person can skip."
        });
        return;
      }

      db.updateRoundStatus(round.id, "skipped");

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
