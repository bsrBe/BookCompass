const User = require("../models/userModel")
const jwt = require("jsonwebtoken")
const sendEmail = require("../utils/sendEmail")
const crypto = require("crypto"); 

const register = async (req ,res , next) => {

    const {name , email , password ,  role , profileImageUrl} = req.body
    try {
        const user =await  User.create({name , email , password,  role , profileImageUrl})
       
            sendTokenResponse(user , 200 , res)
        
    } catch (error) {
        return res.status(500).json({message : error.message})
    }
next()
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

        if (!user.isEmailConfirmed) {
            // Generate confirmation token
            const confirmationToken = user.generateEmailConfirmationToken();
            await user.save({ validateBeforeSave: false });

            const confirmUrl = `${req.protocol}://${req.get("host")}/auth/confirm-email/${confirmationToken}`;
            const message = `Click the link to confirm your email: <a href="${confirmUrl}">Verify Email</a>`;

            await sendEmail({
                email: user.email,
                subject: "Email Confirmation",
                message
            });

            return res.status(403).json({ msg: "Please verify your email. Confirmation link sent." });
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
    const { token } = req.params;

   
    if (!token) {
        console.error("No token provided");
        return res.status(400).json({ msg: "No token provided" });
    }

    try {
        
        const decoded = jwt.decode(token, { complete: true });
   

        if (!decoded) {
            console.error("Token could not be decoded.");
            return res.status(400).json({ msg: "Invalid token format" });
        }

        // Now verify the token
        const verifiedDecoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
        

        const user = await User.findOne({ email: verifiedDecoded.email });

        if (!user) {
            console.log("User not found for email:", verifiedDecoded.email);
            return res.status(400).json({ msg: "Invalid token or user not found" });
        }

        // Mark email as confirmed
        user.isEmailConfirmed = true;
        user.confirmationToken = undefined;
        await user.save();

      
        res.status(200).json({ msg: "Email confirmed successfully. You can now log in." });

    } catch (error) {
        console.error("Error verifying token:", error.message);
        return res.status(400).json({ msg: "Invalid or expired token" });
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