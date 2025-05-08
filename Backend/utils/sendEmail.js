// const nodemailer = require("nodemailer")
// const sendEmail = async (options) => {
//     try {
//         const transporter = nodemailer.createTransport({
//             host: process.env.SMTP_HOST,
//             port: process.env.SMTP_PORT,
//             auth: {
//                 user: process.env.SMTP_EMAIL,
//                 pass: process.env.SMTP_PASSWORD,
//             },
//         });

//         const message = {
//             from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
//             to: options.email,
//             subject: options.subject,
//             text: options.message,
//         };

//         const info = await transporter.sendMail(message);
//         console.log("Message sent: %s", info.messageId);
//     } catch (error) {
//         console.error("Error sending email:", error.message);
//         throw error; // Re-throw the error to the caller
//     }
// };

// module.exports = sendEmail;

const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_EMAIL,
                pass: process.env.GMAIL_PASSWORD, // For better security, use an App Password
            },
        });

        const message = {
            from: `${process.env.FROM_NAME} <${process.env.GMAIL_EMAIL}>`,
            to: options.email,
            subject: options.subject,
            text: options.message,
            // You can also add html: options.html if you want to send HTML emails
        };

        const info = await transporter.sendMail(message);
        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error.message);
        throw error;
    }
};

module.exports = sendEmail;