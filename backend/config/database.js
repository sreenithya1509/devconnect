const mongoose = require("mongoose");

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn("MONGODB_URI not set. DevConnect will use in-memory message storage.");
    return false;
  }

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected.");
    return true;
  } catch (error) {
    console.warn("MongoDB connection failed. Falling back to in-memory storage:", error.message);
    return false;
  }
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectDatabase,
  isMongoConnected,
};
