const app = document.querySelector("#app");
const cardTemplate = document.querySelector("#card-template");

const state = {
  pokemon: [], chains: [], types: {}, abilities: {}, pokedexNumbers: {}, moves: null, championsRoster: null, query: "",
  type: new Set(), generation: new Set(), region: new Set(), form: new Set(), tag: new Set(),
  typeMode: "or", pokedex: "national", filtersOpen: false,
  moveQuery: "", moveType: new Set(), moveClass: new Set(), moveTarget: new Set(), moveKind: new Set(["normal"]),
  moveSortKey: "id", moveSortDirection: "asc", moveLimit: 100,
  championsOwned: loadChampionsOwned()
};

const DEX_ORDER = [
  "kanto", "letsgo-kanto", "original-johto", "updated-johto", "hoenn", "updated-hoenn",
  "original-sinnoh", "extended-sinnoh", "hisui", "original-unova", "updated-unova",
  "kalos-central", "kalos-coastal", "kalos-mountain", "lumiose-city",
  "original-alola", "original-melemele", "original-akala", "original-ulaula", "original-poni",
  "updated-alola", "updated-melemele", "updated-akala", "updated-ulaula", "updated-poni",
  "galar", "isle-of-armor", "crown-tundra", "paldea", "kitakami", "blueberry"
];

const STARTER_SPECIES_IDS = new Set([1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912]);
const PSEUDO_LEGENDARY_SPECIES_IDS = new Set([149, 248, 373, 376, 445, 635, 706, 784, 887, 998]);
const ULTRA_BEAST_SPECIES_IDS = new Set([793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]);
const PARADOX_SPECIES_IDS = new Set([984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1007, 1008, 1009, 1010, 1020, 1021, 1022, 1023]);
const REGION_OPTIONS = [
  { value: "kanto", label: "關都" }, { value: "johto", label: "城都" }, { value: "hoenn", label: "豐緣" },
  { value: "sinnoh", label: "神奧" }, { value: "unova", label: "合眾" }, { value: "kalos", label: "卡洛斯" },
  { value: "alola", label: "阿羅拉" }, { value: "galar", label: "伽勒爾" }, { value: "paldea", label: "帕底亞" }
];
const REGION_BY_GENERATION = { 1: "kanto", 2: "johto", 3: "hoenn", 4: "sinnoh", 5: "unova", 6: "kalos", 7: "alola", 8: "galar", 9: "paldea" };
const REGION_NAMES = Object.fromEntries(REGION_OPTIONS.map(region => [region.value, region.label]));

const FORM_LABELS = {
  normal: "一般型態", regional: "地區型態", mega: "超級進化",
  gmax: "超極巨化", primal: "原始回歸", battle: "戰鬥型態",
  cosmetic: "外觀型態", other: "特殊型態"
};
const STAT_LABELS = { hp: "HP", attack: "攻擊", defense: "防禦", specialAttack: "特攻", specialDefense: "特防", speed: "速度" };
const MOVE_CLASS_LABELS = { physical: "物理", special: "特殊", status: "變化" };
const MOVE_KIND_LABELS = { normal: "一般", z: "Z招式", max: "極巨招式", gmax: "超極巨招式" };
const MOVE_TARGET_LABELS = {
  "selected-pokemon": "選擇一體", "all-opponents": "對方全體", user: "自己", "random-opponent": "隨機一名對手",
  "users-field": "我方場地", "all-other-pokemon": "自己以外全體", "specific-move": "指定招式", "entire-field": "全場",
  "opponents-field": "對方場地", "all-pokemon": "場上全體", "user-and-allies": "自己與同伴", ally: "一名同伴",
  "user-or-ally": "自己或同伴", "selected-pokemon-me-first": "選擇一體", "all-allies": "我方全體", "fainting-pokemon": "瀕死的寶可夢"
};
const MOVE_META_LABELS = {
  damage: "傷害", ailment: "異常狀態", "net-good-stats": "能力提升", heal: "回復", "damage-ailment": "傷害＋異常狀態",
  "damage-lower": "傷害＋能力下降", "damage-raise": "傷害＋能力提升", "damage-heal": "傷害吸收", ohko: "一擊必殺",
  swagger: "能力變化＋混亂", "field-effect": "場地效果", "whole-field-effect": "全場效果", "force-switch": "強制替換", unique: "特殊效果"
};
const MOVE_AILMENT_LABELS = {
  none: "無", paralysis: "麻痺", sleep: "睡眠", freeze: "冰凍", burn: "灼傷", poison: "中毒",
  confusion: "混亂", infatuation: "著迷", trap: "束縛", nightmare: "惡夢", torment: "無理取鬧",
  disable: "定身法", yawn: "瞌睡", "heal-block": "回復封鎖", "no-type-immunity": "消除屬性免疫",
  "leech-seed": "寄生種子", unknown: "未知", protect: "守住", "perish-song": "滅亡之歌", ingrain: "扎根",
  embargo: "查封", silence: "沉默", "tar-shot": "瀝青射擊"
};
const MOVE_STAT_LABELS = { attack: "攻擊", defense: "防禦", "special-attack": "特攻", "special-defense": "特防", speed: "速度", accuracy: "命中", evasion: "閃避" };
const MOVE_EXTRA_TYPES = { shadow: { name: "暗影", color: "#59606d", dark: "#353b45" } };

function formatDex(number, digits = 4) { return `#${String(number).padStart(digits, "0")}`; }
function imageFor(id) { return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`; }
function shinyImageFor(id) { return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`; }
function artworkFor(mon) { return mon.image || imageFor(mon.speciesId); }
function shinyArtworkFor(mon) { return mon.shinyImage || shinyImageFor(mon.speciesId); }
function normalize(text) { return String(text).trim().toLocaleLowerCase("zh-Hant"); }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
function abilityKey(ability) { return normalize(ability.name.en).replaceAll(" ", "-"); }

function loadChampionsOwned() {
  try {
    const stored = JSON.parse(localStorage.getItem("pokedex.champions-owned.v1") || "[]");
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function saveChampionsOwned() {
  try { localStorage.setItem("pokedex.champions-owned.v1", JSON.stringify([...state.championsOwned])); }
  catch { /* The tracker still works for this page view when storage is unavailable. */ }
}

function typePill(type, mini = false) {
  const info = state.types[type] || MOVE_EXTRA_TYPES[type] || { name: type, color: "#777" };
  return `<span class="${mini ? "mini-type" : "type-pill"}" style="background:${info.color}">${info.name}</span>`;
}

function moveClassPill(damageClass) {
  if (!damageClass) return '<span class="move-class">—</span>';
  return `<span class="move-class move-class-${damageClass}">${MOVE_CLASS_LABELS[damageClass] || damageClass}</span>`;
}

function moveValue(value, suffix = "") {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}

function setActiveNav(page) {
  document.querySelectorAll(".header-nav a").forEach(link => link.classList.toggle("active", link.dataset.page === page));
}

function pokemonTags(mon) {
  return {
    baby: Boolean(mon.isBaby), legendary: Boolean(mon.isLegendary), mythical: Boolean(mon.isMythical),
    starter: mon.isStarter ?? STARTER_SPECIES_IDS.has(mon.speciesId),
    pseudo: mon.isPseudoLegendary ?? PSEUDO_LEGENDARY_SPECIES_IDS.has(mon.speciesId),
    ultraBeast: mon.isUltraBeast ?? ULTRA_BEAST_SPECIES_IDS.has(mon.speciesId),
    paradox: mon.isParadox ?? PARADOX_SPECIES_IDS.has(mon.speciesId)
  };
}

function pokemonRegion(mon) {
  return mon.region || REGION_BY_GENERATION[mon.speciesGeneration || mon.generation] || null;
}

function queryTermMatches(mon, rawTerm, regionalEntry, tags) {
  const term = normalize(rawTerm).replace(/^#/, "");
  if (!term) return true;
  const tagLabels = {
    baby: ["寶寶", "寶寶寶可夢"], legendary: ["傳說", "傳說寶可夢"], mythical: ["幻之", "幻之寶可夢"],
    starter: ["御三家", "最初的夥伴"], pseudo: ["600族", "大器晚成"],
    ultraBeast: ["究極異獸", "ultra beast"], paradox: ["悖謬", "悖謬寶可夢", "paradox"]
  };
  const region = pokemonRegion(mon);
  const searchableFields = [
    mon.name.zhHant, mon.name.en, mon.name.ja, mon.slug, mon.dexNumber, regionalEntry?.number,
    ...mon.types.flatMap(type => [type, state.types[type]?.name]),
    `gen ${mon.generation}`, `第${mon.generation}世代`, `${mon.generation}世代`,
    region, REGION_NAMES[region], mon.form.name, FORM_LABELS[mon.form.category], mon.form.category,
    ...Object.entries(tags).filter(([, active]) => active).flatMap(([tag]) => tagLabels[tag] || [])
  ];
  return searchableFields.some(value => normalize(value ?? "").includes(term));
}

function queryMatches(mon, regionalEntry, tags) {
  const query = state.query.trim().replaceAll("＆", "&").replaceAll("｜", "|");
  if (!query) return true;
  return query.split("|").filter(group => group.trim()).some(orGroup => {
    const terms = orGroup.split("&").filter(term => term.trim());
    return terms.length > 0 && terms.every(term => queryTermMatches(mon, term, regionalEntry, tags));
  });
}

function pokemonMatches(mon) {
  const regionalEntry = getRegionalDexEntry(mon);
  const tags = pokemonTags(mon);
  const selectedTypes = [...state.type];
  const matchesTypes = !selectedTypes.length || (state.typeMode === "and"
    ? selectedTypes.every(type => mon.types.includes(type))
    : selectedTypes.some(type => mon.types.includes(type)));
  return queryMatches(mon, regionalEntry, tags)
    && (state.pokedex === "national" || Boolean(regionalEntry))
    && matchesTypes
    && (!state.generation.size || state.generation.has(String(mon.generation)))
    && (!state.region.size || state.region.has(pokemonRegion(mon)))
    && (!state.form.size || state.form.has(mon.form.category))
    && (!state.tag.size || [...state.tag].some(tag => tags[tag]));
}

function getRegionalDexEntry(mon, pokedex = state.pokedex) {
  if (pokedex === "national") return null;
  return (state.pokedexNumbers[String(mon.speciesId)] || []).find(entry => entry.pokedex === pokedex) || null;
}

function getPokedexOptions() {
  const options = new Map();
  for (const entries of Object.values(state.pokedexNumbers)) {
    for (const entry of entries) {
      const current = options.get(entry.pokedex) || { value: entry.pokedex, label: entry.name };
      options.set(entry.pokedex, current);
    }
  }
  return [...options.values()].sort((a, b) => {
    const ai = DEX_ORDER.indexOf(a.value), bi = DEX_ORDER.indexOf(b.value);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.label.localeCompare(b.label, "zh-Hant");
  });
}

function cardClassificationTags(mon) {
  const tags = pokemonTags(mon);
  const formTag = mon.form.category === "mega" ? "超級進化"
    : mon.form.category === "gmax" ? "超極巨化"
    : mon.form.category === "primal" ? "原始回歸"
    : mon.form.category === "regional" ? (mon.form.name?.match(/^(阿羅拉|伽勒爾|洗翠|帕底亞)/)?.[1] || "地區型態")
    : null;
  return [
    formTag,
    tags.legendary && "傳說寶可夢", tags.mythical && "幻之寶可夢",
    tags.ultraBeast && "究極異獸", tags.paradox && "悖謬寶可夢"
  ].filter(Boolean);
}

function makeCard(mon) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  const button = node.querySelector(".card-link");
  const image = node.querySelector(".card-art");
  node.dataset.slug = mon.slug;
  node.classList.add(`form-${mon.form.category}`);
  button.setAttribute("aria-label", `查看 ${mon.name.zhHant} 的詳細資料`);
  const regionalEntry = getRegionalDexEntry(mon);
  node.querySelector(".card-number").textContent = formatDex(regionalEntry?.number ?? mon.dexNumber, regionalEntry ? 3 : 4);
  node.querySelector(".card-tags").innerHTML = cardClassificationTags(mon).map(tag => `<span class="card-tag">${tag}</span>`).join("");
  node.querySelector(".card-name").textContent = mon.name.zhHant;
  node.querySelector(".type-list").innerHTML = mon.types.map(type => typePill(type)).join("");
  image.src = artworkFor(mon);
  image.alt = mon.name.zhHant;
  image.addEventListener("error", () => { image.alt = `${mon.name.zhHant}（圖片暫時無法載入）`; image.style.opacity = ".18"; }, { once: true });
  return node;
}

function filterButtons(key, options) {
  return options.map(option => {
    const active = option.value === "all" ? state[key].size === 0 : state[key].has(option.value);
    return `<button type="button" class="filter-chip ${active ? "active" : ""}" data-value="${option.value}" aria-pressed="${active}">${option.label}</button>`;
  }).join("");
}
function activeFilterCount() { return state.type.size + state.generation.size + state.region.size + state.form.size + state.tag.size; }

function renderHome() {
  setActiveNav("pokedex");
  document.title = "Pokédex｜寶可夢圖鑑";
  const pokedexOptions = getPokedexOptions();
  app.innerHTML = `
    <section class="hero"><div class="hero-inner">
      <p class="eyebrow">National Pokédex</p>
      <h1>遇見每一種<br>獨一無二的寶可夢</h1>
      <p class="hero-copy">搜尋名稱或圖鑑編號，也可以依屬性、世代與型態快速找到牠們。</p>
    </div></section>
    <section class="search-panel" aria-label="圖鑑搜尋與篩選">
      <div class="search-area">
        <label class="search-box">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input id="pokemon-search" aria-label="搜尋寶可夢" type="search" value="${escapeHtml(state.query)}" placeholder="名稱、編號、屬性、地區或標籤…" autocomplete="off">
          <button class="clear-search" type="button" aria-label="清除搜尋" ${state.query ? "" : "hidden"}>×</button>
        </label>
      </div>
      <button class="filter-toggle" type="button" aria-expanded="${state.filtersOpen}">篩選${activeFilterCount() ? ` · ${activeFilterCount()}` : ""}</button>
      <div class="filters" ${state.filtersOpen ? "" : "hidden"}>
        <div class="filter-group type-filter"><div class="filter-heading"><span class="filter-label">屬性</span><div class="logic-toggle" aria-label="屬性篩選邏輯"><button type="button" data-type-mode="or" class="${state.typeMode === "or" ? "active" : ""}" aria-pressed="${state.typeMode === "or"}">OR 任一</button><button type="button" data-type-mode="and" class="${state.typeMode === "and" ? "active" : ""}" aria-pressed="${state.typeMode === "and"}">AND 全部</button></div></div><div class="filter-chips" data-filter="type">${filterButtons("type", [{ value: "all", label: "全部" }, ...Object.entries(state.types).map(([value, item]) => ({ value, label: item.name }))])}</div></div>
        <div class="filter-group"><span class="filter-label">世代</span><div class="filter-chips" data-filter="generation">${filterButtons("generation", [{ value: "all", label: "全部" }, ...[1,2,3,4,5,6,7,8,9].map(value => ({ value: String(value), label: `Gen ${value}` }))])}</div></div>
        <div class="filter-group"><span class="filter-label">首次登場地區</span><div class="filter-chips" data-filter="region">${filterButtons("region", [{ value: "all", label: "全部" }, ...REGION_OPTIONS])}</div></div>
        <div class="filter-group"><span class="filter-label">型態</span><div class="filter-chips" data-filter="form">${filterButtons("form", [{ value: "all", label: "全部" }, { value: "normal", label: "一般" }, { value: "mega", label: "超級進化" }, { value: "gmax", label: "超極巨化" }, { value: "regional", label: "地區型態" }, { value: "primal", label: "原始回歸" }, { value: "battle", label: "戰鬥型態" }, { value: "other", label: "特殊型態" }])}</div></div>
        <div class="filter-group"><span class="filter-label">分類標籤</span><div class="filter-chips" data-filter="tag">${filterButtons("tag", [{ value: "all", label: "全部" }, { value: "baby", label: "寶寶" }, { value: "legendary", label: "傳說" }, { value: "mythical", label: "幻之" }, { value: "ultraBeast", label: "究極異獸" }, { value: "paradox", label: "悖謬寶可夢" }, { value: "starter", label: "御三家" }, { value: "pseudo", label: "600族" }])}</div></div>
      </div>
      <div class="pokedex-picker">
        <div><span class="filter-label">各地區圖鑑</span><strong>依所選圖鑑的地區編號排列</strong></div>
        <label><span class="sr-only">選擇圖鑑</span><select id="pokedex-select">
          <option value="national" ${state.pokedex === "national" ? "selected" : ""}>全國圖鑑</option>
          ${pokedexOptions.map(option => `<option value="${option.value}" ${state.pokedex === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
        </select></label>
      </div>
    </section>
    <section class="catalog">
      <div class="catalog-heading"><h2>寶可夢一覽</h2><p class="result-count" aria-live="polite"></p></div>
      <div class="pokemon-grid"></div>
      <div class="empty-state" hidden><div><h3>沒有找到符合條件的寶可夢</h3><p>試著調整關鍵字或清除篩選條件。</p></div></div>
    </section>`;
  bindHomeEvents();
  renderGrid();
}

function bindHomeEvents() {
  const input = document.querySelector("#pokemon-search");
  const clear = document.querySelector(".clear-search");
  input.addEventListener("input", event => { state.query = event.target.value; clear.hidden = !state.query; renderGrid(); });
  clear.addEventListener("click", () => { state.query = ""; input.value = ""; clear.hidden = true; renderGrid(); input.focus(); });
  document.querySelector(".filter-toggle").addEventListener("click", event => {
    state.filtersOpen = !state.filtersOpen;
    event.currentTarget.setAttribute("aria-expanded", String(state.filtersOpen));
    document.querySelector(".filters").hidden = !state.filtersOpen;
  });
  document.querySelector(".filters").addEventListener("click", event => {
    const modeButton = event.target.closest("[data-type-mode]");
    if (modeButton) {
      state.typeMode = modeButton.dataset.typeMode;
      document.querySelectorAll("[data-type-mode]").forEach(item => {
        const active = item === modeButton;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      renderGrid();
      return;
    }
    const button = event.target.closest(".filter-chip");
    if (!button) return;
    const group = button.closest("[data-filter]");
    const key = group.dataset.filter;
    const value = button.dataset.value;
    if (value === "all") state[key].clear();
    else if (state[key].has(value)) state[key].delete(value);
    else state[key].add(value);
    group.querySelectorAll(".filter-chip").forEach(item => {
      const active = item.dataset.value === "all" ? state[key].size === 0 : state[key].has(item.dataset.value);
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    document.querySelector(".filter-toggle").textContent = `篩選${activeFilterCount() ? ` · ${activeFilterCount()}` : ""}`;
    renderGrid();
  });
  document.querySelector("#pokedex-select").addEventListener("change", event => {
    state.pokedex = event.target.value;
    renderGrid();
  });
  document.querySelector(".pokemon-grid").addEventListener("click", event => {
    const card = event.target.closest(".pokemon-card");
    if (card) location.hash = `#/pokemon/${card.dataset.slug}`;
  });
}

function renderGrid() {
  const grid = document.querySelector(".pokemon-grid");
  const empty = document.querySelector(".empty-state");
  const filtered = state.pokemon.filter(pokemonMatches);
  if (state.pokedex !== "national") {
    filtered.sort((a, b) => getRegionalDexEntry(a).number - getRegionalDexEntry(b).number);
  }
  const dexOption = getPokedexOptions().find(option => option.value === state.pokedex);
  const dexTotal = state.pokedex === "national" ? state.pokemon.length : state.pokemon.filter(mon => getRegionalDexEntry(mon)).length;
  grid.replaceChildren(...filtered.map(makeCard));
  grid.hidden = !filtered.length;
  empty.hidden = Boolean(filtered.length);
  document.querySelector(".catalog-heading h2").textContent = state.pokedex === "national" ? "寶可夢一覽" : `${dexOption?.label || "地區"}圖鑑`;
  document.querySelector(".result-count").textContent = `顯示 ${filtered.length}／${dexTotal} 筆`;
}

function calculateMatchups(defendingTypes) {
  return Object.fromEntries(Object.keys(state.types).map(attackingType => {
    const multiplier = defendingTypes.reduce((value, defendingType) => {
      const defense = state.types[defendingType].damageFrom;
      if (defense.immune.includes(attackingType)) return value * 0;
      if (defense.weak.includes(attackingType)) return value * 2;
      if (defense.resist.includes(attackingType)) return value * .5;
      return value;
    }, 1);
    return [attackingType, multiplier];
  }));
}

function matchupGroup(multiplier, matchups) {
  const types = Object.entries(matchups).filter(([, value]) => value === multiplier).map(([type]) => type);
  const label = multiplier === .5 ? "½×" : multiplier === .25 ? "¼×" : `${multiplier}×`;
  return `<div class="matchup-group"><span class="matchup-multiplier">${label}</span><div class="matchup-types">${types.length ? types.map(type => typePill(type, true)).join("") : "<small>無</small>"}</div></div>`;
}

function regionalFormRegionFromSlug(slug = "") {
  if (slug.endsWith("-alola") || slug === "marowak-totem" || slug.includes("-totem-alola")) return "alola";
  if (slug.includes("-galar")) return "galar";
  if (slug.includes("-hisui")) return "hisui";
  if (slug.includes("-paldea")) return "paldea";
  return null;
}

function evolutionDetailRegion(detail) {
  return detail.region?.name
    || regionalFormRegionFromSlug(detail.base_form?.name)
    || regionalFormRegionFromSlug(detail.evolved_form?.name)
    || null;
}

function evolutionMethodForDetail(detail, fallback) {
  if (!detail) return fallback || "進化";
  if (detail.min_level) return `等級 ${detail.min_level}`;
  if (detail.min_happiness) return "高親密度";
  if (detail.item) return "使用進化道具";
  if (detail.held_item) return detail.trigger?.name === "trade" ? "攜帶道具交換" : "攜帶指定道具";
  if (detail.trigger?.name === "trade") return "交換";
  return { shed: "脫殼", spin: "旋轉", "tower-of-darkness": "惡之塔", "tower-of-waters": "水之塔", "three-critical-hits": "單場命中要害三次", "take-damage": "達成指定傷害條件", other: "特殊條件" }[detail.trigger?.name] || fallback || "特殊條件";
}

function evolutionPokemon(nodeSlug, region, explicitSlug) {
  if (explicitSlug) {
    const explicit = state.pokemon.find(item => item.slug === explicitSlug);
    if (explicit) return explicit;
  }
  const defaultMon = state.pokemon.find(item => item.slug === nodeSlug && item.form.isDefault)
    || state.pokemon.find(item => item.slug === nodeSlug)
    || state.pokemon.find(item => item.form.isDefault && item.slug.startsWith(`${nodeSlug}-`));
  if (!region || !defaultMon) return defaultMon;
  return state.pokemon.find(item => item.speciesId === defaultMon.speciesId
    && item.form.category === "regional"
    && regionalFormRegionFromSlug(item.slug) === region
    && !item.slug.includes("totem")) || defaultMon;
}

function renderEvolutionChain(chain, currentMon) {
  const region = currentMon.form.category === "regional" ? regionalFormRegionFromSlug(currentMon.slug) : null;

  function renderNode(node, explicitSlug = null) {
    const mon = evolutionPokemon(node.slug, region, explicitSlug);
    if (!mon) return "";
    const candidates = node.evolvesTo.map(child => {
      const details = child.conditions || [];
      const matching = region ? details.filter(detail => evolutionDetailRegion(detail) === region) : [];
      const defaults = details.filter(detail => !evolutionDetailRegion(detail));
      return { child, matching, defaults };
    });
    const hasRegionalBranch = region && candidates.some(candidate => candidate.matching.length);
    const visibleChildren = candidates.filter(candidate => hasRegionalBranch ? candidate.matching.length : candidate.defaults.length || !candidate.child.conditions?.length);
    const branches = visibleChildren.map(({ child, matching, defaults }) => {
      const detail = (hasRegionalBranch ? matching : defaults)[0] || child.conditions?.[0];
      return `
      <div class="evolution-branch">
        <div class="evolution-arrow" aria-hidden="true">→<small>${escapeHtml(evolutionMethodForDetail(detail, child.method))}</small></div>
        ${renderNode(child, detail?.evolved_form?.name || null)}
      </div>`;
    }).join("");
    return `<div class="evolution-node">
      <button class="evolution-mon" type="button" data-slug="${mon.slug}"><img src="${artworkFor(mon)}" alt=""><strong>${mon.name.zhHant}</strong></button>
      ${branches ? `<div class="evolution-branches">${branches}</div>` : ""}
    </div>`;
  }

  return `<div class="evolution-tree">${renderNode(chain.root)}</div>`;
}

function renderDetail(slug) {
  const mon = state.pokemon.find(item => item.slug === slug);
  if (!mon) return renderNotFound();
  setActiveNav("pokedex");
  const primary = state.types[mon.types[0]];
  const chain = state.chains.find(item => item.id === mon.evolutionChainId);
  const related = state.pokemon.filter(item => item.speciesId === mon.speciesId);
  const tags = pokemonTags(mon);
  const specialTags = [
    tags.baby && "寶寶寶可夢", tags.legendary && "傳說寶可夢", tags.mythical && "幻之寶可夢",
    tags.ultraBeast && "究極異獸", tags.paradox && "悖謬寶可夢",
    tags.starter && "御三家", tags.pseudo && "600族"
  ].filter(Boolean);
  const regionalDexNumbers = state.pokedexNumbers[String(mon.speciesId)] || [];
  const statsTotal = Object.values(mon.stats).reduce((sum, value) => sum + value, 0);
  const matchups = calculateMatchups(mon.types);
  document.title = `${mon.name.zhHant}｜Pokédex`;
  app.innerHTML = `
    <article class="detail-page" style="--hero-color:${primary.color};--hero-dark:${primary.dark}">
      <header class="detail-hero">
        <div class="detail-topbar"><a class="back-button" href="#/">← 返回圖鑑</a></div>
        <div class="detail-hero-inner">
          <div class="detail-art-column">
            <img class="detail-art" src="${artworkFor(mon)}" alt="${mon.name.zhHant}">
            <div class="sprite-toggle" aria-label="圖片樣式">
              <button class="active" type="button" data-sprite="normal" aria-pressed="true">一般</button>
              <button type="button" data-sprite="shiny" aria-pressed="false">異色 ✦</button>
            </div>
          </div>
          <div>
            <p class="detail-number">${formatDex(mon.dexNumber)} · GENERATION ${mon.generation}</p>
            <h1 class="detail-name">${mon.name.zhHant}</h1>
            <p class="foreign-names">${mon.name.en} &nbsp;/&nbsp; ${mon.name.ja}</p>
            <div class="type-list detail-types">${mon.types.map(type => typePill(type)).join("")}</div>
            <div class="detail-meta">
              <span>${mon.form.name || FORM_LABELS[mon.form.category]}</span>
              <span>第 ${mon.generation} 世代</span>
              ${specialTags.map(tag => `<span class="special-tag">${tag}</span>`).join("")}
            </div>
          </div>
        </div>
      </header>
      <div class="detail-content">
        <section class="panel overview-grid">
          <div><h2 class="panel-title">特性</h2><div class="ability-list">${mon.abilities.map(ability => {
            const details = state.abilities[abilityKey(ability)];
            return `<article class="ability"><h3>${ability.name.zhHant}${ability.hidden ? "<small>隱藏特性</small>" : ""}</h3><p>${details?.description || "目前尚無中文說明。"}</p></article>`;
          }).join("")}</div></div>
          <div><h2 class="panel-title">六項種族值</h2><div class="stats-list">
            ${Object.entries(mon.stats).map(([name, value]) => `<div class="stat-row"><span class="stat-name">${STAT_LABELS[name]}</span><span class="stat-value">${value}</span><div class="stat-track"><div class="stat-fill" style="width:${Math.min(value / 180 * 100, 100)}%"></div></div></div>`).join("")}
            <div class="stat-total">總和　${statsTotal}</div></div></div>
        </section>
        <section class="panel">
          <h2 class="panel-title">地區圖鑑編號</h2>
          <div class="regional-dex-list">
            ${regionalDexNumbers.length ? regionalDexNumbers.map(entry => `<div class="regional-dex-item"><span>${entry.name}</span><strong>#${String(entry.number).padStart(3, "0")}</strong></div>`).join("") : "<p class=\"muted-copy\">沒有收錄於其他地區圖鑑。</p>"}
          </div>
        </section>
        <section class="panel"><h2 class="panel-title">屬性克制</h2><div class="matchup-groups">${[4, 2, .5, .25, 0].map(multiplier => matchupGroup(multiplier, matchups)).join("")}</div></section>
        ${chain ? `<section class="panel"><h2 class="panel-title">進化鏈</h2>${renderEvolutionChain(chain, mon)}</section>` : ""}
        <section class="panel"><h2 class="panel-title">相關型態</h2><div class="related-scroll"><div class="related-list">
          ${related.map(item => `<button class="related-card ${item.slug === mon.slug ? "current" : ""}" type="button" data-slug="${item.slug}"><img src="${artworkFor(item)}" alt=""><strong>${item.name.zhHant}</strong>${item.slug === mon.slug ? '<span class="current-tag">顯示中</span>' : ""}</button>`).join("")}
        </div></div></section>
      </div>
    </article>`;
  app.querySelectorAll("[data-slug]").forEach(button => button.addEventListener("click", () => { location.hash = `#/pokemon/${button.dataset.slug}`; }));
  const detailArt = app.querySelector(".detail-art");
  app.querySelector(".sprite-toggle").addEventListener("click", event => {
    const button = event.target.closest("[data-sprite]");
    if (!button) return;
    detailArt.src = button.dataset.sprite === "shiny" ? shinyArtworkFor(mon) : artworkFor(mon);
    detailArt.alt = `${mon.name.zhHant}${button.dataset.sprite === "shiny" ? "（異色）" : ""}`;
    app.querySelectorAll(".sprite-toggle button").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function moveMatches(move) {
  const query = normalize(state.moveQuery).replace(/^#/, "");
  const compactQuery = query.replaceAll(" ", "").replaceAll("～", "-").replaceAll("—", "-");
  const range = compactQuery.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  const comparison = compactQuery.match(/^(<=|>=|<|>)(\d+(?:\.\d+)?)$/);
  let queryMatches = null;
  if (range) {
    const low = Math.min(Number(range[1]), Number(range[2]));
    const high = Math.max(Number(range[1]), Number(range[2]));
    queryMatches = move.power !== null && move.power !== undefined && move.power >= low && move.power <= high;
  } else if (comparison) {
    const limit = Number(comparison[2]);
    queryMatches = move.power !== null && move.power !== undefined && ({ "<=": move.power <= limit, ">=": move.power >= limit, "<": move.power < limit, ">": move.power > limit })[comparison[1]];
  }
  const fields = [move.id, move.slug, move.name.zhHant, move.name.en, move.name.ja, move.description];
  return (queryMatches ?? (!query || fields.some(value => normalize(value ?? "").includes(query))))
    && (!state.moveType.size || state.moveType.has(move.type))
    && (!state.moveClass.size || state.moveClass.has(move.damageClass))
    && (!state.moveTarget.size || state.moveTarget.has(move.target))
    && (!state.moveKind.size || state.moveKind.has(move.kind || "normal"));
}

function sortMoves(moves) {
  const valueFor = move => ({
    id: move.id, name: move.name.zhHant, type: state.types[move.type]?.name || MOVE_EXTRA_TYPES[move.type]?.name || move.type,
    damageClass: MOVE_CLASS_LABELS[move.damageClass] || move.damageClass, power: move.power, accuracy: move.accuracy,
    pp: move.pp, priority: move.priority, target: MOVE_TARGET_LABELS[move.target] || move.target || "—", description: displayMoveDescription(move)
  })[state.moveSortKey];
  const direction = state.moveSortDirection === "asc" ? 1 : -1;
  return [...moves].sort((a, b) => {
    const av = valueFor(a), bv = valueFor(b);
    if (av === null || av === undefined) return bv === null || bv === undefined ? a.id - b.id : 1;
    if (bv === null || bv === undefined) return -1;
    const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "zh-Hant");
    return result * direction || a.id - b.id;
  });
}

function displayMoveDescription(move) {
  const description = move.description || "資料庫目前未有此招式資料。";
  return /無法使用(?:此|這個)招式|建議忘記(?:此|這個)招式|不能使用的招式/.test(description)
    ? "資料庫目前未有此招式資料。"
    : description;
}

function moveSortHeader(key, label) {
  const active = state.moveSortKey === key;
  const arrow = active ? (state.moveSortDirection === "asc" ? "↑" : "↓") : "↕";
  const ariaSort = active ? (state.moveSortDirection === "asc" ? "ascending" : "descending") : "none";
  return `<th aria-sort="${ariaSort}"><button type="button" data-move-sort-key="${key}">${label}<span aria-hidden="true">${arrow}</span></button></th>`;
}

function moveLearners(move) {
  const pokemonBySlug = new Map(state.pokemon.map(mon => [mon.slug, mon]));
  const seenSpecies = new Set();
  return move.learnedByPokemon.map(slug => pokemonBySlug.get(slug)).filter(mon => {
    if (!mon || seenSpecies.has(mon.speciesId)) return false;
    seenSpecies.add(mon.speciesId);
    return true;
  });
}

function moveFactsHtml(move) {
  const facts = [
    ["首次登場", `第 ${move.generation} 世代`], ["作用對象", MOVE_TARGET_LABELS[move.target] || move.target || "—"],
    ["優先度", move.priority > 0 ? `+${move.priority}` : move.priority],
    ["效果分類", MOVE_META_LABELS[move.meta?.category] || move.meta?.category || "—"]
  ];
  if (move.effectChance !== null && ![move.meta?.ailmentChance, move.meta?.flinchChance, move.meta?.statChance].some(chance => chance > 0)) facts.push(["效果機率", `${move.effectChance}%`]);
  if (move.meta?.ailment && move.meta.ailment !== "none") facts.push(["異常狀態", MOVE_AILMENT_LABELS[move.meta.ailment] || move.meta.ailment]);
  if (move.meta?.minHits || move.meta?.maxHits) facts.push(["連續次數", `${move.meta.minHits ?? move.meta.maxHits}～${move.meta.maxHits ?? move.meta.minHits} 次`]);
  if (move.meta?.minTurns || move.meta?.maxTurns) facts.push(["持續回合", `${move.meta.minTurns ?? move.meta.maxTurns}～${move.meta.maxTurns ?? move.meta.minTurns} 回合`]);
  if (move.meta?.drain > 0) facts.push(["吸取比例", `${move.meta.drain}%`]);
  if (move.meta?.drain < 0) facts.push(["反作用力", `${Math.abs(move.meta.drain)}%`]);
  if (move.meta?.healing > 0) facts.push(["回復比例", `${move.meta.healing}%`]);
  if (move.meta?.critRate > 0) facts.push(["要害等級", `+${move.meta.critRate}`]);
  if (move.meta?.ailmentChance > 0) facts.push(["異常機率", `${move.meta.ailmentChance}%`]);
  if (move.meta?.flinchChance > 0) facts.push(["畏縮機率", `${move.meta.flinchChance}%`]);
  const statChanges = move.statChanges.map(change => `${MOVE_STAT_LABELS[change.stat] || change.stat} ${change.change > 0 ? "+" : ""}${change.change}`).join("、");
  if (statChanges) facts.push(["能力變化", statChanges]);
  return `<div class="move-facts">${facts.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>`;
}

function moveRowHtml(move) {
  return `<tr class="move-row" data-move-key="${escapeHtml(move.slug)}" tabindex="0" aria-label="查看${escapeHtml(move.name.zhHant)}詳細資料">
    <td class="move-id">${move.id === null || move.id === undefined ? "—" : `#${String(move.id).padStart(3, "0")}`}</td>
    <td class="move-name-cell"><strong>${escapeHtml(move.name.zhHant)}</strong><small>${escapeHtml(move.name.en)}</small></td>
    <td>${typePill(move.type, true)}</td><td>${moveClassPill(move.damageClass)}</td>
    <td class="move-number">${moveValue(move.power)}</td><td class="move-number">${moveValue(move.accuracy)}</td><td class="move-number">${moveValue(move.pp)}</td><td class="move-number">${move.priority > 0 ? `+${move.priority}` : move.priority}</td>
    <td class="move-target">${escapeHtml(MOVE_TARGET_LABELS[move.target] || move.target || "—")}</td>
    <td class="move-effect">${escapeHtml(displayMoveDescription(move))}</td>
  </tr>`;
}

function renderMoveTable() {
  const filtered = sortMoves(state.moves.filter(moveMatches));
  const visible = filtered.slice(0, state.moveLimit);
  document.querySelectorAll("[data-move-sort-key]").forEach(button => {
    const active = button.dataset.moveSortKey === state.moveSortKey;
    button.querySelector("span").textContent = active ? (state.moveSortDirection === "asc" ? "↑" : "↓") : "↕";
    button.closest("th").setAttribute("aria-sort", active ? (state.moveSortDirection === "asc" ? "ascending" : "descending") : "none");
  });
  document.querySelector(".move-result-count").textContent = `顯示 ${visible.length}／${filtered.length} 個招式`;
  document.querySelector(".move-table-body").innerHTML = visible.map(moveRowHtml).join("");
  const more = document.querySelector(".move-more");
  more.hidden = visible.length >= filtered.length;
  more.textContent = `顯示更多（剩餘 ${Math.max(filtered.length - visible.length, 0)}）`;
  document.querySelector(".move-empty").hidden = Boolean(filtered.length);
  document.querySelector(".move-table-shell").hidden = !filtered.length;
}

function renderMovesPage() {
  setActiveNav("moves");
  document.title = "招式一覽｜Pokédex";
  const moveTargets = [...new Set(state.moves.map(move => move.target).filter(Boolean))]
    .sort((a, b) => (MOVE_TARGET_LABELS[a] || a).localeCompare(MOVE_TARGET_LABELS[b] || b, "zh-Hant"));
  app.innerHTML = `
    <section class="moves-hero"><div><p class="eyebrow">MOVE DATABASE</p><h1>招式一覽</h1><p>搜尋並比較所有世代的招式資料。</p></div></section>
    <section class="move-browser">
      <div class="move-toolbar">
        <label class="move-search"><span aria-hidden="true">⌕</span><input type="search" value="${escapeHtml(state.moveQuery)}" placeholder="搜尋名稱、編號或威力區間，例如 50-100、>=100…" aria-label="搜尋招式"><button type="button" aria-label="清除招式搜尋" ${state.moveQuery ? "" : "hidden"}>×</button></label>
      </div>
      <div class="move-filters">
        <div class="filter-group move-type-filter"><span class="filter-label">屬性</span><div class="filter-chips" data-move-filter="moveType">${filterButtons("moveType", [{ value: "all", label: "全部" }, ...Object.entries({ ...state.types, ...MOVE_EXTRA_TYPES }).map(([value, item]) => ({ value, label: item.name }))])}</div></div>
        <div class="filter-group"><span class="filter-label">分類</span><div class="filter-chips" data-move-filter="moveClass">${filterButtons("moveClass", [{ value: "all", label: "全部" }, ...Object.entries(MOVE_CLASS_LABELS).map(([value, label]) => ({ value, label }))])}</div></div>
        <div class="filter-group"><span class="filter-label">作用對象</span><div class="filter-chips" data-move-filter="moveTarget">${filterButtons("moveTarget", [{ value: "all", label: "全部" }, ...moveTargets.map(value => ({ value, label: MOVE_TARGET_LABELS[value] || value }))])}</div></div>
        <div class="filter-group"><span class="filter-label">招式種類</span><div class="filter-chips" data-move-filter="moveKind">${filterButtons("moveKind", [{ value: "all", label: "全部" }, ...Object.entries(MOVE_KIND_LABELS).map(([value, label]) => ({ value, label }))])}</div></div>
      </div>
      <div class="move-result-bar"><strong>招式資料</strong><span class="move-result-count"></span></div>
      <div class="move-table-shell"><table class="move-table"><thead><tr>${moveSortHeader("id", "編號")}${moveSortHeader("name", "招式名")}${moveSortHeader("type", "屬性")}${moveSortHeader("damageClass", "分類")}${moveSortHeader("power", "威力")}${moveSortHeader("accuracy", "命中")}${moveSortHeader("pp", "PP")}${moveSortHeader("priority", "優先度")}${moveSortHeader("target", "作用對象")}${moveSortHeader("description", "效果")}</tr></thead><tbody class="move-table-body"></tbody></table></div>
      <div class="move-empty" hidden><h2>找不到符合條件的招式</h2><p>請調整關鍵字或篩選條件。</p></div>
      <button class="move-more" type="button" hidden></button>
    </section>`;
  bindMoveEvents();
  renderMoveTable();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function bindMoveEvents() {
  const search = document.querySelector(".move-search input");
  const clear = document.querySelector(".move-search button");
  search.addEventListener("input", event => { state.moveQuery = event.target.value; state.moveLimit = 100; clear.hidden = !state.moveQuery; renderMoveTable(); });
  clear.addEventListener("click", () => { state.moveQuery = ""; search.value = ""; clear.hidden = true; state.moveLimit = 100; renderMoveTable(); search.focus(); });
  document.querySelector(".move-filters").addEventListener("click", event => {
    const button = event.target.closest(".filter-chip");
    if (!button) return;
    const group = button.closest("[data-move-filter]");
    const key = group.dataset.moveFilter;
    const value = button.dataset.value;
    if (value === "all") state[key].clear();
    else if (state[key].has(value)) state[key].delete(value);
    else state[key].add(value);
    group.querySelectorAll(".filter-chip").forEach(item => {
      const active = item.dataset.value === "all" ? state[key].size === 0 : state[key].has(item.dataset.value);
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    state.moveLimit = 100;
    renderMoveTable();
  });
  document.querySelector(".move-table-shell").addEventListener("click", event => {
    const sortButton = event.target.closest("[data-move-sort-key]");
    if (sortButton) {
      const key = sortButton.dataset.moveSortKey;
      if (state.moveSortKey === key) state.moveSortDirection = state.moveSortDirection === "asc" ? "desc" : "asc";
      else { state.moveSortKey = key; state.moveSortDirection = "asc"; }
      renderMoveTable();
      return;
    }
    const row = event.target.closest("[data-move-key]");
    if (row) location.hash = `#/moves/${encodeURIComponent(row.dataset.moveKey)}`;
  });
  document.querySelector(".move-table-shell").addEventListener("keydown", event => {
    const row = event.target.closest("[data-move-key]");
    if (row && ["Enter", " "].includes(event.key)) { event.preventDefault(); location.hash = `#/moves/${encodeURIComponent(row.dataset.moveKey)}`; }
  });
  document.querySelector(".move-more").addEventListener("click", () => { state.moveLimit += 100; renderMoveTable(); });
}

function renderMoveDetailPage(key) {
  const move = state.moves.find(item => item.slug === key || String(item.id) === key);
  if (!move) return renderMoveNotFound();
  setActiveNav("moves");
  document.title = `${move.name.zhHant}｜招式一覽`;
  const type = state.types[move.type] || MOVE_EXTRA_TYPES[move.type] || { name: move.type, color: "#59606d", dark: "#353b45" };
  const learners = moveLearners(move);
  const learnerCards = learners.map(mon => `<a class="move-pokemon-card" href="#/pokemon/${encodeURIComponent(mon.slug)}">
    <img loading="lazy" src="${artworkFor(mon)}" alt=""><div><strong>${escapeHtml(mon.name.zhHant)}</strong><span>${mon.types.map(monType => state.types[monType]?.name || monType).join("／")}</span></div>
  </a>`).join("");
  app.innerHTML = `<article class="move-detail-page" style="--move-color:${type.color};--move-dark:${type.dark}">
    <header class="move-detail-hero"><div class="move-detail-hero-inner">
      <a class="back-button" href="#/moves">← 返回招式一覽</a>
      <p class="move-detail-number">${move.id === null || move.id === undefined ? "SPECIAL MOVE" : `MOVE #${String(move.id).padStart(3, "0")}`} · GENERATION ${move.generation}</p>
      <h1>${escapeHtml(move.name.zhHant)}</h1><p class="move-foreign-names">${escapeHtml(move.name.en)} &nbsp;/&nbsp; ${escapeHtml(move.name.ja)}</p>
      <div class="move-detail-labels">${typePill(move.type)}${moveClassPill(move.damageClass)}<span class="move-kind">${MOVE_KIND_LABELS[move.kind || "normal"]}</span></div>
      <div class="move-primary-stats"><div><span>威力</span><strong>${moveValue(move.power)}</strong></div><div><span>命中</span><strong>${moveValue(move.accuracy)}</strong></div><div><span>PP</span><strong>${moveValue(move.pp)}</strong></div></div>
    </div></header>
    <div class="move-detail-content">
      <section class="panel"><h2 class="panel-title">招式效果</h2><p class="move-detail-description">${escapeHtml(displayMoveDescription(move))}</p></section>
      <section class="panel"><h2 class="panel-title">詳細資料</h2>${moveFactsHtml(move)}</section>
      <section class="panel move-pokemon-panel"><div class="move-pokemon-heading"><div><h2 class="panel-title">可學會的寶可夢</h2><p>歷代遊戲資料彙整，共 ${learners.length} 種物種。</p></div><strong>${learners.length}</strong></div>
        ${learnerCards ? `<div class="move-pokemon-grid">${learnerCards}</div>` : '<p class="muted-copy">資料庫目前沒有提供可學會此招式的寶可夢。</p>'}
      </section>
    </div>
  </article>`;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderMoveNotFound() {
  setActiveNav("moves");
  document.title = "找不到招式｜Pokédex";
  app.innerHTML = `<section class="error-state"><div><h2>找不到這個招式</h2><p>這筆招式資料可能尚未收錄，或網址有誤。</p><a class="back-button" style="color:var(--ink);border-color:var(--line)" href="#/moves">← 返回招式一覽</a></div></section>`;
}

function renderNotFound() {
  setActiveNav("pokedex");
  document.title = "找不到寶可夢｜Pokédex";
  app.innerHTML = `<section class="error-state"><div><h2>找不到這隻寶可夢</h2><p>這筆資料可能尚未收錄，或網址有誤。</p><a class="back-button" style="color:var(--ink);border-color:var(--line)" href="#/">← 返回圖鑑</a></div></section>`;
}

async function ensureMoves() {
  if (state.moves) return;
  const response = await fetch("data/moves.json");
  if (!response.ok) throw new Error("招式資料檔讀取失敗");
  state.moves = await response.json();
}

async function ensureChampionsRoster() {
  if (state.championsRoster) return;
  const response = await fetch("data/champions-roster.json");
  if (!response.ok) throw new Error("Champions 名單讀取失敗");
  state.championsRoster = await response.json();
}

function championsCardHtml(mon, index) {
  const owned = state.championsOwned.has(mon.key);
  return `<article class="champions-card${owned ? " owned" : ""}">
    <a class="champions-card-link" href="#/pokemon/${encodeURIComponent(mon.slug)}" aria-label="查看${escapeHtml(mon.name)}的圖鑑資料">
      <span class="champions-number">#${index + 1}</span>
      <img loading="lazy" src="${escapeHtml(mon.image)}" data-fallback-src="${escapeHtml(mon.fallbackImage)}" alt="">
      <strong>${escapeHtml(mon.name)}</strong>
    </a>
    <button class="champions-check" type="button" data-champions-key="${escapeHtml(mon.key)}" aria-pressed="${owned}" aria-label="${escapeHtml(mon.name)}，${owned ? "已擁有" : "未擁有"}">✓</button>
  </article>`;
}

function updateChampionsProgress() {
  const rosterKeys = new Set(state.championsRoster.pokemon.map(mon => mon.key));
  const owned = [...state.championsOwned].filter(key => rosterKeys.has(key)).length;
  const total = state.championsRoster.pokemon.length;
  const percent = total ? owned / total * 100 : 0;
  document.querySelector(".champions-owned-count").textContent = `${owned}／${total}`;
  document.querySelector(".champions-progress-bar span").style.width = `${percent}%`;
  document.querySelector(".champions-progress").setAttribute("aria-valuenow", String(owned));
}

function renderChampionsPage() {
  setActiveNav("champions");
  document.title = "Champions 收藏紀錄｜Pokédex";
  const roster = state.championsRoster.pokemon;
  const ruleset = state.championsRoster.ruleset || "M-C";
  const version = state.championsRoster.version || "1.2.0";
  app.innerHTML = `
    <section class="champions-hero"><div class="champions-hero-heading">
      <div>
        <p class="eyebrow">MY CHAMPIONS COLLECTION</p>
        <h1>Champions 收藏紀錄</h1>
        <p>點擊右上角圓圈記錄擁有狀態；點擊卡片可查看圖鑑資料。</p>
      </div>
      <div class="champions-regulation" aria-label="賽制 ${escapeHtml(ruleset)}，版本 ${escapeHtml(version)}">
        <strong>賽制：${escapeHtml(ruleset)}</strong>
        <small>Ver ${escapeHtml(version)}</small>
      </div>
    </div></section>
    <section class="champions-catalog">
      <div class="champions-summary">
        <div><span>已擁有</span><strong class="champions-owned-count">0／${roster.length}</strong></div>
        <div class="champions-progress" role="progressbar" aria-label="Champions 收藏進度" aria-valuemin="0" aria-valuemax="${roster.length}" aria-valuenow="0"><div class="champions-progress-bar"><span></span></div></div>
      </div>
      <div class="champions-grid">${roster.map(championsCardHtml).join("")}</div>
      <p class="champions-source">可用名單與 Champions 圖示來自 <a href="https://wiki.52poke.com/wiki/宝可梦列表（Champions）" target="_blank" rel="noreferrer">52Poké Champions 寶可夢列表</a>，並以 <a href="https://github.com/projectpokemon/champout" target="_blank" rel="noreferrer">Project Pokémon champout</a> 核對版本；圖片無法載入時會自動改用 PokéAPI 圖鑑圖片。</p>
    </section>`;

  const grid = document.querySelector(".champions-grid");
  grid.addEventListener("click", event => {
    const toggle = event.target.closest("[data-champions-key]");
    if (!toggle) return;
    const card = toggle.closest(".champions-card");
    const key = toggle.dataset.championsKey;
    const owned = !state.championsOwned.has(key);
    if (owned) state.championsOwned.add(key); else state.championsOwned.delete(key);
    card.classList.toggle("owned", owned);
    toggle.setAttribute("aria-pressed", String(owned));
    const mon = roster.find(item => item.key === key);
    toggle.setAttribute("aria-label", `${mon?.name || "寶可夢"}，${owned ? "已擁有" : "未擁有"}`);
    saveChampionsOwned();
    updateChampionsProgress();
  });
  grid.querySelectorAll("img[data-fallback-src]").forEach(image => {
    image.addEventListener("error", () => {
      if (image.src === image.dataset.fallbackSrc) return;
      image.src = image.dataset.fallbackSrc;
    });
  });
  updateChampionsProgress();
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function route() {
  if (location.hash === "#/champions") {
    const requestedHash = location.hash;
    setActiveNav("champions");
    app.innerHTML = `<section class="loading-state" aria-live="polite"><span class="loading-ball"></span><p>正在載入 Champions 名單…</p></section>`;
    try {
      await ensureChampionsRoster();
      if (location.hash === requestedHash) renderChampionsPage();
    } catch (error) {
      console.error(error);
      app.innerHTML = `<section class="error-state"><div><h2>無法載入 Champions 名單</h2><p>請確認 <code>data/champions-roster.json</code> 存在並透過本機伺服器開啟網站。</p></div></section>`;
    }
    return;
  }
  const moveMatch = location.hash.match(/^#\/moves\/([^/]+)$/);
  if (location.hash === "#/moves" || moveMatch) {
    const requestedHash = location.hash;
    setActiveNav("moves");
    app.innerHTML = `<section class="loading-state" aria-live="polite"><span class="loading-ball"></span><p>正在載入招式資料…</p></section>`;
    try {
      await ensureMoves();
      if (location.hash !== requestedHash) return;
      if (moveMatch) renderMoveDetailPage(decodeURIComponent(moveMatch[1]));
      else renderMovesPage();
    } catch (error) {
      console.error(error);
      app.innerHTML = `<section class="error-state"><div><h2>無法載入招式資料</h2><p>請確認 <code>data/moves.json</code> 存在並透過本機伺服器開啟網站。</p></div></section>`;
    }
    return;
  }
  const match = location.hash.match(/^#\/pokemon\/([^/]+)$/);
  if (match) renderDetail(decodeURIComponent(match[1])); else renderHome();
}

async function init() {
  try {
    const responses = await Promise.all([fetch("data/pokemon.json"), fetch("data/evolution-chains.json"), fetch("data/types.json"), fetch("data/abilities.json"), fetch("data/pokedex-numbers.json")]);
    if (!responses.every(response => response.ok)) throw new Error("資料檔讀取失敗");
    [state.pokemon, state.chains, state.types, state.abilities, state.pokedexNumbers] = await Promise.all(responses.map(response => response.json()));
    await route();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="error-state"><div><h2>無法載入圖鑑資料</h2><p>請透過本機伺服器開啟網站，例如執行 <code>python -m http.server</code>。</p></div></section>`;
  }
}

window.addEventListener("hashchange", () => { void route(); });
void init();
