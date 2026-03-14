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
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const data = await res.json();

  spotifyTokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000
  };

  return spotifyTokenCache.accessToken;
}

async function searchSpotifyAlbum(artist, album) {
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
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = await res.json();
  const item = data.albums?.items?.[0];
  if (!item) return null;

  return {
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
  if (!item) return null;

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

async function enrichAlbum(artist, album) {
  const [spotify, apple] = await Promise.allSettled([
    searchSpotifyAlbum(artist, album),
    searchAppleAlbum(artist, album)
  ]);

  const spotifyValue = spotify.status === "fulfilled" ? spotify.value : null;
  const appleValue = apple.status === "fulfilled" ? apple.value : null;

  return {
    spotify: spotifyValue,
    apple: appleValue,
    artist: spotifyValue?.artist || appleValue?.artist || artist,
    album: spotifyValue?.album || appleValue?.album || album,
    imageUrl: spotifyValue?.imageUrl || appleValue?.imageUrl || null
  };
}

module.exports = {
  enrichAlbum
};
