const app = document.querySelector("#app");
const cardTemplate = document.querySelector("#card-template");

const state = {
  pokemon: [], chains: [], types: {}, abilities: {}, pokedexNumbers: {}, query: "",
  type: new Set(), generation: new Set(), region: new Set(), form: new Set(), tag: new Set(),
  typeMode: "or", pokedex: "national", filtersOpen: false
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

function formatDex(number, digits = 4) { return `#${String(number).padStart(digits, "0")}`; }
function imageFor(id) { return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`; }
function shinyImageFor(id) { return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`; }
function artworkFor(mon) { return mon.image || imageFor(mon.speciesId); }
function shinyArtworkFor(mon) { return mon.shinyImage || shinyImageFor(mon.speciesId); }
function normalize(text) { return String(text).trim().toLocaleLowerCase("zh-Hant"); }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
function abilityKey(ability) { return normalize(ability.name.en).replaceAll(" ", "-"); }

function typePill(type, mini = false) {
  const info = state.types[type] || { name: type, color: "#777" };
  return `<span class="${mini ? "mini-type" : "type-pill"}" style="background:${info.color}">${info.name}</span>`;
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
        <div class="filter-group"><span class="filter-label">型態</span><div class="filter-chips" data-filter="form">${filterButtons("form", [{ value: "all", label: "全部" }, { value: "normal", label: "一般" }, { value: "mega", label: "超級進化" }, { value: "gmax", label: "超極巨化" }, { value: "regional", label: "地區" }, { value: "primal", label: "原始回歸" }, { value: "battle", label: "戰鬥型態" }, { value: "other", label: "特殊型態" }])}</div></div>
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

function renderEvolutionChain(chain) {
  return `<div class="evolution-line">${chain.members.map((member, index) => {
    const mon = state.pokemon.find(item => item.slug === member.slug);
    if (!mon) return "";
    const arrow = index ? `<div class="evolution-arrow">→<small>${member.method}</small></div>` : "";
    return `${arrow}<button class="evolution-mon" type="button" data-slug="${mon.slug}"><img src="${artworkFor(mon)}" alt=""><strong>${mon.name.zhHant}</strong></button>`;
  }).join("")}</div>`;
}

function renderDetail(slug) {
  const mon = state.pokemon.find(item => item.slug === slug);
  if (!mon) return renderNotFound();
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
        ${chain ? `<section class="panel"><h2 class="panel-title">進化鏈</h2>${renderEvolutionChain(chain)}</section>` : ""}
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

function renderNotFound() {
  document.title = "找不到寶可夢｜Pokédex";
  app.innerHTML = `<section class="error-state"><div><h2>找不到這隻寶可夢</h2><p>這筆資料可能尚未收錄，或網址有誤。</p><a class="back-button" style="color:var(--ink);border-color:var(--line)" href="#/">← 返回圖鑑</a></div></section>`;
}

function route() {
  const match = location.hash.match(/^#\/pokemon\/([^/]+)$/);
  if (match) renderDetail(decodeURIComponent(match[1])); else renderHome();
}

async function init() {
  try {
    const responses = await Promise.all([fetch("data/pokemon.json"), fetch("data/evolution-chains.json"), fetch("data/types.json"), fetch("data/abilities.json"), fetch("data/pokedex-numbers.json")]);
    if (!responses.every(response => response.ok)) throw new Error("資料檔讀取失敗");
    [state.pokemon, state.chains, state.types, state.abilities, state.pokedexNumbers] = await Promise.all(responses.map(response => response.json()));
    route();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="error-state"><div><h2>無法載入圖鑑資料</h2><p>請透過本機伺服器開啟網站，例如執行 <code>python -m http.server</code>。</p></div></section>`;
  }
}

window.addEventListener("hashchange", route);
init();
