const express = require("express");
const Stripe = require("stripe");
const connectDB = require("../config/db");

const router = express.Router();

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);


// =====================================
// Create Stripe Checkout Session
// =====================================

router.post(
  "/create-checkout-session",
  async (req, res) => {
    try {
      // ---------------------------------
      // 1. Get Course ID + User ID
      // ---------------------------------

      const { courseId, userId } = req.body;

      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: "Course ID is required",
        });
      }

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

      const courses =
        db.collection("courses");


      // ---------------------------------
      // 3. Validate ObjectId
      // ---------------------------------

      const { ObjectId } = require("mongodb");

      if (!ObjectId.isValid(courseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid course ID",
        });
      }


      // ---------------------------------
      // 4. Find Course
      // ---------------------------------

      const course =
        await courses.findOne({
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
        course.discountPrice ??
        course.salePrice
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
      // 8. Create Stripe Checkout
      // ---------------------------------

      const session =
        await stripe.checkout.sessions.create({
          mode: "payment",

          payment_method_types: ["card"],

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

          // IMPORTANT
          metadata: {
            courseId: courseId,
            userId: userId,
          },
        });


      // ---------------------------------
      // 9. Check Stripe URL
      // ---------------------------------

      if (!session.url) {
        return res.status(500).json({
          success: false,
          message:
            "Stripe checkout URL was not generated",
        });
      }


      // ---------------------------------
      // 10. Response
      // ---------------------------------

      return res.status(200).json({
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url,
      });

    } catch (error) {

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


module.exports = router;