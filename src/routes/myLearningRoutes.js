const express = require("express");
const { ObjectId } = require("mongodb");
const connectDB = require("../config/db");

const router = express.Router();

// =====================================
// GET MY LEARNING
// =====================================

router.get("/my-learning", async (req, res) => {
  try {
    // ---------------------------------
    // 1. Get User ID
    // ---------------------------------

    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // ---------------------------------
    // 2. Connect MongoDB
    // ---------------------------------

    const db = await connectDB();

    const enrollments =
      db.collection("enrollments");

    const courses =
      db.collection("courses");

    // ---------------------------------
    // 3. Find User Enrollments
    // ---------------------------------

    const userEnrollments =
      await enrollments
        .find({
          userId,
          status: "active",
        })
        .sort({
          enrolledAt: -1,
        })
        .toArray();

    // ---------------------------------
    // 4. No Enrolled Courses
    // ---------------------------------

    if (userEnrollments.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        courses: [],
      });
    }

    // ---------------------------------
    // 5. Get Course IDs
    // ---------------------------------

    const courseIds =
      userEnrollments
        .map((enrollment) =>
          enrollment.courseId
        )
        .filter((id) =>
          ObjectId.isValid(id)
        )
        .map((id) =>
          new ObjectId(id)
        );

    // ---------------------------------
    // 6. Find Courses
    // ---------------------------------

    const enrolledCourses =
      await courses
        .find({
          _id: {
            $in: courseIds,
          },
        })
        .toArray();

    // ---------------------------------
    // 7. Combine Course + Enrollment
    // ---------------------------------

    const myLearning =
      enrolledCourses.map((course) => {
        const enrollment =
          userEnrollments.find(
            (item) =>
              item.courseId ===
              course._id.toString()
          );

        return {
          ...course,

          enrollment: {
            id: enrollment?._id,

            progress:
              enrollment?.progress ?? 0,

            status:
              enrollment?.status ??
              "active",

            paymentStatus:
              enrollment?.paymentStatus ??
              "paid",

            enrolledAt:
              enrollment?.enrolledAt,
          },
        };
      });

    // ---------------------------------
    // 8. Response
    // ---------------------------------

    return res.status(200).json({
      success: true,
      count: myLearning.length,
      courses: myLearning,
    });
  } catch (error) {
    console.error(
      "My Learning Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load my learning",
      error: error.message,
    });
  }
});

module.exports = router;