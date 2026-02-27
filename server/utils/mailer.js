const nodemailer = require('nodemailer');

// Create a transporter object using SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // Your email address
    pass: process.env.EMAIL_PASS,  // Your Gmail app password (NOT your actual password)
  },
});

// Function to send email
const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent to:', to);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

module.exports = { sendEmail };
