# 道具資料更新

```sh
node scripts/sync-champions-items.mjs
```

讀取 GameWith 繁體中文持有物一覽的公開頁面資料，以日文名稱優先、中文名稱其次配對本地道具。網址編號屬於 GameWith，不用作 PokeAPI 編號。

Champions 是否加入以網頁實際顯示的道具連結為準，不納入僅出現在隱藏 master data 的項目。這不代表所有已加入道具都適用於每個賽制。

- `data/items.json` 是網站使用的合併資料。
- `data/champions-item-overrides.json` 保存來源、擷取時間、顯示筆數及覆蓋資料。
- Champions 有中文描述時優先使用，原描述存入 `legacyDescription`；其他道具保留既有內容。
- 本地缺少的 Champions 道具使用獨立 slug，PokeAPI 編號為空，不假造編號。英語名稱缺少時留空。
- 道具圖片優先使用既有 PokeAPI 圖片，缺少時採 GameWith 圖片；頁面處理圖片載入失敗。

`sync-pokeapi.mjs` 會套用已保存的 Champions 覆蓋資料，避免重新同步時遺失加入狀態及描述。

道具頁包含所有本地道具，分類為方便瀏覽所做的分組。入手方法不擷取、不顯示。持有物的一般概念與分類可參考 https://wiki.52poke.com/zh-hant/持有物 。
