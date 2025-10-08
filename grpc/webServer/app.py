import grpc 
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
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

@app.get('/')
def index():
    return {"message": "API ON"}

@app.post("/clients", status_code= 201)
def creat_client(client: CreateClient):
    try:
        grpc_request = manager_pb2.RegisterClientRequest(
            name= client.name,
            credit_limit = client.credit_limit
        )

        grpc_response = stub_client.RegisterClient(grpc_request)
        return MessageToDict(grpc_response)
    except grpc.RpcError as e:
        raise HTTPException(status_code = 500, detail=f'Fail: {e.details()}')

@app.get("/clients/{client_id}")
def get_client(client_id: str):
    try:
        grpc_request = manager_pb2.ConsultClientRequest(
            id=client_id
        )
        
        grpc_response = stub_client.ConsultClient(grpc_request)
        return MessageToDict(grpc_response)
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.NOT_FOUND:
            raise HTTPException(status_code=404, detail="Client not found")
        raise HTTPException(status_code=500, detail=f'Fail: {e.details()}')
    
@app.post('/transactions')
def perform_transaction(transaction: CreateTransaction):
    try:
        grpc_request = manager_pb2.PerformTransaction(
            client_id= transaction.client_id,
            value=transaction.value,
            type =transaction.type,
            description= transaction.description
        )

        grpc_reponse = stub_transaction.RequestTransaction(grpc_request)
        return MessageToDict(grpc_reponse)
    except grpc.RpcError as e:
        raise HTTPException(status_code= 500, detail=f'Fail: {e.details()}')

@app.get('/transactions/{client_id}')
def get_transactions(client_id: str):
    try:
        grpc_request = manager_pb2.ConsultClientRequest(
            id=client_id
        )
        
        transactions = []
        grpc_response_stream = stub_transaction.ConsultTransaction(grpc_request)
        
        for transaction in grpc_response_stream:
            transactions.append(MessageToDict(transaction))
            
        return {"transactions": transactions}
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.NOT_FOUND:
            raise HTTPException(status_code=404, detail="Client not found or no transactions")
        raise HTTPException(status_code=500, detail=f'Fail: {e.details()}')

@app.get('/extrato/{client_id}')
def get_extrato(client_id: str):
    try:
       
        client_request = manager_pb2.ConsultClientRequest(id=client_id)
        client_response = stub_client.ConsultClient(client_request)
        client_data = MessageToDict(client_response)
        
       
        transactions = []
        transaction_request = manager_pb2.ConsultClientRequest(id=client_id)
        
        try:
            grpc_response_stream = stub_transaction.ConsultTransaction(transaction_request)
            for transaction in grpc_response_stream:
                transactions.append(MessageToDict(transaction))
        except grpc.RpcError as transaction_error:
           
            if transaction_error.code() != grpc.StatusCode.NOT_FOUND:
                raise transaction_error
        
       
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