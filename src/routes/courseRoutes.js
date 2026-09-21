const express = require("express");
const connectDB = require("../config/db");

const router = express.Router();

// =====================================
// GET ALL COURSES
// =====================================

router.get("/", async (req, res) => {
  try {
    const db = await connectDB();
const courses = db.collection("courses");

    const result = await courses.find().toArray();

    res.status(200).json(result);
  } catch (error) {
    console.error("GET /api/courses error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
      error: error.message,
    });
  }
});

module.exports = router;