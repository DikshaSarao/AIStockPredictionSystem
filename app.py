# AI STOCK PREDICTION SYSTEM
# Flask Backend Server

import os
import io
import json
import pandas as pd
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS

# Import project modules
from python.data_collection import fetch_stock_data, get_data_metadata, STOCKS_INFO
from python.preprocessing import (
    describe_dataset, clean_dataset, handle_missing_values,
    transform_data, reduce_data, encode_categorical, scale_features
)
from python.eda import compute_eda_summary, get_chart_data
from python.feature_engineering import add_engineered_features, FEATURE_EXPLANATIONS, get_features_summary
from python.train_test_prep import (
    prepare_features_and_target, perform_feature_extraction, split_train_test, SELECTED_FEATURE_COLS
)
import threading

# Initialize Flask application
app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

# Local cache directory
CACHE_DIR = os.path.join(os.path.dirname(__file__), "data", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# List of friendly stock metadata
SUPPORTED_STOCKS_LIST = [
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Energy / Conglomerate", "icon": "trending-up"},
    {"symbol": "TCS.NS", "name": "TCS", "sector": "Information Technology", "icon": "cpu"},
    {"symbol": "INFY.NS", "name": "Infosys", "sector": "Information Technology", "icon": "terminal"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Banking & Finance", "icon": "landmark"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "sector": "Public Banking", "icon": "building-2"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "sector": "Banking & Finance", "icon": "credit-card"},
    {"symbol": "ITC.NS", "name": "ITC", "sector": "FMCG / Diversified", "icon": "shopping-bag"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "sector": "Telecommunications", "icon": "radio"}
]

@app.route("/")
def serve_index():
    """Serve frontend index.html"""
    return send_from_directory("frontend", "index.html")

@app.route("/api/health", methods=["GET"])
@app.route("/api/status", methods=["GET"])
def health_check():
    """Returns health status of the backend."""
    return jsonify({
        "status": "success",
        "message": "AI Stock Prediction System Backend is active",
        "currency": "₹ INR",
        "server": "Flask",
        "port": 5000,
        "stocks_supported": len(SUPPORTED_STOCKS_LIST)
    })

@app.route("/api/stocks", methods=["GET"])
def get_stocks():
    """Returns list of supported Indian NSE stocks with live/cached market summaries."""
    enriched_stocks = []
    for s in SUPPORTED_STOCKS_LIST:
        stock_data = dict(s)
        cache_file = os.path.join(CACHE_DIR, f"{s['symbol']}_1y.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                    sum_data = cdata.get("eda", {}).get("summary", {})
                    stock_data["current_price"] = sum_data.get("current_price")
                    stock_data["daily_change"] = sum_data.get("daily_change")
                    stock_data["daily_change_pct"] = sum_data.get("daily_change_pct")
                    stock_data["high_52w"] = sum_data.get("high_52w")
                    stock_data["low_52w"] = sum_data.get("low_52w")
                    stock_data["latest_volume"] = sum_data.get("latest_volume")
                    stock_data["last_updated"] = sum_data.get("last_updated")
            except Exception:
                pass
        enriched_stocks.append(stock_data)

    return jsonify({
        "status": "success",
        "currency": "₹ INR",
        "stocks": enriched_stocks
    })

def execute_stock_pipeline(symbol="RELIANCE.NS", period="1y", force_refresh=False):
    """
    Executes the complete data pipeline for an Indian NSE stock:
    1. Data Collection
    2. Dataset Description
    3. Data Cleaning
    4. Missing Values
    5. Data Transformation
    6. Data Reduction
    7. Categorical Encoding
    8. Feature Scaling
    9. EDA & Visualizations
    10. Feature Engineering
    11. Feature Selection
    12. Feature Extraction (PCA)
    13. Train/Test Data Preparation
    14. Final Clean Dataset
    """
    if symbol not in STOCKS_INFO:
        symbol = "RELIANCE.NS"

    cache_file = os.path.join(CACHE_DIR, f"{symbol}_{period}.json")

    # Serve from cache if available and not forced refresh
    if not force_refresh and os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
                return cached_data, None
        except Exception:
            pass

    # 1. DATA COLLECTION
    raw_df, company_name = fetch_stock_data(symbol, period)
    if raw_df is None or raw_df.empty:
        return None, "Unable to fetch data from Yahoo Finance. Please check your internet connection or try again later."

    metadata = get_data_metadata(raw_df, symbol)

    # 2. DATASET DESCRIPTION
    description_info = describe_dataset(raw_df)

    # 3. DATA CLEANING
    cleaned_df, before_clean_stats, after_clean_stats = clean_dataset(raw_df)

    # 4. MISSING VALUES HANDLING
    imputed_df, missing_info = handle_missing_values(cleaned_df)

    # 5. DATA TRANSFORMATION
    transformed_df = transform_data(imputed_df)

    # 6. DATA REDUCTION
    reduced_df, reduction_info = reduce_data(transformed_df)

    # 7. CATEGORICAL ENCODING DEMO
    encoding_info = encode_categorical(symbol)

    # 8. FEATURE SCALING
    scaling_info = scale_features(cleaned_df)

    # 9. EDA & VISUALIZATIONS
    eda_summary = compute_eda_summary(transformed_df)
    charts_data = get_chart_data(transformed_df)

    # 10. FEATURE ENGINEERING
    engineered_df = add_engineered_features(imputed_df)

    # 11. FEATURE SELECTION & EXTRACTION
    clean_ml_df, X, y, selected_cols = prepare_features_and_target(engineered_df)
    extraction_info = perform_feature_extraction(X)

    # 12. TRAIN-TEST SPLIT PREPARATION
    train_test_info = split_train_test(clean_ml_df, X, y, split_ratio=0.80)

    # 13. FINAL DATASET PREVIEW (Preferred Columns)
    preferred_cols = [
        'Date', 'Open', 'High', 'Low', 'Close', 'Volume',
        'Price_Change', 'Price_Spread', 'SMA_20', 'EMA_20',
        'Daily_Return', 'RSI', 'Next_Day_Close'
    ]
    preview_cols = [c for c in preferred_cols if c in clean_ml_df.columns]
    final_preview = clean_ml_df[preview_cols].tail(15).round(2).to_dict(orient="records")
    final_columns = preview_cols

    response_payload = {
        "symbol": symbol,
        "company_name": company_name,
        "period": period,
        "currency": "₹ INR",
        "metadata": metadata,
        "description": description_info,
        "cleaning": {
            "before": before_clean_stats,
            "after": after_clean_stats,
            "sample": cleaned_df.tail(10).round(2).to_dict(orient="records")
        },
        "missing_values": missing_info,
        "transformation": {
            "columns_added": ["Price_Spread (₹)", "Price_Change (₹)", "Daily_Return_Pct (%)"],
            "sample": transformed_df[['Date', 'Open', 'Close', 'Price_Spread', 'Price_Change', 'Daily_Return_Pct']].tail(10).to_dict(orient="records")
        },
        "reduction": reduction_info,
        "encoding": encoding_info,
        "scaling": scaling_info,
        "eda": eda_summary,
        "charts": charts_data,
        "feature_engineering": {
            "explanations": FEATURE_EXPLANATIONS,
            "features_summary": get_features_summary(engineered_df),
            "sample": engineered_df[['Date', 'Close', 'SMA_20', 'EMA_20', 'Daily_Return', 'RSI', 'MACD']].tail(10).to_dict(orient="records")
        },
        "feature_selection": {
            "features_X": selected_cols,
            "target_y": "Next_Day_Close (₹)",
            "sample_X": X.tail(5).round(2).to_dict(orient="records"),
            "sample_y": y.tail(5).round(2).tolist()
        },
        "feature_extraction": extraction_info,
        "train_test": train_test_info,
        "final_dataset": {
            "columns": final_columns,
            "total_records": len(clean_ml_df),
            "preview": final_preview
        }
    }

    # Save to cache
    csv_file = os.path.join(CACHE_DIR, f"{symbol}_{period}_clean.csv")
    try:
        rename_map = {
            'Open': 'Open (₹)',
            'High': 'High (₹)',
            'Low': 'Low (₹)',
            'Close': 'Close (₹)',
            'Price_Change': 'Price_Change (₹)',
            'Price_Spread': 'Price_Spread (₹)',
            'SMA_20': 'SMA_20 (₹)',
            'EMA_20': 'EMA_20 (₹)',
            'Next_Day_Close': 'Next_Day_Close (₹)'
        }
        export_cols = [c for c in preferred_cols if c in clean_ml_df.columns]
        clean_ml_df[export_cols].rename(columns=rename_map).to_csv(csv_file, index=False, encoding='utf-8-sig')
    except Exception as e:
        print("CSV cache save warning:", e)

    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(response_payload, f)
    except Exception as e:
        print("Cache save warning:", e)

    return response_payload, None

@app.route("/api/analyze", methods=["GET"])
def analyze_stock():
    """Returns real analyzed stock data for selected symbol & period."""
    symbol = request.args.get("symbol", "RELIANCE.NS").upper()
    period = request.args.get("period", "1y")
    force_refresh = request.args.get("refresh", "false").lower() == "true"

    payload, err_msg = execute_stock_pipeline(symbol, period, force_refresh)
    if err_msg:
        return jsonify({"status": "error", "message": err_msg}), 502

    return jsonify({"status": "success", "data": payload})

@app.route("/api/download-csv", methods=["GET"])
def download_csv():
    """Generates and streams the preprocessed clean dataset with ₹ INR labels."""
    symbol = request.args.get("symbol", "RELIANCE.NS").upper()
    period = request.args.get("period", "1y")

    csv_file = os.path.join(CACHE_DIR, f"{symbol}_{period}_clean.csv")
    filename = f"{symbol.replace('.NS', '')}_Stock_Analysis_Data.csv"

    # Serve directly from cache if available
    if os.path.exists(csv_file):
        return send_file(
            csv_file,
            mimetype="text/csv",
            as_attachment=True,
            download_name=filename
        )

    # If not in cache, execute pipeline to generate both JSON and CSV cache
    payload, err_msg = execute_stock_pipeline(symbol, period, force_refresh=False)
    if os.path.exists(csv_file):
        return send_file(
            csv_file,
            mimetype="text/csv",
            as_attachment=True,
            download_name=filename
        )

    if err_msg or not payload:
        return "Unable to download data from Yahoo Finance", 502

    return "Dataset unavailable", 500

@app.route("/api/download-notebook", methods=["GET"])
def download_notebook():
    """Download the 22-section Jupyter Notebook."""
    nb_path = os.path.join(os.path.dirname(__file__), "notebooks", "stock_data_analysis.ipynb")
    return send_file(
        nb_path,
        mimetype="application/x-ipynb+json",
        as_attachment=True,
        download_name="stock_data_analysis.ipynb"
    )

@app.route("/api/code", methods=["GET"])
def get_code_snippets():
    """Returns the implementation Python code snippets."""
    snippets = [
        {
            "id": "1_imports",
            "title": "1. Import Libraries",
            "filename": "imports.py",
            "code": """import pandas as pd
import numpy as np
import yfinance as yf
import matplotlib.pyplot as plt
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.decomposition import PCA"""
        },
        {
            "id": "2_collection",
            "title": "2. Data Collection",
            "filename": "data_collection.py",
            "code": """# Fetch 1 year of real historical data for Reliance Industries from Yahoo Finance
ticker = "RELIANCE.NS"
data = yf.download(ticker, period="1y", progress=False)

# Flatten columns if multi-index
if isinstance(data.columns, pd.MultiIndex):
    data.columns = data.columns.get_level_values(0)

data = data.reset_index()
data['Date'] = pd.to_datetime(data['Date']).dt.strftime('%Y-%m-%d')
print(f"Collected {len(data)} trading sessions for {ticker}")"""
        },
        {
            "id": "3_cleaning",
            "title": "3. Data Cleaning",
            "filename": "data_cleaning.py",
            "code": """# Step 1: Remove duplicate rows
data = data.drop_duplicates()

# Step 2: Sort chronologically by trading date
data = data.sort_values(by='Date').reset_index(drop=True)

# Step 3: Handle missing values via Forward Fill (ffill) and Backward Fill (bfill)
data = data.ffill().bfill()
print("Missing values after clean:", data.isnull().sum().sum())"""
        },
        {
            "id": "4_transformation",
            "title": "4. Data Transformation",
            "filename": "data_transformation.py",
            "code": """# Derive essential price metrics
data['Price_Spread'] = (data['High'] - data['Low']).round(2)
data['Price_Change'] = (data['Close'] - data['Open']).round(2)
data['Daily_Return'] = data['Close'].pct_change().round(4)

# Retain high-signal continuous features
data = data[['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Price_Change', 'Price_Spread', 'Daily_Return']]"""
        },
        {
            "id": "5_scaling",
            "title": "5. Feature Scaling",
            "filename": "feature_scaling.py",
            "code": """features = ['Open', 'High', 'Low', 'Close', 'Volume']

# Normalization: Scales continuous values to [0, 1]
minmax = MinMaxScaler()
normalized_data = minmax.fit_transform(data[features])

# Standardization: Scales values to Mean = 0, Std = 1
standard = StandardScaler()
standardized_data = standard.fit_transform(data[features])"""
        },
        {
            "id": "6_engineering",
            "title": "6. Feature Engineering",
            "filename": "feature_engineering.py",
            "code": """# Calculate technical indicators
data['SMA_20'] = data['Close'].rolling(window=20).mean().round(2)
data['EMA_20'] = data['Close'].ewm(span=20, adjust=False).mean().round(2)
data['Daily_Return'] = data['Close'].pct_change().round(4)
data['Price_Change'] = (data['Close'] - data['Open']).round(2)

# 14-period Relative Strength Index (RSI)
delta = data['Close'].diff()
gain = delta.clip(lower=0).rolling(14).mean()
loss = (-delta.clip(upper=0)).rolling(14).mean()
rs = gain / (loss.replace(0, np.nan))
data['RSI'] = (100 - (100 / (1 + rs))).round(2)
data = data.bfill()"""
        },
        {
            "id": "7_pca",
            "title": "7. PCA",
            "filename": "pca_extraction.py",
            "code": """from sklearn.decomposition import PCA

# Fit 2-Component PCA on standardized features
features_for_pca = ['Open', 'High', 'Low', 'Close', 'Volume']
standardized_matrix = standard.fit_transform(data[features_for_pca])

pca = PCA(n_components=2)
pca_data = pca.fit_transform(standardized_matrix)

# Explained variance ratio
explained_var = pca.explained_variance_ratio_
print(f"Component 1: {explained_var[0]*100:.2f}% | Component 2: {explained_var[1]*100:.2f}%")
print(f"Total Explained Variance: {np.sum(explained_var)*100:.2f}%")"""
        },
        {
            "id": "8_split",
            "title": "8. X, y & Data Split",
            "filename": "train_test_split.py",
            "code": """# Define Target Variable y = Next Day Close Price in ₹ (Close shifted -1)
data['Next_Day_Close'] = data['Close'].shift(-1)
clean_ml = data.dropna(subset=['Next_Day_Close'])

# Define Input Feature Matrix X and Target y
X_cols = ['Open', 'High', 'Low', 'Volume', 'SMA_20', 'EMA_20', 'Daily_Return', 'Price_Change', 'RSI']
X = clean_ml[X_cols]
y = clean_ml['Next_Day_Close']

# Chronological 80% Train, 20% Test partition (preserving time-order)
train_size = int(len(clean_ml) * 0.80)
X_train, X_test = X.iloc[:train_size], X.iloc[train_size:]
y_train, y_test = y.iloc[:train_size], y.iloc[train_size:]

print(f"Training set: {len(X_train)} sessions | Test set: {len(X_test)} sessions")"""
        }
    ]
    return jsonify({"status": "success", "snippets": snippets})

def warm_cache_async():
    """Pre-warms cache for supported Indian stocks in background."""
    for stock in SUPPORTED_STOCKS_LIST:
        sym = stock["symbol"]
        try:
            execute_stock_pipeline(sym, "1y", force_refresh=False)
        except Exception as e:
            print(f"Cache pre-warm notice for {sym}: {e}")

if __name__ == "__main__":
    print("==================================================")
    print("AI STOCK PREDICTION SYSTEM")
    print("Starting Flask Server at http://127.0.0.1:5000 and http://localhost:5000 ...")
    print("==================================================")
    # Start cache warmup thread
    threading.Thread(target=warm_cache_async, daemon=True).start()
    app.run(host="0.0.0.0", port=5000, debug=False)
