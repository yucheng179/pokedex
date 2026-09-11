import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, "data");
const CACHE_DIR = join(ROOT, ".cache", "52poke", "moves");
const API = "https://wiki.52poke.com/api.php";
const SOURCE = "52Poké Wiki";
const FALLBACK = "資料庫目前未有此招式資料。";
const REFRESH = process.argv.includes("--refresh");
const CONCURRENCY = 3;

const TYPE_SLUGS = {
  一般: "normal", 格斗: "fighting", 飛行: "flying", 毒: "poison", 地面: "ground", 岩石: "rock",
  虫: "bug", 幽灵: "ghost", 钢: "steel", 火: "fire", 水: "water", 草: "grass", 电: "electric",
  超能力: "psychic", 冰: "ice", 龙: "dragon", 恶: "dark", 妖精: "fairy"
};

const GMAX_USERS = {
  "g-max-wildfire": ["charizard"], "g-max-befuddle": ["butterfree"], "g-max-volt-crash": ["pikachu"],
  "g-max-gold-rush": ["meowth"], "g-max-chi-strike": ["machamp"], "g-max-terror": ["gengar"],
  "g-max-resonance": ["lapras"], "g-max-cuddle": ["eevee"], "g-max-replenish": ["snorlax"],
  "g-max-malodor": ["garbodor"], "g-max-stonesurge": ["drednaw"], "g-max-wind-rage": ["corviknight"],
  "g-max-stun-shock": ["toxtricity-amped"], "g-max-finale": ["alcremie"], "g-max-depletion": ["duraludon"],
  "g-max-gravitas": ["orbeetle"], "g-max-volcalith": ["coalossal"], "g-max-sandblast": ["sandaconda"],
  "g-max-snooze": ["grimmsnarl"], "g-max-tartness": ["flapple"], "g-max-sweetness": ["appletun"],
  "g-max-smite": ["hatterene"], "g-max-steelsurge": ["copperajah"], "g-max-meltdown": ["melmetal"],
  "g-max-foam-burst": ["kingler"], "g-max-centiferno": ["centiskorch"], "g-max-drum-solo": ["rillaboom"],
  "g-max-fireball": ["cinderace"], "g-max-hydrosnipe": ["inteleon"], "g-max-vine-lash": ["venusaur"],
  "g-max-cannonade": ["blastoise"], "g-max-one-blow": ["urshifu-single-strike"], "g-max-rapid-flow": ["urshifu-rapid-strike"]
};

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await rename(temp, path);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
    await rm(path, { force: true });
    await rename(temp, path);
  }
}

function safeCacheName(value) {
  return value.normalize("NFKC").replaceAll(/[^\p{L}\p{N}.-]+/gu, "-").slice(0, 100);
}

async function wiki(params, cacheName, attempt = 1) {
  const cacheFile = join(CACHE_DIR, `${safeCacheName(cacheName)}.json`);
  if (!REFRESH) {
    try { return JSON.parse(await readFile(cacheFile, "utf8")); } catch { /* cache miss */ }
  }
  const url = new URL(API);
  Object.entries({ ...params, format: "json", formatversion: "2", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { "user-agent": "local-pokedex-data-sync/1.0" } });
  if (response.status === 429 && attempt < 7) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 30000);
    await new Promise(resolve => setTimeout(resolve, delay));
    return wiki(params, cacheName, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  await writeJson(cacheFile, data);
  return data;
}

async function mapLimit(items, worker, label) {
  const output = new Array(items.length);
  let cursor = 0;
  let finished = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try { output[index] = await worker(items[index], index); }
      catch (error) { output[index] = { error: error.message, item: items[index] }; }
      finished++;
      if (finished % 10 === 0 || finished === items.length) process.stdout.write(`\r${label}: ${finished}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  process.stdout.write("\n");
  return output;
}

function decodeHtml(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (_, entity) => {
    if (entity[0] === "#") return String.fromCodePoint(Number.parseInt(entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1), entity[1]?.toLowerCase() === "x" ? 16 : 10));
    return named[entity] ?? `&${entity};`;
  });
}

function htmlToText(html) {
  return decodeHtml(html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|table)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/(?:p|li|ul|ol|div)>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .split("\n").map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line && line !== "編輯" && line !== "編輯原始碼")
    .join(" ").replace(/\[?編輯(?:原始碼)?\]?/g, "").replace(/\s+/g, " ").trim();
}

function effectFromHtml(html = "") {
  const marker = html.indexOf('id="招式附加效果"');
  if (marker < 0) return null;
  const headingEnd = html.indexOf("</h2>", marker);
  const nextHeading = html.indexOf("<h2", headingEnd + 5);
  const text = htmlToText(html.slice(headingEnd + 5, nextHeading < 0 ? html.length : nextHeading));
  return text || null;
}

function infoboxNumber(html, label) {
  const marker = html.indexOf(`title="${label}"`);
  if (marker < 0) return null;
  const cellStart = html.indexOf("<td", marker);
  const cellEnd = html.indexOf("</td>", cellStart);
  const match = htmlToText(html.slice(cellStart, cellEnd)).match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function queryPage(title, cacheName) {
  const query = await wiki({
    action: "query", titles: title, redirects: "1", converttitles: "1", variant: "zh-hant", prop: "revisions", rvprop: "ids"
  }, cacheName);
  return query.query?.pages?.find(item => !item.missing) || null;
}

async function resolveMovePage(name, cacheKey, searchName = name) {
  let page = await queryPage(`${name}（招式）`, `${cacheKey}-resolve-move`);
  if (!page) page = await queryPage(name, `${cacheKey}-resolve`);
  if (!page && searchName) {
    const searched = await wiki({ action: "query", list: "search", srsearch: searchName, srlimit: "8" }, `${cacheKey}-search`);
    const result = searched.query?.search?.find(item => !/列表|狀態|状态|卡牌|動畫|漫画|漫畫/.test(item.title));
    if (result) page = await queryPage(result.title, `${cacheKey}-resolve-search`);
  }
  if (!page) return null;
  const parsed = await wiki({ action: "parse", page: page.title, prop: "text", variant: "zh-hant" }, `${cacheKey}-page-${page.pageid}`);
  const html = parsed.parse?.text || "";
  const description = effectFromHtml(html);
  if (!description) return null;
  return {
    title: parsed.parse.title,
    description,
    power: infoboxNumber(html, "威力"),
    accuracy: infoboxNumber(html, "命中"),
    pp: infoboxNumber(html, "ＰＰ"),
    revisionId: parsed.parse.revid || page.revisions?.[0]?.revid || null,
    sourceUrl: `https://wiki.52poke.com/zh-hant/${encodeURIComponent(parsed.parse.title)}`
  };
}

function slugifyEnglish(name) {
  return name.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function numberOrNull(value) {
  return /^\d+$/.test(value.trim()) ? Number(value) : null;
}

function parseGmaxRows(wikitext) {
  const rows = [];
  const pattern = /\{\{Movelist\/gen\/ex\|(?:\?{3}|—)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|超极巨\|([^|]+)\|([^|]+)\|([^|}]+)(?:\|[^}]*)?\}\}/g;
  for (const match of wikitext.matchAll(pattern)) {
    rows.push({ zhHans: match[1].replace(/[‎\s]+$/g, ""), ja: match[2], en: match[3], type: TYPE_SLUGS[match[4]], power: numberOrNull(match[5]), accuracy: numberOrNull(match[6]), pp: numberOrNull(match[7]) });
  }
  return rows;
}

function parseShadowRows(wikitext) {
  const rows = [];
  const pattern = /\{\{Movelist\/gen\|\d+\|([^|]+)\|([^|]+)\|([^|]+)\|暗影\|([^|]+)\|([^|]+)\|([^|]+)\|[^}]+\}\}/g;
  for (const match of wikitext.matchAll(pattern)) {
    rows.push({ zhHans: match[1], ja: match[2], en: match[3], damageClass: match[4], power: numberOrNull(match[5]), accuracy: numberOrNull(match[6].replace("%", "")) });
  }
  return rows;
}

async function traditionalTitles(names) {
  const characters = { 冲: "衝", 锋: "鋒", 击: "擊", 终: "終", 结: "結", 锐: "銳", 风: "風", 电: "電", 闪: "閃", 冻: "凍", 紧: "緊", 雾: "霧", 气: "氣" };
  return new Map(names.map(name => [name, [...name].map(character => characters[character] || character).join("")]));
}

async function main() {
  const moves = await readJson(join(DATA_DIR, "moves.json"), []);
  const previous = await readJson(join(DATA_DIR, "move-description-overrides.json"), { overrides: {} });
  const candidates = moves.filter(move => move.id !== null && move.description === FALLBACK);
  console.log(`補充缺失招式描述（候選 ${candidates.length}）…`);
  const resolved = await mapLimit(candidates, move => resolveMovePage(move.name.zhHant, move.slug, move.name.en), "描述");
  const overrides = { ...(previous.overrides || {}) };
  candidates.forEach((move, index) => {
    const result = resolved[index];
    if (!result || result.error) return;
    overrides[move.slug] = { description: result.description, source: SOURCE, sourceUrl: result.sourceUrl, revisionId: result.revisionId };
  });
  Object.values(overrides).forEach(entry => {
    if (entry.description) entry.description = entry.description.replace(/\[?編輯(?:原始碼)?\]?/g, "").replace(/\s+/g, " ").trim();
  });

  console.log("補充黑暗招式名稱…");
  const shadowList = await wiki({ action: "parse", page: "招式列表（黑暗招式）", prop: "wikitext" }, "shadow-move-list");
  const shadowRows = parseShadowRows(shadowList.parse?.wikitext || "");
  const shadowNames = await traditionalTitles([...new Set(shadowRows.map(row => row.zhHans))]);
  shadowRows.forEach(row => {
    const slug = slugifyEnglish(row.en);
    overrides[slug] = { ...(overrides[slug] || {}), nameZhHant: shadowNames.get(row.zhHans), nameJa: row.ja };
  });

  console.log("取得超極巨招式清單…");
  const swordShield = await wiki({ action: "parse", page: "招式列表（剑／盾）", prop: "wikitext" }, "sword-shield-move-list");
  const gmaxRows = parseGmaxRows(swordShield.parse?.wikitext || "");
  const gmaxPages = await mapLimit(gmaxRows, row => resolveMovePage(row.zhHans, slugifyEnglish(row.en)), "超極巨招式");
  const supplementalMoves = gmaxRows.map((row, index) => {
    const slug = slugifyEnglish(row.en);
    const page = gmaxPages[index];
    return {
      id: null, slug, name: { zhHant: page?.title || row.zhHans, en: row.en, ja: row.ja }, kind: "gmax",
      type: row.type || "normal", damageClass: null, power: page?.power ?? row.power, accuracy: page?.accuracy ?? row.accuracy, pp: page?.pp ?? row.pp,
      priority: 0, effectChance: null, generation: 8, target: "selected-pokemon",
      description: page?.description || FALLBACK,
      descriptionSource: page && !page.error ? { name: SOURCE, url: page.sourceUrl, revisionId: page.revisionId } : null,
      statChanges: [], meta: null, learnedByPokemon: GMAX_USERS[slug] || []
    };
  });

  const now = new Date().toISOString();
  await Promise.all([
    writeJson(join(DATA_DIR, "move-description-overrides.json"), {
      generatedAt: now, source: SOURCE, sourceUrl: "https://wiki.52poke.com/zh-hant/招式列表", overrides
    }),
    writeJson(join(DATA_DIR, "move-supplements.json"), {
      generatedAt: now, source: SOURCE, sourceUrl: "https://wiki.52poke.com/zh-hant/招式列表（劍／盾）", moves: supplementalMoves
    })
  ]);
  console.log(`完成：${Object.keys(overrides).length} 筆描述覆寫、${supplementalMoves.length} 個超極巨招式。`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
