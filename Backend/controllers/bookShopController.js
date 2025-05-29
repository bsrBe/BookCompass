const BookShop = require("../models/bookShopModel");
const Book = require("../models/bookModel");
const BookShopReview = require("../models/bookShopReviewModel");
const { uploadImage } = require("../utils/cloudinary");
const { geocodeAddress } = require("../utils/geocode");
const mongoose = require("mongoose");

// Create a new bookshop
const createBookShop = async (req, res) => {
    try {
        const sellerId = req.user.id;
        
        // Check if seller already has a bookshop
        const existingBookShop = await BookShop.findOne({ seller: sellerId });
        if (existingBookShop) {
            return res.status(400).json({ message: "You already have a bookshop" });
        }

        // Debug log to see what's coming in the request
        console.log("Request body:", req.body);
        console.log("Request files:", req.files);

        const {
            name,
            tagline,
            description,
            services,
            contact,
            operatingHours,
            socialMedia,
            upcomingEvents,
            location,
            paymentOptions
        } = req.body;

        // Parse JSON strings if they are strings
        let parsedContact, parsedLocation, parsedServices, parsedPaymentOptions;
        try {
            parsedContact = contact ? (typeof contact === 'string' ? JSON.parse(contact) : contact) : {};
            parsedLocation = location ? (typeof location === 'string' ? JSON.parse(location) : location) : {};
            parsedServices = services ? (typeof services === 'string' ? JSON.parse(services) : services) : [];
            parsedPaymentOptions = paymentOptions ? (typeof paymentOptions === 'string' ? JSON.parse(paymentOptions) : paymentOptions) : [];
        } catch (error) {
            console.error("JSON parsing error:", error);
            return res.status(400).json({ 
                message: "Invalid JSON format in request data",
                error: error.message,
                receivedData: {
                    contact,
                    location,
                    services,
                    paymentOptions
                }
            });
        }

        // Debug log for parsed data
        console.log("Parsed data:", {
            name,
            parsedContact,
            parsedLocation,
            parsedServices,
            parsedPaymentOptions
        });

        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({ 
                message: "Bookshop name is required",
                receivedName: name 
            });
        }
        if (!parsedContact?.phoneNumber) {
            return res.status(400).json({ message: "Phone number is required" });
        }
        if (!parsedContact?.email) {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!parsedLocation?.address) {
            return res.status(400).json({ message: "Address is required" });
        }

        // Validate payment options if provided
        if (parsedPaymentOptions && parsedPaymentOptions.length > 0) {
            for (const option of parsedPaymentOptions) {
                if (!option.provider || !option.phoneNumber) {
                    return res.status(400).json({ 
                        message: "Each payment option must have both provider and phone number" 
                    });
                }
                if (!/^\d{10}$/.test(option.phoneNumber)) {
                    return res.status(400).json({ 
                        message: "Payment phone number must be exactly 10 digits" 
                    });
                }
            }
        }

        // Geocode the address
        let coordinates;
        try {
            coordinates = await geocodeAddress(parsedLocation.address);
        } catch (error) {
            console.error("Geocoding error:", error);
            return res.status(400).json({ 
                message: "Could not validate the provided address",
                error: error.message
            });
        }

        // Handle image uploads
        let logoUrl = "https://via.placeholder.com/150";
        let backgroundUrl = "https://via.placeholder.com/1200x300";

        if (req.files) {
            try {
                if (req.files.logo) {
                    logoUrl = await uploadImage(req.files.logo[0].buffer, "bookshop_logos");
                }
                if (req.files.background) {
                    backgroundUrl = await uploadImage(req.files.background[0].buffer, "bookshop_backgrounds");
                }
            } catch (error) {
                console.error("Image upload error:", error);
                return res.status(400).json({ 
                    message: "Failed to upload images",
                    error: error.message
                });
            }
        }

        const bookShop = await BookShop.create({
            name: name.trim(),
            tagline: tagline?.trim() || undefined,
            description: description?.trim() || undefined,
            services: parsedServices || [],
            contact: {
                phoneNumber: parsedContact.phoneNumber,
                email: parsedContact.email,
                website: parsedContact.website || undefined
            },
            paymentOptions: parsedPaymentOptions || [],
            operatingHours: operatingHours || {},
            socialMedia: socialMedia || {},
            upcomingEvents: upcomingEvents || [],
            images: {
                logo: logoUrl,
                background: backgroundUrl
            },
            seller: sellerId,
            location: {
                type: "Point",
                coordinates: [coordinates.lng, coordinates.lat],
                address: parsedLocation.address
            }
        });

        res.status(201).json({ success: true, data: bookShop });
    } catch (error) {
        console.error("Error creating bookshop:", error);
        res.status(400).json({ 
            message: "Failed to create bookshop",
            error: error.message
        });
    }
};

// Update bookshop details
const updateBookShop = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const bookShop = await BookShop.findOne({ seller: sellerId });

        if (!bookShop) {
            return res.status(404).json({ message: "Bookshop not found" });
        }

        const {
            name,
            tagline,
            description,
            services,
            contact,
            operatingHours,
            socialMedia,
            upcomingEvents,
            location,
            paymentOptions
        } = req.body;

        // Parse payment options if provided
        let parsedPaymentOptions;
        if (paymentOptions) {
            try {
                parsedPaymentOptions = typeof paymentOptions === 'string' ? 
                    JSON.parse(paymentOptions) : paymentOptions;
                
                // Validate payment options
                for (const option of parsedPaymentOptions) {
                    if (!option.provider || !option.phoneNumber) {
                        return res.status(400).json({ 
                            message: "Each payment option must have both provider and phone number" 
                        });
                    }
                    if (!/^\d{10}$/.test(option.phoneNumber)) {
                        return res.status(400).json({ 
                            message: "Payment phone number must be exactly 10 digits" 
                        });
                    }
                }
            } catch (error) {
                return res.status(400).json({ 
                    message: "Invalid payment options format",
                    error: error.message
                });
            }
        }

        // Handle address changes and geocoding
        if (location?.address && location.address !== bookShop.location.address) {
            try {
                const coordinates = await geocodeAddress(location.address);
                bookShop.location = {
                    address: location.address,
                    coordinates
                };
            } catch (error) {
                console.error("Geocoding error:", error);
                return res.status(400).json({ 
                    message: "Could not validate the provided address" 
                });
            }
        }

        // Handle image uploads
        if (req.files) {
            if (req.files.logo) {
                bookShop.images.logo = await uploadImage(req.files.logo[0].buffer);
            }
            if (req.files.background) {
                bookShop.images.background = await uploadImage(req.files.background[0].buffer);
            }
        }

        // Update fields
        Object.assign(bookShop, {
            name: name || bookShop.name,
            tagline: tagline || bookShop.tagline,
            description: description || bookShop.description,
            services: services || bookShop.services,
            contact: contact || bookShop.contact,
            paymentOptions: parsedPaymentOptions || bookShop.paymentOptions,
            operatingHours: operatingHours || bookShop.operatingHours,
            socialMedia: socialMedia || bookShop.socialMedia,
            upcomingEvents: upcomingEvents || bookShop.upcomingEvents
        });

        await bookShop.save();
        res.status(200).json({ success: true, data: bookShop });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Get bookshop details
const getBookShop = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid bookshop ID" });
        }

        const bookShop = await BookShop.findById(id)
            .populate("seller", "name email")
            .populate("availableBooks")
            .populate({
                path: "reviews",
                populate: {
                    path: "user",
                    select: "name"
                }
            });

        if (!bookShop) {
            return res.status(404).json({ message: "Bookshop not found" });
        }

        res.status(200).json({ success: true, data: bookShop });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Get seller's bookshop
const getMyBookShop = async (req, res) => {
    try {
        const sellerId = req.user.id;
        
        const bookShop = await BookShop.findOne({ seller: sellerId })
            .populate("availableBooks")
            .populate({
                path: "reviews",
                populate: {
                    path: "user",
                    select: "name"
                }
            });

        if (!bookShop) {
            return res.status(404).json({ 
                message: "No bookshop found. Please create one to start selling books." 
            });
        }

        res.status(200).json({ success: true, data: bookShop });
    } catch (error) {
        console.error("Error fetching my bookshop:", error);
        res.status(400).json({ 
            message: "Failed to fetch bookshop",
            error: error.message 
        });
    }
};

// Create a review for a bookshop
const createReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        // Check if user has already reviewed this bookshop
        const existingReview = await BookShopReview.findOne({
            user: userId,
            bookShop: id
        });

        if (existingReview) {
            return res.status(400).json({ 
                message: "You have already reviewed this bookshop" 
            });
        }

        const review = await BookShopReview.create({
            user: userId,
            bookShop: id,
            rating,
            comment
        });

        res.status(201).json({ success: true, data: review });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Get reviews for a bookshop
const getBookShopReviews = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid bookshop ID" });
        }

        const reviews = await BookShopReview.find({ bookShop: id })
            .populate("user", "name")
            .sort("-createdAt");

        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Get nearby bookshops
const getNearbyBookshops = async (req, res) => {
    try {
        const { longitude, latitude, radius = 10 } = req.query; // radius in kilometers

        if (!longitude || !latitude) {
            return res.status(400).json({ 
                message: "Longitude and latitude are required" 
            });
        }

        const bookshops = await BookShop.find({
            'location.coordinates.lng': {
                $gte: parseFloat(longitude) - (radius / 111.32), // Convert km to degrees
                $lte: parseFloat(longitude) + (radius / 111.32)
            },
            'location.coordinates.lat': {
                $gte: parseFloat(latitude) - (radius / 111.32),
                $lte: parseFloat(latitude) + (radius / 111.32)
            }
        })
        .populate("seller", "name")
        .select("-reviews");

        // Filter results to exact radius using Haversine formula
        const filteredBookshops = bookshops.filter(shop => {
            const distance = calculateDistance(
                parseFloat(latitude),
                parseFloat(longitude),
                shop.location.coordinates.lat,
                shop.location.coordinates.lng
            );
            return distance <= radius;
        });

        res.status(200).json({ 
            success: true, 
            count: filteredBookshops.length,
            data: filteredBookshops 
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Search bookshops by location and other criteria
const searchBookshops = async (req, res) => {
    try {
        const { 
            longitude, 
            latitude, 
            radius = 10,
            services,
            minRating,
            category
        } = req.query;

        let query = {};

        // Add location-based search if coordinates are provided
        if (longitude && latitude) {
            query['location.coordinates.lng'] = {
                $gte: parseFloat(longitude) - (radius / 111.32),
                $lte: parseFloat(longitude) + (radius / 111.32)
            };
            query['location.coordinates.lat'] = {
                $gte: parseFloat(latitude) - (radius / 111.32),
                $lte: parseFloat(latitude) + (radius / 111.32)
            };
        }

        // Add service filter
        if (services) {
            const serviceList = services.split(',');
            query.services = { $in: serviceList };
        }

        // Add rating filter
        if (minRating) {
            query.averageRating = { $gte: parseFloat(minRating) };
        }

        // Add category filter if books in that category are available
        if (category) {
            query['availableBooks.category'] = category;
        }

        const bookshops = await BookShop.find(query)
            .populate("seller", "name")
            .populate({
                path: "availableBooks",
                match: category ? { category } : {},
                select: "title price category"
            })
            .select("-reviews");

        // Filter results to exact radius if coordinates were provided
        let filteredBookshops = bookshops;
        if (longitude && latitude) {
            filteredBookshops = bookshops.filter(shop => {
                const distance = calculateDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    shop.location.coordinates.lat,
                    shop.location.coordinates.lng
                );
                return distance <= radius;
            });
        }

        // Filter by category if specified
        if (category) {
            filteredBookshops = filteredBookshops.filter(shop => shop.availableBooks.length > 0);
        }

        res.status(200).json({ 
            success: true, 
            count: filteredBookshops.length,
            data: filteredBookshops 
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Helper function to calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
};

const deg2rad = (deg) => {
    return deg * (Math.PI/180);
};

// Get all bookshops
const getAllBookshops = async (req, res) => {
    try {
        const bookshops = await BookShop.find()
            .populate("seller", "name email")
            .populate("availableBooks")
            .select("-reviews"); // Exclude reviews to keep response size manageable

        res.status(200).json({ 
            success: true, 
            count: bookshops.length,
            data: bookshops 
        });
    } catch (error) {
        console.error("Error fetching all bookshops:", error);
        res.status(400).json({ 
            message: "Failed to fetch bookshops",
            error: error.message 
        });
    }
};

// Update bookshop fields
const updateBookshopFields = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const updateFields = req.body;

        // Find the bookshop owned by the seller
        const bookShop = await BookShop.findOne({ seller: sellerId });
        if (!bookShop) {
            return res.status(404).json({ 
                message: "No bookshop found for this seller" 
            });
        }

        // Handle location updates separately if provided
        if (updateFields.location) {
            const { address, coordinates } = updateFields.location;
            let newCoordinates = coordinates;

            if (address && address !== bookShop.location.address) {
                try {
                    const geocodedLocation = await geocodeAddress(address);
                    newCoordinates = [geocodedLocation.lng, geocodedLocation.lat];
                } catch (error) {
                    console.error("Geocoding error:", error);
                    return res.status(400).json({ 
                        message: "Could not validate the provided address",
                        error: error.message
                    });
                }
            }

            if (newCoordinates) {
                updateFields['location.coordinates'] = newCoordinates;
                updateFields['location.type'] = 'Point';
            }
            if (address) {
                updateFields['location.address'] = address;
            }
            delete updateFields.location;
        }

        // Handle contact updates
        if (updateFields.contact) {
            Object.keys(updateFields.contact).forEach(key => {
                updateFields[`contact.${key}`] = updateFields.contact[key];
            });
            delete updateFields.contact;
        }

        // Handle operating hours updates
        if (updateFields.operatingHours) {
            Object.keys(updateFields.operatingHours).forEach(key => {
                updateFields[`operatingHours.${key}`] = updateFields.operatingHours[key];
            });
            delete updateFields.operatingHours;
        }

        // Handle social media updates
        if (updateFields.socialMedia) {
            Object.keys(updateFields.socialMedia).forEach(key => {
                updateFields[`socialMedia.${key}`] = updateFields.socialMedia[key];
            });
            delete updateFields.socialMedia;
        }

        // Handle images updates
        if (updateFields.images) {
            Object.keys(updateFields.images).forEach(key => {
                updateFields[`images.${key}`] = updateFields.images[key];
            });
            delete updateFields.images;
        }

        // Update the bookshop with only the provided fields
        const updatedBookShop = await BookShop.findByIdAndUpdate(
            bookShop._id,
            { $set: updateFields },
            { 
                new: true,
                runValidators: true
            }
        ).populate("seller", "name email");

        res.status(200).json({
            success: true,
            message: "Bookshop updated successfully",
            data: updatedBookShop
        });
    } catch (error) {
        console.error("Error updating bookshop:", error);
        res.status(400).json({ 
            message: "Failed to update bookshop",
            error: error.message 
        });
    }
};

module.exports = {
    createBookShop,
    updateBookShop,
    getBookShop,
    getMyBookShop,
    createReview,
    getBookShopReviews,
    getNearbyBookshops,
    searchBookshops,
    getAllBookshops,
    updateBookshopFields
}; 