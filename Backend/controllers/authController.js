const User = require("../models/userModel")
const jwt = require("jsonwebtoken")
const sendEmail = require("../utils/sendEmail")
const crypto = require("crypto"); 

const register = async (req ,res) => {

    const {name , email , password ,  role , profileImageUrl ,location} = req.body
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
          }
          if (role === 'seller' && (!location || !location.address)) {
              return res.status(400).json({ message: 'Location address is required for sellers' });
            }
        const user =await  User.create({name , email , password,  role , profileImageUrl ,location: role === 'seller' ? { address: location.address } : undefined,});
        if (!user.isEmailConfirmed) {
            // Generate confirmation token
            const confirmationToken = user.generateEmailConfirmationToken();
            await user.save({ validateBeforeSave: false });

            const confirmUrl = `${req.protocol}://${req.get("host")}/api/auth/confirmEmail/${confirmationToken}`;
            const message = `Click the link to confirm your email: <a href="${confirmUrl}">Verify Email</a>`;

            await sendEmail({
                email: user.email,
                subject: "Email Confirmation",
                message
            });

            return res.status(403).json({ msg: "Please verify your email. Confirmation link sent.Don't Forget to check your spam folder" });
        }
            sendTokenResponse(user , 200 , res)
        
    } catch (error) {
        return res.status(500).json({message : error.message})
    }

}

const Login = async (req , res ,next) => {
    const {email , password} = req.body

    try {
        const user = await User.findOne({email}).select("+password")
        if(!email || !password) {
            return res.status(400).json({msg : "please provide email and password"})
        }
        if (!user) {
    return res.status(404).json({ msg: "invalid credentials, user not found" });
}

        const isMatch = await user.matchPassword(password);
        if(!isMatch){
            return res.status(404).json({msg : "invalid credentials"})
        }

        

        sendTokenResponse(user , 200 ,res)

    } catch (error) {
        return res.status(500).json({msg : error.message} )
    }
    
}

const getMe = async (req ,res ,next) => {
    const user = await User.findById(req.user.id).select("-password")
    res.status(200).json(user)
}

const sendTokenResponse = (user , statusCode , res) => {
    const token = user.getSignedJwtToken();
    const options = {
        expires : new Date (
            Date.now() +  process.env.JWT_COOKIES_EXPIRE * 24 * 60 * 60 * 1000
        ),
        httpOnly : true,
        sameSite: "None",
        secure: false,  // Enable CSRF protection by restricting cross-site cookies
    }
    if (process.env.NODE_ENV == "Production") {
        options.secure = true;
      }

      // Set the cookie and log it for debugging
    // res.cookie("cookieToken", token, options);
    // console.log("Cookie Set:", res.getHeaders()["set-cookie"]);

    
    res.
    status(statusCode)
    .cookie("cookieToken" , token , options)
    .json({user , token})
}

const forgotPassword = async(req ,res) => {
    const user = await User.findOne({email : req.body.email});

    if(!user) {
        return res.status(400).json({msg : "user with this email not found"})
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({validateBeforeSave : false});

  const resetUrl = `${req.protocol}://${req.get(
    "host"
  )}/auth/resetPassword/${resetToken}`;
  const message = `You are receiving this email because you(or someone else)has requested reset of a password please make a put request to ${resetUrl}`;


try {
    await sendEmail({
        email : user.email,
        subject : "password reset",
        message

    })
    return res.status(200).json({ success: true, msg: "Email sent successfully" });

} catch (error) {
    console.error("Error during sendEmail:", error.message);
    user.resetPasswordToken = undefined,
    user.resetPasswordExpire = undefined
    await user.save({validateBeforeSave : false})
    
    return res.status(500).json("email could not be sent" );
}
}

const resetPassword = async (req, res) => {
    // Extract reset token from URL params
    let resetToken = req.params.token;
    console.log("Received reset token:", resetToken);

    if (!resetToken) {
        return res.status(400).json({ msg: 'No reset token found in request' });
    }
    resetToken = resetToken.trim();  // Trim any leading/trailing spaces
    if (resetToken.startsWith(":")) {
        resetToken = resetToken.slice(1);
    }
    console.log("Trimmed token:", resetToken);
    try {
        // Hash the reset token to match with the stored hash
        const hashedToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Find the user based on the reset password token and expiry time
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid token or token has expired' });
        }

        // Check if new password is valid
        const newPassword = req.body.password;
        if (!newPassword || typeof newPassword !== "string") {
            return res.status(400).json({ msg: "Invalid password format" });
        }

        // Set new password
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Respond with the updated user and token
        sendTokenResponse(user, 200, res);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: error.message });
    }
};



const confirmEmail = async (req, res) => {
    console.log("authController.js: confirmEmail function invoked."); // Added for debugging
    const { token } = req.params;
    console.log("authController.js: Token from params:", token); // Added for debugging

   
    if (!token) {
        console.error("authController.js: No token provided in params."); // Updated log
        return res.status(400).json({ msg: "No token provided" });
    }

    console.log("authController.js: EMAIL_VERIFICATION_SECRET:", process.env.EMAIL_VERIFICATION_SECRET); // Added for debugging

    try {
        console.log("authController.js: Attempting to decode token."); // Added for debugging
        const decoded = jwt.decode(token, { complete: true });
   

        if (!decoded) {
            console.error("authController.js: Token could not be decoded."); // Updated log
            return res.status(400).json({ msg: "Invalid token format" });
        }
        console.log("authController.js: Token decoded (without verification):", decoded.payload); // Added for debugging

        // Now verify the token
        console.log("authController.js: Attempting to verify token."); // Added for debugging
        const verifiedDecoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
        console.log("authController.js: Token verified successfully. Decoded payload:", verifiedDecoded); // Added for debugging
        

        const user = await User.findOne({ email: verifiedDecoded.email });

        if (!user) {
            console.log("authController.js: User not found for email:", verifiedDecoded.email); // Updated log
            return res.status(400).json({ msg: "Invalid token or user not found" });
        }
        console.log("authController.js: User found:", user.email); // Added for debugging

        // Mark email as confirmed
        user.isEmailConfirmed = true;
        user.confirmationToken = undefined; // Clear the confirmation token
        console.log("authController.js: Attempting to save user with confirmed email."); // Added for debugging
        await user.save();
        console.log("authController.js: User saved successfully."); // Added for debugging

      
        res.status(200).json({ msg: "Email confirmed successfully. You can now log in." });

    } catch (error) {
        console.error("authController.js: Error verifying token:", error.message, error.stack); // Updated log, added stack
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ msg: "Invalid token signature or structure." });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ msg: "Token has expired." });
        }
        return res.status(500).json({ msg: "Error processing email confirmation.", error: error.message }); // More generic server error
    }
};


module.exports = {
    register,
    Login,
    getMe,
    forgotPassword,
    resetPassword,
    confirmEmail
}
