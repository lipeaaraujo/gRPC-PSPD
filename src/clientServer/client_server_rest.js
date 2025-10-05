import express from "express";
import bodyParser from "body-parser";
import { randomUUID } from "crypto";

const app = express();
app.use(bodyParser.json());

const clients = new Map();

/*
Client schema:
{
  id: string,
  name: string,
  credit_limit: number,
  balance: number
}
*/

app.post("/v1/clients", async (req, res) => {
  try {
    const body = req.body || {};
    const id = body.id || randomUUID();
    const client = {
      id,
      name: body.name || "anonymous",
      credit_limit: typeof body.credit_limit === "number" ? body.credit_limit : 1000,
      balance: typeof body.balance === "number" ? body.balance : 0,
    };
    await new Promise(r => setTimeout(r, 50)); 
    clients.set(id, client);
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/v1/clients/:id", async (req, res) => {
  const id = req.params.id;
  await new Promise(r => setTimeout(r, 20));
  if (!clients.has(id)) return res.status(404).json({ error: "client_not_found" });
  res.json(clients.get(id));
});

app.put("/v1/clients/:id/balance", async (req, res) => {
  const id = req.params.id;
  const { delta } = req.body;
  if (!clients.has(id)) return res.status(404).json({ error: "client_not_found" });
  await new Promise(r => setTimeout(r, 30));
  const c = clients.get(id);
  c.balance = Number(c.balance) + Number(delta);
  clients.set(id, c);
  res.json({ ok: true, client: c });
});

const port = process.env.PORT || 50051;
app.listen(port, () => console.log(`Client REST server (A) running on :${port}`));
