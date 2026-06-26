const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { isMongoConnected } = require("../config/database");

const memoryUsers = [];

function publicUser(user) {
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
  };
}

function avatarColorFor(value) {
  const palette = ["#2a9d8f", "#22577a", "#8b5cf6", "#f97316", "#e11d48", "#16a34a"];
  const index = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

async function createUser({ name, email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);

  if (isMongoConnected()) {
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      const error = new Error("An account with this email already exists.");
      error.status = 409;
      throw error;
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      avatarColor: avatarColorFor(normalizedEmail),
    });

    return publicUser(user);
  }

  if (memoryUsers.some((user) => user.email === normalizedEmail)) {
    const error = new Error("An account with this email already exists.");
    error.status = 409;
    throw error;
  }

  const user = {
    id: String(Date.now()),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    avatarColor: avatarColorFor(normalizedEmail),
  };
  memoryUsers.push(user);
  return publicUser(user);
}

async function validateUser({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = isMongoConnected()
    ? await User.findOne({ email: normalizedEmail })
    : memoryUsers.find((item) => item.email === normalizedEmail);

  if (!user) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const error = new Error("Invalid email or password.");
    error.status = 401;
    throw error;
  }

  return publicUser(user);
}

async function updateUserProfile(userId, { name }) {
  const nextName = typeof name === 'string' ? name.trim().slice(0, 40) : '';
  if (!nextName) {
    const error = new Error("Display name is required.");
    error.status = 400;
    throw error;
  }

  if (isMongoConnected()) {
    const user = await User.findByIdAndUpdate(userId, { name: nextName }, { new: true });
    if (!user) {
      const error = new Error("User not found.");
      error.status = 404;
      throw error;
    }
    return publicUser(user);
  }

  const user = memoryUsers.find((item) => String(item.id) === String(userId));
  if (!user) {
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }

  user.name = nextName;
  return publicUser(user);
}

module.exports = {
  createUser,
  updateUserProfile,
  validateUser,
};
