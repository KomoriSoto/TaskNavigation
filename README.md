# TaskNavigation

タスク管理と集中力トラッキングを統合した Django 製 Web アプリケーション。  
カンバンボードでタスクを管理しながら、カメラを使った集中度計測でワークセッションを可視化します。

---

## ✨ 主な機能

### タスク管理（カンバンボード）
- **4 ステータス管理** — Todo / In Progress / Review / Done
- **優先度設定** — Low / Medium / High
- **期日管理** — 期限切れタスクをダッシュボードに自動表示
- **ドラッグ＆ドロップ** — カラム間をリアルタイムに移動（REST API 連携）

### 集中力トラッキング
- **カメラ計測** — 視線安定性・姿勢・顔の向き・中心注視率をリアルタイム分析
- **スコアリング** — Excellent / Good / Fair / Poor の 4 段階評価
- **5 分間隔スナップショット** — セッション中の集中度の推移を記録
- **フォーカスアイテム** — セッションごとに意識するポイントを選択（姿勢・深い作業・呼吸など）
- **履歴一覧・詳細表示** — 過去セッションをページネーションで確認

### ダッシュボード
- タスクのステータス別カウント
- 直近の集中ログサマリー
- 直近 7 日間の集中度平均スコア
- 期限切れタスクのクイックビュー

---

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---|---|
| Backend | Python 3.x / Django 5.2 |
| Frontend | HTML5 / CSS3 / JavaScript (ES6+) |
| Database | SQLite（開発）/ PostgreSQL（本番） |
| API | Django REST Framework |
| AI | Google Gemini API |
| 認証 | Django 標準 Auth |
| 環境変数管理 | python-dotenv |
| 画像処理 | Pillow |

---

## 📁 プロジェクト構成

```
TaskNavigation/
├── accounts/        # ユーザー認証（登録・ログイン・ログアウト）
├── tasks/           # タスク管理（カンバン・CRUD・REST API）
├── concentration/   # 集中力計測・ログ管理
├── dashboard/       # トップページ・統計サマリー
├── config/          # Django 設定・URL ルーティング
├── templates/       # HTML テンプレート
├── static/          # CSS・JS・画像
└── manage.py
```

---

## 🚀 ローカルでの実行方法

### 1. リポジトリをクローン

```bash
git clone https://github.com/KomoriSoto/TaskNavigation.git
cd TaskNavigation
```

### 2. 仮想環境を作成・有効化

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate
```

### 3. 依存パッケージをインストール

```bash
pip install -r requirements.txt
```

### 4. 環境変数を設定

`.env.example` をコピーして `.env` を作成し、各値を設定します。

```bash
cp .env.example .env
```

```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
```

### 5. データベースをセットアップ

```bash
python manage.py migrate
python manage.py createsuperuser
```

### 6. 開発サーバーを起動

```bash
python manage.py runserver
```

`http://127.0.0.1:8000` にアクセスするとアプリが起動します。

---

## 🗄️ データモデル概要

### Task

| フィールド | 内容 |
|---|---|
| `title` | タスク名 |
| `status` | todo / in_progress / review / done |
| `priority` | 1(Low) / 2(Medium) / 3(High) |
| `due_date` | 期日 |
| `position` | カンバン内の表示順 |

### ConcentrationLog

| フィールド | 内容 |
|---|---|
| `duration_minutes` | セッション時間（分） |
| `average_score` | 集中度平均スコア |
| `gaze_stability_avg` | 視線安定性スコア |
| `posture_score_avg` | 姿勢スコア |
| `score_records` | 5 分間隔スナップショット (JSON) |
| `focus_items` | 選択したフォーカスアイテム (JSON) |

---

## 📄 ライセンス

MIT License
