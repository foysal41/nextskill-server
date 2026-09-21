require("dotenv").config();
const courseRoutes = require("./src/routes/courseRoutes");
const filterRoutes = require("./src/routes/filterRoutes");
const jobRoutes = require("./src/routes/jobRoutes");
const stripeRoutes = require("./src/routes/stripeRoutes");
const myLearningRoutes = require("./src/routes/myLearningRoutes");
const connectDB = require("./src/config/db");
const cors = require("cors");
const express = require("express");
const { ApifyClient } = require("apify-client");
const { MongoClient, ServerApiVersion } = require("mongodb");
// const dns = require("dns");
// dns.setServers(["8.8.8.8", "1.1.1.1"]);
const Stripe = require("stripe");

const app = express();

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});


const port = 5000;




app.use(cors());


app.use(cors());


// =====================================
// Stripe Webhook
// MUST BE BEFORE express.json()
// =====================================

app.post(
  "/api/stripe/webhook",
  express.raw({
    type: "application/json",
  }),
  async (req, res) => {
    try {
      const stripe = new Stripe(
        process.env.STRIPE_SECRET_KEY
      );

      const signature =
        req.headers["stripe-signature"];

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

        // -------------------------------
        // Validate metadata
        // -------------------------------

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

        // -------------------------------
        // Connect MongoDB
        // -------------------------------

        const db =
          await connectDB();

        const enrollments =
          db.collection("enrollments");

        // -------------------------------
        // Prevent duplicate enrollment
        // -------------------------------

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

          return res.status(200).json({
            received: true,
            message:
              "Already enrolled",
          });
        }

        // -------------------------------
        // Create Enrollment
        // -------------------------------

        const enrollment = {
          userId,
          courseId,

          status: "active",

          progress: 0,

          paymentStatus: "paid",

          stripeSessionId:
            session.id,

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
        message:
          "Webhook error",
        error: error.message,
      });
    }
  }
);


// =====================================
// JSON Parser
// MUST COME AFTER STRIPE WEBHOOK
// =====================================

app.use(express.json());


// =====================================
// Routes
// =====================================

app.use(
  "/api/courses",
  courseRoutes
);

app.use(
  "/api",
  filterRoutes
);

app.use(
  "/api",
  jobRoutes
);

app.use(
  "/api",
  stripeRoutes
);



// =====================================
// Stripe Webhook
// MUST COME BEFORE express.json()
// =====================================

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {

    const stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY
    );

    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {

      const signature =
        req.headers["stripe-signature"];

      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );

    } catch (error) {

      console.error(
        "Stripe Webhook Signature Error:",
        error.message
      );

      return res.status(400).send(
        `Webhook Error: ${error.message}`
      );
    }


    // =================================
    // Payment Completed
    // =================================

    if (
      event.type ===
      "checkout.session.completed"
    ) {

      const session =
        event.data.object;

      try {

        const courseId =
          session.metadata?.courseId;

        const userId =
          session.metadata?.userId;


        if (!courseId || !userId) {

          console.error(
            "Missing courseId or userId in Stripe metadata"
          );

          return res.status(400).json({
            success: false,
            message:
              "Missing enrollment metadata",
          });
        }


        // -------------------------------
        // Connect MongoDB
        // -------------------------------

        const db =
          await connectDB();

        const enrollments =
          db.collection(
            "enrollments"
          );


        // -------------------------------
        // Check duplicate enrollment
        // -------------------------------

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

          // -----------------------------
          // Create Enrollment
          // -----------------------------

          const enrollment = {

            userId,

            courseId,

            status: "active",

            progress: 0,

            enrolledAt: new Date(),

            stripeSessionId:
              session.id,

            paymentStatus:
              "paid",
          };


          await enrollments.insertOne(
            enrollment
          );


          console.log(
            "Enrollment created successfully"
          );

          console.log(enrollment);
        }

      } catch (error) {

        console.error(
          "Enrollment Creation Error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Failed to create enrollment",
        });
      }
    }


    // Stripe needs this
    return res.status(200).json({
      received: true,
    });
  }
);


app.use(express.json());

app.use("/api/courses", courseRoutes);
app.use("/api", filterRoutes);
app.use("/api", jobRoutes);
app.use("/api", stripeRoutes);
app.use("/api", myLearningRoutes);


// =====================================
// My Learning
// =====================================

app.get(
  "/api/my-learning",
  async (req, res) => {

    try {

      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message:
            "userId is required",
        });
      }


      const db =
        await connectDB();


      const enrollments =
        db.collection(
          "enrollments"
        );

      const courses =
        db.collection(
          "courses"
        );


      // -------------------------------
      // Get user enrollments
      // -------------------------------

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


      if (
        userEnrollments.length === 0
      ) {

        return res.status(200).json({
          success: true,
          count: 0,
          courses: [],
        });
      }


      // -------------------------------
      // Course IDs
      // -------------------------------

      const courseIds =
        userEnrollments.map(
          (item) => item.courseId
        );


      const { ObjectId } =
        require("mongodb");


      const validCourseIds =
        courseIds
          .filter((id) =>
            ObjectId.isValid(id)
          )
          .map(
            (id) =>
              new ObjectId(id)
          );


      // -------------------------------
      // Find courses
      // -------------------------------

      const enrolledCourses =
        await courses
          .find({
            _id: {
              $in: validCourseIds,
            },
          })
          .toArray();


      // -------------------------------
      // Attach enrollment information
      // -------------------------------

      const myLearning =
        enrolledCourses.map(
          (course) => {

            const enrollment =
              userEnrollments.find(
                (item) =>
                  item.courseId ===
                  course._id.toString()
              );


            return {
              ...course,

              enrollment: {
                id:
                  enrollment?._id,

                progress:
                  enrollment?.progress ??
                  0,

                status:
                  enrollment?.status,

                enrolledAt:
                  enrollment?.enrolledAt,
              },
            };
          }
        );


      return res.status(200).json({
        success: true,

        count:
          myLearning.length,

        courses:
          myLearning,
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
  }
);



// =====================================
// Root Route
// =====================================

app.get("/", (req, res) => {
  res.send("Hello World!");
});




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