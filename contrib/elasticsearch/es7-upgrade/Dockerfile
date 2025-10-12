FROM python:3.14.0
COPY . .
RUN pip install --upgrade pip
RUN pip install elasticsearch
ENTRYPOINT ["python", "transfer.py"]