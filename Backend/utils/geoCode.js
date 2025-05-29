const axios = require('axios');

const extractCoordinatesFromGoogleMapsUrl = async (url) => {
    try {
        // Handle different Google Maps URL formats
        let coordinates;
        
        // Format 1: https://www.google.com/maps/place/.../@lat,lng,zoom
        const placeMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (placeMatch) {
            return {
                lat: parseFloat(placeMatch[1]),
                lng: parseFloat(placeMatch[2])
            };
        }

        // Format 2: https://www.google.com/maps?q=lat,lng
        const queryMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (queryMatch) {
            return {
                lat: parseFloat(queryMatch[1]),
                lng: parseFloat(queryMatch[2])
            };
        }

        // Format 3: https://maps.google.com/?ll=lat,lng
        const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (llMatch) {
            return {
                lat: parseFloat(llMatch[1]),
                lng: parseFloat(llMatch[2])
            };
        }

        // Format 4: https://maps.app.goo.gl/... (shortened URL)
        if (url.includes('maps.app.goo.gl')) {
            try {
                // Follow the redirect to get the full URL
                const response = await axios.get(url, {
                    maxRedirects: 5,
                    validateStatus: function (status) {
                        return status >= 200 && status < 400; // Accept redirects
                    }
                });
                
                // Extract coordinates from the final URL
                const finalUrl = response.request.res.responseUrl;
                const finalPlaceMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (finalPlaceMatch) {
                    return {
                        lat: parseFloat(finalPlaceMatch[1]),
                        lng: parseFloat(finalPlaceMatch[2])
                    };
                }
            } catch (error) {
                console.error('Error following maps.app.goo.gl redirect:', error);
            }
        }

        return null;
    } catch (error) {
        console.error('Error extracting coordinates from Google Maps URL:', error);
        return null;
    }
};

const geocodeAddress = async (address) => {
    try {
        // Check if the input is a Google Maps URL
        if (address.startsWith('http') && (address.includes('google.com/maps') || address.includes('maps.google.com') || address.includes('maps.app.goo.gl'))) {
            const coordinates = await extractCoordinatesFromGoogleMapsUrl(address);
            if (coordinates) {
                return coordinates;
            }
        }

        // If not a valid Google Maps URL or coordinates couldn't be extracted,
        // fall back to OpenRouteService API
        const response = await axios.get('https://api.openrouteservice.org/geocode/search', {
            params: {
                api_key: process.env.ORS_API_KEY,
                text: address,
                size: 1,  // Return 1 result
            },
        });
        const { coordinates } = response.data.features[0].geometry; // [lon, lat]
        return { lat: coordinates[1], lng: coordinates[0] };
    } catch (error) {
        console.error('Geocoding error:', error.response ? error.response.data : error);
        throw new Error('Failed to geocode address');
    }
};

module.exports = { geocodeAddress };
