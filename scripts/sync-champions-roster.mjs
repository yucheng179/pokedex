import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, "data");
const IMAGE_DIR = join(ROOT, "assets", "champions");
const API = "https://wiki.52poke.com/api.php";
const PAGE_TITLE = "宝可梦列表（Champions）";
const SOURCE_URL = "https://wiki.52poke.com/wiki/宝可梦列表（Champions）";
const GAME_VERSION = "1.2.0";

// These forms have gameplay differences and remain separate collection cards.
// Purely cosmetic forms and temporary battle transformations are collapsed.
const FILE_SLUGS = {
  "Champions 0026A Sprite.png": "raichu-alola",
  "Champions 0038A Sprite.png": "ninetales-alola",
  "Champions 0053A Sprite.png": "persian-alola",
  "Champions 0059H Sprite.png": "arcanine-hisui",
  "Champions 0080G Sprite.png": "slowbro-galar",
  "Champions 0128PA Sprite.png": "tauros-paldea-aqua-breed",
  "Champions 0128PB Sprite.png": "tauros-paldea-blaze-breed",
  "Champions 0128PC Sprite.png": "tauros-paldea-combat-breed",
  "Champions 0157H Sprite.png": "typhlosion-hisui",
  "Champions 0199G Sprite.png": "slowking-galar",
  "Champions 0479F Sprite.png": "rotom-frost",
  "Champions 0479Fa Sprite.png": "rotom-fan",
  "Champions 0479H Sprite.png": "rotom-heat",
  "Champions 0479M Sprite.png": "rotom-mow",
  "Champions 0479W Sprite.png": "rotom-wash",
  "Champions 0503H Sprite.png": "samurott-hisui",
  "Champions 0571H Sprite.png": "zoroark-hisui",
  "Champions 0618G Sprite.png": "stunfisk-galar",
  "Champions 0670E Sprite.png": "floette-eternal",
  "Champions 0678F Sprite.png": "meowstic-female",
  "Champions 0706H Sprite.png": "goodra-hisui",
  "Champions 0711J Sprite.png": "gourgeist-super",
  "Champions 0711L Sprite.png": "gourgeist-large",
  "Champions 0711S Sprite.png": "gourgeist-small",
  "Champions 0713H Sprite.png": "avalugg-hisui",
  "Champions 0724H Sprite.png": "decidueye-hisui",
  "Champions 0745Mn Sprite.png": "lycanroc-midnight",
  "Champions 0745D Sprite.png": "lycanroc-dusk",
  "Champions 0876F Sprite.png": "indeedee-female",
  "Champions 0902F Sprite.png": "basculegion-female"
};

const DISPLAY_NAMES = {
  "meowstic-male": "超能妙喵（雄性）",
  "indeedee-male": "愛管侍（雄性）",
  "basculegion-male": "幽尾玄魚（雄性）",
  "lycanroc-midday": "鬃岩狼人（白晝）",
  "rotom": "洛托姆",
  "rotom-frost": "結冰洛托姆",
  "rotom-fan": "旋轉洛托姆",
  "rotom-heat": "加熱洛托姆",
  "rotom-mow": "切割洛托姆",
  "rotom-wash": "清洗洛托姆",
  "gourgeist-average": "南瓜怪人（中顆種）",
  "gourgeist-super": "南瓜怪人（巨顆種）",
  "gourgeist-large": "南瓜怪人（大顆種）",
  "gourgeist-small": "南瓜怪人（小顆種）"
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "local-pokedex-data-sync/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function readJson(name, fallback = null) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, name), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(name, value) {
  const path = join(DATA_DIR, name);
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

function parseRows(wikitext) {
  return wikitext.split(/\n\|-/).slice(1).map((chunk, sourceOrder) => {
    const dexNumber = Number(chunk.match(/\| #(\d{4})/)?.[1]);
    const imageFile = chunk.match(/\[\[File:([^\]|]+)/)?.[1];
    const sourceName = chunk.match(/\{\{side\|([^}]+)/)?.[1];
    const formMarkup = chunk.match(/<small>(.*?)<\/small>/s)?.[1] || "";
    const sourceVersion = [...chunk.matchAll(/\n\| (1\.[^\n]+)/g)].at(-1)?.[1]?.trim() || null;
    if (!dexNumber || !imageFile || !sourceName) return null;
    return { dexNumber, imageFile, sourceName, formMarkup, sourceVersion, sourceOrder };
  }).filter(Boolean);
}

function displayName(mon) {
  if (DISPLAY_NAMES[mon.slug]) return DISPLAY_NAMES[mon.slug];
  return mon.name.zhHant
    .replace(/的樣子/g, "")
    .replace(/・(?=[）)])/g, "")
    .replace(/[（(]\s*[）)]/g, "")
    .trim();
}

async function imageInfo(files) {
  const result = new Map();
  const unique = [...new Set(files)];
  for (let offset = 0; offset < unique.length; offset += 40) {
    const batch = unique.slice(offset, offset + 40);
    const params = new URLSearchParams({
      action: "query",
      prop: "imageinfo",
      iiprop: "url|size",
      titles: batch.map(file => `File:${file}`).join("|"),
      format: "json",
      formatversion: "2"
    });
    const data = await fetchJson(`${API}?${params}`);
    for (const page of data.query?.pages || []) {
      const file = page.title?.replace(/^File:/, "");
      const info = page.imageinfo?.[0];
      if (file && info?.url) result.set(file, { url: info.url, size: Number(info.size) || null });
    }
  }
  return result;
}

async function mapLimit(items, limit, task) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      await task(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function downloadImage(mon) {
  const path = join(IMAGE_DIR, `${mon.slug}.png`);
  try {
    const details = await stat(path);
    if (mon.imageBytes && details.size === mon.imageBytes) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const response = await fetch(mon.sourceImageUrl, { headers: { "user-agent": "local-pokedex-data-sync/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${mon.sourceImageUrl}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, bytes);
  try {
    await rename(temp, path);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
    await rm(path, { force: true });
    await rename(temp, path);
  }
}

async function main() {
  console.log("取得 52Poké Champions 名單與圖片資料…");
  const parseParams = new URLSearchParams({
    action: "parse",
    page: PAGE_TITLE,
    prop: "wikitext",
    format: "json",
    formatversion: "2"
  });
  const revisionParams = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "ids|timestamp",
    titles: PAGE_TITLE,
    format: "json",
    formatversion: "2"
  });
  const [page, revisionData, pokemon, previousRoster] = await Promise.all([
    fetchJson(`${API}?${parseParams}`),
    fetchJson(`${API}?${revisionParams}`),
    readJson("pokemon.json", []),
    readJson("champions-roster.json", { pokemon: [] })
  ]);
  const revision = revisionData.query?.pages?.[0]?.revisions?.[0];
  const rows = parseRows(page.parse?.wikitext || "");
  if (!rows.length) throw new Error("52Poké Champions 頁面沒有可解析的表格列。");

  const nonMega = rows.filter(row => !/(超级|超級)/.test(row.formMarkup));
  const selected = [];
  for (const speciesRows of Map.groupBy(nonMega, row => row.dexNumber).values()) {
    selected.push(speciesRows[0]);
    selected.push(...speciesRows.slice(1).filter(row => FILE_SLUGS[row.imageFile]));
  }

  const bySlug = new Map(pokemon.map(mon => [mon.slug, mon]));
  const defaultBySpecies = new Map();
  for (const mon of pokemon) {
    if (!defaultBySpecies.has(mon.speciesId) || mon.form?.isDefault) defaultBySpecies.set(mon.speciesId, mon);
  }
  const previousBySpecies = Map.groupBy(previousRoster.pokemon || [], mon => mon.speciesId);
  const previousBySlug = Map.groupBy(previousRoster.pokemon || [], mon => mon.slug);
  const usedPreviousKeys = new Set();
  const images = await imageInfo(selected.map(row => row.imageFile));
  const unresolved = [];
  const missingImages = [];
  const roster = selected.map(row => {
    const mon = bySlug.get(FILE_SLUGS[row.imageFile]) || defaultBySpecies.get(row.dexNumber);
    if (!mon) {
      unresolved.push(row);
      return null;
    }
    const image = images.get(row.imageFile);
    if (!image) missingImages.push(row.imageFile);
    const previous = previousBySlug.get(mon.slug)?.find(item => !usedPreviousKeys.has(item.key))
      || previousBySpecies.get(row.dexNumber)?.find(item => !usedPreviousKeys.has(item.key));
    if (previous) usedPreviousKeys.add(previous.key);
    return {
      key: previous?.key || `champions-${mon.slug}`,
      slug: mon.slug,
      speciesId: mon.speciesId,
      dexNumber: mon.dexNumber,
      name: displayName(mon),
      image: `assets/champions/${mon.slug}.png`,
      fallbackImage: mon.image,
      imageBytes: image?.size || null,
      sourceImageUrl: image?.url || null,
      sourceImageFile: row.imageFile,
      sourceVersion: row.sourceVersion,
      sourceOrder: row.sourceOrder
    };
  }).filter(Boolean);

  if (unresolved.length) throw new Error(`有 ${unresolved.length} 筆 52Poké 名單無法對應本地圖鑑。`);
  if (missingImages.length) throw new Error(`52Poké 缺少 ${missingImages.length} 張圖片：${missingImages.join(", ")}`);
  if (new Set(roster.map(mon => mon.slug)).size !== roster.length) {
    const duplicates = roster.filter((mon, index) => roster.findIndex(item => item.slug === mon.slug) !== index);
    throw new Error(`Champions 名單仍有重複型態：${duplicates.map(mon => mon.slug).join(", ")}`);
  }

  roster.sort((a, b) => a.dexNumber - b.dexNumber || a.sourceOrder - b.sourceOrder);
  await mkdir(IMAGE_DIR, { recursive: true });
  await mapLimit(roster, 12, downloadImage);
  const totalImageBytes = roster.reduce((sum, mon) => sum + (mon.imageBytes || 0), 0);
  await writeJson("champions-roster.json", {
    generatedAt: new Date().toISOString(),
    version: GAME_VERSION,
    ruleset: "M-C",
    count: roster.length,
    sort: "national-pokedex",
    formPolicy: "Collapse cosmetic-only and temporary battle forms; keep regional and gameplay-distinct forms.",
    source: {
      name: "52Poké Champions Pokémon list",
      url: SOURCE_URL,
      api: API,
      pageRevisionId: revision?.revid || null,
      pageUpdatedAt: revision?.timestamp || null
    },
    imageSource: {
      name: "52Poké Champions sprites",
      totalBytes: totalImageBytes,
      localDirectory: "assets/champions",
      fallback: "PokéAPI official artwork"
    },
    pokemon: roster
  });
  console.log(`完成：${roster.length} 張收藏卡，52Poké 圖片 ${roster.length}／${roster.length}，共 ${(totalImageBytes / 1024 / 1024).toFixed(2)} MiB。`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
