const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";
const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

let spotifyTokenCache = {
  accessToken: null,
  expiresAt: 0
};

async function getSpotifyAccessToken() {
  const now = Date.now();

  if (spotifyTokenCache.accessToken && now < spotifyTokenCache.expiresAt) {
    return spotifyTokenCache.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log("Spotify env present:", {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret
  });

  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Spotify token request failed:", res.status, text);
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const data = await res.json();

  spotifyTokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000
  };

  console.log("Spotify token acquired");
  return spotifyTokenCache.accessToken;
}

async function searchSpotifyAlbum(artist, album) {
  console.log("Spotify search starting:", { artist, album });

  const token = await getSpotifyAccessToken();
  const q = `album:${album} artist:${artist}`;

  const url = new URL(SPOTIFY_SEARCH_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("type", "album");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Spotify search failed:", res.status, text);
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = await res.json();
  console.log("Spotify search result count:", data.albums?.items?.length || 0);

  const item = data.albums?.items?.[0];
  if (!item) {
    console.log("Spotify search found no match");
    return null;
  }

  return {
    id: item.id || null,
    url: item.external_urls?.spotify || null,
    imageUrl: item.images?.[0]?.url || null,
    album: item.name || album,
    artist: item.artists?.map((a) => a.name).join(", ") || artist
  };
}

async function searchAppleAlbum(artist, album) {
  const url = new URL(ITUNES_SEARCH_URL);
  url.searchParams.set("term", `${artist} ${album}`);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "album");
  url.searchParams.set("limit", "1");

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Apple search failed: ${res.status}`);
  }

  const data = await res.json();
  const item = data.results?.[0];

  if (!item) {
    return null;
  }

  const imageUrl =
    item.artworkUrl100?.replace("100x100bb", "600x600bb") ||
    item.artworkUrl100 ||
    null;

  return {
    url: item.collectionViewUrl || null,
    imageUrl,
    album: item.collectionName || album,
    artist: item.artistName || artist
  };
}

function buildAlbumOfTheYearSearchUrl(artist, album) {
  return `https://www.albumoftheyear.org/search/?q=${encodeURIComponent(
    `${artist} ${album}`
  )}`;
}

async function enrichAlbum(artist, album) {
  const [spotify, apple] = await Promise.allSettled([
    searchSpotifyAlbum(artist, album),
    searchAppleAlbum(artist, album)
  ]);

  if (spotify.status === "rejected") {
    console.error("Spotify enrichment failed:", spotify.reason);
  }

  if (apple.status === "rejected") {
    console.error("Apple enrichment failed:", apple.reason);
  }

  const spotifyValue = spotify.status === "fulfilled" ? spotify.value : null;
  const appleValue = apple.status === "fulfilled" ? apple.value : null;

  const finalArtist = spotifyValue?.artist || appleValue?.artist || artist;
  const finalAlbum = spotifyValue?.album || appleValue?.album || album;

  return {
    spotify: spotifyValue,
    apple: appleValue,
    albumOfTheYearUrl: buildAlbumOfTheYearSearchUrl(finalArtist, finalAlbum),
    artist: finalArtist,
    album: finalAlbum,
    imageUrl: spotifyValue?.imageUrl || appleValue?.imageUrl || null
  };
}

module.exports = {
  enrichAlbum
};
