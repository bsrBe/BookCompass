const axios = require('axios');

const geocodeAddress = async (address) => {
  try {
    const response = await axios.get('https://api.openrouteservice.org/geocode/search', {
      params: {
        api_key: process.env.ORS_API_KEY,
        text: address,
        size: 1,  // Return 1 result
      },
    });
    const { coordinates } = response.data.features[0].geometry; // [lon, lat]
    return { lat: coordinates[1], lon: coordinates[0] };
  } catch (error) {
    console.error('Geocoding error:', error.response ? error.response.data : error);
    throw new Error('Failed to geocode address');
  }
};
