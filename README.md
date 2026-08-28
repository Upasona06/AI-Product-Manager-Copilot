# 🚀 AI Product Manager Copilot

An intelligent, full-stack product management platform designed to automate customer feedback analysis, calculate features' ROI dynamically, plan launch horizons, and compile executive-ready strategy reports.

---

## 🌟 Key Features & Modules

### 1. Ingestion & NLP Preprocessing Pipeline
* **Batch Ingestion:** Supports manual feedback entries or bulk CSV spreadsheet uploads.
* **Local NLP Engine:** Uses the NLTK library to tokenize paragraphs, filter stopwords, and lemmatize words to their root form.
* **Duplicate Detection:** Groups identical or highly similar customer reviews automatically to reduce redundancy and API costs.

### 2. AI Classification & Sentiment Analysis
* **Automated Triage:** Evaluates user feedback to categorize entries into **Bugs**, **Feature Requests**, or **General inquiries**.
* **Smart Tagging:** Maps issues to relevant system modules (e.g. *Security*, *UX*, *Database*).
* **Customer Sentiment:** Identifies self-reported and AI-detected sentiment to flag critical user frustration points.

### 3. Quantitative RICE Prioritization
* **Object Pricing:** Dynamically computes features' priority scores using:
  $$\text{RICE Score} = \frac{\text{Reach} \times \text{Impact} \times \text{Confidence}}{\text{Effort}}$$
* **MoSCoW Sorting:** Automatically slots features into *Must Have*, *Should Have*, *Could Have*, or *Won't Have* bins.
* **Manual Override:** Allows product managers to review and override metrics in the UI in real-time.

### 4. Dynamic Kanban Roadmap Planner
* **Horizon Board:** Drag-and-drop Kanban interface divided into **Now** (1-2 months), **Next** (3-6 months), and **Later** (6+ months) columns.
* **AI Milestone Sequences:** Automatically clusters backlog items into recommended release phases (like MVP, Core Enhancements, Future backlogs).
* **One-Click Application:** Bulk syncs recommended timelines straight to the database.

### 5. Strategy Reports Dashboard
* **Executive Summary:** Bulleted briefing on product health, core pain points, and launch readiness metrics.
* **Product Strategy Report:** Outline details of SWOT analysis, competitive advantages, and strategic KPIs.
* **PDF & Printing:** Custom print styles optimized for saving reports directly to PDF.

---

## 🛠️ Technology Stack

* **Frontend:** React.js, Vite, Axios, Tailwind CSS
* **Backend:** Python, Flask REST API (Modular Blueprints)
* **Database:** PostgreSQL (with SQLAlchemy ORM)
* **NLP & AI:** NLTK (`word_tokenize`, `punkt_tab`, `stopwords`), Google GenAI SDK (Gemini API)

---

## 📁 Repository Structure

```text
├── backend/
│   ├── database/             # Migration files and database connection setup
│   ├── models/               # SQLAlchemy DB Schemas (users, raw_feedback, roadmap_items, etc.)
│   ├── routes/               # Flask Blueprints (auth, classify, process, roadmap, reports)
│   ├── services/             # Pipeline business logic (NLP pipeline, Gemini service)
│   ├── utils/                # Helper utilities (tokenizers, lemmatizers)
│   ├── app.py                # Main Flask application entrypoint
│   ├── config.py             # Server environments and database config
│   └── requirements.txt      # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI elements (Navbar, Markdown renderer, Status panels)
│   │   ├── pages/            # Page layouts (RoadmapPage, StrategyReportsPage, DashboardPage)
│   │   ├── services/         # Axios API connection endpoints
│   │   └── App.jsx           # Main React routing config
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite configurations
```

---

## 🚀 Local Installation & Setup

### Prerequisites
* Python 3.10+
* Node.js v16+
* PostgreSQL running locally

### 1. Set Up the Backend
Navigate to the `backend/` directory:
```bash
cd backend
```

Create and activate a virtual environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Create a **`.env`** file inside the `backend/` directory:
```env
FLASK_APP=app.py
FLASK_ENV=development
DATABASE_URL=postgresql://<username>:<password>@localhost:5432/ai_pm_copilot
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here
```

Run migrations to set up PostgreSQL database tables:
```bash
python database/run_migration.py
```

Start the Flask server:
```bash
python app.py
```
*(The server will boot and print `Gemini Key Loaded: True` on port 5000).*

### 2. Set Up the Frontend
Open a new terminal and navigate to the `frontend/` directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the React development server:
```bash
npm run dev
```
*(The UI will boot and be accessible at `http://localhost:5173`).*

---

## 🔒 Security & Credentials Note
* **Never commit `.env` files** containing database passwords or Gemini API keys to Git.
* A template is provided in `backend/.env.example` as a reference.
