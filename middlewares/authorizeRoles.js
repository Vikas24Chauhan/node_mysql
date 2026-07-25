const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      const error = new Error(
        "You don't have permission to perform this action.",
      );
      error.statusCode = 403;

      return next(error);
    }

    next();
  };
};

export default authorizeRoles;
