const mongoose = require("mongoose")
require("dotenv").config();  
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken"); 
const crypto = require("crypto");  
const Joi = require("joi");

const userSchema = new mongoose.Schema({
    
        name : {
            type : String,
            required : true
        },
        
        email : {
            type : String,
            required : true,
            unique : true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                "Please add a valid email",
              ],
        },

        password : {
            type : String,
            required : true,
            minlength : 8,
            maxlength : 1024,
        },

        role : {
            type : String,
            required : true,
            enum : ["seller" , "buyer"],
            default : "buyer"
        },

        profileImageUrl: {
            type: String, // Field type: String
            required: true, // Field is optional
            default: "https://img-cdn.pixlr.com/image-generator/history/65bb506dcb310754719cf81f/ede935de-1138-4f66-8ed7-44bd16efc709/medium.webp",
          },
        isEmailConfirmed: { type: Boolean, default: false }, 
        confirmationToken: String, 
        confirmationSentAt: Date,


    resetPasswordToken: String,
    resetPasswordExpire: Date,
},
{timestamps : true}
);

userSchema.pre("save" , async  function (next) {
    if(!this.isModified("password")){
        next();
    }
    const salt  = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password ,salt);
})

userSchema.methods.getSignedJwtToken = function (){
    return jwt.sign({id :this._id} , `${process.env.JWT_SECRET}` ,
        {expiresIn : process.env.JWT_EXPIRE}
    )
}

userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword , this.password)
}

userSchema.methods.generateEmailConfirmationToken = function () {
  const token = jwt.sign({ email: this.email }, process.env.EMAIL_VERIFICATION_SECRET, { expiresIn: "1h" });
  this.confirmationToken = token;
  this.confirmationSentAt = new Date();
  return token;
};

userSchema.methods.getResetPasswordToken = function () {
    const resetToken = crypto.randomBytes(20).toString("hex");
  
    // hash token and set to resetPassword field
  
    this.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    return resetToken;
  };

function validateUser(user) {
    const schema = Joi.object({
      name: Joi.string().min(3).required(), 
      email: Joi.string().email().min(6).max(255).required(), 
      password: Joi.string()
        .min(8)
        .required()
        .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])"))
        .messages({
          "string.pattern.base": "Password must contain at least one lowercase letter, and uppercase letter",
        }),
      role: Joi.string().valid("seller", "buyer"),  
    });
    return schema.validate(user); 
}

module.exports = mongoose.model("User" , userSchema);