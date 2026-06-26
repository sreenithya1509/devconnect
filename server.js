const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const createAdapter = require("@socket.io/redis-adapter").createAdapter;
const redis = require("redis");
require("dotenv").config();

const authRoutes = require("./backend/routes/auth");
const { connectDatabase } = require("./backend/config/database");
const { getRoomMessages, saveMessage } = require("./backend/services/messageStore");
const {
  getCurrentUser,
  getRoomUsers,
  userJoin,
  userLeave,
} = require("./backend/services/presence");
const { verifyToken } = require("./backend/utils/jwt");

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = socketio(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : "*",
    methods: ["GET", "POST"],
  },
});

const rooms = ["JavaScript", "Python", "UI/UX", "DevOps", "Career Prep", "Open Source"];

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/auth", authRoutes);

app.get("/api/rooms", (req, res) => {
  res.json({ rooms });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "DevConnect" });
});

async function configureRedisAdapter() {
  if (process.env.REDIS_ENABLED !== "true" && !process.env.REDIS_URL) {
    console.log("Redis adapter disabled. Running with in-memory Socket.IO adapter.");
    return;
  }

  try {
    const pubClient = redis.createClient({
      url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    });
    pubClient.on("error", (error) => {
      console.warn("Redis pub client error:", error.message);
    });
    await pubClient.connect();

    const subClient = pubClient.duplicate();
    subClient.on("error", (error) => {
      console.warn("Redis sub client error:", error.message);
    });
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO Redis adapter connected.");
  } catch (error) {
    console.warn(
      "Redis adapter unavailable. Falling back to the in-memory Socket.IO adapter:",
      error.message
    );
  }
}

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication required."));
  }

  try {
    socket.user = verifyToken(token);
    return next();
  } catch (error) {
    return next(new Error("Session expired. Please sign in again."));
  }
});

io.on("connection", (socket) => {
  socket.on("joinRoom", async ({ room }) => {
    const selectedRoom = rooms.includes(room) ? room : rooms[0];
    const previousUser = getCurrentUser(socket.id);
    if (previousUser && previousUser.room !== selectedRoom) {
      socket.leave(previousUser.room);
      userLeave(socket.id);
      emitRoomPresence(previousUser.room);
    }

    const user = userJoin({
      id: socket.id,
      userId: socket.user.id,
      username: socket.user.name,
      room: selectedRoom,
      avatarColor: socket.user.avatarColor,
    });

    socket.join(user.room);

    try {
      const history = await getRoomMessages(user.room);
      socket.emit("messageHistory", history);

      const notice = await saveMessage({
        room: user.room,
        username: "DevConnect",
        text: `${user.username} joined ${user.room}`,
        type: "system",
        status: "seen",
      });
      socket.to(user.room).emit("message", notice);

      emitRoomPresence(user.room);
    } catch (error) {
      socket.emit("appError", {
        message: "Could not load previous messages. New realtime messages will still work.",
      });
    }
  });

  socket.on("chatMessage", async (msg, callback) => {
    const user = getCurrentUser(socket.id);
    const text = typeof msg === "string" ? msg.trim() : "";

    if (!user || !text) {
      if (callback) callback({ ok: false, message: "Message cannot be empty." });
      return;
    }

    try {
      const message = await saveMessage({
        room: user.room,
        username: user.username,
        userId: user.userId,
        text,
        type: "message",
        status: "sent",
      });

      io.to(user.room).emit("message", message);
      if (callback) callback({ ok: true, id: message.id });
    } catch (error) {
      if (callback) callback({ ok: false, message: "Message could not be saved." });
      socket.emit("appError", { message: "Message could not be saved. Please try again." });
    }
  });

  socket.on("typing:start", () => {
    const user = getCurrentUser(socket.id);
    if (user) {
      socket.to(user.room).emit("typing", { username: user.username, isTyping: true });
    }
  });

  socket.on("typing:stop", () => {
    const user = getCurrentUser(socket.id);
    if (user) {
      socket.to(user.room).emit("typing", { username: user.username, isTyping: false });
    }
  });

  socket.on("profile:update", ({ name }, callback) => {
    const user = getCurrentUser(socket.id);
    const nextName = typeof name === "string" ? name.trim().slice(0, 40) : "";

    if (!user || !nextName) {
      if (callback) callback({ ok: false });
      return;
    }

    user.username = nextName;
    socket.user.name = nextName;
    emitRoomPresence(user.room);
    if (callback) callback({ ok: true });
  });

  socket.on("disconnect", async () => {
    const user = userLeave(socket.id);

    if (user) {
      try {
        const notice = await saveMessage({
          room: user.room,
          username: "DevConnect",
          text: `${user.username} left ${user.room}`,
          type: "system",
          status: "seen",
        });
        socket.to(user.room).emit("message", notice);
      } catch (error) {
        socket.to(user.room).emit("appError", { message: "Presence update could not be saved." });
      }

      emitRoomPresence(user.room);
    }
  });
});

function emitRoomPresence(room) {
  io.to(room).emit("roomUsers", {
    room,
    users: getRoomUsers(room),
  });
}

async function startServer() {
  await connectDatabase();
  await configureRedisAdapter();

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`DevConnect server running on port ${PORT}`));
}

startServer();
