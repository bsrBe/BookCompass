// Create a mock Cloudinary object
const mockCloudinary = {
    v2: {
        config: jest.fn(),
        uploader: {
            upload_stream: jest.fn((options, callback) => {
                callback(null, { secure_url: 'https://mock-cloudinary-url.com/image.jpg' });
            }),
            destroy: jest.fn((public_id, callback) => {
                callback(null, { result: 'ok' });
            })
        }
    }
};

// Mock the cloudinary module
jest.mock('cloudinary', () => mockCloudinary);

module.exports = mockCloudinary; 