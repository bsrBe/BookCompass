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
        if (address.startsWith('http') && (
            address.includes('google.com/maps') || 
            address.includes('maps.google.com') || 
            address.includes('maps.app.goo.gl')
        )) {
            const coordinates = await extractCoordinatesFromGoogleMapsUrl(address);
            if (coordinates) {
                // Validate that the coordinates are within Ethiopia
                if (coordinates.lat >= 3.4 && coordinates.lat <= 14.9 && 
                    coordinates.lng >= 33.0 && coordinates.lng <= 48.0) {
                    return coordinates;
                } else {
                    throw new Error("The provided location is outside of Ethiopia");
                }
            }
            // If coordinates couldn't be extracted, fall through to address geocoding
        }

        const cleanedAddress = address
            .replace(/,+/g, ", ")
            .replace(/\s+/g, " ")
            .trim();

        const ETHIOPIAN_LOCATIONS = {
            mexico: { lat: 9.001442, lng: 38.6771697 },
            "mexico, addis ababa": { lat: 9.001442, lng: 38.6771697 },
            bole: { lat: 8.9806, lng: 38.7998 },
            piassa: { lat: 9.0300, lng: 38.7500 },
        };

        const normalizedAddress = cleanedAddress.toLowerCase();
        if (ETHIOPIAN_LOCATIONS[normalizedAddress]) {
            return ETHIOPIAN_LOCATIONS[normalizedAddress];
        }

        const ethiopiaQuery = cleanedAddress.includes("Ethiopia")
            ? cleanedAddress
            : `${cleanedAddress}, Ethiopia`;

        const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ethiopiaQuery)}&countrycodes=et&limit=1`
        );

        if (response.data?.length > 0) {
            const result = response.data[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);

            if (lat >= 3.4 && lat <= 14.9 && lon >= 33.0 && lon <= 48.0) {
                return { lat, lng: lon };
            }
        }

        const components = cleanedAddress.split(",").map((c) => c.trim());
        for (let i = 0; i < components.length; i++) {
            const partialQuery = `${components.slice(i).join(", ")}, Ethiopia`;
            const fallbackResponse = await axios.get(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(partialQuery)}&countrycodes=et&limit=1`
            );

            if (fallbackResponse.data?.length > 0) {
                const result = fallbackResponse.data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);

                if (lat >= 3.4 && lat <= 14.9 && lon >= 33.0 && lon <= 48.0) {
                    return { lat, lng: lon };
                }
            }
        }

        throw new Error("Address not found in Ethiopia");
    } catch (error) {
        console.error("Geocoding error:", error);
        throw new Error(`Could not locate "${address}" in Ethiopia. Please try format: "Neighborhood, City, Ethiopia" or provide a Google Maps URL`);
    }
};

module.exports = {
    geocodeAddress,
    extractCoordinatesFromGoogleMapsUrl
};
