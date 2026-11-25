# AI STOCK PREDICTION SYSTEM
# Module 2: Preprocessing & Data Cleaning
# Market data preprocessing: cleaning, missing values, transformation,
# reduction, categorical encoding, and feature scaling using Scikit-learn.

import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler, StandardScaler, LabelEncoder

# Column descriptions for Dataset Description table
COLUMN_DESCRIPTIONS = [
    {"column": "Date", "description": "Trading date of the stock session", "dtype": "object / datetime64", "unit": "YYYY-MM-DD"},
    {"column": "Open", "description": "Opening price of the stock during the session", "dtype": "float64", "unit": "₹ INR"},
    {"column": "High", "description": "Highest price reached by the stock during the session", "dtype": "float64", "unit": "₹ INR"},
    {"column": "Low", "description": "Lowest price reached by the stock during the session", "dtype": "float64", "unit": "₹ INR"},
    {"column": "Close", "description": "Closing price of the stock at session end", "dtype": "float64", "unit": "₹ INR"},
    {"column": "Volume", "description": "Total number of shares traded during the session", "dtype": "int64", "unit": "Shares"}
]

def describe_dataset(data):
    """
    Generate dataset summary statistics in ₹ INR.
    """
    stats = data[['Open', 'High', 'Low', 'Close', 'Volume']].describe().round(2).to_dict()
    return {
        "dictionary": COLUMN_DESCRIPTIONS,
        "summary_statistics": stats
    }

def clean_dataset(data):
    """
    Perform simple data cleaning:
    - Check duplicates
    - Check missing values
    - Drop duplicate rows
    - Sort chronologically by date
    """
    df = data.copy()
    
    # Before cleaning metrics
    before_metrics = {
        "rows": len(df),
        "columns": len(df.columns),
        "duplicates": int(df.duplicated().sum()),
        "missing_values": int(df.isnull().sum().sum())
    }

    # Step 1: Remove duplicate rows
    df = df.drop_duplicates()

    # Step 2: Ensure Date column is sorted
    df = df.sort_values(by='Date').reset_index(drop=True)

    # Step 3: Ensure numeric columns are properly typed
    numeric_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # After cleaning metrics
    after_metrics = {
        "rows": len(df),
        "columns": len(df.columns),
        "duplicates": int(df.duplicated().sum()),
        "missing_values": int(df.isnull().sum().sum())
    }

    return df, before_metrics, after_metrics

def handle_missing_values(data):
    """
    Analyze missing values and demonstrate Forward Fill (ffill) and Backward Fill (bfill).
    """
    df = data.copy()
    
    # Missing count per column
    missing_counts = df.isnull().sum().to_dict()

    # Forward fill (propagates last valid price forward - standard in finance)
    df_ffill = df.ffill()
    # Backward fill for any initial missing values
    df_clean = df_ffill.bfill()

    after_missing = df_clean.isnull().sum().to_dict()

    return df_clean, {
        "before": missing_counts,
        "treatment_method": "Forward Fill (ffill) followed by Backward Fill (bfill)",
        "explanation": "In financial time-series, Forward Fill is standard because the last known market price is the most realistic estimate for a missing period.",
        "after": after_missing
    }

def transform_data(data):
    """
    Data Transformation:
    Derive simple meaningful financial metrics from raw columns.
    """
    df = data.copy()

    # Daily Price Spread: High - Low
    df['Price_Spread'] = (df['High'] - df['Low']).round(2)

    # Daily Price Change: Close - Open
    df['Price_Change'] = (df['Close'] - df['Open']).round(2)

    # Daily Return Percentage: pct_change() * 100
    df['Daily_Return_Pct'] = (df['Close'].pct_change() * 100).round(2).fillna(0.0)

    return df

def reduce_data(data):
    """
    Data Reduction:
    Remove redundant features and retain high-signal columns.
    """
    df = data.copy()
    
    # Memory before
    mem_before = df.memory_usage(deep=True).sum() / 1024  # in KB

    # Selected essential columns
    essential_cols = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Price_Change', 'Daily_Return_Pct']
    df_reduced = df[[col for col in essential_cols if col in df.columns]]

    mem_after = df_reduced.memory_usage(deep=True).sum() / 1024

    return df_reduced, {
        "retained_columns": list(df_reduced.columns),
        "memory_before_kb": round(mem_before, 2),
        "memory_after_kb": round(mem_after, 2),
        "reduction_percentage": round((1 - (mem_after / mem_before)) * 100, 2) if mem_before > 0 else 0
    }

def encode_categorical(selected_symbol="RELIANCE.NS"):
    """
    Categorical Encoding demonstration:
    Shows how ticker symbols / sectors would be encoded using:
    1. Label Encoding
    2. One-Hot Encoding
    Note: Explains why numerical price columns must NEVER be encoded.
    """
    sample_df = pd.DataFrame({
        "Ticker": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "SBIN.NS"],
        "Sector": ["Energy", "IT", "IT", "Banking", "Banking"]
    })

    # Label Encoding
    le = LabelEncoder()
    sample_df["Sector_LabelEncoded"] = le.fit_transform(sample_df["Sector"])

    # One-Hot Encoding
    ohe_df = pd.get_dummies(sample_df[["Sector"]], prefix="Sector", dtype=int)
    demo_df = pd.concat([sample_df, ohe_df], axis=1)

    return {
        "explanation": "Stock price columns (Open, High, Low, Close, Volume) are continuous numerical variables and MUST NOT be encoded. Categorical encoding is only applied to categorical identifiers such as Stock Symbols or Industry Sectors.",
        "sample_table": demo_df.to_dict(orient="records"),
        "label_mapping": {label: int(idx) for idx, label in enumerate(le.classes_)}
    }

def scale_features(data):
    """
    Feature Scaling:
    Demonstrates both:
    1. MinMaxScaler (Normalization: range [0, 1])
    2. StandardScaler (Standardization: mean=0, std=1)
    """
    df = data.copy()
    features = ['Open', 'High', 'Low', 'Close', 'Volume']
    available_features = [f for f in features if f in df.columns]

    raw_values = df[available_features].tail(5).round(2).to_dict(orient="records")

    # 1. Normalization (MinMaxScaler)
    minmax = MinMaxScaler()
    norm_values = minmax.fit_transform(df[available_features])
    norm_sample = pd.DataFrame(norm_values[-5:], columns=available_features).round(4).to_dict(orient="records")

    # 2. Standardization (StandardScaler)
    standard = StandardScaler()
    std_values = standard.fit_transform(df[available_features])
    std_sample = pd.DataFrame(std_values[-5:], columns=available_features).round(4).to_dict(orient="records")

    return {
        "features": available_features,
        "raw_sample": raw_values,
        "normalized_sample": norm_sample,
        "standardized_sample": std_sample,
        "explanation": "Feature scaling standardizes numerical magnitudes so that high-magnitude columns (like Volume in millions) do not dominate low-magnitude features during future gradient-based ML training."
    }
