const db = require("./db");
const { buildPickerBlocks } = require("./slack");

function random(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function getMembers(client, channel) {
  let members = [];
  let cursor;

  do {
    const res = await client.conversations.members({
      channel,
      cursor,
      limit: 200
    });

    members = members.concat(res.members || []);
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  return members;
}

async function getEligibleMembers(client, channel) {
  const ids = await getMembers(client, channel);

  const users = await Promise.all(
    ids.map(async id => {
      try {
        const res = await client.users.info({ user: id });
        const u = res.user;

        if (!u || u.deleted || u.is_bot || u.is_app_user) return null;

        return { id: u.id };
      } catch {
        return null;
      }
    })
  );

  return users.filter(Boolean);
}

async function announcePick({ client, channelId, userId, prefixText = "" }) {
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const res = await client.chat.postMessage({
    channel: channelId,
    text: `${prefixText}Picker is <@${userId}>`,
    blocks: buildPickerBlocks(userId, deadline)
  });

  const roundId = db.createRound({
    channelId,
    selectedUserId: userId,
    status: "pending",
    messageTs: res.ts,
    deadlineAt: deadline
  });

  db.addWinnerHistory({
    channelId,
    userId,
    roundId,
    pickedAt: new Date().toISOString()
  });

  return roundId;
}

async function runNewPick({ client, channelId, prefixText = "", excludeUserIds = [] }) {
  const members = await getEligibleMembers(client, channelId);

  let pool = members.filter(m => !excludeUserIds.includes(m.id));

  if (!pool.length) pool = members;

  const winner = random(pool);

  return announcePick({
    client,
    channelId,
    userId: winner.id,
    prefixText
  });
}

module.exports = { runNewPick };
