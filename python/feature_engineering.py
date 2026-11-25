# AI STOCK PREDICTION SYSTEM
# Module 4: Feature Engineering
# Financial feature engineering: technical indicators and market signals.
# NOTE: These features are prepared for future ML models. No prediction is performed here.

import pandas as pd
import numpy as np

def add_engineered_features(data):
    """
    Calculate essential technical and momentum features:
    1. SMA_20: Simple Moving Average (20-day)
    2. EMA_20: Exponential Moving Average (20-day)
    3. Daily_Return: Daily percentage price return
    4. Price_Change: Close price minus Open price (₹)
    5. Volume_Change: Percentage change in trading volume
    6. RSI_14: Relative Strength Index (14-period)
    7. MACD: Moving Average Convergence Divergence (12 EMA - 26 EMA)
    8. Bollinger_Upper & Lower: 20-day rolling mean +/- 2 standard deviations
    """
    df = data.copy()

    # 1. Simple Moving Average (20-day trend)
    df['SMA_20'] = df['Close'].rolling(window=20).mean().round(2)

    # 2. Exponential Moving Average (20-day fast response)
    df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean().round(2)

    # 3. Daily Return (percentage change from previous close)
    df['Daily_Return'] = df['Close'].pct_change().round(4)

    # 4. Price Change (intra-day difference in ₹)
    df['Price_Change'] = (df['Close'] - df['Open']).round(2)

    # Price Spread (intra-day High - Low range in ₹)
    df['Price_Spread'] = (df['High'] - df['Low']).round(2)

    # 5. Volume Change (day-to-day percentage variation)
    df['Volume_Change'] = df['Volume'].pct_change().round(4)

    # 6. Relative Strength Index (RSI - 14 period)
    delta = df['Close'].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=14, min_periods=14).mean()
    avg_loss = loss.rolling(window=14, min_periods=14).mean()
    rs = avg_gain / (avg_loss.replace(0, np.nan))
    df['RSI'] = (100 - (100 / (1 + rs))).round(2)

    # 7. MACD (12-period EMA - 26-period EMA)
    ema_12 = df['Close'].ewm(span=12, adjust=False).mean()
    ema_26 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = (ema_12 - ema_26).round(2)
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean().round(2)

    # 8. Bollinger Bands (20-day SMA +/- 2 std)
    rolling_std = df['Close'].rolling(window=20).std()
    df['BB_Upper'] = (df['SMA_20'] + (rolling_std * 2)).round(2)
    df['BB_Lower'] = (df['SMA_20'] - (rolling_std * 2)).round(2)

    # Replace any infinite values from percentage calculations and fill NaNs
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.bfill().ffill().fillna(0.0)

    return df

FEATURE_EXPLANATIONS = [
    {
        "name": "SMA 20",
        "key": "SMA_20",
        "formula": "Close.rolling(20).mean()",
        "category": "Trend Indicator",
        "description": "20-day simple moving average smoothing price noise to identify prevailing market trend."
    },
    {
        "name": "EMA 20",
        "key": "EMA_20",
        "formula": "Close.ewm(span=20).mean()",
        "category": "Trend Indicator",
        "description": "20-day exponential moving average weighting recent prices higher to react faster to trend shifts."
    },
    {
        "name": "Daily Return",
        "key": "Daily_Return",
        "formula": "Close.pct_change()",
        "category": "Volatility / Return",
        "description": "Percentage price return relative to prior close, stationarizing data for statistical analysis."
    },
    {
        "name": "Price Change",
        "key": "Price_Change",
        "formula": "Close - Open (₹)",
        "category": "Intraday Momentum",
        "description": "Session difference between Open and Close in ₹ INR, measuring net intraday price action."
    },
    {
        "name": "RSI",
        "key": "RSI",
        "formula": "100 - (100 / (1 + RS))",
        "category": "Momentum Oscillator",
        "description": "14-day momentum oscillator on 0-100 scale measuring price velocity (>70 overbought, <30 oversold)."
    }
]

def get_features_summary(df):
    """
    Extracts each engineered indicator's latest computed value from the dataset.
    """
    if df.empty:
        return []
    latest = df.iloc[-1]
    result = []
    for item in FEATURE_EXPLANATIONS:
        k = item["key"]
        val_str = "-"
        if k == "BB":
            val_str = f"Upper: ₹{latest.get('BB_Upper', 0):.2f} | Lower: ₹{latest.get('BB_Lower', 0):.2f}"
        elif k in latest:
            v = latest[k]
            if k in ["SMA_20", "EMA_20"]:
                val_str = f"₹{v:,.2f}"
            elif k == "Price_Change":
                val_str = f"₹{v:+.2f}"
            elif k == "Daily_Return":
                val_str = f"{v*100:+.2f}%"
            elif k == "Volume_Change":
                val_str = f"{v*100:+.2f}%"
            else:
                val_str = f"{v:.2f}"
        result.append({
            **item,
            "latest_value": val_str
        })
    return result
