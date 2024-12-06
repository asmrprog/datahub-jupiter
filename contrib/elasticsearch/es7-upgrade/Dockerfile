FROM python:3.14.0a2
COPY . .
RUN pip install --upgrade pip
RUN pip install elasticsearch
ENTRYPOINT ["python", "transfer.py"]