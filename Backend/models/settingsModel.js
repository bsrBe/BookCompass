const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'appSettings' // Use a fixed key to ensure only one settings document
  },
  isMaintenanceMode: {
    type: Boolean,
    required: true,
    default: false
  }
}, { timestamps: true });

// Ensure only one document can exist
settingsSchema.index({ key: 1 });

const Settings = mongoose.model('Settings', settingsSchema);

// Function to get or create the singleton settings document
const getSettings = async () => {
  let settings = await Settings.findOne({ key: 'appSettings' });
  if (!settings) {
    settings = await Settings.create({ key: 'appSettings', isMaintenanceMode: false });
  }
  return settings;
};

module.exports = { Settings, getSettings };
