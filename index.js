require("dotenv").config();

const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const dns = require("dns");
const Stripe = require("stripe");

const app = express();
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);
const port = 5000;



app.use(cors());
app.use(express.json());

dns.setServers(["8.8.8.8", "1.1.1.1"]);

// =====================================
// MongoDB
// =====================================

const uri = process.env.MONGO_DB_URI;

if (!uri) {
  console.error("MONGO_DB_URI is missing");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let courseCollections;


// =====================================
// MongoDB Connection
// =====================================

async function connectDB() {
  if (courseCollections) {
    return courseCollections;
  }

  await client.connect();

  const database = client.db("nextSkill_Course_db");

  courseCollections = database.collection("courses");

  await client.db("admin").command({ ping: 1 });

  console.log("MongoDB connected successfully!");

  return courseCollections;
}


// =====================================
// Root Route
// =====================================

app.get("/", (req, res) => {
  res.send("Hello World!");
});


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


// =====================================
// ADD COURSE
// =====================================

app.post("/api/add-course", async (req, res) => {
  try {
    const courses = await connectDB();

    const course = req.body;

    const result = await courses.insertOne(course);

    res.status(201).json(result);
  } catch (error) {
    console.error("POST /api/add-course error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add course",
      error: error.message,
    });
  }
});


// =====================================
// FILTER COURSES
// =====================================

app.get("/api/filtercourses", async (req, res) => {
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





// =====================================
// Stripe Checkout
// =====================================

app.post(
  "/api/create-checkout-session",
  async (req, res) => {
    try {
      // ---------------------------------
      // 1. Get Course ID
      // ---------------------------------

      const { courseId } = req.body;

      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: "Course ID is required",
        });
      }

      // ---------------------------------
      // 2. Connect to MongoDB
      // ---------------------------------

      const courses = await connectDB();

      const { ObjectId } = require("mongodb");

      // ---------------------------------
      // 3. Validate ObjectId
      // ---------------------------------

      if (!ObjectId.isValid(courseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid course ID",
        });
      }

      // ---------------------------------
      // 4. Find Course
      // ---------------------------------

      const course = await courses.findOne({
        _id: new ObjectId(courseId),
      });

      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found",
        });
      }

      // ---------------------------------
      // 5. Get Course Price
      // ---------------------------------

      const regularPrice = Number(
        course.price ?? course.regularPrice
      );

      const discountPrice = Number(
        course.discountPrice ?? course.salePrice
      );

      const coursePrice =
        Number.isFinite(discountPrice) &&
        discountPrice > 0
          ? discountPrice
          : regularPrice;

      // ---------------------------------
      // 6. Validate Course Price
      // ---------------------------------

      if (
        !Number.isFinite(coursePrice) ||
        coursePrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid course price",
        });
      }

      // ---------------------------------
      // 7. Create URLs
      // ---------------------------------

      const clientURL =
        process.env.CLIENT_URL ||
        "http://localhost:3000";

      const successURL =
        `${clientURL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;

      const cancelURL =
        `${clientURL}/courses/${courseId}`;

      // ---------------------------------
      // 8. Debug Logs
      // ---------------------------------

      // console.log(
      //   "===================================="
      // );

      // console.log(
      //   "Stripe Checkout Request"
      // );

      // console.log(
      //   "Course:",
      //   course.title
      // );

      // console.log(
      //   "Regular Price:",
      //   regularPrice
      // );

      // console.log(
      //   "Discount Price:",
      //   discountPrice
      // );

      // console.log(
      //   "Final Price:",
      //   coursePrice
      // );

      // console.log(
      //   "Client URL:",
      //   clientURL
      // );

      // console.log(
      //   "Success URL:",
      //   successURL
      // );

      // console.log(
      //   "Cancel URL:",
      //   cancelURL
      // );

      // console.log(
      //   "===================================="
      // );

      // ---------------------------------
      // 9. Create Stripe Checkout Session
      // ---------------------------------

      const session =
        await stripe.checkout.sessions.create({
          mode: "payment",

          payment_method_types: [
            "card",
          ],

          line_items: [
            {
              price_data: {
                currency:
                  process.env.STRIPE_CURRENCY ||
                  "usd",

                product_data: {
                  name:
                    course.title ||
                    "NextSkill Course",
                },

                unit_amount:
                  Math.round(
                    coursePrice * 100
                  ),
              },

              quantity: 1,
            },
          ],

          success_url: successURL,

          cancel_url: cancelURL,

          metadata: {
            courseId: courseId,
          },
        });

      // ---------------------------------
      // 10. Check Stripe URL
      // ---------------------------------

      if (!session.url) {
        return res.status(500).json({
          success: false,
          message:
            "Stripe checkout URL was not generated",
        });
      }

      // ---------------------------------
      // 11. Send Response
      // ---------------------------------

      return res.status(200).json({
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url,
      });

    } catch (error) {
      // ---------------------------------
      // Error Handling
      // ---------------------------------

      console.error(
        "===================================="
      );

      console.error(
        "Stripe Checkout Error:"
      );

      console.error(error);

      console.error(
        "===================================="
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to create Stripe checkout session",
        error: error.message,
      });
    }
  }
);

// =====================================
// ERROR HANDLER
// =====================================

app.use((err, req, res, next) => {
  console.error("Express Error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});


// =====================================
// EXPORT FOR VERCEL
// =====================================

module.exports = app;


// =====================================
// LOCAL DEVELOPMENT ONLY
// =====================================

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}