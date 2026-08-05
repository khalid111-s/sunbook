const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // MongoDB duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    message = 'هذا البريد الإلكتروني مسجل مسبقاً';
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((val) => val.message);
    message = messages.join(', ');
  }

  // Mongoose CastError (ObjectId غير صالح)
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'المورد غير موجود';
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;