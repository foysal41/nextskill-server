require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { ApifyClient } = require("apify-client");

// =====================================
// Routes
// =====================================

const courseRoutes = require("./src/routes/courseRoutes");
const filterRoutes = require("./src/routes/filterRoutes");
const jobRoutes = require("./src/routes/jobRoutes");
const stripeRoutes = require("./src/routes/stripeRoutes");
const myLearningRoutes = require("./src/routes/myLearningRoutes");

// =====================================
// Database
// =====================================

const connectDB = require("./src/config/db");

// =====================================
// App
// =====================================

const app = express();

const port = 5000;

// =====================================
// External Services
// =====================================

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// =====================================
// CORS
// =====================================

app.use(cors());

// =====================================
// Stripe Webhook
// IMPORTANT:
// Must be BEFORE express.json()
// because Stripe needs the raw body
// =====================================

app.post(
  "/api/stripe/webhook",
  express.raw({
    type: "application/json",
  }),
  async (req, res) => {
    try {
      // ---------------------------------
      // Stripe
      // ---------------------------------

      const stripe = new Stripe(
        process.env.STRIPE_SECRET_KEY
      );

      // ---------------------------------
      // Stripe Signature
      // ---------------------------------

      const signature =
        req.headers["stripe-signature"];

      // ---------------------------------
      // Verify Webhook
      // ---------------------------------

      const event =
        stripe.webhooks.constructEvent(
          req.body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );

      // =================================
      // Payment Completed
      // =================================

      if (
        event.type ===
        "checkout.session.completed"
      ) {
        const session =
          event.data.object;

        // ---------------------------------
        // Get Metadata
        // ---------------------------------

        const courseId =
          session.metadata?.courseId;

        const userId =
          session.metadata?.userId;

        console.log(
          "Stripe Payment Completed"
        );

        console.log({
          courseId,
          userId,
          sessionId: session.id,
        });

        // ---------------------------------
        // Validate Metadata
        // ---------------------------------

        if (!courseId || !userId) {
          console.error(
            "Missing courseId or userId"
          );

          return res.status(400).json({
            success: false,
            message:
              "Missing enrollment metadata",
          });
        }

        // ---------------------------------
        // Connect MongoDB
        // ---------------------------------

        const db =
          await connectDB();

        const enrollments =
          db.collection(
            "enrollments"
          );

        // ---------------------------------
        // Check Duplicate Enrollment
        // ---------------------------------

        const existingEnrollment =
          await enrollments.findOne({
            userId,
            courseId,
          });

        if (existingEnrollment) {
          console.log(
            "User already enrolled:",
            userId,
            courseId
          );
        } else {
          // -------------------------------
          // Create Enrollment
          // -------------------------------

          const enrollment = {
            userId,
            courseId,
            status: "active",
            progress: 0,
            paymentStatus: "paid",
            stripeSessionId: session.id,
            enrolledAt: new Date(),
          };

          const result =
            await enrollments.insertOne(
              enrollment
            );

          console.log(
            "Enrollment created successfully:",
            result.insertedId
          );
        }
      }

      // ---------------------------------
      // Stripe Response
      // ---------------------------------

      return res.status(200).json({
        received: true,
      });

    } catch (error) {
      console.error(
        "Stripe Webhook Error:",
        error
      );

      return res.status(400).json({
        success: false,
        message: "Webhook error",
        error: error.message,
      });
    }
  }
);

// =====================================
// JSON Parser
// IMPORTANT:
// Must come AFTER Stripe Webhook
// =====================================

app.use(express.json());

// =====================================
// API Routes
// =====================================

// Courses
app.use(
  "/api/courses",
  courseRoutes
);

// Filters
app.use(
  "/api",
  filterRoutes
);

// Jobs
app.use(
  "/api",
  jobRoutes
);

// Stripe Checkout
app.use(
  "/api",
  stripeRoutes
);

// My Learning
app.use(
  "/api",
  myLearningRoutes
);

// =====================================
// Root Route
// =====================================

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// =====================================
// Error Handler
// =====================================

app.use(
  (err, req, res, next) => {
    console.error(
      "Express Error:",
      err
    );

    res.status(500).json({
      success: false,
      message:
        "Internal server error",
      error: err.message,
    });
  }
);

// =====================================
// Export for Vercel
// =====================================

module.exports = app;

// =====================================
// Local Development Only
// =====================================

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(
      `Server running on http://localhost:${port}`
    );
  });
}