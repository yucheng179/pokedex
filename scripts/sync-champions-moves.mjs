import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, "data");
const REPOSITORY = "projectpokemon/champout";
const RAW_ROOT = `https://raw.githubusercontent.com/${REPOSITORY}/main`;
const SOURCE_URL = `https://github.com/${REPOSITORY}`;
const FILES = {
  moves: "masterdata/waza.json",
  learnsets: "masterdata/waza_learn.json",
  descriptions: "rom-txt/tch/wazainfo_syn.json"
};

// Champions target codes, verified against the moves that share PokeAPI IDs.
const TARGETS = {
  0: "selected-pokemon",
  1: "user-or-ally",
  2: "ally",
  3: "selected-pokemon",
  4: "all-other-pokemon",
  5: "all-opponents",
  6: "user-and-allies",
  7: "user",
  8: "all-pokemon",
  9: "random-opponent",
  10: "entire-field",
  11: "opponents-field",
  12: "users-field",
  13: "specific-move",
  14: "all-allies"
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "local-pokedex-data-sync/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function readJson(name) {
  return JSON.parse(await readFile(join(DATA_DIR, name), "utf8"));
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

function cleanText(value) {
  return String(value || "").replace(/[\n\f]+/g, " ").replace(/\s+/g, " ").trim();
}

function nullableNumber(value, { variablePower = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0 || (variablePower && number === 1)) return null;
  return number;
}

function nullableAccuracy(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 100 ? number : null;
}

function speciesIdFromChampionsId(id) {
  return Number(String(id).padStart(7, "0").slice(0, 4));
}

async function main() {
  console.log("取得 Pokémon Champions 招式資料…");
  const [championMoves, championLearnsets, textData, pokemon, currentMoves, commits] = await Promise.all([
    fetchJson(`${RAW_ROOT}/${FILES.moves}`),
    fetchJson(`${RAW_ROOT}/${FILES.learnsets}`),
    fetchJson(`${RAW_ROOT}/${FILES.descriptions}`),
    readJson("pokemon.json"),
    readJson("moves.json"),
    fetchJson(`https://api.github.com/repos/${REPOSITORY}/commits?path=${FILES.moves}&per_page=1`)
  ]);

  const currentById = new Map(currentMoves.filter(move => move.id !== null).map(move => [move.id, move]));
  const defaultPokemonBySpecies = new Map();
  for (const mon of pokemon) {
    if (!defaultPokemonBySpecies.has(mon.speciesId) || mon.form?.isDefault) defaultPokemonBySpecies.set(mon.speciesId, mon.slug);
  }

  const descriptions = new Map(textData.mSDataSet.map(entry => [entry.LabelName, cleanText(entry.OriginalText)]));
  const learnersByMoveId = new Map();
  for (const entry of championLearnsets) {
    const slug = defaultPokemonBySpecies.get(speciesIdFromChampionsId(entry.id));
    if (!slug) continue;
    for (const moveId of String(entry.waza || "").split(",").map(Number).filter(Boolean)) {
      if (!learnersByMoveId.has(moveId)) learnersByMoveId.set(moveId, new Set());
      learnersByMoveId.get(moveId).add(slug);
    }
  }

  const overrides = {};
  for (const row of championMoves) {
    if (row.available !== "1") continue;
    const id = Number(row.id);
    const current = currentById.get(id);
    if (!current) continue;
    const description = descriptions.get(row.ms_lbl_info);
    overrides[current.slug] = {
      id,
      power: nullableNumber(row.power, { variablePower: true }),
      accuracy: nullableAccuracy(row.accuracy),
      pp: Number(row.pp),
      priority: Number(row.priority),
      target: TARGETS[row.target] || current.target,
      ...(description ? { description } : {}),
      learnedByPokemonAdditions: [...(learnersByMoveId.get(id) || [])].sort()
    };
  }

  const commit = commits[0];
  const version = commit?.commit?.message?.match(/v(\d+(?:\.\d+)+)/i)?.[1] || null;
  const output = {
    generatedAt: new Date().toISOString(),
    game: "Pokémon Champions",
    version,
    source: {
      name: "Project Pokémon champout",
      url: SOURCE_URL,
      commit: commit?.sha || null,
      committedAt: commit?.commit?.author?.date || null,
      files: FILES,
      corroboratedBy: [
        "https://wiki.52poke.com/zh-hant/招式列表（Champions）",
        "https://championsbattledata.com/moves/",
        "https://www.reddit.com/r/stunfisk/comments/1u82vna/some_movepool_changes_in_champions_version_11/"
      ]
    },
    policy: "Only available Champions moves override current move fields; learnsets are additive and never remove historical learners.",
    moves: overrides
  };
  await writeJson("champions-move-overrides.json", output);

  const merged = currentMoves.map(move => {
    const override = overrides[move.slug];
    if (!override) return move;
    const { learnedByPokemonAdditions, id, ...fields } = override;
    return {
      ...move,
      ...fields,
      descriptionSource: { name: "Pokémon Champions game data", url: SOURCE_URL, version, commit: commit?.sha || null },
      learnedByPokemon: [...new Set([...(move.learnedByPokemon || []), ...learnedByPokemonAdditions])].sort()
    };
  });
  await writeJson("moves.json", merged);

  const relations = Object.values(overrides).reduce((sum, move) => sum + move.learnedByPokemonAdditions.length, 0);
  console.log(`完成：Champions v${version || "unknown"}，${Object.keys(overrides).length} 個可用招式，歷代聯集已納入 ${relations} 筆 Champions 學習關係。`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
