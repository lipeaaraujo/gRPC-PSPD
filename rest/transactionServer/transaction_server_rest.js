import express from "express";
import bodyParser from "body-parser";
import { randomUUID } from "crypto";
import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

const app = express();
app.use(bodyParser.json());

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

const clientUrl = process.env.CLIENT_SERVICE_URL || "http://localhost:4000";

const verifyClient = async (client_id) => {
  const res = await fetch(`${clientUrl}/clients/${client_id}`);
  if (res.status !== 200) {
    throw new Error("client not found");
  }
}

app.post("/transactions", async (req, res) => {
  try {
    const { client_id, value, type, description } = req.body;

    if (!client_id || !value || !type || typeof value !== "number") {
      return res.status(400).json({ error: "invalid payload" });
    }

    if (type !== "d" && type !== "c") {
      return res.status(400).json({
        error: "transaction must be 'd' or 'c'"
      });
    }

    await verifyClient(client_id);

    const tx = {
      id: randomUUID(),
      client_id,
      value,
      type: type || "d",
      description: description || "",
      date: new Date().toISOString(),
    };

    const createdTransaction = await prisma.transaction.create({
      data: tx
    });

    res.status(201).json(createdTransaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/transactions/:client_id", async (req, res) => {
  const client_id = req.params.client_id;
  await new Promise(r => setTimeout(r, 30));

  const clientTransactions = await prisma.transaction.findMany({
    where: { client_id }
  });

  res.json({
    "transactions": clientTransactions
  });
});

const port = process.env.TRANSACTIONS_SERVICE_PORT || 4001;
app.listen(port, () => console.log(`Transaction REST server (B) running on :${port}`));
