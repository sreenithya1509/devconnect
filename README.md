# DevConnect

DevConnect is a modern realtime collaboration platform built with Node.js, Express, Socket.IO, MongoDB, and a responsive vanilla frontend. It supports authenticated workspaces, realtime team channels, live presence, typing indicators, and persistent room history.

## Features

- JWT login and signup with persistent browser sessions
- Realtime Socket.IO rooms and message delivery
- MongoDB/Mongoose message and user storage
- Previous message history loaded when joining a channel
- Online presence, join/leave notices, and typing indicators
- Dark/light mode with system preference fallback and localStorage persistence
- Responsive Discord/Slack-inspired collaboration UI
- Loading skeletons, empty states, error banners, sticky sidebar, and sticky composer
- Deployment-friendly CORS, environment variables, and optional Redis adapter

## Tech Stack

- Node.js
- Express.js
- Socket.IO
- MongoDB Atlas
- Mongoose
- JWT
- bcryptjs
- HTML, CSS, JavaScript

## Installation

```powershell
cd C:\Users\csree\chatcord
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3000`.

For development with auto-restart:

```powershell
npm run dev
```

## Environment Variables

Create a `.env` file from `.env.example`.

```env
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/devconnect
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000
REDIS_ENABLED=false
REDIS_URL=
```

`MONGODB_URI` is optional for local demo mode. If it is not set, DevConnect uses in-memory storage so the app still runs. For production, use MongoDB Atlas.



## Deployment

### Backend on Render or Railway

1. Create a new Node.js web service.
2. Set the build command to `npm install`.
3. Set the start command to `npm start`.
4. Add environment variables from `.env.example`.
5. Set `CLIENT_ORIGIN` to the deployed frontend URL if hosting frontend separately.
6. Ensure WebSocket support is enabled by the platform.

### Database on MongoDB Atlas

1. Create an Atlas cluster.
2. Add a database user.
3. Allow your deployment platform IPs or use a suitable network access rule.
4. Copy the connection string into `MONGODB_URI`.

### Frontend on Vercel

The current app can be served by Express from `public/`. If deploying the frontend separately on Vercel, set the frontend project root to `public/` and point API/WebSocket calls to the backend URL. Keep `CLIENT_ORIGIN` on the backend in sync with the Vercel URL.

