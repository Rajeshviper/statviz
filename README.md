# StatViz — Statistical Dashboard Web App

A full-stack web application for instant statistical analysis and data visualisation. Upload any CSV or Excel file and get EDA results, interactive charts, and a downloadable PDF report in seconds.

---

## 🔗 Live Demo

- **Frontend:** https://statviz-two.vercel.app
- **Backend API:** https://statviz-api.onrender.com

---

## ✨ Features

- 📂 **CSV & Excel Upload** — drag and drop any dataset up to 100,000 rows
- 📊 **Auto EDA** — mean, median, std dev, variance, skewness, kurtosis, IQR, outlier detection, normality test (Shapiro-Wilk)
- 🔥 **Correlation Matrix** — Pearson correlation heatmap for all numeric columns
- 📈 **Interactive Charts** — histogram, bar chart, scatter plot, radar chart, category breakdown
- 📥 **PDF Export** — download a full analysis report with one click
- 🧭 **Multi-page Navigation** — EDA page + Charts Dashboard connected with React Router

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Recharts |
| Backend | Python, FastAPI |
| Statistics | Pandas, NumPy, SciPy, Statsmodels |
| PDF Export | ReportLab |
| Deployment | Vercel (frontend), Render (backend) |

---

## 📁 Project Structure

```
statviz/
├── frontend/                  # React app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── UploadPage.jsx # EDA & upload
│   │   │   └── Dashboard.jsx  # Charts dashboard
│   │   ├── App.jsx            # React Router setup
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
└── backend/                   # FastAPI app
    ├── main.py                # All routes & logic
    └── requirements.txt
```

---

## 🚀 Run Locally

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
uvicorn main:app --reload
# API running at http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:5173
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API status check |
| GET | `/health` | Health check |
| POST | `/upload` | Upload CSV/Excel, get full EDA |
| POST | `/export/pdf` | Generate and download PDF report |

---

## 📊 EDA Output (per column)

**Numeric columns:**
mean, median, std dev, variance, min, max, Q1, Q3, IQR, range, skewness, kurtosis, outlier count, normality test (Shapiro-Wilk), histogram bins

**Categorical columns:**
unique count, top 10 values with frequency, mode

---

## 👨‍🎓 About

Built as a final year project combining a B.Sc in Computer Science and M.Sc in Statistics. StatViz demonstrates the practical application of statistical analysis methods through a modern full-stack web application.

---

## 📄 License

MIT License — free to use and modify.
