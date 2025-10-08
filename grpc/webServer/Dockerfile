FROM python:3.12-alpine

WORKDIR /app

COPY ./webServer/requirements.txt ./app/requirements.txt
RUN pip install --no-cache-dir -r ./app/requirements.txt

EXPOSE 8080
COPY ./webServer /app
COPY ./manager.proto /app/manager.proto

CMD ["fastapi", "run", "app.py", "--port", "8080"]