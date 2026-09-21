const express = require("express");
const { ApifyClient } = require("apify-client");

const router = express.Router();

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});


// =====================================
// LinkedIn Job Search - Apify
// =====================================

router.post("/jobs/search", async (req, res) => {
  try {
    const {
      keyword,
      location,
      workArrangement,
      experience,
      employmentType,
      hasSalary,
    } = req.body;

    // ---------------------------------
    // 1. Validate Job Keyword
    // ---------------------------------

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({
        success: false,
        message: "Job keyword is required",
      });
    }


    // ---------------------------------
    // 2. Prepare Apify Input
    // ---------------------------------

    const input = {
      timeRange: "7d",
      titleSearch: [keyword.trim()],

      ...(location?.trim()
        ? {
            locationSearch: [location.trim()],
          }
        : {}),

      ...(workArrangement?.length
        ? {
            aiWorkArrangementFilter: workArrangement,
          }
        : {}),

      ...(experience
        ? {
            aiExperienceLevelFilter: [experience],
          }
        : {}),

      ...(employmentType
        ? {
            aiEmploymentTypeFilter: [employmentType],
          }
        : {}),

      ...(hasSalary === true
        ? {
            hasSalary: true,
          }
        : {}),
    };


    // ---------------------------------
    // 3. Run Apify Actor
    // ---------------------------------

    const run = await apifyClient
      .actor("vIGxjRrHqDTPuE6M4")
      .call(input);

    console.log("Apify Run Completed:");
    console.log(run.id);


    // ---------------------------------
    // 4. Get Dataset Results
    // ---------------------------------

    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems();


    // ---------------------------------
    // 5. Send Results to Frontend
    // ---------------------------------

    return res.status(200).json({
      success: true,
      count: items.length,
      jobs: items,
    });

  } catch (error) {
    console.error("Apify Job Search Error:");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to search jobs",
      error: error.message,
    });
  }
});


module.exports = router;