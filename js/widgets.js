// 글 본문 위젯 — 본문에 들어 있는 <div data-widget="..."> 자리에 움직이는 상자를 그려요.
// - sanitize.js가 허용한 위젯 이름(WIDGETS)만 자리로 남겨요. 여기서는 그 자리를 createElement / textContent로만 채워요 (innerHTML 안 씀).
// - daily-quote: 방문할 때마다 새 명언 (js/data/advices.js에서 무작위)
// - pokemon-match: 성격 유형을 누르면 PokéAPI(pokeapi.co)에서 어울리는 포켓몬을 불러와요
import { ADVICES } from "./data/advices.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const track = (name, params) => { if (typeof window.trackEvent === "function") window.trackEvent(name, params); };

// ---------- 오늘의 명언 ----------
let lastQuote = -1;
function pickQuote() {
  let i = Math.floor(Math.random() * ADVICES.length);
  if (ADVICES.length > 1 && i === lastQuote) i = (i + 1) % ADVICES.length; // 같은 명언이 연달아 나오지 않게
  lastQuote = i;
  return ADVICES[i];
}

function mountQuote(box) {
  const label = el("p", "widget-label", "당신을 위한 오늘의 명언");
  const msg = el("p", "quote-message");
  const who = el("p", "quote-author");
  const more = el("button", "btn btn-outline widget-btn", "다른 명언 보기");
  more.type = "button";
  const show = () => {
    const q = pickQuote();
    msg.textContent = `“${q.message}”`;
    who.textContent = q.authorProfile ? `— ${q.author} (${q.authorProfile})` : `— ${q.author}`;
  };
  more.addEventListener("click", () => { show(); track("refresh_quote", { widget_name: "daily_quote" }); });
  const quote = el("blockquote", "quote-body");
  quote.append(msg, who);
  box.replaceChildren(label, quote, more);
  box.setAttribute("aria-live", "polite");
  show();
}

// ---------- 성격별 포켓몬 ----------
// 성격마다 후보 3마리 (PokéAPI 도감 번호). 누를 때마다 후보 중에서 골라요.
const PERSONALITIES = [
  { id: "challenger", label: "열정적인 도전가형", desc: "목표가 생기면 일단 뛰어드는 당신! 남들이 망설일 때 먼저 불을 지피는 추진력이 가장 큰 매력이에요.", pool: [6, 257, 59] },
  { id: "mood_maker", label: "분위기 메이커형", desc: "어디서든 사람들에게 에너지를 나눠주는 당신! 당신이 있으면 분위기가 환해져요.", pool: [25, 417, 587] },
  { id: "healer", label: "느긋한 힐링형", desc: "서두르지 않아도 결국 해내는 당신! 웬만한 일에는 흔들리지 않는 든든함이 주변을 편안하게 해요.", pool: [143, 79, 39] },
  { id: "thinker", label: "차분한 사색가형", desc: "조용하지만 깊이 생각하고, 믿고 기대고 싶은 당신! 곁에 있는 사람을 묵묵히 이끌어줘요.", pool: [131, 134, 9] },
  { id: "strategist", label: "원칙 있는 전략가형", desc: "정직함과 원칙을 소중히 여기는 당신! 한번 믿음을 주면 끝까지 함께해요.", pool: [448, 65, 376] },
  { id: "explorer", label: "호기심 많은 적응형", desc: "새로운 것에 관심이 많고 어디서든 금방 적응하는 당신! 앞으로의 가능성이 무궁무진해요.", pool: [133, 151, 700] }
];
const API = "https://pokeapi.co/api/v2";
const cache = new Map();

async function getJson(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  cache.set(url, p);
  p.catch(() => cache.delete(url)); // 실패한 요청은 다시 시도할 수 있게
  return p;
}
const ko = (list, key) => (list || []).find((x) => x.language && x.language.name === "ko")?.[key] || "";

async function loadPokemon(num) {
  const p = await getJson(`${API}/pokemon/${num}`);
  const s = await getJson(p.species.url);
  const types = await Promise.all(p.types.map((t) => getJson(t.type.url).then((d) => ko(d.names, "name") || t.type.name)));
  const flavor = [...(s.flavor_text_entries || [])].reverse().find((f) => f.language.name === "ko");
  return {
    num,
    name: ko(s.names, "name") || p.name,
    genus: ko(s.genera, "genus"),
    types,
    flavor: flavor ? flavor.flavor_text.replace(/\s+/g, " ").trim() : "",
    image: p.sprites?.other?.["official-artwork"]?.front_default || p.sprites?.front_default || ""
  };
}

function mountPokemon(box) {
  const label = el("p", "widget-label", "나와 닮은 포켓몬 찾기");
  const hint = el("p", "widget-hint", "나와 가장 가까운 성격을 눌러보세요.");
  const chips = el("div", "chips widget-chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "성격 유형");
  const result = el("div", "poke-result");
  result.setAttribute("aria-live", "polite");
  result.hidden = true;

  let current = null; // 지금 고른 성격
  const lastPick = {}; // 성격별 마지막으로 보여준 포켓몬 (다시 누르면 다른 포켓몬)
  let reqId = 0;

  async function show(type) {
    const pool = type.pool.filter((n) => n !== lastPick[type.id]);
    const num = pool[Math.floor(Math.random() * pool.length)];
    lastPick[type.id] = num;
    const my = ++reqId;
    result.hidden = false;
    result.replaceChildren(el("p", "widget-hint", "포켓몬을 불러오는 중…"));
    try {
      const pk = await loadPokemon(num);
      if (my !== reqId) return; // 그 사이 다른 성격을 눌렀으면 버려요
      const img = el("img", "poke-img");
      img.src = pk.image; img.alt = pk.name; img.width = 240; img.height = 240; img.loading = "lazy";
      const info = el("div", "poke-info");
      const title = el("h3", "poke-name", `${type.label} → ${pk.name}`);
      const meta = el("p", "poke-meta", [pk.types.join(" · ") + " 타입", pk.genus].filter(Boolean).join(" | "));
      const desc = el("p", "poke-desc", type.desc);
      info.append(title, meta, desc);
      if (pk.flavor) info.appendChild(el("p", "poke-flavor", `도감 한 줄: ${pk.flavor}`));
      const again = el("button", "btn btn-outline widget-btn", "같은 성격의 다른 포켓몬");
      again.type = "button";
      again.addEventListener("click", () => { show(type); track("select_personality", { personality: type.id, pokemon_id: String(lastPick[type.id]), widget_name: "pokemon_match" }); });
      info.appendChild(again);
      result.replaceChildren(img, info);
    } catch {
      if (my !== reqId) return;
      const retry = el("button", "btn btn-outline widget-btn", "다시 시도");
      retry.type = "button";
      retry.addEventListener("click", () => show(type));
      result.replaceChildren(el("p", "widget-hint", "포켓몬을 불러오지 못했어요. 잠시 뒤 다시 눌러주세요."), retry);
    }
  }

  for (const type of PERSONALITIES) {
    const b = el("button", "chip", type.label);
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      current = type;
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      show(type);
      track("select_personality", { personality: type.id, pokemon_id: String(lastPick[type.id]), widget_name: "pokemon_match" });
    });
    chips.appendChild(b);
  }
  const credit = el("p", "widget-credit");
  const a = el("a", "", "PokéAPI");
  a.href = "https://pokeapi.co/"; a.target = "_blank"; a.rel = "noopener noreferrer nofollow";
  credit.append("포켓몬 정보 · 그림: ", a);
  box.replaceChildren(label, hint, chips, result, credit);
}

const MOUNT = { "daily-quote": mountQuote, "pokemon-match": mountPokemon };

// 본문(root) 안의 위젯 자리를 모두 그려요
export function mountWidgets(root) {
  root.querySelectorAll("div[data-widget]").forEach((box) => {
    const fn = MOUNT[box.getAttribute("data-widget")];
    if (!fn) return;
    box.classList.add("widget");
    fn(box);
  });
}
