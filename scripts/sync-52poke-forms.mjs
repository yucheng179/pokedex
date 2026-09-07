import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = join(ROOT, ".cache", "52poke");
const API = "https://wiki.52poke.com/api.php";
const PAGES = [
  { key: "form-variations", title: "拥有形态变化的宝可梦列表" },
  { key: "national-forms", title: "宝可梦列表（按全国图鉴编号）/形态变化" }
];
const USER_AGENT = process.env.POKEDEX_USER_AGENT || "LocalPokedexSync/1.0 (non-commercial Pokédex data sync)";
const REFRESH = process.argv.includes("--refresh");
const TRADITIONAL_HTML_CACHE = join(CACHE_DIR, "national-forms-zh-hant.json");
const OUTPUT_FILE = join(ROOT, "data", "form-name-overrides.json");
const GENERIC_FORM_WORDS = new Set(["form", "forme", "mode", "build", "pattern", "style", "cloak", "trim", "size", "core", "flower", "drive", "plumage", "type", "the", "of"]);
const MANUAL_FORM_NAMES = {
  "pikachu-alola-cap": "阿羅拉帽子", "pikachu-belle": "貴婦皮卡丘", "pikachu-cosplay": "換裝皮卡丘",
  "pikachu-hoenn-cap": "豐緣帽子", "pikachu-kalos-cap": "卡洛斯帽子", "pikachu-libre": "蒙面皮卡丘",
  "pikachu-original-cap": "初始帽子", "pikachu-partner-cap": "就決定是你了之帽子", "pikachu-phd": "博士皮卡丘",
  "pikachu-pop-star": "偶像皮卡丘", "pikachu-rock-star": "硬搖滾皮卡丘", "pikachu-sinnoh-cap": "神奧帽子",
  "pikachu-starter": "搭檔皮卡丘", "pikachu-unova-cap": "合眾帽子", "pikachu-world-cap": "世界帽子",
  "eevee-starter": "搭檔伊布",
  "pichu-spiky-eared": "刺刺耳皮丘",
  "arceus-bug": "蟲屬性的樣子", "arceus-dark": "惡屬性的樣子", "arceus-dragon": "龍屬性的樣子",
  "arceus-electric": "電屬性的樣子", "arceus-fairy": "妖精屬性的樣子", "arceus-fighting": "格鬥屬性的樣子",
  "arceus-fire": "火屬性的樣子", "arceus-flying": "飛行屬性的樣子", "arceus-ghost": "幽靈屬性的樣子",
  "arceus-grass": "草屬性的樣子", "arceus-ground": "地面屬性的樣子", "arceus-poison": "毒屬性的樣子",
  "arceus-psychic": "超能力屬性的樣子", "arceus-rock": "岩石屬性的樣子", "arceus-steel": "鋼屬性的樣子",
  "arceus-unknown": "未知屬性的樣子", "arceus-water": "水屬性的樣子",
  "darmanitan-zen": "達摩模式",
  "genesect-burn": "火焰卡帶", "genesect-chill": "冰凍卡帶", "genesect-douse": "水流卡帶", "genesect-shock": "閃電卡帶",
  "greninja-battle-bond": "牽絆變身", "vivillon-icy-snow": "冰雪花紋",
  "pumpkaboo-super": "巨顆種", "gourgeist-super": "巨顆種",
  "zygarde-10": "１０％形態", "zygarde-10-power-construct": "１０％形態・群聚變形",
  "gumshoos-totem": "霸主寶可夢", "vikavolt-totem": "霸主寶可夢", "ribombee-totem": "霸主寶可夢",
  "araquanid-totem": "霸主寶可夢", "lurantis-totem": "霸主寶可夢", "salazzle-totem": "霸主寶可夢",
  "togedemaru-totem": "霸主寶可夢", "kommo-o-totem": "霸主寶可夢",
  "mimikyu-totem-disguised": "霸主寶可夢・化形的樣子", "mimikyu-totem-busted": "霸主寶可夢・現形的樣子",
  "oricorio-pau": "呼拉呼拉風格", "rockruff-own-tempo": "特殊岩狗狗（我行我素）"
};
const ALCREMIE_SWEETS = {
  "strawberry-sweet": "草莓糖飾", "berry-sweet": "莓果糖飾", "love-sweet": "愛心糖飾",
  "star-sweet": "星星糖飾", "clover-sweet": "四葉草糖飾", "flower-sweet": "花朵糖飾", "ribbon-sweet": "蝴蝶結糖飾"
};
const ALCREMIE_CREAMS = {
  "vanilla-cream": "奶香香草", "ruby-cream": "奶香紅鑽", "matcha-cream": "奶香抹茶",
  "mint-cream": "奶香薄荷", "lemon-cream": "奶香檸檬", "salted-cream": "奶香雪鹽",
  "ruby-swirl": "紅鑽綜合", "caramel-swirl": "焦糖綜合", "rainbow-swirl": "三色综合"
};

async function writeJsonAtomic(path, value) {
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

async function readCache(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function fetchLatestSource(title, cacheFile) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query", prop: "revisions", rvprop: "ids|timestamp|content", rvslots: "main",
    titles: title, format: "json", formatversion: "2"
  });
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`52Poké 回應 ${response.status} ${response.statusText}`);
  const payload = await response.json();
  const page = payload.query?.pages?.[0];
  const revision = page?.revisions?.[0];
  const content = revision?.slots?.main?.content;
  if (!page || page.missing || !revision || !content) throw new Error("無法取得 52Poké 頁面原始碼");
  const cached = {
    source: "52Poké Wiki", sourceUrl: `https://wiki.52poke.com/zh-hant/${encodeURIComponent(title)}`,
    apiUrl: url.toString(), pageId: page.pageid, title: page.title,
    revisionId: revision.revid, revisionTimestamp: revision.timestamp,
    fetchedAt: new Date().toISOString(), userAgent: USER_AGENT, content
  };
  await writeJsonAtomic(cacheFile, cached);
  return cached;
}

async function fetchTraditionalHtml(title) {
  const url = `https://wiki.52poke.com/zh-hant/${encodeURIComponent(title)}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (!response.ok) throw new Error(`52Poké 繁體頁面回應 ${response.status} ${response.statusText}`);
  const cached = { source: "52Poké Wiki", sourceUrl: url, fetchedAt: new Date().toISOString(), userAgent: USER_AGENT, content: await response.text() };
  await writeJsonAtomic(TRADITIONAL_HTML_CACHE, cached);
  return cached;
}

function decodeHtml(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function parseTraditionalRows(html) {
  const rows = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => decodeHtml(match[1]));
    if (cells.length < 7 || !/^#\d+$/.test(cells[0]) || !/^\d+$/.test(cells[1])) continue;
    rows.push({ speciesId: Number(cells[0].slice(1)), formNumber: Number(cells[1]), speciesName: cells[3], formName: cells[4], japaneseName: cells[5], englishName: cells[6] });
  }
  return rows;
}

function keyParts(text) {
  return String(text || "").normalize("NFKC").toLowerCase().replace(/poké/g, "poke").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").filter(Boolean);
}

function comparableKey(text, speciesEnglish = "") {
  const speciesParts = new Set(keyParts(speciesEnglish));
  return keyParts(text).filter(part => !GENERIC_FORM_WORDS.has(part) && !speciesParts.has(part)).join("-");
}

function alcremieName(apiName) {
  for (const [cream, creamName] of Object.entries(ALCREMIE_CREAMS)) {
    if (!apiName.startsWith(`${cream}-`)) continue;
    const sweet = ALCREMIE_SWEETS[apiName.slice(cream.length + 1)];
    if (sweet) return `${creamName}・${sweet}`;
  }
  return null;
}

function makeDisplayName(speciesName, formName) {
  return formName.includes(speciesName) || formName.startsWith("超級") ? formName : `${speciesName}（${formName}）`;
}

async function buildOverrides(traditionalHtml, sources) {
  const pokemon = JSON.parse(await readFile(join(ROOT, "data", "pokemon.json"), "utf8"));
  const rows = parseTraditionalRows(traditionalHtml);
  const rowsBySpecies = Map.groupBy(rows, row => row.speciesId);
  const defaultBySpecies = new Map(pokemon.filter(mon => mon.form.isDefault).map(mon => [mon.speciesId, mon]));
  const overrides = {};
  const unresolved = [];

  for (const mon of pokemon.filter(mon => /#\d+/.test(mon.form.name || "") || mon.form.nameSource?.source === "52Poké Wiki")) {
    const speciesName = defaultBySpecies.get(mon.speciesId)?.name.zhHant || mon.name.zhHant.split("（")[0];
    const speciesEnglish = defaultBySpecies.get(mon.speciesId)?.name.en || "";
    let formName = MANUAL_FORM_NAMES[mon.slug] || null;
    let matchMethod = formName ? "curated-from-52poke" : null;

    if (!formName && mon.speciesId === 201) {
      formName = mon.form.apiName === "exclamation" ? "!" : mon.form.apiName === "question" ? "?" : mon.form.apiName.toUpperCase();
      matchMethod = "52poke-form-symbol";
    }
    if (!formName && mon.speciesId === 869) {
      formName = alcremieName(mon.form.apiName);
      if (formName) matchMethod = "52poke-cream-plus-decoration";
    }

    if (!formName) {
      const apiKey = comparableKey(mon.form.apiName, speciesEnglish);
      const candidates = (rowsBySpecies.get(mon.speciesId) || []).filter(row => row.formName && row.formNumber !== 0);
      let matches = candidates.filter(row => comparableKey(row.englishName, speciesEnglish) === apiKey);
      if (matches.length !== 1) matches = candidates.filter(row => {
        const rowKey = comparableKey(row.englishName, speciesEnglish);
        return rowKey && apiKey && (rowKey.startsWith(`${apiKey}-`) || apiKey.startsWith(`${rowKey}-`));
      });
      if (matches.length === 1) {
        formName = matches[0].formName;
        matchMethod = "52poke-english-form-match";
      }
    }

    if (!formName && [664, 665].includes(mon.speciesId)) {
      const vivillon = (rowsBySpecies.get(666) || []).find(row => comparableKey(row.englishName) === comparableKey(mon.form.apiName));
      if (vivillon) {
        formName = vivillon.formName;
        matchMethod = "52poke-vivillon-pattern";
      }
    }

    if (!formName) {
      unresolved.push({ slug: mon.slug, speciesId: mon.speciesId, apiName: mon.form.apiName });
      continue;
    }
    overrides[mon.slug] = {
      formName, displayName: makeDisplayName(speciesName, formName), matchMethod,
      source: "52Poké Wiki", sourceUrl: sources[1].sourceUrl, revisionId: sources[1].revisionId
    };
  }

  const output = {
    generatedAt: new Date().toISOString(),
    license: { name: "CC BY-NC-SA 3.0", attributionRequired: true, commercialUse: false, shareAlike: true, url: "https://creativecommons.org/licenses/by-nc-sa/3.0/" },
    sources: sources.map(source => ({ title: source.title, sourceUrl: source.sourceUrl, revisionId: source.revisionId, revisionTimestamp: source.revisionTimestamp, fetchedAt: source.fetchedAt })),
    overrides, unresolved
  };
  await writeJsonAtomic(OUTPUT_FILE, output);
  return { rows: rows.length, overrides: Object.keys(overrides).length, unresolved: unresolved.length };
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const sources = [];
  let lastRequestAt = 0;
  for (const page of PAGES) {
    const cacheFile = join(CACHE_DIR, `${page.key}-source.json`);
    let source = !REFRESH && await readCache(cacheFile);
    if (!source) {
      const remainingDelay = 550 - (Date.now() - lastRequestAt);
      if (remainingDelay > 0) await new Promise(resolve => setTimeout(resolve, remainingDelay));
      console.log(`依照 52Poké 機器讀取守則，取得「${page.title}」最新 revision…`);
      source = await fetchLatestSource(page.title, cacheFile);
      lastRequestAt = Date.now();
    } else {
      console.log(`使用「${page.title}」本地快取 revision ${source.revisionId}。`);
    }
    sources.push(source);
  }
  let traditionalHtml = !REFRESH && await readCache(TRADITIONAL_HTML_CACHE);
  if (!traditionalHtml) {
    const remainingDelay = 550 - (Date.now() - lastRequestAt);
    if (remainingDelay > 0) await new Promise(resolve => setTimeout(resolve, remainingDelay));
    console.log("取得全國圖鑑型態列表的繁體快取…");
    traditionalHtml = await fetchTraditionalHtml(PAGES[1].title);
  } else {
    console.log("使用全國圖鑑型態列表的繁體 HTML 本地快取。");
  }
  console.log(JSON.stringify(sources.map(source => ({ title: source.title, revisionId: source.revisionId, revisionTimestamp: source.revisionTimestamp, characters: source.content.length })), null, 2));
  console.log(JSON.stringify({ traditionalHtmlCharacters: traditionalHtml.content.length }, null, 2));
  console.log(JSON.stringify(await buildOverrides(traditionalHtml.content, sources), null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
