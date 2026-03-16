require("dotenv").config();
const db = require("../db");
const { app } = require("../slack");
const { runNewPick } = require("../picker");

function hoursRemaining(deadlineAt) {
  const diffMs = new Date(deadlineAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
}

(async () => {
  try {
    await db.init();

    const nowIso = new Date().toISOString();

    // 1) Send reminders for rounds nearing expiry
    const roundsNeedingReminder = await db.getRoundsNeedingReminder(nowIso, 12);

    for (const round of roundsNeedingReminder) {
      const remaining = hoursRemaining(round.deadline_at);

      try {
        await app.client.chat.postEphemeral({
          channel: round.channel_id,
          user: round.selected_user_id,
          text: `⏰ Reminder: you're this week's album picker and have about ${remaining} hour${remaining === 1 ? "" : "s"} left to submit your nomination.`
        });

        await db.markReminderSent(round.id);
        console.log(`Reminder sent for round ${round.id}`);
      } catch (err) {
        console.error(`Failed to send reminder for round ${round.id}:`, err);
      }
    }

    // 2) Reroll expired pending rounds
    const expired = await db.getExpiredPendingRounds(nowIso);

    for (const round of expired) {
      await db.updateRoundStatus(round.id, "expired");

      await app.client.chat.postMessage({
        channel: round.channel_id,
        text: `⏰ <@${round.selected_user_id}> did not respond in time. Rerolling...`
      });

      await runNewPick({
        client: app.client,
        channelId: round.channel_id,
        prefixText: "Reroll: ",
        excludeUserIds: [round.selected_user_id]
      });

      console.log(`Expired round rerolled: ${round.id}`);
    }

    console.log("Timeout check complete");
    process.exit(0);
  } catch (err) {
    console.error("checkTimeouts failed:", err);
    process.exit(1);
  }
})();
