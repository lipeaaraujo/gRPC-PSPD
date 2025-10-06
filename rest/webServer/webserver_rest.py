from fastapi import FastAPI, HTTPException, Request
import httpx
import uvicorn
import asyncio
import os
import uuid

app = FastAPI()

A_BASE = os.getenv("A_URL", "http://localhost:50051")
B_BASE = os.getenv("B_URL", "http://localhost:50052")

A_CLIENT_CREATE = A_BASE + "/v1/clients"
A_CLIENT_GET = A_BASE + "/v1/clients/{id}"
A_CLIENT_BALANCE = A_BASE + "/v1/clients/{id}/balance"
B_TRANSACTIONS = B_BASE + "/v1/transactions"
B_TRANSACTIONS_BY_CLIENT = B_BASE + "/v1/transactions/{client_id}"

@app.post("/api/process")
async def process_transaction(request: Request):
    payload = await request.json()
    client_id = payload.get("client_id")
    value = payload.get("value")
    tx_type = payload.get("type", "debit")
    description = payload.get("description", "")

    async with httpx.AsyncClient(timeout=10.0) as client:
        if not client_id:
            body = { "name": payload.get("name", "auto-client"), "credit_limit": payload.get("credit_limit", 1000) }
            resp = await client.post(A_CLIENT_CREATE, json=body)
            if resp.status_code not in (200,201):
                raise HTTPException(status_code=502, detail="failed_create_client")
            j = resp.json()
            client_id = j["id"]

        tx_body = {"client_id": client_id, "value": value, "type": tx_type, "description": description}
        resp_tx = await client.post(B_TRANSACTIONS, json=tx_body)
        if resp_tx.status_code not in (200,201):
            raise HTTPException(status_code=502, detail="failed_create_transaction")
        tx = resp_tx.json()

        delta = -value if tx_type == "debit" else value
        resp_bal = await client.put(A_CLIENT_BALANCE.format(id=client_id), json={"delta": delta})
        if resp_bal.status_code != 200:
            raise HTTPException(status_code=502, detail="failed_update_balance")
        updated = resp_bal.json()

    return {"client_id": client_id, "transaction": tx, "client": updated["client"]}

if __name__ == "__main__":
    uvicorn.run("webserver_rest:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
