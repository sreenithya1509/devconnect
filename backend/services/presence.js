const users = [];

function normalizeText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().slice(0, 40);
  return normalized || fallback;
}

function userJoin({ id, userId, username, room, avatarColor }) {
  const existingIndex = users.findIndex((user) => user.id === id);
  if (existingIndex !== -1) {
    users.splice(existingIndex, 1);
  }

  const user = {
    id,
    userId,
    username: normalizeText(username, "Guest"),
    room: normalizeText(room, "General"),
    avatarColor: avatarColor || "#2a9d8f",
    status: "online",
  };

  users.push(user);
  return user;
}

function getCurrentUser(id) {
  return users.find((user) => user.id === id);
}

function userLeave(id) {
  const index = users.findIndex((user) => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }

  return null;
}

function getRoomUsers(room) {
  return users.filter((user) => user.room === room);
}

module.exports = {
  getCurrentUser,
  getRoomUsers,
  userJoin,
  userLeave,
};
