from contextlib import contextmanager
from signal import signal
import grpc 
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from prometheus_fastapi_instrumentator import Instrumentator
import os

import manager_pb2
import manager_pb2_grpc

from google.protobuf.json_format import MessageToDict

load_dotenv()

class CreateClient(BaseModel):
    name: str
    credit_limit: float

class CreateTransaction(BaseModel):
    client_id: str
    value: float
    type: str = ""
    description: str = ""

app = FastAPI(
    title="API Gateway Transactions",
    description="Gateway HTTP",
    version= "1.0.0"
)

Instrumentator().instrument(app).expose(app)

channel_server_client = grpc.insecure_channel(
    os.getenv("GRPC_CLIENT_URL")
)
channel_server_transaction = grpc.insecure_channel(
    os.getenv("GRPC_TRANSACTION_URL")
)

stub_client = manager_pb2_grpc.ClientServiceStub(channel_server_client)
stub_transaction = manager_pb2_grpc.TransactionServiceStub(
    channel_server_transaction
)

async def grpc_with_timeout_async(fn, timeout):
    loop = asyncio.get_event_loop()
    return await asyncio.wait_for(loop.run_in_executor(None, fn), timeout)

@app.get('/')
def index():
    return {"message": "API ON"}

@app.post("/clients", status_code= 201)
async def creat_client(client: CreateClient):
    try:
        grpc_request = manager_pb2.RegisterClientRequest(
            name= client.name,
            credit_limit = client.credit_limit
        )

        grpc_response = await grpc_with_timeout_async(lambda: stub_client.RegisterClient(grpc_request), 5)
        return MessageToDict(grpc_response)
    except grpc.RpcError as e:
        raise HTTPException(status_code = 500, detail=f'Fail: {e.details()}')
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timed out")

@app.get("/clients/{client_id}")
async def get_client(client_id: str):
    try:
        grpc_request = manager_pb2.ConsultClientRequest(
            id=client_id
        )
        
        grpc_response = await grpc_with_timeout_async(lambda: stub_client.ConsultClient(grpc_request), 5)
        return MessageToDict(grpc_response)
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.NOT_FOUND:
            raise HTTPException(status_code=404, detail="Client not found")
        raise HTTPException(status_code=500, detail=f'Fail: {e.details()}')
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timed out")

@app.post('/transactions')
async def perform_transaction(transaction: CreateTransaction):
    try:
        grpc_request = manager_pb2.PerformTransaction(
            client_id= transaction.client_id,
            value=transaction.value,
            type =transaction.type,
            description= transaction.description
        )

        grpc_reponse = await grpc_with_timeout_async(lambda: stub_transaction.RequestTransaction(grpc_request), 5)
        return MessageToDict(grpc_reponse)
    except grpc.RpcError as e:
        raise HTTPException(status_code= 500, detail=f'Fail: {e.details()}')
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timed out")

@app.get('/transactions/{client_id}')
async def get_transactions(client_id: str):
    try:
        grpc_request = manager_pb2.ConsultClientRequest(
            id=client_id
        )
        
        transactions = []
        grpc_response_stream = await grpc_with_timeout_async(lambda: stub_transaction.ConsultTransaction(grpc_request), 5)
        
        for transaction in grpc_response_stream:
            transactions.append(MessageToDict(transaction))
            
        return {"transactions": transactions}
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.NOT_FOUND:
            raise HTTPException(status_code=404, detail="Client not found or no transactions")
        raise HTTPException(status_code=500, detail=f'Fail: {e.details()}')
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timed out")

@app.get('/extrato/{client_id}')
async def get_extrato(client_id: str):
    try:
       
        client_request = manager_pb2.ConsultClientRequest(id=client_id)
        client_response = await grpc_with_timeout_async(lambda: stub_client.ConsultClient(client_request), 5)
        client_data = MessageToDict(client_response)
        
       
        transactions = []
        transaction_request = manager_pb2.ConsultClientRequest(id=client_id)
        
        try:
            grpc_response_stream = await grpc_with_timeout_async(lambda: stub_transaction.ConsultTransaction(transaction_request), 5)
            for transaction in grpc_response_stream:
                transactions.append(MessageToDict(transaction))
        except grpc.RpcError as transaction_error:
            if transaction_error.code() != grpc.StatusCode.NOT_FOUND:
                raise transaction_error
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Request timed out")
        
       
        # Função auxiliar para converter valores
        def safe_float(value, default=0.0):
            if isinstance(value, str):
                try:
                    return float(value) if value else default
                except ValueError:
                    return default
            return float(value) if value is not None else default
        
        # Converter valores do cliente
        credit_limit = safe_float(client_data.get("creditLimit"))
        balance = safe_float(client_data.get("balance"))
        
        extrato = {
            "client": {
                "id": client_data.get("id"),
                "name": client_data.get("name"),
                "creditLimit": credit_limit,
                "balance": balance
            },
            "transactions": transactions,
            "summary": {
                "totalTransactions": len(transactions),
                "currentBalance": balance
            }
        }
        
        return extrato
        
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.NOT_FOUND:
            raise HTTPException(status_code=404, detail="Client not found")
        raise HTTPException(status_code=500, detail=f'Fail: {e.details()}')
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timed out")