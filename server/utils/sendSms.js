const axios = require("axios");
require("dotenv").config(); // Load environment variables from .env

// Send SMS using Fast2SMS API
const sendSms = async (phone, message) => {
  const apiKey = process.env.FAST2SMS_API_KEY;  // Use API key from environment variable

  if (!apiKey) {
    console.error("Fast2SMS API Key is missing!");
    return false;
  }

  console.log("API Key loaded: ", apiKey);  // Debug log to confirm API key

  // Ensure phone is a string
  phone = phone.toString(); // Convert phone to string if it's not

  // Format phone number (example: +91 for India)
  if (!phone.startsWith("+91")) {
    phone = "+91" + phone; // Prepending country code if not present
  }

  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",  // Fast2SMS API endpoint
      {
        route: "otp",                         // Use "p" for promotional route
        message: message,                   // Message to be sent
        language: "english",                // Language
        flash: 0,                           // Flash message, set to 0 for regular SMS
        numbers: phone,                     // Phone number or multiple numbers
      },
      {
        headers: {
          "authorization": apiKey,         // Authorization header with API key
          "Content-Type": "application/json",
        },
      }
    );

    // Check response and confirm if SMS was sent successfully
    if (response.data.return) {
      console.log("SMS sent successfully to", phone);
      return true;
    } else {
      console.error("Failed to send SMS:", response.data);
      return false;
    }
  } catch (error) {
    console.error("Error sending SMS:", error.message);
    return false;
  }
};

module.exports = { sendSms };
