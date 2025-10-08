import express from "express";
import bodyParser from "body-parser";
import { randomUUID } from "crypto";
import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient();

const app = express();
app.use(bodyParser.json());

/*
Client schema:
{
  id: string,
  name: string,
  credit_limit: number,
  balance: number
}
*/

app.post("/clients", async (req, res) => {
  try {
    const body = req.body || {};
    const id = randomUUID();

    if (!body.name || !body.credit_limit || typeof body.credit_limit !== "number") {
      return res.status(400).json({ error: "invalid payload" });
    }

    const newClient = {
      id,
      name: body.name,
      credit_limit: body.credit_limit,
      balance: 1000,
    };

    const user = await prisma.user.create({
      data: newClient
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/clients/:id", async (req, res) => {
  const id = req.params.id;

  const client = await prisma.user.findUnique({
    where: { id }
  });
  
  if (!client) return res.status(404).json({ error: "client not found" });
  res.json(client);
});

const port = process.env.CLIENT_SERVICE_PORT || 4000;
app.listen(port, () => console.log(`Client REST server (A) running on :${port}`));
