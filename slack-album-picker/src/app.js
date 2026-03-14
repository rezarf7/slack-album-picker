require("dotenv").config();
const { app } = require("./slack");
const db = require("./db");
const { runNewPick } = require("./picker");
const { enrichAlbum } = require("./music");

function nominationModal(roundId) {
  return {
    type: "modal",
    callback_id: "submit_nomination",
    private_metadata: JSON.stringify({ roundId }),
    title: {
      type: "plain_text",
      text: "Submit nomination"
    },
    submit: {
      type: "plain_text",
      text: "Submit"
    },
    close: {
      type: "plain_text",
      text: "Cancel"
    },
    blocks: [
      {
        type: "input",
        block_id: "artist_block",
        label: {
          type: "plain_text",
          text: "Artist"
        },
        element: {
          type: "plain_text_input",
          action_id: "artist_input"
        }
      },
      {
        type: "input",
        block_id: "album_block",
        label: {
          type: "plain_text",
          text: "Album"
        },
        element: {
          type: "plain_text_input",
          action_id: "album_input"
        }
      }
    ]
  };
}

function buildFinalNominationBlocks({ pickerUserId, artist, album, imageUrl, spotifyUrl, appleUrl }) {
  const actions = [];

  if (spotifyUrl) {
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Open in Spotify"
      },
      url: spotifyUrl
    });
  }

  if (appleUrl) {
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Open in Apple Music"
      },
      url: appleUrl
    });
  }

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎶 <@${pickerUserId}>'s nomination:\n*${album}* — ${artist}`
      },
      ...(imageUrl
        ? {
            accessory: {
              type: "image",
              image_url: imageUrl,
              alt_text: `${album} cover art`
            }
          }
        : {})
    }
  ];

  if (actions.length) {
    blocks.push({
      type: "actions",
      elements: actions
    });
  }

  return blocks;
}

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

      await client.views.open({
        trigger_id: body.trigger_id,
        view: nominationModal(round.id)
      });
    } catch (err) {
      console.error("accept_pick failed:", err);
    }
  }, 0);
});

app.view("submit_nomination", async ({ ack, body, view, client }) => {
  await ack();

  setTimeout(async () => {
    try {
      const metadata = JSON.parse(view.private_metadata || "{}");
      const roundId = metadata.roundId;

      const artist =
        view.state.values.artist_block.artist_input.value.trim();
      const album =
        view.state.values.album_block.album_input.value.trim();

      const round = await db.getRoundById(roundId);
      if (!round) return;
      if (body.user.id !== round.selected_user_id) return;

      const enriched = await enrichAlbum(artist, album);

      await db.createNomination({
        roundId,
        pickerUserId: body.user.id,
        artist: enriched.artist,
        album: enriched.album,
        spotifyUrl: enriched.spotify?.url || null,
        spotifyImageUrl: enriched.spotify?.imageUrl || null,
        appleUrl: enriched.apple?.url || null,
        appleImageUrl: enriched.apple?.imageUrl || null
      });

      await db.updateRoundStatus(round.id, "submitted");

      const blocks = buildFinalNominationBlocks({
        pickerUserId: body.user.id,
        artist: enriched.artist,
        album: enriched.album,
        imageUrl: enriched.imageUrl,
        spotifyUrl: enriched.spotify?.url || null,
        appleUrl: enriched.apple?.url || null
      });

      await client.chat.postMessage({
        channel: round.channel_id,
        text: `${enriched.album} — ${enriched.artist}`,
        blocks
      });

      if (process.env.SLACK_LOG_CHANNEL_ID) {
        await client.chat.postMessage({
          channel: process.env.SLACK_LOG_CHANNEL_ID,
          text: `${enriched.album} — ${enriched.artist}`,
          blocks
        });
      }
    } catch (err) {
      console.error("submit_nomination failed:", err);
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
