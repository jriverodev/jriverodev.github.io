Signed URL Upload Service (server)

Overview
- This small service provides an endpoint to request a Signed URL from Supabase Storage for a given bucket and path.
- Use the service_role key on the server to call Supabase's /storage/v1/object/sign endpoint.
- The client (browser/app) then uploads directly to the Signed URL (PUT), which avoids exposing service_role credentials in the client.

Files created
- server/sign-upload.js  -> Express endpoint POST /api/sign-upload
- server/.env.example    -> environment variables example
- js/sign-upload-client-snippet.js -> client helpers to request signed URL and upload

How to run (server)
1) Create server directory and install dependencies
   cd server
   npm init -y
   npm install express node-fetch@2 dotenv

2) Copy .env.example to .env and fill values
   SUPABASE_URL=https://<your-project>.supabase.co
   SERVICE_ROLE_KEY=<your-service-role-key>

3) Start the service
   node sign-upload.js

API
POST /api/sign-upload
- Body JSON: { bucket: 'ttocc-archivos', path: 'uploads/miimagen.jpg', expires: 600 }
- Response 200: { signedUrl: 'https://...' }
- Response non-200: returns upstream body from Supabase for easier debugging

Security notes
- Protect the sign endpoint with authentication (JWT/session) so only authorized users can request signed URLs.
- Do NOT commit the service_role key to source control. Use environment variables or a secrets manager.
- Use short expiration times for signed URLs (e.g. 5-10 minutes) in production.

Client integration
- The repo contains js/sign-upload-client-snippet.js with helper functions: requestSignedUrl, base64ToBlob, uploadToSignedUrl.
- Typical flow:
  1. Client asks /api/sign-upload for a Signed URL for a unique path.
  2. Client uploads the file with PUT to Signed URL.
  3. Client stores the storage path in the record and upserts it into Postgres/Supabase.

If you want, I can:
- Add an Express route to validate the user token before signing.
- Add a small example page that requests a Signed URL and uploads a selected file.
- Add a PowerShell / curl sample that performs the same end-to-end flow.
