const validateUser = (req, res, next) => {
  const { name, email, age } = req.body;

  // Required fields
  if (!name || !email || age === undefined) {
    return res.status(400).json({
      message: "Name, email and age are required.",
    });
  }

  // Name length
  if (name.trim().length < 3) {
    return res.status(400).json({
      message: "Name must be at least 3 characters.",
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: "Invalid email format.",
    });
  }

  // Age validation
  if (age < 1 || age > 120) {
    return res.status(400).json({
      message: "Age must be between 1 and 120.",
    });
  }

  next();
};

export default validateUser;
