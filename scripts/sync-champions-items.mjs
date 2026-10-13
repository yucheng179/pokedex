import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");
const source = "https://gamewith.ai/pokemon-champions/zh-hant/items";
const normalize = value => String(value || "").normalize("NFKC").replace(/\s+/g, "");
async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}
function property(payload, key) {
  const marker = `"${key}":`;
  const start = payload.indexOf(marker);
  if (start < 0) throw new Error(`缺少來源欄位 ${key}`);
  const text = payload.slice(start + marker.length);
  let depth = 0, quoted = false, escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{" || char === "[") depth++;
    else if ((char === "}" || char === "]") && --depth === 0) return JSON.parse(text.slice(0, index + 1));
  }
  throw new Error(`來源欄位 ${key} 不完整`);
}
async function writeJson(name, value) {
  const path = join(dataDir, name), temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

const items = JSON.parse(await readFile(join(dataDir, "items.json"), "utf8"));
const html = await fetchText(source);
const payloads = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)].map(match => JSON.parse(match[1]));
const payload = payloads.find(text => text.includes('"allItems"'));
if (!payload) throw new Error("GameWith 資料格式已變更；不覆寫資料。");
const records = property(payload, "allItems"), names = property(payload, "itemNameMap"), descriptions = property(payload, "descMap");
// Use items actually displayed on the page, rather than unreleased entries in the hidden master data.
const displayedIds = new Set([...html.matchAll(/href="\/pokemon-champions\/zh-hant\/items\/(\d+)"/g)].map(match => Number(match[1])));
if (displayedIds.size < 50) throw new Error("顯示名單異常；不覆寫資料。");
const overrides = {}, additions = [];
for (const item of items) {
  item.inChampions = false;
  if (Object.hasOwn(item, "legacyDescription")) item.description = item.legacyDescription;
  delete item.descriptionVersion; delete item.descriptionSource; delete item.championsSource;
}
for (const record of records.filter(item => displayedIds.has(item.ID))) {
  const ja = record["名前"], zh = names[ja];
  if (!zh) throw new Error(`缺少中文名稱：${ja}`);
  let matches = items.filter(item => normalize(item.name.ja) === normalize(ja));
  if (!matches.length) matches = items.filter(item => normalize(item.name.zhHant) === normalize(zh));
  if (!matches.length) {
    const addition = { id: null, slug: `champions-item-${record.ID}`, name: { zhHant: zh, ja, en: "" }, category: ja.includes("ナイト") ? "mega-stones" : record["カテゴリ"] === "きのみ" ? "other" : "held-items", attributes: ["holdable"], description: null, image: null, flingPower: null, flingEffect: null };
    items.push(addition); additions.push(addition.slug); matches = [addition];
  }
  const sourceUrl = `${source}/${record.ID}`;
  for (const item of matches) {
    if (!Object.hasOwn(item, "legacyDescription")) item.legacyDescription = item.description;
    const description = descriptions[ja] || null;
    item.inChampions = true; item.championsSource = sourceUrl;
    if (description) { item.description = description; item.descriptionVersion = "Champions"; item.descriptionSource = sourceUrl; }
    if (!item.image && record["画像ID"]) item.image = `https://img.gamewith.jp/article_tools/pokemon-champions/gacha/i_item${record["画像ID"]}.png`;
    overrides[item.slug] = { ...item };
  }
}
const snapshot = { source, fetchedAt: new Date().toISOString(), displayedCount: displayedIds.size, note: "依網頁實際顯示名單判定加入 Champions，排除僅存在隱藏資料的未顯示項目。保留原始描述。", overrides };
await writeJson("champions-item-overrides.json", snapshot);
await writeJson("items.json", items);
console.log(JSON.stringify({ displayed: displayedIds.size, matchedRecords: Object.keys(overrides).length, additions, total: items.length }, null, 2));
