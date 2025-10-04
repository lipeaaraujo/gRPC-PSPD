import grpc 
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import manager_pb2
import manager_pb2_grpc

from google.protobuf.json_format import MessageToDict

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

channel_server_client = grpc.insecure_channel('localhost:50051')
channel_server_transaction = grpc.insecure_channel('localhost:50052')

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
        raise HTTPException(status_code= 500, detail=f'')