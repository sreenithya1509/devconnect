const jwt = require("jsonwebtoken");

function getJwtSecret() {
  return process.env.JWT_SECRET || "devconnect-local-secret-change-me";
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  signToken,
  verifyToken,
};
