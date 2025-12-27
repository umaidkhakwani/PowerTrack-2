from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import pandas as pd
import statsmodels.api as sm
import numpy as np

app = FastAPI()

class DataPoint(BaseModel):
    date: str
    value: float

class AnalyticsRequest(BaseModel):
    data: List[DataPoint]

@app.get("/")
def read_root():
    return {"status": "Analytics Service Running"}

@app.post("/analytics/trend")
def compute_trend(request: AnalyticsRequest):
    if len(request.data) < 2:
        raise HTTPException(status_code=400, detail="Not enough data points for trend analysis")

    df = pd.DataFrame([d.dict() for d in request.data])
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    
    # Simple linear regression: y = mx + c
    # We use integer index as X for simplicity in trend direction
    df['x'] = range(len(df))
    
    X = sm.add_constant(df['x'])
    y = df['value']
    
    model = sm.OLS(y, X).fit()
    slope = model.params['x']
    
    direction = "stable"
    if slope > 0.01:
        direction = "increasing"
    elif slope < -0.01:
        direction = "decreasing"
        
    return {
        "slope": slope,
        "direction": direction,
        "r_squared": model.rsquared
    }

@app.post("/analytics/spike")
def detect_spike(request: AnalyticsRequest):
    if len(request.data) < 5:
        raise HTTPException(status_code=400, detail="Not enough data for spike detection")
        
    df = pd.DataFrame([d.dict() for d in request.data])
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    
    # We compare the LATEST point against the statistics of the preceding window
    # to avoid the spike itself skewing the mean/std (masking effect).
    current_val = df.iloc[-1]['value']
    history = df.iloc[:-1]
    
    # Use the last 5 points of history as the reference window
    window_size = 5
    reference_window = history.tail(window_size)
    
    mean = reference_window['value'].mean()
    std = reference_window['value'].std()
    
    is_spike = False
    threshold_dist = 0.0
    
    # If std is 0 (all previous values identical), any significant deviation is a spike
    if std == 0 or pd.isna(std):
        # If std is 0, we can't use Z-score. 
        # We'll treat it as a spike if difference is > 20% of mean (heuristic) or just > 0 if strict?
        # Let's use a small epsilon for std to avoid division by zero or strict check
        if mean == 0:
            if abs(current_val) > 0: is_spike = True # 0 -> something
        else:
            pct_change = abs(current_val - mean) / abs(mean)
            if pct_change > 0.5: # 50% jump from steady state
                is_spike = True
        threshold_dist = 0 # Symbolic
    else:
        z_score = (current_val - mean) / std
        threshold_dist = 2 * std
        if abs(z_score) > 2:
            is_spike = True
            
    return {
        "is_spike": is_spike,
        "value": current_val,
        "mean": mean,
        "threshold": threshold_dist,
        "overall_mean": df['value'].mean()
    }
