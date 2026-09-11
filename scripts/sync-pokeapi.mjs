import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, "data");
const CACHE_DIR = join(ROOT, ".cache", "pokeapi");
const API = "https://pokeapi.co/api/v2";
const CONCURRENCY = Number(readArg("concurrency") || 12);
const REFRESH = process.argv.includes("--refresh");
const USE_CACHE = process.argv.includes("--cache");
const ONLY = new Set((readArg("only") || "core,moves,items").split(","));

const LANG_ZH = ["zh-Hant", "zh-Hans"];
const LANG_EN = ["en"];
const LANG_JA = ["ja-Hrkt", "ja"];
const TYPE_STYLES = {
  normal: ["#8f989e", "#616a70"], fire: ["#ee7043", "#c74328"], water: ["#4b90d6", "#2864a0"],
  electric: ["#e9b91f", "#b88600"], grass: ["#5fae58", "#347c3a"], ice: ["#63c5c3", "#318b91"],
  fighting: ["#c4544c", "#8e3438"], poison: ["#a566ad", "#74417c"], ground: ["#c99b57", "#8b6530"],
  flying: ["#8799c5", "#586b9a"], psychic: ["#e66c91", "#b43a64"], bug: ["#91a835", "#66771c"],
  rock: ["#ae9b6a", "#786941"], ghost: ["#676b9e", "#424672"], dragon: ["#526eb7", "#314587"],
  dark: ["#685a58", "#403535"], steel: ["#6595a2", "#3f6973"], fairy: ["#dc86b9", "#a94d84"]
};
const STARTER_IDS = new Set([1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912]);
const PSEUDO_IDS = new Set([149, 248, 373, 376, 445, 635, 706, 784, 887, 998]);
const ULTRA_BEAST_IDS = new Set([793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]);
const PARADOX_IDS = new Set([984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1007, 1008, 1009, 1010, 1020, 1021, 1022, 1023]);
const REGION_BY_GENERATION = { 1: "kanto", 2: "johto", 3: "hoenn", 4: "sinnoh", 5: "unova", 6: "kalos", 7: "alola", 8: "galar", 9: "paldea" };
const FORM_PRIORITY = { mega: 0, gmax: 1, regional: 2, primal: 3, battle: 4, other: 5, normal: 6 };
const SPECIAL_FORM_LABELS = {
  attack: "攻擊型態", defense: "防禦型態", speed: "速度型態",
  sandy: "沙土蓑衣", trash: "垃圾蓑衣",
  heat: "加熱洛托姆", wash: "清洗洛托姆", frost: "結冰洛托姆", fan: "旋轉洛托姆", mow: "切割洛托姆",
  origin: "起源形態", sky: "天空形態", therian: "靈獸形態",
  black: "暗黑型態", white: "焰白型態", resolute: "覺悟的樣子", unbound: "解放的樣子",
  female: "雌性", amped: "高調的樣子", "low-key": "低調的樣子", eternamax: "無極巨化",
  "single-strike": "一擊流", "rapid-strike": "連擊流",
  dada: "阿爸的樣子", ice: "騎白馬的樣子", shadow: "騎黑馬的樣子", bloodmoon: "赫月",
  original: "原始色", male: "雄性", curly: "上弓姿勢", droopy: "下垂姿勢", stretchy: "平挺姿勢",
  "family-of-three": "三隻家庭", "three-segment": "三節型態", roaming: "徒步型態",
  "cornerstone-mask": "礎石面具", "hearthflame-mask": "火灶面具", "wellspring-mask": "水井面具"
};
const DEX_NAMES = {
  kanto: "關都", "original-johto": "城都（金／銀／水晶）", "updated-johto": "城都（心金／魂銀）",
  hoenn: "豐緣（紅寶石／藍寶石）", "updated-hoenn": "豐緣（終極紅寶石／始源藍寶石）",
  "original-sinnoh": "神奧（鑽石／珍珠）", "extended-sinnoh": "神奧（白金）",
  "original-unova": "合眾（黑／白）", "updated-unova": "合眾（黑２／白２）",
  "kalos-central": "卡洛斯中央", "kalos-coastal": "卡洛斯海岸", "kalos-mountain": "卡洛斯山岳",
  "original-alola": "阿羅拉（太陽／月亮）", "updated-alola": "阿羅拉（究極之日／究極之月）",
  "original-melemele": "美樂美樂島", "updated-melemele": "美樂美樂島（究極）",
  "original-akala": "阿卡拉島", "updated-akala": "阿卡拉島（究極）",
  "original-ulaula": "烏拉烏拉島", "updated-ulaula": "烏拉烏拉島（究極）",
  "original-poni": "波尼島", "updated-poni": "波尼島（究極）",
  "letsgo-kanto": "關都（Let's Go）", galar: "伽勒爾", "isle-of-armor": "鎧島", "crown-tundra": "王冠雪原",
  hisui: "洗翠", paldea: "帕底亞", kitakami: "北上鄉", blueberry: "藍莓", "lumiose-city": "密阿雷"
};

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function idFromUrl(url) {
  return Number(new URL(url).pathname.split("/").filter(Boolean).at(-1));
}

function generationFromResource(resource) {
  if (!resource?.url) return null;
  return idFromUrl(resource.url);
}

function cacheFileFor(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean).slice(2);
  if (parts.length === 1) parts.push("list");
  const query = parsed.search ? `-${parsed.searchParams.toString().replaceAll(/[^a-zA-Z0-9]+/g, "-")}` : "";
  return join(CACHE_DIR, ...parts.slice(0, -1), `${parts.at(-1)}${query}.json`);
}

async function fetchJson(url, attempt = 1) {
  const cacheFile = cacheFileFor(url);
  if (USE_CACHE && !REFRESH) {
    try { return JSON.parse(await readFile(cacheFile, "utf8")); } catch { /* cache miss */ }
  }
  try {
    const response = await fetch(url, { headers: { "user-agent": "local-pokedex-data-sync/1.0" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    if (USE_CACHE) await writeJson(cacheFile, data);
    return data;
  } catch (error) {
    if (attempt >= 4) throw new Error(`無法取得 ${url}: ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    return fetchJson(url, attempt + 1);
  }
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

async function readExisting(name, fallback = {}) {
  try { return JSON.parse(await readFile(join(DATA_DIR, name), "utf8")); } catch { return fallback; }
}

async function list(endpoint) {
  return (await fetchJson(`${API}/${endpoint}?limit=100000`)).results;
}

async function mapLimit(items, worker, label) {
  const output = new Array(items.length);
  let cursor = 0;
  let finished = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
      finished++;
      if (finished % 100 === 0 || finished === items.length) process.stdout.write(`\r${label}: ${finished}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  process.stdout.write("\n");
  return output;
}

function pickName(entries = [], languages = LANG_ZH) {
  for (const language of languages) {
    const value = entries.find(entry => entry.language?.name?.toLowerCase() === language.toLowerCase())?.name;
    if (value) return value;
  }
  return null;
}

function pickText(entries = [], fields = ["flavor_text", "text", "short_effect", "effect", "description"]) {
  for (const language of LANG_ZH) {
    const candidates = entries.filter(entry => entry.language?.name?.toLowerCase() === language.toLowerCase());
    for (const entry of candidates.toReversed()) {
      for (const field of fields) {
        if (entry[field]) return entry[field].replace(/[\n\f]+/g, " ").replace(/\s+/g, " ").trim();
      }
    }
  }
  return null;
}

const UNAVAILABLE_MOVE_DESCRIPTION = /無法使用(?:此|這個)招式|建議忘記(?:此|這個)招式|不能使用的招式/;

function pickMoveText(entries = [], fields = ["flavor_text", "text", "short_effect", "effect", "description"]) {
  for (const language of LANG_ZH) {
    const candidates = entries.filter(entry => entry.language?.name?.toLowerCase() === language.toLowerCase());
    for (const entry of candidates.toReversed()) {
      for (const field of fields) {
        if (!entry[field]) continue;
        const text = entry[field].replace(/[\n\f]+/g, " ").replace(/\s+/g, " ").trim();
        if (text && !UNAVAILABLE_MOVE_DESCRIPTION.test(text)) return text;
      }
    }
  }
  return null;
}

function moveDescription(move) {
  return pickMoveText(move.flavor_text_entries)
    || pickMoveText(move.effect_entries)
    || "資料庫目前未有此招式資料。";
}

function moveKind(move) {
  if ((move.id >= 622 && move.id <= 658) || (move.id >= 695 && move.id <= 703) || move.id === 719 || (move.id >= 723 && move.id <= 728)) return "z";
  if (move.id === 743 || (move.id >= 757 && move.id <= 774)) return "max";
  return "normal";
}

function localizedNames(entries, fallbackEnglish) {
  return {
    zhHant: pickName(entries, LANG_ZH) || fallbackEnglish,
    en: pickName(entries, LANG_EN) || fallbackEnglish,
    ja: pickName(entries, LANG_JA) || fallbackEnglish
  };
}

function relationNames(resources = []) { return resources.map(resource => resource.name); }

function regionalFormRegion(slug) {
  if (slug.endsWith("-alola") || slug === "marowak-totem") return "alola";
  if (slug.endsWith("-galar") || /^darmanitan-galar-(?:standard|zen)$/.test(slug)) return "galar";
  if (slug.endsWith("-hisui")) return "hisui";
  if (slug.endsWith("-paldea") || /^tauros-paldea-(?:combat|blaze|aqua)-breed$/.test(slug)) return "paldea";
  return null;
}

function inferFormCategory(form, slug, isDefaultVariety) {
  if (form?.is_mega || slug.includes("-mega")) return "mega";
  if (slug.includes("-gmax")) return "gmax";
  if (slug.includes("-primal")) return "primal";
  if (regionalFormRegion(slug)) return "regional";
  if (form?.is_battle_only) return "battle";
  return isDefaultVariety ? "normal" : "other";
}

function inferredFormGeneration(category, slug, fallback) {
  if (category === "mega" || category === "primal") return 6;
  if (regionalFormRegion(slug) === "alola") return 7;
  if (["galar", "hisui"].includes(regionalFormRegion(slug)) || category === "gmax") return 8;
  if (regionalFormRegion(slug) === "paldea") return 9;
  return fallback;
}

function megaSuffix(slug) {
  return slug.match(/-mega-([xyz])$/)?.[1].toUpperCase() || "";
}

function specialFormLabel(form, fallbackPrefix = "特殊型態") {
  const rawName = form?.form_name || "";
  return SPECIAL_FORM_LABELS[rawName] || `${fallbackPrefix} #${form?.id || "?"}`;
}

function megaVariantLabel(form, slug) {
  const letter = megaSuffix(slug);
  if (letter) return letter;
  let rawName = (form?.form_name || "").replace(/^mega-?|\-mega$/g, "");
  if (!rawName || rawName === "mega") rawName = slug.match(/-([^-]+)-mega$/)?.[1] || "";
  return rawName && rawName !== "mega" ? (SPECIAL_FORM_LABELS[rawName] || `型態 #${form?.id || "?"}`) : "";
}

function gmaxVariantLabel(slug) {
  for (const rawName of ["low-key", "amped", "single-strike", "rapid-strike"]) {
    if (slug.endsWith(`-${rawName}-gmax`)) return SPECIAL_FORM_LABELS[rawName];
  }
  return "";
}

function formLabel(category, slug, form) {
  const region = regionalFormRegion(slug);
  if (region === "alola") return slug.includes("totem") ? "阿羅拉的樣子・霸主" : "阿羅拉的樣子";
  if (region === "galar") return slug.startsWith("darmanitan-galar-")
    ? (slug.endsWith("-zen") ? "伽勒爾的樣子・達摩模式" : "伽勒爾的樣子・普通模式")
    : "伽勒爾的樣子";
  if (region === "hisui") return "洗翠的樣子";
  if (region === "paldea") {
    if (slug.endsWith("-combat-breed")) return "帕底亞的樣子・鬥戰種";
    if (slug.endsWith("-blaze-breed")) return "帕底亞的樣子・火熾種";
    if (slug.endsWith("-aqua-breed")) return "帕底亞的樣子・水瀾種";
    return "帕底亞的樣子";
  }
  if (category === "mega") return `超級進化${megaVariantLabel(form, slug) ? ` ${megaVariantLabel(form, slug)}` : ""}`;
  if (category === "gmax") return `超極巨化${gmaxVariantLabel(slug) ? `・${gmaxVariantLabel(slug)}` : ""}`;
  return { primal: "原始回歸", battle: specialFormLabel(form, "戰鬥型態"), other: specialFormLabel(form), normal: "一般型態" }[category];
}

function formatEvolution(details = []) {
  const detail = details[0];
  if (!detail) return "進化";
  if (detail.min_level) return `等級 ${detail.min_level}`;
  if (detail.min_happiness) return "高親密度";
  if (detail.item) return "使用進化道具";
  if (detail.held_item) return detail.trigger?.name === "trade" ? "攜帶道具交換" : "攜帶指定道具";
  if (detail.trigger?.name === "trade") return "交換";
  return { "shed": "脫殼", "spin": "旋轉", "tower-of-darkness": "惡之塔", "tower-of-waters": "水之塔", "three-critical-hits": "單場命中要害三次", "take-damage": "達成指定傷害條件", "other": "特殊條件" }[detail.trigger?.name] || "特殊條件";
}

function normalizeEvolutionNode(node) {
  return {
    slug: node.species.name,
    method: formatEvolution(node.evolution_details),
    conditions: node.evolution_details || [],
    evolvesTo: node.evolves_to.map(normalizeEvolutionNode)
  };
}

function flattenEvolution(root, output = []) {
  output.push({ slug: root.slug, method: root.method });
  root.evolvesTo.forEach(child => flattenEvolution(child, output));
  return output;
}

async function syncCore() {
  console.log("同步核心圖鑑資料…");
  const existingAbilities = await readExisting("abilities.json");
  const formNameData = await readExisting("form-name-overrides.json");
  const formNameOverrides = formNameData.overrides || {};
  const [typeRefs, abilityRefs, speciesRefs, pokemonRefs, pokedexRefs, versionGroupRefs] = await Promise.all([
    list("type"), list("ability"), list("pokemon-species"), list("pokemon"), list("pokedex"), list("version-group")
  ]);

  const typeDetails = await mapLimit(typeRefs.filter(ref => TYPE_STYLES[ref.name]), ref => fetchJson(ref.url), "屬性");
  const types = Object.fromEntries(typeDetails.map(type => {
    const [color, dark] = TYPE_STYLES[type.name];
    return [type.name, {
      id: type.id, name: pickName(type.names, LANG_ZH) || type.name, color, dark,
      damageFrom: {
        weak: relationNames(type.damage_relations.double_damage_from),
        resist: relationNames(type.damage_relations.half_damage_from),
        immune: relationNames(type.damage_relations.no_damage_from)
      }
    }];
  }));

  const abilityDetails = await mapLimit(abilityRefs, ref => fetchJson(ref.url), "特性");
  const abilities = Object.fromEntries(abilityDetails.map(ability => [ability.name, {
    id: ability.id, slug: ability.name, name: localizedNames(ability.names, ability.name),
    description: pickText(ability.flavor_text_entries) || pickText(ability.effect_entries) || existingAbilities[ability.name]?.description || null,
    generation: generationFromResource(ability.generation), isMainSeries: ability.is_main_series
  }]));

  const [speciesDetails, pokemonDetails, pokedexDetails, versionGroupDetails] = await Promise.all([
    mapLimit(speciesRefs, ref => fetchJson(ref.url), "物種"),
    mapLimit(pokemonRefs, ref => fetchJson(ref.url), "寶可夢型態"),
    mapLimit(pokedexRefs, ref => fetchJson(ref.url), "地區圖鑑"),
    mapLimit(versionGroupRefs, ref => fetchJson(ref.url), "版本群組")
  ]);
  const speciesBySlug = new Map(speciesDetails.map(species => [species.name, species]));
  const pokemonBySlug = new Map(pokemonDetails.map(pokemon => [pokemon.name, pokemon]));
  const versionGroupGenerations = new Map(versionGroupDetails.map(group => [group.name, generationFromResource(group.generation)]));
  const pokedexNames = new Map(pokedexDetails.map(dex => [dex.name, pickName(dex.names, LANG_ZH) || DEX_NAMES[dex.name] || null]));

  const formUrls = [...new Set(pokemonDetails.flatMap(pokemon => pokemon.forms.map(form => form.url)))];
  const formDetails = await mapLimit(formUrls, url => fetchJson(url), "外觀型態");
  const formsByPokemon = Map.groupBy(formDetails, form => form.pokemon.name);

  const evolutionUrls = [...new Set(speciesDetails.map(species => species.evolution_chain?.url).filter(Boolean))];
  const evolutionDetails = await mapLimit(evolutionUrls, url => fetchJson(url), "進化鏈");
  const chains = evolutionDetails.map(chain => {
    const root = normalizeEvolutionNode(chain.chain);
    root.method = "";
    return { id: chain.id, root, members: flattenEvolution(root) };
  });
  const starterChainIds = new Set(speciesDetails
    .filter(species => STARTER_IDS.has(species.id) && species.evolution_chain)
    .map(species => idFromUrl(species.evolution_chain.url)));
  const starterSpeciesIds = new Set(speciesDetails
    .filter(species => species.evolution_chain && starterChainIds.has(idFromUrl(species.evolution_chain.url)))
    .map(species => species.id));

  const normalizedPokemon = [];
  const existingPokemonSlugs = new Set(pokemonDetails.map(pokemon => pokemon.name));
  for (const pokemon of pokemonDetails) {
    const speciesSlug = pokemon.species.name;
    const species = speciesBySlug.get(speciesSlug);
    if (!species) continue;
    const forms = formsByPokemon.get(pokemon.name) || [];
    const primaryForm = forms.find(form => form.name === pokemon.name) || forms.find(form => form.is_default) || forms[0];
    normalizedPokemon.push(makePokemonRecord(pokemon, species, primaryForm, abilities, versionGroupGenerations, false, formNameOverrides, starterSpeciesIds));
    for (const form of forms) {
      if (form === primaryForm || form.is_default || existingPokemonSlugs.has(form.name)) continue;
      normalizedPokemon.push(makePokemonRecord(pokemon, species, form, abilities, versionGroupGenerations, true, formNameOverrides, starterSpeciesIds));
    }
  }
  normalizedPokemon.sort((a, b) => a.dexNumber - b.dexNumber
    || Number(!a.form.isDefault) - Number(!b.form.isDefault)
    || (FORM_PRIORITY[a.form.category] ?? 99) - (FORM_PRIORITY[b.form.category] ?? 99)
    || a.slug.localeCompare(b.slug));

  const pokedexNumbers = Object.fromEntries(speciesDetails.map(species => [String(species.id), species.pokedex_numbers
    .filter(entry => entry.pokedex.name !== "national" && pokedexNames.get(entry.pokedex.name))
    .map(entry => ({ pokedex: entry.pokedex.name, name: pokedexNames.get(entry.pokedex.name), number: entry.entry_number }))]));

  await Promise.all([
    writeJson(join(DATA_DIR, "pokemon.json"), normalizedPokemon),
    writeJson(join(DATA_DIR, "types.json"), types),
    writeJson(join(DATA_DIR, "abilities.json"), abilities),
    writeJson(join(DATA_DIR, "evolution-chains.json"), chains),
    writeJson(join(DATA_DIR, "pokedex-numbers.json"), pokedexNumbers)
  ]);
  return { pokemon: normalizedPokemon.length, species: speciesDetails.length, abilities: abilityDetails.length, types: typeDetails.length, chains: chains.length };
}

function makePokemonRecord(pokemon, species, form, abilities, versionGroupGenerations, cosmetic = false, formNameOverrides = {}, starterSpeciesIds = STARTER_IDS) {
  const slug = cosmetic ? form.name : pokemon.name;
  const isDefault = !cosmetic && pokemon.is_default;
  const category = inferFormCategory(form, slug, isDefault);
  const speciesNames = localizedNames(species.names, species.name);
  const formNames = form ? localizedNames(form.names, "") : null;
  const chineseFormName = !isDefault && formNames?.zhHant ? formNames.zhHant : null;
  const nameOverride = formNameOverrides[slug] || null;
  const label = nameOverride?.formName || formLabel(category, slug, form);
  const megaVariant = megaVariantLabel(form, slug);
  const displayName = isDefault ? speciesNames.zhHant
    : category === "mega" ? `超級${speciesNames.zhHant}${megaVariant ? (/^[XYZ]$/.test(megaVariant) ? ` ${megaVariant}` : `（${megaVariant}）`) : ""}`
    : (nameOverride?.displayName || chineseFormName || `${speciesNames.zhHant}（${label}）`);
  const formGeneration = form?.version_group ? versionGroupGenerations.get(form.version_group.name) : null;
  const speciesGeneration = generationFromResource(species.generation);
  const generation = isDefault ? speciesGeneration : inferredFormGeneration(category, slug, formGeneration || speciesGeneration);
  const stats = Object.fromEntries(pokemon.stats.map(entry => [{ "special-attack": "specialAttack", "special-defense": "specialDefense" }[entry.stat.name] || entry.stat.name, entry.base_stat]));
  const total = Object.values(stats).reduce((sum, value) => sum + value, 0);
  const official = pokemon.sprites.other?.["official-artwork"];
  const home = pokemon.sprites.other?.home;
  return {
    id: cosmetic ? form.id : pokemon.id,
    speciesId: species.id,
    slug,
    dexNumber: species.id,
    name: {
      zhHant: displayName,
      en: !isDefault && formNames?.en ? formNames.en : (isDefault ? speciesNames.en : `${speciesNames.en} (${formLabel(category, slug)})`),
      ja: !isDefault && formNames?.ja ? formNames.ja : (category === "mega" ? `メガ${speciesNames.ja}${megaSuffix(slug)}` : speciesNames.ja)
    },
    types: (cosmetic && form?.types?.length ? form.types : pokemon.types).map(entry => entry.type.name),
    generation,
    speciesGeneration,
    region: REGION_BY_GENERATION[speciesGeneration] || null,
    evolutionChainId: species.evolution_chain ? idFromUrl(species.evolution_chain.url) : null,
    form: {
      category, name: isDefault ? null : label, apiName: form?.form_name || null, isDefault,
      nameSource: nameOverride ? { source: nameOverride.source, sourceUrl: nameOverride.sourceUrl, revisionId: nameOverride.revisionId, matchMethod: nameOverride.matchMethod } : null
    },
    isBaby: species.is_baby,
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
    isUltraBeast: ULTRA_BEAST_IDS.has(species.id),
    isParadox: PARADOX_IDS.has(species.id),
    isStarter: starterSpeciesIds.has(species.id),
    isPseudoLegendary: PSEUDO_IDS.has(species.id) && total === 600,
    abilities: pokemon.abilities.filter(entry => entry.ability).map(entry => ({
      id: abilities[entry.ability.name]?.id,
      name: abilities[entry.ability.name]?.name || { zhHant: entry.ability.name, en: entry.ability.name, ja: entry.ability.name },
      hidden: entry.is_hidden
    })),
    stats,
    image: cosmetic ? (form.sprites.front_default || official?.front_default || home?.front_default || pokemon.sprites.front_default) : (official?.front_default || home?.front_default || pokemon.sprites.front_default),
    shinyImage: cosmetic ? (form.sprites.front_shiny || official?.front_shiny || home?.front_shiny || pokemon.sprites.front_shiny) : (official?.front_shiny || home?.front_shiny || pokemon.sprites.front_shiny)
  };
}

async function syncMoves() {
  console.log("同步招式資料…");
  const descriptionData = await readExisting("move-description-overrides.json");
  const supplementalData = await readExisting("move-supplements.json");
  const championsData = await readExisting("champions-move-overrides.json");
  const descriptionOverrides = descriptionData.overrides || {};
  const championsOverrides = championsData.moves || {};
  const refs = await list("move");
  const details = await mapLimit(refs, ref => fetchJson(ref.url), "招式");
  const apiMoves = details.map(move => {
    const apiDescription = moveDescription(move);
    const override = descriptionOverrides[move.name];
    const useOverride = apiDescription === "資料庫目前未有此招式資料。" && override?.description;
    const names = localizedNames(move.names, move.name);
    if (override?.nameZhHant) names.zhHant = override.nameZhHant;
    if (override?.nameJa) names.ja = override.nameJa;
    const baseMove = {
      id: move.id, slug: move.name, name: names, kind: moveKind(move),
      type: move.type.name, damageClass: move.damage_class?.name || null,
      power: move.power, accuracy: move.accuracy, pp: move.pp, priority: move.priority,
      effectChance: move.effect_chance, generation: generationFromResource(move.generation), target: move.target?.name || null,
      description: useOverride ? override.description : apiDescription,
      descriptionSource: useOverride ? { name: "52Poké Wiki", url: override.sourceUrl, revisionId: override.revisionId } : { name: "PokéAPI", url: `${API}/move/${move.id}` },
      statChanges: move.stat_changes.map(entry => ({ stat: entry.stat.name, change: entry.change })),
      meta: move.meta ? { ailment: move.meta.ailment?.name, category: move.meta.category?.name, minHits: move.meta.min_hits, maxHits: move.meta.max_hits, minTurns: move.meta.min_turns, maxTurns: move.meta.max_turns, drain: move.meta.drain, healing: move.meta.healing, critRate: move.meta.crit_rate, ailmentChance: move.meta.ailment_chance, flinchChance: move.meta.flinch_chance, statChance: move.meta.stat_chance } : null,
      learnedByPokemon: move.learned_by_pokemon.map(pokemon => pokemon.name)
    };
    const champions = championsOverrides[move.name];
    if (!champions) return baseMove;
    const { learnedByPokemonAdditions = [], id, ...fields } = champions;
    return {
      ...baseMove,
      ...fields,
      descriptionSource: champions.description
        ? { name: "Pokémon Champions game data", url: championsData.source?.url, version: championsData.version, commit: championsData.source?.commit }
        : baseMove.descriptionSource,
      learnedByPokemon: [...new Set([...baseMove.learnedByPokemon, ...learnedByPokemonAdditions])].sort()
    };
  });
  const moves = [...apiMoves, ...(supplementalData.moves || [])].sort((a, b) => (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER) || a.slug.localeCompare(b.slug));
  await writeJson(join(DATA_DIR, "moves.json"), moves);
  return moves.length;
}

async function syncItems() {
  console.log("同步道具資料…");
  const refs = await list("item");
  const details = await mapLimit(refs, ref => fetchJson(ref.url), "道具");
  const usedSlugs = new Set();
  const items = details.sort((a, b) => a.id - b.id).map(item => {
    let slug = item.name;
    if (usedSlugs.has(slug)) slug = `${item.name}-${item.id}`;
    usedSlugs.add(slug);
    return ({
    id: item.id, slug, apiName: item.name, name: localizedNames(item.names, item.name),
    category: item.category?.name || null, attributes: item.attributes.map(attribute => attribute.name),
    cost: item.cost, flingPower: item.fling_power, flingEffect: item.fling_effect?.name || null,
    description: pickText(item.flavor_text_entries) || pickText(item.effect_entries),
    image: item.sprites?.default || null,
    heldByPokemon: item.held_by_pokemon.map(entry => entry.pokemon.name),
    babyTriggerForEvolutionChainId: item.baby_trigger_for ? idFromUrl(item.baby_trigger_for.url) : null,
    machines: item.machines.map(machine => ({ machineUrl: machine.machine.url, versionGroup: machine.version_group.name }))
  });
  });
  await writeJson(join(DATA_DIR, "items.json"), items);
  return items.length;
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
  const startedAt = new Date();
  let previousSummary = {};
  try {
    previousSummary = JSON.parse(await readFile(join(DATA_DIR, "metadata.json"), "utf8")).summary || {};
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const summary = { ...previousSummary };
  if (ONLY.has("core")) summary.core = await syncCore();
  if (ONLY.has("moves")) summary.moves = await syncMoves();
  if (ONLY.has("items")) summary.items = await syncItems();
  const metadata = { generatedAt: new Date().toISOString(), source: API, options: { concurrency: CONCURRENCY, refresh: REFRESH, cache: USE_CACHE, updatedGroups: [...ONLY] }, summary };
  await writeJson(join(DATA_DIR, "metadata.json"), metadata);
  console.log(`完成，耗時 ${Math.round((Date.now() - startedAt.getTime()) / 1000)} 秒。`);
  console.log(summary);
}

main().catch(error => {
  console.error("同步失敗：", error);
  process.exitCode = 1;
});
