# AI STOCK PREDICTION SYSTEM
# Module 5: Feature Selection, Feature Extraction & Train-Test Preparation
# Feature selection, PCA demonstration, and chronological train/test split.
# NOTE: DO NOT train any machine learning models in this data preparation phase.

import pandas as pd
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# Recommended Input Features for future ML model
SELECTED_FEATURE_COLS = [
    'Open', 'High', 'Low', 'Volume', 'SMA_20', 'EMA_20', 'Daily_Return', 'Price_Change', 'RSI'
]

def prepare_features_and_target(data):
    """
    Define:
    X: Input Features Matrix (multivariate stock indicators)
    y: Target Variable (Next Day Close Price in ₹)
    
    y is created by shifting Close price backwards by 1 trading day:
    y = Close.shift(-1)
    """
    df = data.copy()

    # Create target variable: Next Day Close Price in ₹
    df['Next_Day_Close'] = df['Close'].shift(-1)

    # Drop the very last row because Next_Day_Close will be NaN for today
    df_clean = df.dropna(subset=['Next_Day_Close']).copy()

    avail_features = [col for col in SELECTED_FEATURE_COLS if col in df_clean.columns]
    X = df_clean[avail_features].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    y = df_clean['Next_Day_Close']

    return df_clean, X, y, avail_features

def perform_feature_extraction(X):
    """
    Feature Extraction via Principal Component Analysis (PCA):
    Demonstrates reducing multiple correlated input features into 2 Principal Components.
    Computes explained variance ratio for feature dimensionality analysis.
    """
    if X.empty or len(X) < 2:
        return {}

    # Standardize X before PCA
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Apply 2-Component PCA
    pca = PCA(n_components=2)
    pca_result = pca.fit_transform(X_scaled)

    var_ratio = pca.explained_variance_ratio_
    total_var = float(np.sum(var_ratio) * 100)

    # Convert first 20 points for frontend visualization
    pca_points = [
        {"PC1": round(float(pca_result[i, 0]), 3), "PC2": round(float(pca_result[i, 1]), 3)}
        for i in range(min(50, len(pca_result)))
    ]

    return {
        "n_components": 2,
        "explained_variance_ratio": [round(float(v) * 100, 2) for v in var_ratio],
        "total_explained_variance_pct": round(total_var, 2),
        "pca_sample_points": pca_points,
        "explanation": "Principal Component Analysis (PCA) linearly combines correlated features into orthogonal components. Here, 2 components capture a large portion of overall variance while drastically reducing feature dimensionality."
    }

def split_train_test(df_clean, X, y, split_ratio=0.80):
    """
    Chronological Time-Series Split:
    80% Training Data (Historical period)
    20% Testing Data (Recent period)

    NOTE: Random splitting (shuffle=True) is strictly avoided in stock prediction
    to prevent lookahead bias / data leakage.
    """
    total_records = len(df_clean)
    train_size = int(total_records * split_ratio)
    test_size = total_records - train_size

    # Split datasets
    train_df = df_clean.iloc[:train_size]
    test_df = df_clean.iloc[train_size:]

    X_train = X.iloc[:train_size]
    y_train = y.iloc[:train_size]
    X_test = X.iloc[train_size:]
    y_test = y.iloc[train_size:]

    return {
        "total_records": total_records,
        "train_size": train_size,
        "test_size": test_size,
        "train_percentage": f"{int(split_ratio * 100)}%",
        "test_percentage": f"{int((1 - split_ratio) * 100)}%",
        "train_start_date": str(train_df['Date'].iloc[0]) if 'Date' in train_df.columns else "",
        "train_end_date": str(train_df['Date'].iloc[-1]) if 'Date' in train_df.columns else "",
        "test_start_date": str(test_df['Date'].iloc[0]) if 'Date' in test_df.columns else "",
        "test_end_date": str(test_df['Date'].iloc[-1]) if 'Date' in test_df.columns else "",
        "train_sample": train_df[['Date', 'Close', 'Next_Day_Close']].head(5).to_dict(orient="records"),
        "test_sample": test_df[['Date', 'Close', 'Next_Day_Close']].head(5).to_dict(orient="records"),
        "features_list": list(X.columns),
        "target_variable": "Next_Day_Close (₹)"
    }
