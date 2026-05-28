const Message = require("../models/Message");
const { isMongoConnected } = require("../config/database");

const memoryMessages = [];

function serializeMessage(message) {
  return {
    id: String(message._id || message.id),
    room: message.room,
    username: message.username,
    userId: message.userId ? String(message.userId) : null,
    text: message.text,
    type: message.type || "message",
    status: message.status || "sent",
    createdAt: message.createdAt || new Date().toISOString(),
  };
}

async function saveMessage(payload) {
  const message = {
    room: payload.room,
    username: payload.username,
    userId: payload.userId || null,
    text: payload.text,
    type: payload.type || "message",
    status: payload.status || "sent",
  };

  if (isMongoConnected()) {
    const saved = await Message.create(message);
    return serializeMessage(saved);
  }

  const saved = {
    ...message,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  memoryMessages.push(saved);
  return serializeMessage(saved);
}

async function getRoomMessages(room, limit = 50) {
  if (isMongoConnected()) {
    const messages = await Message.find({ room })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return messages.reverse().map(serializeMessage);
  }

  return memoryMessages
    .filter((message) => message.room === room)
    .slice(-limit)
    .map(serializeMessage);
}

module.exports = {
  getRoomMessages,
  saveMessage,
};
