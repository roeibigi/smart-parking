# Pinned version (not "latest"), slim = small Debian-based image
FROM python:3.12-slim

WORKDIR /app

# Copy requirements first: Docker caches this layer, so editing app.py
# doesn't reinstall the packages on every build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Print logs immediately (otherwise `docker compose logs` looks empty)
ENV PYTHONUNBUFFERED=1

CMD ["python", "app.py"]
