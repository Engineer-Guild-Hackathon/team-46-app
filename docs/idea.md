# PoC Idea: Level-Based Text Generation from Books

## 目的

- ユーザーに英語学習向けの教材を提供する
- ユーザーの内部レベルに応じて文章を自動生成
- シンプルなPoCでUI/UXを確認する

## PoCで作る画面

1. **メインページ**
   - 右上に **ログインボタン** または **ユーザーアカウントボタン**
   - 中央に **書籍のグリッド表示**
   - 書籍カードをクリックすると、該当書籍ページへ遷移
   - デザイン参考: `/docs/mainpage.png`

2. **書籍表示ページ**
   - 選択された書籍のテキストを表示
   - ページ分け可能（ページごとにAPIで取得）
   - デザイン参考: `/docs/Book - Design 2.png`

## 機能要件

- **メインページ**
  - 書籍リスト取得: `GET /api/books?page=X&pageSize=Y?search=KEYWORD` で書籍一覧取得 300~500msの遅延（debounce）を入れて検索を最適化
  - 書籍カードクリックで詳細表示
  - ページネーション / Lazy load optional

- **書籍ページ**
  - 書籍テキスト取得: `GET /api/text?level=X?bookId=ID?page=Z`
  - 次ページをプリフェッチ
  - ユーザー内部レベルに応じて表示内容調整

## API: テキストページ取得 (要件)

パラメータ

| 名前               | 必須 | 説明                                       | デフォルト値 |
| ------------------ | ---- | ------------------------------------------ | ------------ |
| bookId             | ○    | 対象の本のID                               | -            |
| startSentenceNo    |      | 開始の sentenceNo                          | 0            |
| userId             |      | ユーザーID                                 | "anonymous"  |
| charCount          |      | 要求文字数（最大）                         | 800          |
| wordClickCount     |      | クリックして単語を表示させた回数           | null         |
| sentenceClickCount |      | クリックして日本語訳を表示させた回数       | null         |
| time               |      | 前回のロードから今回のリクエストまでの秒数 | null         |
| rate               |      | ユーザーの推定レート                       | null         |

レスポンス形式

```json
{
    "rate":1800,
    "endSentenceNo":121,
    "text":[
        {
            "type":"text",
            "sentenceNo":12,
            "en":"Alice said,\"I feel strange. I am getting very small\" ",
            "jp":"アリスは「体が小さくなっていくよう！」と言いました"
        },
        ...
    ]
}
```

振る舞い

- `startSentenceNo` から始まる「1ページ分」の文のリストを返します。
- リスト長さは各 `en` と `jp` を含めた合計文字数が `charCount` に達しない最大の長さになります（つまり合計が charCount を超えない最大の文数を返す）。
- 各要素の `type` は `text` または `subtitle` を取り得ます。

備考: フロントエンドでは `src/lib/api/text.ts` の `getTextPage` を利用してこのエンドポイントへ GET リクエストを送ります。

## 開発方針

- **フロントエンド:** Svelte + TypeScript + shadcn/ui
- **バックエンド:** Flask
- **PoC範囲:**
  - メインページと書籍ページのみ
  - ユーザー認証はボタン表示だけ
  - 本文生成はサンプル文章で代用可

## ゴール

- メインページの書籍グリッドと書籍ページのテキスト表示が動くこと
- ユーザーが書籍を選ぶ → ページが表示される、という基本フローを確認
