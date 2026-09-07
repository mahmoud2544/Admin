import { getBlobJson } from "./_shared/blob.js";
import { renderSite } from "./_shared/render.js";

export default async function handler(req, res) {
  let data = (await getBlobJson("content.json")) || {};
  if (Array.isArray(data.portfolio)) {
    data = { ...data, portfolio: [...data.portfolio].reverse() };
  }
  const html = renderSite(data);
  res.setHeader("Content-Type", "text/html; charset=UTF-8");
  res.status(200).send(html);
}
