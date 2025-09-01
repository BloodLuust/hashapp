# Use Python 3.11 (Alpine) as a minimal base image
FROM python:3.11-alpine

# Set working directory
WORKDIR /app

# Install system certificates to avoid TLS verification errors
RUN apk add --no-cache ca-certificates && update-ca-certificates

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI app code
COPY . .

# Expose port 8000 for the FastAPI app
EXPOSE 8000

# Start the FastAPI server with Uvicorn (accessible externally via 0.0.0.0)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
