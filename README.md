<<<<<<< HEAD
# AI STOCK PREDICTION SYSTEM
### Indian Market Data & Intelligent Stock Analytics

---

## 📌 Project Overview
The **AI Stock Prediction System** is a professional-grade stock market data analytics and preprocessing application for equities listed on the **National Stock Exchange of India (NSE)**.

The system ingests real historical market data via Yahoo Finance (`yfinance`), validates and cleans market feeds, treats missing data with domain-appropriate imputation, computes intraday and rolling technical indicators, evaluates multi-factor correlations, performs dimensionality reduction via Principal Component Analysis (PCA), and partitions datasets chronologically for future machine learning modeling.

All stock prices and indicators are represented natively in **Indian Rupees (₹ INR)**.

---

## 🏛️ Project Architecture

```
AISTOCKPREDICTIONSYSTEM/
├── app.py                         # Flask backend serving API endpoints & fintech UI
├── requirements.txt               # Dependencies (flask, yfinance, pandas, numpy, scikit-learn, etc.)
├── README.md                      # Comprehensive project documentation & technical guide
├── python/
│   ├── __init__.py
│   ├── data_collection.py         # Real Yahoo Finance download and dataset metadata
│   ├── preprocessing.py          # Data cleaning, null imputation (ffill/bfill), scaling, encoding
│   ├── eda.py                    # Summary statistics, correlation matrix, distributions
│   ├── feature_engineering.py    # SMA_20, EMA_20, Daily Return, Price Change, RSI, MACD, BB
│   └── train_test_prep.py        # X and y definition, PCA demonstration, 80/20 chronological split
├── notebooks/
│   └── stock_data_analysis.ipynb # 22-section interactive Jupyter Notebook
├── data/
│   └── cache/                    # Automated caching for instantaneous UI interactions
└── frontend/
    ├── index.html                # Unified fintech web application
    ├── css/
    │   └── style.css             # Glassmorphism, neon glow, dark fintech theme
    └── js/
        └── app.js                # State manager, interactive charts, and API client
```

---

## 📊 Supported Indian Stocks (NSE)
All stocks are fetched in native **₹ INR**:
1. **RELIANCE.NS** — Reliance Industries Ltd (Default)
2. **TCS.NS** — Tata Consultancy Services
3. **INFY.NS** — Infosys
4. **HDFCBANK.NS** — HDFC Bank
5. **SBIN.NS** — State Bank of India (SBI)
6. **ICICIBANK.NS** — ICICI Bank
7. **ITC.NS** — ITC Ltd
8. **BHARTIARTL.NS** — Bharti Airtel

---

## 🚀 How to Run the Project

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Web Application:**
   ```bash
   python app.py
   ```

3. **Access the Website:**
   Open your browser at:
   ```
   http://127.0.0.1:5000
   ```

---

## 💡 Key Technical Questions & Architecture Answers

### Q1: Why did you use Forward Fill (`ffill`) for missing values?
**Answer:** In financial stock market data, mean or median imputation distorts price reality. Forward Fill propagates the last known transaction price forward, which is the industry-standard assumption for financial time series (an asset retains its last traded price until the next trade occurs).

### Q2: Why is random splitting (`shuffle=True`) avoided in time-series?
**Answer:** Random splitting causes **lookahead bias** and **data leakage**, where future prices leak into the training set. Stock analysis requires strict **chronological time-series splitting** (80% earlier sessions for training, 20% most recent sessions for testing).

### Q3: Why do we scale features like Volume and Price?
**Answer:** Trading Volume is typically in millions of shares, while Daily Return is a small fraction (e.g., 0.015). Feature scaling (MinMaxScaler or StandardScaler) brings all features to a comparable range so high-magnitude features do not dominate model weights during gradient descent.

### Q4: Should Open, High, Low, Close, Volume be encoded?
**Answer:** No. Continuous numeric values must never undergo categorical encoding (like One-Hot or Label encoding). Categorical encoding is only applied to qualitative identifiers, such as Stock Tickers or Industry Sectors.

### Q5: What are X and y in this project?
**Answer:** 
- **$X$ (Feature Matrix):** `Open`, `High`, `Low`, `Volume`, `SMA_20`, `EMA_20`, `Daily_Return`, `Volume_Change`, `RSI`.
- **$y$ (Target Vector):** `Next_Day_Close` (`Close.shift(-1)` in ₹ INR) representing the next trading day's closing price.
=======
# AIStockPredictionSystem
>>>>>>> d53f300186a38cde98ccbad0cb081a41e7b2941e
