const express = require("express");
const connectDB = require("../config/db");

const router = express.Router();


// =====================================
// FILTER COURSES
// =====================================

router.get("/filtercourses", async (req, res) => {
  try {
    const courses = await connectDB();

    const { search, category, sort } = req.query;

    const query = {};

    if (search) {
      query.title = {
        $regex: search,
        $options: "i",
      };
    }

    if (category) {
      query.category = category;
    }

    let sortOption = {};

    if (sort === "newest") {
      sortOption = {
        _id: -1,
      };
    }

    if (sort === "price-low") {
      sortOption = {
        discountPrice: 1,
      };
    }

    if (sort === "price-high") {
      sortOption = {
        discountPrice: -1,
      };
    }

    const result = await courses
      .find(query)
      .sort(sortOption)
      .toArray();

    res.status(200).json(result);
  } catch (error) {
    console.error("GET /api/filtercourses error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to filter courses",
      error: error.message,
    });
  }
});

module.exports = router;