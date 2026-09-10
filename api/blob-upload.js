import { handleUpload } from '@vercel/blob/client';
import { getSessionEmail } from './_lib/auth.js';

// Called by the browser's upload() helper before it sends a file straight to
// Blob storage. The session token travels inside clientPayload (not a
// custom header) because @vercel/blob's upload() doesn't forward custom
// headers to this request.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let sessionToken = null;
        try {
          sessionToken = JSON.parse(clientPayload || '{}').sessionToken;
        } catch {
          sessionToken = null;
        }
        const email = await getSessionEmail(sessionToken);
        if (!email) throw new Error('Unauthorized');
        return {
          allowedContentTypes: ['image/*', 'video/*'],
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // The browser registers the finished upload itself via POST /api/media,
        // so nothing to do here.
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
