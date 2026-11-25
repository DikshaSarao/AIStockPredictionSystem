# AI STOCK PREDICTION SYSTEM
# Module 1: Data Collection
# Automated module to fetch Indian stock market data using yfinance.

import yfinance as yf
import pandas as pd

# Supported Indian NSE stocks
STOCKS_INFO = {
    "RELIANCE.NS": "Reliance Industries",
    "TCS.NS": "TCS",
    "INFY.NS": "Infosys",
    "HDFCBANK.NS": "HDFC Bank",
    "SBIN.NS": "State Bank of India",
    "ICICIBANK.NS": "ICICI Bank",
    "ITC.NS": "ITC",
    "BHARTIARTL.NS": "Bharti Airtel"
}

def fetch_stock_data(symbol="RELIANCE.NS", period="1y"):
    """
    Fetch real historical stock data from Yahoo Finance for Indian NSE stocks.
    Prices are directly in INR (₹).
    """
    if symbol not in STOCKS_INFO:
        symbol = "RELIANCE.NS"

    try:
        # Download stock data from Yahoo Finance
        data = yf.download(symbol, period=period, progress=False)

        if data.empty:
            raise ValueError(f"No data returned for {symbol}")

        # Handle MultiIndex columns if yfinance returns them
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        # Reset index so 'Date' becomes a regular column
        data = data.reset_index()

        # Format Date to string YYYY-MM-DD
        data['Date'] = pd.to_datetime(data['Date']).dt.strftime('%Y-%m-%d')

        # Keep only core stock columns
        core_cols = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
        data = data[[c for c in core_cols if c in data.columns]]

        # Round price columns to 2 decimal places
        for col in ['Open', 'High', 'Low', 'Close']:
            if col in data.columns:
                data[col] = data[col].round(2)

        return data, STOCKS_INFO.get(symbol, symbol)

    except Exception as e:
        print(f"Error fetching data: {e}")
        return None, None

def get_data_metadata(data, symbol):
    """
    Extract simple metadata for presentation.
    """
    if data is None or data.empty:
        return {}

    return {
        "symbol": symbol,
        "company_name": STOCKS_INFO.get(symbol, symbol),
        "source": "Yahoo Finance (NSE)",
        "currency": "₹ INR",
        "total_records": len(data),
        "total_columns": len(data.columns),
        "start_date": str(data['Date'].iloc[0]),
        "end_date": str(data['Date'].iloc[-1]),
        "columns": list(data.columns),
        "data_types": {col: str(dtype) for col, dtype in data.dtypes.items()}
    }

if __name__ == "__main__":
    df, company = fetch_stock_data("RELIANCE.NS", "1y")
    print("Fetched stock data for:", company)
    print(df.head())
    print("\nDataset Info:")
    print(get_data_metadata(df, "RELIANCE.NS"))
