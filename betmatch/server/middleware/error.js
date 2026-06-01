export const notFound = (_req, res) => {
  res.status(404).json({ error: "Route not found" });
};

export const errorHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
};
