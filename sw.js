// KATAkaNA BUILDER のサービスワーカー。ホーム画面に追加したアプリを、電波がないところでも開けるようにする。
// - 画面（HTML/CSS/JS）と単語データはネットワークを優先する（更新がすぐ届くように）。つながらないときだけ保存しておいたものを使う
// - フォントは変わらないので、保存したものを優先する
// - 音声（/audio/）は容量が大きいので保存しない（オフラインのときはブラウザの読み上げになる）
// 保存するファイルの一覧を変えたら CACHE の番号を上げる
const CACHE = "kb-v1";
const SHELL = [
  "./",
  "index.html",
  "app/app.js",
  "app/style.css",
  "data/words.json",
  "data/roots.json",
  "data/pairs.json",
  "manifest.webmanifest",
  "icons/icon-192.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin || url.pathname.startsWith("/audio/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))),
  );
});
