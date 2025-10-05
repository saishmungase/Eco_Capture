FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libsndfile1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN python -m pip install --upgrade pip

# Install PyTorch CPU-only
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision

# Install FastAPI and other dependencies
RUN pip install --no-cache-dir fastapi uvicorn pillow python-multipart requests python-dotenv pydantic

# Set work directory
WORKDIR /app

# Copy your application
COPY app.py /app/app.py

# Expose API port
EXPOSE 8080

# Start FastAPI
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
