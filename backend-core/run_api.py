#!/usr/bin/env python3
"""
FastAPI startup wrapper for uvicorn
Fixes module loading issues by ensuring proper sys.path configuration
"""
import sys
import os

# Ensure current directory is in path for uvicorn module resolution
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, log_level="info", reload=True)
