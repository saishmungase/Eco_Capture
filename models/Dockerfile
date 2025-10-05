FROM python:3.10-slim

# system deps for pillow and basics
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libsndfile1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip

# install CPU-only PyTorch + torchvision wheels (official CPU wheels)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision

RUN pip install --no-cache-dir fastapi uvicorn pillow python-multipart requests

WORKDIR /app
COPY app.py /app/app.py

EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
