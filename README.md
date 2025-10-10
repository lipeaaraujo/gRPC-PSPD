# gRPC PSPD - Sistema de Transações Financeiras

Sistema distribuído de transações financeiras implementado com gRPC e REST, usando Node.js e Python.

## Clonar Repositório

```bash
git clone https://github.com/lipeaaraujo/gRPC-PSPD.git
cd gRPC-PSPD
```

## Arquitetura

O sistema possui três serviços principais:
- **Client Server** (Node.js): Gerenciamento de clientes
- **Transaction Server** (Node.js): Processamento de transações  
- **Web Server** (Python/FastAPI): Gateway HTTP que expõe APIs REST

## Formas de Execução

OBS: Para execução com Docker Compose importante copiar o arquivo `.env.example` para `.env` em cada versão (gRPC e REST).

### 1. gRPC com Docker Compose

```bash
cd grpc/
docker-compose up --build
```

**Portas:**
- Client Server: 4000
- Transaction Server: 4001
- Web Server (FastAPI): 8080
- Banco de dados (clientes): 5432
- Banco de dados (transações): 5433

### 2. REST com Docker Compose

```bash
cd rest/
docker-compose up --build
```

### 3. Kubernetes (gRPC)

```bash
cd grpc/

# Deploy do banco de dados
kubectl apply -f db-deployment.yaml

# Deploy dos serviços
kubectl apply -f deployment.yaml

# Listar pods e serviços
kubectl get pods
kubectl get services

# Redirecionar porta local para o Web Server
kubectl port-forward service/web-grpc-server 8080:8080
```

OpenAPI do Web Server gRPC: `http://localhost:8080/docs`

### 4. Kubernetes (REST)

```bash
cd rest/

# Deploy do banco de dados
kubectl apply -f db-deployment.yaml

# Deploy dos serviços  
kubectl apply -f deployment.yaml

# Listar pods e serviços
kubectl get pods
kubectl get services

# Redirecionar porta local para o Web Server
kubectl port-forward service/web-rest-server 8080:8080
```

OpenAPI do Web Server REST: `http://localhost:8080/docs`

## APIs Disponíveis (Web Server)

### Clientes
- `POST /clients` - Criar cliente
- `GET /clients/{client_id}` - Consultar cliente

### Transações
- `POST /transactions` - Realizar transação
- `GET /transactions/{client_id}` - Listar transações do cliente
- `GET /extrato/{client_id}` - Extrato completo do cliente

## Estrutura dos Serviços

### Client Server (`src/clientServer/client_server.js`)
- `registerClient` - Registra novos clientes
- `consultClient` - Consulta dados do cliente

### Transaction Server (`src/transactionServer/transaction_server.js`)
- `requestTransaction` - Processa transações
- `consultTransactions` - Lista transações

### Web Server (`src/webServer/app.py`)
- Gateway HTTP que conecta com os serviços gRPC
- Expõe APIs REST para consumo externo

## Configuração

Cada versão possui arquivo `.env.example` para configuração das portas e URLs dos serviços.

## Testes

Para executar testes de carga com K6, consulte o [guia de testes](tests/README.md).