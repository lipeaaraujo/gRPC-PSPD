from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import httpx
import os

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

CLIENT_SERVICE_URL = os.getenv("CLIENT_SERVICE_URL", "http://localhost:4000")
TRANSACTION_SERVICE_URL = os.getenv("TRANSACTION_SERVICE_URL", "http://localhost:4001")

CLIENT_CREATE = CLIENT_SERVICE_URL + "/clients"
CLIENT_GET = CLIENT_SERVICE_URL + "/clients/{id}"
CLIENT_BALANCE = CLIENT_SERVICE_URL + "/clients/{id}/balance"
TRANSACTIONS = TRANSACTION_SERVICE_URL + "/transactions"
TRANSACTIONS_BY_CLIENT = TRANSACTION_SERVICE_URL + "/transactions/{client_id}"

@app.get('/')
def index():
    return {"message": "API ON"}

@app.post("/clients", status_code=201)
def create_client(client: CreateClient):
    try:
        body = client.model_dump()
        response = httpx.post(CLIENT_CREATE, json=body, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f'Fail: {str(e)}')

@app.get("/clients/{client_id}")
def get_client(client_id: str):
    try:
        response = httpx.get(CLIENT_GET.format(id=client_id), timeout=10.0)
        response.raise_for_status()
        return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f'Fail: {str(e)}')
    
@app.post("/transactions", status_code=201)
def perform_transaction(transaction: CreateTransaction):
    try:
        body = transaction.model_dump()
        response = httpx.post(TRANSACTIONS, json=body, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f'Fail: {str(e)}')
    
@app.get("/transactions/{client_id}")
def get_transactions(client_id: str):
    try:
        response = httpx.get(TRANSACTIONS_BY_CLIENT.format(client_id=client_id), timeout=10.0)
        response.raise_for_status()
        return response.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f'Fail: {str(e)}')

@app.get('/extrato/{client_id}')
def get_statement(client_id: str):
    try:
        client_resp = httpx.get(CLIENT_GET.format(id=client_id), timeout=10.0)
        client_resp.raise_for_status()
        client_data = client_resp.json()

        tx_resp = httpx.get(TRANSACTIONS_BY_CLIENT.format(client_id=client_id), timeout=10.0)
        tx_resp.raise_for_status()
        transactions = tx_resp.json().get("transactions", [])

        balance = client_data.get("balance", 0.0)

        return {
            "client": client_data,
            "transactions": transactions,
            "summary": {
                "total_transactions": len(transactions),
                "currentBalance": balance
            }
        }
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f'Fail: {str(e)}')

# @app.post("/api/process")
# async def process_transaction(request: Request):
#     payload = await request.json()
#     client_id = payload.get("client_id")
#     value = payload.get("value")
#     tx_type = payload.get("type", "debit")
#     description = payload.get("description", "")

#     async with httpx.AsyncClient(timeout=10.0) as client:
#         if not client_id:
#             body = { "name": payload.get("name", "auto-client"), "credit_limit": payload.get("credit_limit", 1000) }
#             resp = await client.post(A_CLIENT_CREATE, json=body)
#             if resp.status_code not in (200,201):
#                 raise HTTPException(status_code=502, detail="failed_create_client")
#             j = resp.json()
#             client_id = j["id"]

#         tx_body = {"client_id": client_id, "value": value, "type": tx_type, "description": description}
#         resp_tx = await client.post(B_TRANSACTIONS, json=tx_body)
#         if resp_tx.status_code not in (200,201):
#             raise HTTPException(status_code=502, detail="failed_create_transaction")
#         tx = resp_tx.json()

#         delta = -value if tx_type == "debit" else value
#         resp_bal = await client.put(A_CLIENT_BALANCE.format(id=client_id), json={"delta": delta})
#         if resp_bal.status_code != 200:
#             raise HTTPException(status_code=502, detail="failed_update_balance")
#         updated = resp_bal.json()

#     return {"client_id": client_id, "transaction": tx, "client": updated["client"]}

# if __name__ == "__main__":
#     uvicorn.run("webserver_rest:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
