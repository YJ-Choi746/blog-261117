// 글마다 "공유용 페이지"를 만들어요: p/<글ID>.html + p/<글ID>.jpg
// 카카오톡 · 페이스북 · 슬랙 같은 미리보기는 스크립트를 실행하지 않고 처음 HTML의 og 태그만 읽어요.
// 그래서 발행된 글마다 제목 · 요약 · 대표 이미지를 미리 적어 둔 작은 페이지를 만들고,
// 사람이 열면 진짜 글(post.html?id=...)로 바로 넘어가게 해요.
// 실행: GitHub Actions (.github/workflows/firebase-hosting.yml) — npm 패키지 없이 Node 20만 써요.
// 읽기: Firestore REST (발행된 글 · 이미지는 누구나 읽을 수 있는 공개 데이터라 키가 필요 없어요)
import { mkdir, writeFile } from "node:fs/promises";

const PROJECT = "blog---261117";
const SITE = "https://blog---261117.web.app/";
const API = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const OUT = "p";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const val = (f) => (f ? f.stringValue ?? f.timestampValue ?? f.integerValue ?? null : null);
const plain = (html) => String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

async function publishedPosts() {
  const res = await fetch(`${API}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "posts" }], where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } } } })
  });
  if (!res.ok) throw new Error(`글 목록을 못 읽었어요: ${res.status}`);
  return (await res.json()).filter((r) => r.document).map((r) => ({ id: r.document.name.split("/").pop(), f: r.document.fields || {} }));
}

async function coverJpeg(imageId) {
  if (!imageId || !/^[A-Za-z0-9_-]+$/.test(imageId)) return null;
  const res = await fetch(`${API}/images/${imageId}`);
  if (!res.ok) return null;
  const data = val(((await res.json()).fields || {}).data);
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(data || "");
  return m ? Buffer.from(m[1], "base64") : null;
}

function page({ id, title, desc, image }) {
  const target = `${SITE}post.html?id=${encodeURIComponent(id)}`;
  const url = `${SITE}${OUT}/${encodeURIComponent(id)}.html`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Jae</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Jae">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`}
<link rel="canonical" href="${esc(target)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body style="margin:0;padding:40px 24px;background:#FAFAFA;color:#111111;font-family:sans-serif">
<p><a href="${esc(target)}" style="color:#111111">${esc(title)} — 글 읽으러 가기</a></p>
</body>
</html>
`;
}

const posts = await publishedPosts();
await mkdir(OUT, { recursive: true });
for (const { id, f } of posts) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) continue;
  const title = val(f.title) || "기록";
  const desc = (val(f.summary) || plain(val(f.contentHtml)) || val(f.body) || "Jae의 기록").replace(/\s+/g, " ").trim().slice(0, 120);
  let image = null;
  const jpg = await coverJpeg(val(f.coverImageId));
  if (jpg) {
    await writeFile(`${OUT}/${id}.jpg`, jpg);
    image = `${SITE}${OUT}/${id}.jpg`;
  }
  await writeFile(`${OUT}/${id}.html`, page({ id, title, desc, image }));
  console.log(`만듦: ${OUT}/${id}.html${image ? " + 썸네일" : ""} — ${title}`);
}
console.log(`발행된 글 ${posts.length}개의 공유 페이지를 만들었어요.`);
