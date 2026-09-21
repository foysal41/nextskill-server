// =====================================
// GET ALL COURSES
// =====================================

app.get("/api/courses", async (req, res) => {
  try {
    const courses = await connectDB();

    const result = await courses.find().toArray();

    // console.log("Courses fetched:", result.length);

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
