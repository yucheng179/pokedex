import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, "data");
const source = "https://gamewith.ai/pokemon-champions/zh-hant/abilities";
const clean = value => value.replace(/<[^>]*>/g, "").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const normalize = value => value.normalize("NFKC").replace(/\s+/g, "");
const aliases = { "as-one-glastrier": "人馬一體(白馬)", "as-one-spectrier": "人馬一體(黑馬)", eelevate: "鰻鰻高升", "fire-mane": "火焰鬃毛", "aura-guard": "波導防護" };

async function writeJson(name, value) {
  const path = join(dataDir, name);
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

const abilities = JSON.parse(await readFile(join(dataDir, "abilities.json"), "utf8"));
const response = await fetch(source, { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`GameWith: HTTP ${response.status}`);
const html = await response.text();
const entries = new Map();
const categoryKeys = new Set(["weather", "field", "offense", "defense", "status", "rank", "speed", "type", "contact", "switch", "item", "interfere", "other"]);
const categoryMap = new Map();
const chunks = [...new Set([...html.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1]))];
for (const url of chunks) {
  if (!url.startsWith("https://assets.gamewith.ai/")) continue;
  const chunkResponse = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!chunkResponse.ok) continue;
  const chunk = await chunkResponse.text();
  if (!chunk.includes('"AbilityTable"')) continue;
  for (const match of chunk.matchAll(/(?:"([^"\n]+)"|([\p{L}\p{N}_]+)):\[((?:"[a-z]+",?)+)\]/gu)) {
    const categories = JSON.parse(`[${match[3]}]`);
    if (categories.length && categories.every(key => categoryKeys.has(key))) categoryMap.set(normalize(match[1] || match[2]), categories);
  }
}
if (categoryMap.size < 250) throw new Error("GameWith 分類格式可能已變更；不覆寫資料。");
const categoryAliases = { "as-one-glastrier": "じんばいったい(はくば)", "as-one-spectrier": "じんばいったい(こくば)", eelevate: "うなぎのぼり", "fire-mane": "ほのおのたてがみ" };
for (const match of html.matchAll(/<a\b[^>]*href="(\/pokemon-champions\/zh-hant\/abilities\/\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
  const spans = [...match[2].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/g)].map(item => clean(item[1]));
  if (spans.length < 2 || !spans[0] || !spans[1]) continue;
  entries.set(normalize(spans[0]), { name: spans[0], description: spans[1], sourceUrl: `https://gamewith.ai${match[1]}` });
}
if (entries.size < 250) throw new Error(`僅解析 ${entries.size} 個特性，網站格式可能已變更；不覆寫資料。`);
const overrides = {};
const unmatched = [];
let filled = 0;
for (const ability of Object.values(abilities).filter(item => item.isMainSeries)) {
  const entry = entries.get(normalize(aliases[ability.slug] || ability.name.zhHant));
  if (!entry) continue;
  if (!ability.description) filled++;
  if (!Object.hasOwn(ability, "legacyDescription")) ability.legacyDescription = ability.description;
  ability.description = entry.description;
  ability.descriptionVersion = "Champions";
  ability.descriptionSource = entry.sourceUrl;
  // Aura Guard is not yet included in GameWith's category map; its contact damage reduction is defense/contact.
  const categoryName = normalize(categoryAliases[ability.slug] || ability.name.ja);
  ability.categories = categoryMap.get(categoryName) || (ability.slug === "aura-guard" ? ["defense", "contact"] : ["other"]);
  ability.categorySource = categoryMap.has(categoryName) ? "GameWith" : "local-description-classification";
  overrides[ability.slug] = { id: ability.id, ...entry, categories: ability.categories, categorySource: ability.categorySource };
}
for (const entry of entries.values()) {
  if (!Object.values(overrides).some(item => item.name === entry.name)) unmatched.push(entry);
}
const snapshot = { source, fetchedAt: new Date().toISOString(), note: "GameWith Champions 描述優先；未收錄者保留既有描述。GameWith 網址編號不是 PokeAPI 編號，依名稱配對。", overrides, unmatched };
await writeJson("champions-ability-overrides.json", snapshot);
await writeJson("abilities.json", abilities);
console.log(JSON.stringify({ parsed: entries.size, updated: Object.keys(overrides).length, filled, remainingMissing: Object.values(abilities).filter(item => item.isMainSeries && !item.description).map(item => ({id:item.id,name:item.name.zhHant})), unmatched }, null, 2));
