import type { VercelRequest, VercelResponse } from "@vercel/node";

async function getDb() {
  const { getFirestore } = await import("../../lib/firebase");
  return getFirestore();
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const db = await getDb();
    const col = db.collection("bills");

    if (req.method === "GET") {
      const snap = await col.orderBy("createdAt", "desc").get();
      return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    if (req.method === "POST") {
      const now = new Date().toISOString();
      const bill = { ...req.body, id: newId(), createdAt: now, updatedAt: now };
      await col.doc(bill.id).set(bill);
      return res.json(bill);
    }

    if (req.method === "PUT") {
      const { id, ...data } = req.body;
      if (!id) return res.status(400).json({ error: "Missing id" });
      const updated = { ...data, updatedAt: new Date().toISOString() };
      await col.doc(id).update(updated);
      return res.json({ id, ...updated });
    }

    if (req.method === "DELETE") {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: "Missing id" });
      await col.doc(id).delete();
      return res.json({ success: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
