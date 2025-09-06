# Firebase APIデプロイ手順 (Python版)

## 1. Firebaseプロジェクトのセットアップ

1.  Firebaseコンソール (https://console.firebase.google.com/) にアクセスし、新しいプロジェクトを作成するか、既存のプロジェクトを選択します。
2.  プロジェクトの設定画面からプロジェクトIDをコピーします。
3.  ルートディレクトリにある `.firebaserc` ファイルを開き、`<YOUR_FIREBASE_PROJECT_ID>` をあなたのプロジェクトIDに置き換えます。

    ```json
    {
      "projects": {
        "default": "your-project-id-goes-here"
      }
    }
    ```

## 2. Firebase CLIのインストールとログイン

1.  Pythonがインストールされていない場合は、公式サイト (https://www.python.org/) からインストールしてください (バージョン 3.10 以降を推奨)。
2.  ターミナル（コマンドプロンプト）を開き、次のコマンドでFirebase CLIをインストールします。
    ```bash
    npm install -g firebase-tools
    ```
    (Firebase CLIのインストールにはNode.jsが必要です)
3.  Firebaseにログインします。
    ```bash
    firebase login
    ```

## 3. 依存関係のインストール

1.  `functions` ディレクトリに移動します。
    ```bash
    cd functions
    ```
2.  Pythonの仮想環境を作成して有効化することを推奨します。
    ```bash
    python -m venv venv
    # Windowsの場合
    .\venv\Scripts\activate
    # macOS/Linuxの場合
    # source venv/bin/activate
    ```
3.  必要なPythonパッケージをインストールします。
    ```bash
    pip install -r requirements.txt
    ```
4.  ルートディレクトリに戻ります。
    ```bash
    cd ..
    ```

## 4. (オプション) Firestoreにテストデータを追加する

1.  FirebaseコンソールのFirestore Databaseページに移動します。
2.  `items` という名前のコレクションを作成します。
3.  ドキュメントをいくつか追加します。各ドキュメントには任意のフィールドを持たせることができます。（例: `name: "Test Item 1"`, `price: 100`）

## 5. デプロイ

1.  ターミナルでプロジェクトのルートディレクトリにいることを確認します。
2.  次のコマンドを実行して、API（Cloud Function）をデプロイします。
    ```bash
    firebase deploy --only functions
    ```
3.  デプロイが完了すると、ターミナルにAPIのエンドポイントURLが表示されます。そのURLにアクセスすると、Firestoreから取得したデータがJSON形式で返されます。

## 6. (オプション) ローカルでのテスト

デプロイする前にローカルで関数をテストすることも可能です。

1.  次のコマンドでFirebaseエミュレータを起動します。
    ```bash
    firebase emulators:start --only functions
    ```
2.  ターミナルに表示されたローカルURLにアクセスして動作を確認します。
