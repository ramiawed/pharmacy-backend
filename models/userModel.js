const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

var userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "You must supply a name"],
    },
    username: {
      type: String,
      required: [true, "You must supply a username"],
      unique: [true, "You must supply a unique username"],
    },
    password: {
      type: String,
      required: [true, "Please Provide a password"],
      minlength: [5, "password must be greater than 5 characters"],
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "Please Provide a confirm password"],
      validate: {
        message: "Password and confirm password must be the same",
        validator: function (val) {
          return this.password === val;
        },
      },
    },
    passwordChangedAt: Date,
    type: {
      type: String,
      enum: ["admin", "pharmacy", "warehouse", "company", "normal"],
      default: "Normal",
    },
    logo_url: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    mobile: [
      {
        type: String,
        required: [true, "You must supply a mobile number"],
      },
    ],
    phone: [{ type: String }],
    email: [
      {
        type: String,
        lowercase: true,
      },
    ],
    city: {
      type: String,
      required: [true, "You must supply a city"],
    },
    addressDetails: {
      type: String,
      required: [true, "You must supply a details address"],
    },
    employeeName: {
      type: String,
    },
    certificateName: {
      type: String,
    },
    guestDetails: {
      job: {
        type: String,
        enum: ["", "student", "pharmacist", "employee"],
        default: "",
      },
      companyName: {
        type: String,
      },
      jobTitle: {
        type: String,
      },
    },
    allowAdmin: {
      type: Boolean,
      default: true,
    },
    allowShowingMedicines: {
      type: Boolean,
      default: true,
    },
    inSectionOne: {
      type: Boolean,
      default: false,
    },
    inSectionTwo: {
      type: Boolean,
      default: false,
    },
    paper_url: {
      type: String,
      default: "",
    },
    ourCompanies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    expoPushToken: [
      {
        type: String,
        default: "",
      },
    ],
    costOfDeliver: {
      type: Number,
      default: 0,
    },
    invoiceMinTotal: {
      type: Number,
      default: 0,
    },
    fastDeliver: {
      type: Boolean,
      defautl: false,
    },
    payAtDeliver: {
      type: Boolean,
      default: false,
    },
    includeInPointSystem: {
      type: Boolean,
      default: false,
    },
    pointForAmount: {
      type: Number,
      default: 0,
    },
    amountToGetPoint: {
      type: Number,
      default: 0,
    },
    points: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password before save it to DB
userSchema.pre("save", async function (next) {
  // only run this function if password was actually modified
  if (!this.isModified("password")) return next();

  // hash the password with the cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // delete password confirm field
  this.passwordConfirm = undefined;
  next();
});

// Encrypt password before save it to DB
userSchema.pre("insertMany", async function (next) {
  // delete password confirm field
  this.passwordConfirm = undefined;
  next();
});

// check if the entered password correct
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.passwordChangedAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }

  // false means NOT changes
  return false;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
