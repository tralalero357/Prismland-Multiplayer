# Prismland Multiplayer

Your original Prismland game, upgraded for online multiplayer (up to 20 players per room).

## Included

- `public/Prismland.html` — game client (Three.js, original terrain/building/movement preserved)
- `server.js` — Node.js + Socket.IO multiplayer server
- `package.json` — dependencies and start command

## Run locally

1. Install **Node.js 18 or newer**.
2. Open a terminal in this folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser.
6. Click **Create world**. Share the 6-character room code with friends.

For friends on the same Wi-Fi, they can open `http://YOUR-COMPUTER-LAN-IP:3000`.
For friends anywhere on the internet, deploy the whole folder to a Node.js host with WebSocket support (for example Render, Railway, or Fly.io), then share the public URL and room code.

## Deploy online (Render example)

1. Put this project in a GitHub repository.
2. In Render, create a **New Web Service** and connect that repository.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.
5. Deploy. Open the HTTPS URL Render gives you.
6. Share that URL and the room code with your friends.

The server uses the hosting provider's `PORT` environment variable automatically. Keep the service running while playing; rooms and world edits are held in server memory and are cleared if the server restarts.

## Multiplayer notes

- Each room supports up to 20 simultaneous players.
- Players, their movement, chat messages, and block edits are synchronized.
- Every browser generates the same initial terrain locally; the server stores changes made by players.
- The current version keeps room data in memory (not a permanent save). Anyone with the room code can join while the room exists.
- Use a trusted host and share room codes only with people you want in your world.
