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

function buildFinalNominationBlocks({
  pickerUserId,
  artist,
  album,
  imageUrl,
  spotifyUrl,
  appleUrl,
  albumOfTheYearUrl
}) {
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

  if (albumOfTheYearUrl) {
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Album of the Year"
      },
      url: albumOfTheYearUrl
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
  console.log("accept_pick clicked", {
    user: body.user?.id,
    ts: body.message?.ts,
    channel: body.channel?.id
  });

  await ack();

  try {
    const round = await db.getPendingRoundByMessageTs(body.message.ts);
    console.log("accept_pick round lookup result:", round);

    if (!round) {
      console.log("accept_pick: no pending round found");
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: "This round could not be found. Please try again."
      });
      return;
    }

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

    console.log("accept_pick: modal opened for round", round.id);
  } catch (err) {
    console.error("accept_pick failed:", err);

    try {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: "Sorry, I couldn't open the nomination form. Please try again."
      });
    } catch (postErr) {
      console.error("accept_pick ephemeral failed:", postErr);
    }
  }
});

app.view("submit_nomination", async ({ ack, body, view, client }) => {
  console.log("submit_nomination received");

  try {
    const metadata = JSON.parse(view.private_metadata || "{}");
    const roundId = metadata.roundId;

    const artist =
      view.state.values.artist_block.artist_input.value.trim();
    const album =
      view.state.values.album_block.album_input.value.trim();

    console.log("submit_nomination values:", {
      roundId,
      user: body.user?.id,
      artist,
      album
    });

    const round = await db.getRoundById(roundId);
    console.log("submit_nomination round lookup:", round);

    if (!round) {
      await ack({
        response_action: "errors",
        errors: {
          album_block: "This round could not be found. Please close this window and try again."
        }
      });
      return;
    }

    if (body.user.id !== round.selected_user_id) {
      await ack({
        response_action: "errors",
        errors: {
          album_block: "Only the selected person can submit this nomination."
        }
      });
      return;
    }

    const enriched = await enrichAlbum(artist, album);
    console.log("submit_nomination enriched result:", enriched);

    const existingNomination = await db.findExistingNomination(
      enriched.artist,
      enriched.album
    );

    if (existingNomination) {
      console.log("submit_nomination: duplicate nomination blocked", existingNomination);

      await ack({
        response_action: "errors",
        errors: {
          album_block: `That album has already been nominated before: ${enriched.album} — ${enriched.artist}. Please choose a different album.`
        }
      });
      return;
    }

    await ack();
    console.log("submit_nomination acked");

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

    console.log("submit_nomination: nomination saved");

    await db.updateRoundStatus(round.id, "submitted");
    console.log("submit_nomination: round marked submitted");

    const blocks = buildFinalNominationBlocks({
      pickerUserId: body.user.id,
      artist: enriched.artist,
      album: enriched.album,
      imageUrl: enriched.imageUrl,
      spotifyUrl: enriched.spotify?.url || null,
      appleUrl: enriched.apple?.url || null,
      albumOfTheYearUrl: enriched.albumOfTheYearUrl || null
    });

    await client.chat.postMessage({
      channel: round.channel_id,
      text: `${enriched.album} — ${enriched.artist}`,
      blocks
    });

    console.log("submit_nomination: posted to main channel");

    if (process.env.SLACK_LOG_CHANNEL_ID) {
      await client.chat.postMessage({
        channel: process.env.SLACK_LOG_CHANNEL_ID,
        text: `${enriched.album} — ${enriched.artist}`,
        blocks
      });

      console.log("submit_nomination: posted to log channel");
    }
  } catch (err) {
    console.error("submit_nomination failed:", err);

    try {
      await ack({
        response_action: "errors",
        errors: {
          album_block: "Something went wrong while processing your nomination. Please try again."
        }
      });
    } catch (ackErr) {
      console.error("submit_nomination ack error:", ackErr);
    }
  }
});

app.action("skip_me", async ({ ack, body, client }) => {
  console.log("skip_me clicked", {
    user: body.user?.id,
    ts: body.message?.ts,
    channel: body.channel?.id
  });

  await ack();

  setTimeout(async () => {
    try {
      const round = await db.getPendingRoundByMessageTs(body.message.ts);
      console.log("skip_me round lookup result:", round);

      if (!round) {
        console.log("skip_me: no pending round found");
        return;
      }

      if (body.user.id !== round.selected_user_id) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: body.user.id,
          text: "Only the selected person can skip."
        });
        return;
      }

      await db.updateRoundStatus(round.id, "skipped");
      console.log("skip_me: round skipped", round.id);

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

      console.log("skip_me: reroll triggered");
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
