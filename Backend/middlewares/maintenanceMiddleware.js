const { getSettings } = require('../models/settingsModel');

const maintenanceMiddleware = async (req, res, next) => {
  try {
    const settings = await getSettings();

    // Check if maintenance mode is enabled
    if (settings.isMaintenanceMode) {
      // Allow access ONLY to the maintenance toggle endpoint when mode is ON
      // Authorization for this endpoint is handled within adminRoutes
      const isMaintenanceToggleRoute = req.originalUrl.startsWith('/api/admin/maintenance'); // Adjust path if needed

      if (isMaintenanceToggleRoute) {
        return next(); // Allow request to proceed to admin routes for authorization
      } else {
        // Block all other requests
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'System is under maintenance. We will be back soon.'
        });
      }
    } else {
      // Maintenance mode is off, allow all requests
      return next();
    }
  } catch (error) {
    console.error('Error in maintenance middleware:', error);
    // In case of error fetching settings, maybe default to allowing access or handle differently
    return res.status(500).json({ error: 'Internal Server Error during maintenance check' });
  }
};

module.exports = maintenanceMiddleware;
