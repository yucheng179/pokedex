# Champions 特性描述同步

在專案根目錄執行：

```sh
node scripts/sync-champions-abilities.mjs
```

來源為 GameWith 繁體中文 Champions 特性列表。解析公開 HTML，依中文名稱配對，不使用 GameWith 的網址編號當作 PokeAPI 編號。人馬一體白馬／黑馬及三個新特性以明確 slug 對照。

- `data/abilities.json`：供網站使用的合併資料。Champions 描述優先，未收錄者保留既有描述；`legacyDescription` 保存第一次覆蓋前的原描述。
- `data/champions-ability-overrides.json`：來源、抓取時間、各特性描述及來源網址，並列出未配對資料。

`sync-pokeapi.mjs` 會重新套用本地 Champions 覆蓋資料。若要取得最新 GameWith 描述，重新執行上述命令。解析結果少於 250 筆時會中止，避免網站格式變更造成誤寫。

這是 GameWith 標示為 Champions 的描述資料，不代表每個特性目前都有可用寶可夢。寶可夢擁有特性的關係仍來自本地圖鑑資料，沒有切換成 Champions 限定名單。

分類從頁面載入的公開 AbilityTable 程式資料解析，以日文名稱配對，支援一個特性屬於多個分類。分類多選採 OR，與世代、搜尋之間採 AND。GameWith 尚未分類的波導防護，依接觸傷害減半的描述補為防禦／接觸，並以 `categorySource` 記錄本地判定。
