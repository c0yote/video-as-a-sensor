FROM python:3.11-slim

# Avoid the NumPy 2.x ABI by pinning to 1.26.x BEFORE installing OpenCV
RUN pip install --no-cache-dir numpy==1.26.4 opencv-python-headless==4.9.0.80

COPY worker.py /worker.py
ENV PYTHONUNBUFFERED=1
CMD ["python", "/worker.py"]