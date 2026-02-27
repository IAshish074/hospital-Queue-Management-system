const jwt = require('jsonwebtoken');

const verifyOtpToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authorization token missing' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // from .env
    if (!decoded.verified) {
      return res.status(403).json({ error: 'OTP not verified. Access denied.' });
    }

    req.queueId = decoded.queueId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = verifyOtpToken;
