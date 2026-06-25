// Configuration — adapte ces deux URLs à ton environnement
const PB_URL  = "http://188.115.125.74:8090";
const APP_URL = "http://192.168.1.223:3000";

const CRAWLER_RE = /discord|twitter|facebook|telegram|whatsapp|slack|linkedin|preview|bot|crawler|spider|curl|wget/i;

routerAdd("GET", "/api/share/song/:id", (c) => {
  const id = c.pathParam("id");

  let song;
  try {
    song = $app.dao().findRecordById("songs", id);
  } catch (_) {
    c.response().writeHeader(404);
    c.response().write("Song not found");
    return null;
  }

  const title     = song.getString("title");
  const author    = song.getString("author");
  const coverFile = song.getString("cover") || song.getString("cover_url");
  const coverUrl  = coverFile
    ? (coverFile.startsWith("http") ? coverFile : `${PB_URL}/api/files/${song.get("collectionId")}/${id}/${coverFile}`)
    : "";

  const songAppUrl = `${APP_URL}/song/${id}`;
  const ua = c.request().header.get("User-Agent") || "";

  if (!CRAWLER_RE.test(ua)) {
    return c.redirect(302, songAppUrl);
  }

  const safeTitle  = title.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const safeAuthor = author.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const desc       = `Écouter sur Nexora-Music`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta property="og:type"        content="music.song">
  <meta property="og:title"       content="${safeTitle} — ${safeAuthor}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image"       content="${coverUrl}">
  <meta property="og:url"         content="${songAppUrl}">
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${safeTitle} — ${safeAuthor}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image"       content="${coverUrl}">
  <title>${safeTitle} — ${safeAuthor} | Nexora-Music</title>
  <script>window.location.href = "${songAppUrl}";</script>
</head>
<body></body>
</html>`;

  c.response().header().set("Content-Type", "text/html; charset=utf-8");
  c.response().writeHeader(200);
  c.response().write(html);
  return null;
});
