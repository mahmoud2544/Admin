import { getBlobJson, putBlobJson } from "../_shared/blob.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  let type = req.query.type;
  if (!type && req.body) {
    type = req.body.type;
  }
  if (!type) type = "view";

  const data = (await getBlobJson("analytics.json")) || { views: 0, interactions: 0, monthly: {} };

  if (type === "view") data.views = (data.views || 0) + 1;
  else if (type === "interaction") data.interactions = (data.interactions || 0) + 1;

  const monthKey = new Date().toISOString().slice(0, 7);
  if (!data.monthly) data.monthly = {};
  if (!data.monthly[monthKey]) data.monthly[monthKey] = { views: 0, interactions: 0 };
  if (type === "view") data.monthly[monthKey].views += 1;
  else if (type === "interaction") data.monthly[monthKey].interactions += 1;

  await putBlobJson("analytics.json", data);
  return res.status(200).json({ success: true });
}
