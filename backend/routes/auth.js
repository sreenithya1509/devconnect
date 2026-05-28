const express = require("express");
const authenticate = require("../middleware/auth");
const { createUser, updateUserProfile, validateUser } = require("../services/userStore");
const { signToken } = require("../utils/jwt");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({
        message: "Name, valid email, and a password of at least 6 characters are required.",
      });
    }

    const user = await createUser({ name, email, password });
    return res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Signup failed." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await validateUser({ email, password });
    return res.json({ token: signToken(user), user });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Login failed." });
  }
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.patch("/profile", authenticate, async (req, res) => {
  try {
    const user = await updateUserProfile(req.user.id, { name: req.body.name });
    return res.json({ token: signToken(user), user });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || "Profile update failed." });
  }
});

module.exports = router;
