import express from "express";
import bodyParser from "body-parser";
import { randomUUID } from "crypto";

const app = express();
app.use(bodyParser.json());

const transactions = [];

/*
Transaction schema:
{
  id: string,
  client_id: string,
  value: number,
  type: "debit" | "credit",
  description: string,
  date: ISOString
}
*/

app.post("/transactions", async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.client_id || typeof body.value !== "number") {
      return res.status(400).json({ error: "invalid_payload" });
    }

    await new Promise(r => setTimeout(r, 80)); // 80ms

    const tx = {
      id: body.id || randomUUID(),
      client_id: body.client_id,
      value: body.value,
      type: body.type || "debit",
      description: body.description || "",
      date: new Date().toISOString(),
    };
    transactions.push(tx);
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/transactions/:client_id", async (req, res) => {
  const client_id = req.params.client_id;
  await new Promise(r => setTimeout(r, 30));
  const list = transactions.filter(t => t.client_id === client_id);
  res.json(list);
});

const port = process.env.TRANSACTIONS_SERVICE_PORT || 4001;
app.listen(port, () => console.log(`Transaction REST server (B) running on :${port}`));
