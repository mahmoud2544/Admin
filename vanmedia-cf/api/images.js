import { list } from "@vercel/blob";

export default async function handler(req, res) {
  const pathParam = req.query.path;
  if (!pathParam) {
    return res.status(404).send("Not found");
  }

  const key = pathParam.startsWith("Images/") ? pathParam : `Images/${pathParam}`;

  try {
    const { blobs } = await list({ prefix: key });
    const blob = blobs.find((b) => b.pathname === key);
    if (blob && blob.url) {
      return res.redirect(307, blob.url);
    }
  } catch (e) {
    console.error("Error locating image in Vercel Blob:", e);
  }

  return res.status(404).send("Not found");
}
