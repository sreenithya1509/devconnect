const { verifyToken } = require("../utils/jwt");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }
}

module.exports = authenticate;
