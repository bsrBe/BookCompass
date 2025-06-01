const mongoose = require("mongoose");

const bookShopSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please add a shop name"],
        trim: true,
        maxlength: [100, "Shop name cannot be more than 100 characters"]
    },
    tagline: {
        type: String,
        trim: true,
        maxlength: [200, "Tagline cannot be more than 200 characters"]
    },
    description: {
        type: String,
        required: false,
        maxlength: [1000, "Description cannot be more than 1000 characters"]
    },
    services: [{
        type: String,
        enum: [
            "Café",
            "Reading Area",
            "Author Events",
            "Children's Corner",
            "Free Wi-Fi",
            "Book Club",
            "Other"
        ]
    }],
    contact: {
        phoneNumber: {
            type: String,
            required: [true, "Phone number is required"]
        },
        email: {
            type: String,
            required: false,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                "Please add a valid email"
            ]
        },
        website: {
            type: String,
            required: false,
            match: [
                /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
                "Please add a valid URL"
            ]
        }
    },
    paymentOptions: [{
        provider: {
            type: String,
            enum: ["Telebirr", "CBE Birr", "Amole", "HelloCash", "E-Birr"],
            required: [true, "Payment provider is required"]
        },
        phoneNumber: {
            type: String,
            required: [true, "Phone number is required"],
            match: [/^\d{10}$/, "Phone number must be exactly 10 digits"]
        }
    }],
    operatingHours: {
        monday: {
            type: String,
            default: "9:00 AM - 5:00 PM"
        },
        tuesday: {
            type: String,
            default: "9:00 AM - 5:00 PM"
        },
        wednesday: {
            type: String,
            default: "9:00 AM - 5:00 PM"
        },
        thursday: {
            type: String,
            default: "9:00 AM - 5:00 PM"
        },
        friday: {
            type: String,
            default: "9:00 AM - 5:00 PM"
        },
        saturday: {
            type: String,
            default: "10:00 AM - 4:00 PM"
        },
        sunday: {
            type: String,
            default: "Closed"
        }
    },
    socialMedia: {
        facebook: {
            type: String,
            match: [
                /^(https?:\/\/)?(www\.)?facebook\.com\/[a-zA-Z0-9.]+$/,
                "Please add a valid Facebook URL"
            ]
        },
        instagram: {
            type: String,
            match: [
                /^(https?:\/\/)?(www\.)?instagram\.com\/[a-zA-Z0-9._]+$/,
                "Please add a valid Instagram URL"
            ]
        },
        twitter: {
            type: String,
            match: [
                /^(https?:\/\/)?(www\.)?twitter\.com\/[a-zA-Z0-9_]+$/,
                "Please add a valid Twitter URL"
            ]
        }
    },
    images: {
        logo: {
            type: String,
            default: "https://via.placeholder.com/150"
        },
        background: {
            type: String,
            default: "https://via.placeholder.com/1200x300"
        }
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator: function(v) {
                    return v.length === 2 && 
                           v[0] >= -180 && v[0] <= 180 && // longitude
                           v[1] >= -90 && v[1] <= 90;     // latitude
                },
                message: 'Coordinates must be valid [longitude, latitude]'
            }
        },
        address: {
            type: String,
            required: [true, "Address is required"]
        }
    },
    availableBooks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book"
    }],
    averageRating: {
        type: Number,
        default: 0,
        min: [0, "Rating cannot be less than 0"],
        max: [5, "Rating cannot be more than 5"]
    },
    numReviews: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Create geospatial index
bookShopSchema.index({ location: "2dsphere" });

// Virtual for reviews
bookShopSchema.virtual('reviews', {
    ref: 'BookShopReview',
    localField: '_id',
    foreignField: 'bookShop',
    justOne: false
});

// Virtual for total books
bookShopSchema.virtual('totalBooks').get(function() {
    return this.availableBooks ? this.availableBooks.length : 0;
});

// Method to add book to shop
bookShopSchema.methods.addBook = async function(bookId) {
    if (!this.availableBooks.includes(bookId)) {
        this.availableBooks.push(bookId);
        await this.save();
    }
};

// Method to remove book from shop
bookShopSchema.methods.removeBook = async function(bookId) {
    this.availableBooks = this.availableBooks.filter(id => id.toString() !== bookId.toString());
    await this.save();
};

// Create text index for search
bookShopSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model("BookShop", bookShopSchema); 
