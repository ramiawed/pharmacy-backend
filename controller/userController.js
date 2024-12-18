const User = require("../models/userModel");
const Order = require("../models/orderModel");
const BasketOrder = require("../models/basketOrdersModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const fs = require("fs");
const Excel = require("exceljs");
const nodemailer = require("nodemailer");
const Item = require("../models/itemModel");
const Advertisement = require("../models/advertisementModel");
const Basket = require("../models/basketModel");
const Favorite = require("../models/favoriteModel");
const Statistic = require("../models/statisticModel");
const SavedItems = require("../models/savedItemsModel");
const mongoose = require("mongoose");

const userAllowedFields = [
  "name",
  "username",
  "logo_url",
  "phone",
  "mobile",
  "email",
  "type",
  "city",
  "addressDetails",
  "employeeName",
  "certificateName",
  "allowAdmin",
  "inSectionOne",
  "inSectionTwo",
  "details",
  "allowShowingMedicines",
  "paper_url",
  "ourCompanies",
  "costOfDeliver",
  "invoiceMinTotal",
  "fastDeliver",
  "payAtDeliver",
  "includeInPointSystem",
  "pointForAmount",
  "amountToGetPoint",
  "points",
];

// remove unwanted property from an object
const filterObj = (obj) => {
  let newObj = {};
  Object.keys(obj).forEach((key) => {
    if (userAllowedFields.includes(key)) newObj[key] = obj[key];
  });
  return newObj;
};

// update some fields in user profile
// 1- pass the protect middleware
// 2- get id = req.user.id after passing the protect middleware
// 3- update the info and return the new user
exports.updateMe = catchAsync(async (req, res, next) => {
  const newObj = filterObj(req.body);

  Object.keys(newObj).forEach((key) => {
    newObj[key] = newObj[key].trim();
  });

  // get the user id from the req.user after passing protect middleware
  const userId = req.user._id;

  const updatedUser = await User.findByIdAndUpdate(userId, newObj, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

// delete a user by setting the isActive to false
// 1- need to pass protect middleware
// 2- get the id from the req.user.id after passing protect middleware
exports.deleteMe = catchAsync(async (req, res, next) => {
  // 1- check if password in the body
  const { password } = req.body;

  const findUser = await User.findById(req.user._id).select("+password");

  // 2- check that the password is correct
  const result = await findUser.correctPassword(password, findUser.password);

  if (!result) {
    return next(new AppError("password is wrong", 401));
  }

  await User.findByIdAndUpdate(
    req.user._id,
    { isActive: false },
    { runValidators: false }
  );

  res.status(200).json({
    status: "success",
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return next(new AppError("enter a user id", 401));
  }

  const checkItem = await Item.find({
    $or: [{ company: id }, { "warehouses.warehouse": id }],
  });

  if (checkItem && checkItem.length > 0) {
    return next(new AppError("cannot delete user item collections", 400));
  }

  const checkAdvertisement = await Advertisement.find({
    $or: [{ company: id }, { warehouse: id }],
  });

  if (checkAdvertisement && checkAdvertisement.length > 0) {
    return next(
      new AppError("cannot delete user advertisement collections", 400)
    );
  }

  const checkOrder = await Order.find({
    $or: [{ pharmacy: id }, { warehouse: id }],
  });

  if (checkOrder && checkOrder.length > 0) {
    return next(new AppError("cannot delete user order collections", 400));
  }

  const checkBasketOrder = await BasketOrder.find({
    $or: [{ pharmacy: id }, { warehouse: id }],
  });

  if (checkBasketOrder && checkBasketOrder.length > 0) {
    return next(
      new AppError("cannot delete user basket order collections", 400)
    );
  }

  const checkBasket = await Basket.find({
    warehouse: id,
  });

  if (checkBasket && checkBasket.length > 0) {
    return next(new AppError("cannot delete user basket collections", 400));
  }

  const checkFavorite = await Favorite.find({
    $or: [{ userId: id }, { favorites: id }],
  });

  if (checkFavorite && checkFavorite.length > 0) {
    return next(new AppError("cannot delete user favorite collections", 400));
  }

  const checkStatistics = await Statistic.find({
    $or: [{ sourceUser: id }, { targetUser: id }],
  });

  if (checkStatistics && checkStatistics.length > 0) {
    await Statistic.deleteMany({
      $or: [{ sourceUser: id }, { targetUser: id }],
    });
  }

  const checkSavedItems = await SavedItems.find({
    userId: id,
  });

  if (checkSavedItems && checkSavedItems.length > 0) {
    return next(new AppError("cannot delete user saved item collections", 400));
  }

  const user = await User.findById(id);

  try {
    // if the user have a logo, delete it
    if (user.logo_url && user.logo_url !== "") {
      if (fs.existsSync(`${__basedir}/public/profiles/${user.logo_url}`)) {
        fs.unlinkSync(`${__basedir}/public/profiles/${user.logo_url}`);
      }
    }

    if (user.paper_url && user.paper_url !== "") {
      if (fs.existsSync(`${__basedir}/public/licenses/${user.paper_url}`)) {
        fs.unlinkSync(`${__basedir}/public/licenses/${user.paper_url}`);
      }
    }
  } catch (err) {}

  await User.findByIdAndDelete(id);

  res.status(200).json({
    status: "success",
    userId: id,
  });
});

exports.update = catchAsync(async (req, res, next) => {
  const id = req.params.userId ? req.params.userId : req.user._id;
  let body = req.body;

  Object.keys(body).forEach((key) => {
    if (typeof body[key] !== "boolean" && typeof body[key] !== "number") {
      body[key] = body[key].trim();
    }
  });

  const user = await User.findByIdAndUpdate(id, body, {
    new: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

// get a user by id
exports.getUserById = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

// get users specified by type (Company, Warehouse, Normal, Admin)
exports.getUsers = catchAsync(async (req, res, next) => {
  const { page, limit } = req.query;

  const query = req.query;

  const details = query.details;

  // array that contains all the conditions
  const conditionArray = [];
  if (query.type) {
    conditionArray.push({ type: query.type });
  }

  // name condition
  if (query.name) {
    conditionArray.push({ name: { $regex: query.name, $options: "i" } });
  }

  // mobile condition
  if (query.mobile) {
    conditionArray.push({ mobile: { $regex: query.mobile, $options: "i" } });
  }

  // inSectionOne condition
  if (query.inSectionOne !== undefined) {
    conditionArray.push({ inSectionOne: query.inSectionOne });
  }

  // inSectionTwo condition
  if (query.inSectionTwo !== undefined) {
    conditionArray.push({ inSectionTwo: query.inSectionTwo });
  }

  // approve condition
  // if (query.isApproved !== undefined) {
  //   conditionArray.push({ isApproved: query.isApproved });
  // }

  // active condition
  if (query.isActive !== undefined) {
    conditionArray.push({ isActive: query.isActive });
  }

  //
  if (query.allowShowingMedicines !== undefined) {
    conditionArray.push({ allowShowingMedicines: query.allowShowingMedicines });
  }

  // city condition
  if (query.city) {
    conditionArray.push({ city: query.city });
  }

  // address details
  if (query.addressDetails) {
    conditionArray.push({
      addressDetails: { $regex: query.addressDetails, $options: "i" },
    });
  }

  // employee name
  if (query.employeeName) {
    conditionArray.push({
      employeeName: { $regex: query.employeeName, $options: "i" },
    });
  }

  // certificate name
  if (query.certificateName) {
    conditionArray.push({
      certificateName: { $regex: query.certificateName, $options: "i" },
    });
  }

  // job
  if (query.job) {
    conditionArray.push({
      "guestDetails.job": query.job,
    });
  }

  // company name
  if (query.companyName) {
    conditionArray.push({
      "guestDetails.companyName": { $regex: query.companyName, $options: "i" },
    });
  }

  // job title
  if (query.jobTitle) {
    conditionArray.push({
      "guestDetails.jobTitle": { $regex: query.jobTitle, $options: "i" },
    });
  }

  let count;
  let users;

  if (conditionArray.length === 0) {
    count = await User.countDocuments();

    users = await User.find()
      .select(
        details === "all"
          ? "-inSectionOne -inSectionTwo"
          : "name  logo_url _id city type allowShowingMedicines isActive  ourCompanies costOfDeliver invoiceMinTotal fastDeliver points"
      )
      .populate({
        path: "ourCompanies",
        model: "User",
        select: "_id name",
      })
      .sort(query.sort ? query.sort + " _id" : "-createdAt -name _id")
      .skip((page - 1) * (limit * 1))
      .limit(limit * 1);
  } else {
    count = await User.countDocuments({
      $and: conditionArray,
    });

    users = await User.find({
      $and: conditionArray,
    })
      .sort(query.sort ? query.sort : "-createdAt -name ")
      .select(
        details === "all"
          ? "-inSectionOne -inSectionTwo"
          : "name  logo_url  _id city type allowShowingMedicines isActive  ourCompanies costOfDeliver invoiceMinTotal fastDeliver points"
      )
      .populate({
        path: "ourCompanies",
        model: "User",
        select: "_id name",
      })
      .skip((page - 1) * (limit * 1))
      .limit(limit * 1);
  }

  res.status(200).json({
    status: "success",
    count,
    data: {
      users,
    },
  });
});

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find({}).select("+password");

  res.status(200).json({
    status: "success",
    data: {
      data: users,
    },
  });
});

// change my password
exports.changeMyPassword = catchAsync(async (req, res, next) => {
  // 1- check if the old password and the new password in the body
  const { oldPassword, newPassword, newPasswordConfirm } = req.body;

  const updateUser = await User.findById(req.user._id).select("+password");

  // 2- check that the old password is correct
  const result = await updateUser.correctPassword(
    oldPassword,
    updateUser.password
  );

  if (!result) {
    return next(new AppError("Old password is wrong", 401));
  }

  // 3- change the password and save the user
  updateUser.password = newPassword;
  updateUser.passwordConfirm = newPasswordConfirm;

  await updateUser.save({});

  // 4- return succeeded
  res.status(200).json({
    status: "success",
  });
});

// reset user password
exports.resetUserPassword = catchAsync(async (req, res, next) => {
  const { userId, newPassword, newPasswordConfirm } = req.body;

  const updateUser = await User.findById(userId).select("+password");

  updateUser.password = newPassword;
  updateUser.passwordConfirm = newPasswordConfirm;

  await updateUser.save({});

  // 4- return succeeded
  res.status(200).json({
    status: "success",
  });
});

// get info for a user defined by id
exports.getMyDetails = catchAsync(async (req, res, next) => {
  const user = req.user;

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

exports.uploadProfilePicture = catchAsync(async (req, res) => {
  const name = req.name;
  const user = req.user;

  try {
    // if the user have a logo, delete it
    if (user.logo_url && user.logo_url !== "") {
      if (fs.existsSync(`${__basedir}/public/profiles/${user.logo_url}`)) {
        fs.unlinkSync(`${__basedir}/public/profiles/${user.logo_url}`);
      }
    }
  } catch (err) {}

  await User.findByIdAndUpdate(user._id, {
    logo_url: name,
  });

  res.status(200).json({
    status: "success",
    data: {
      name: name,
    },
  });
});

exports.uploadLicense = catchAsync(async (req, res, next) => {
  const name = req.name;
  const { id } = req.body;

  await User.findByIdAndUpdate(id, {
    paper_url: name,
  });

  res.status(200).json({
    status: "success",
    data: {
      name,
    },
  });
});

// send email
exports.sendEmail = catchAsync(async (req, res, next) => {
  const user = req.user;

  const { cartItems = [] } = req.body;

  const filename = `Order ${Date.now()}.xlsx`;
  let workbook = new Excel.Workbook();
  let worksheet = workbook.addWorksheet("Debtors");

  worksheet.columns = [
    { header: "الاسم التجاري", key: "itemName" },
    { header: "اسم الشركة", key: "companyName" },
    { header: "المستودع", key: "warehouseName" },
    { header: "الشكل الصيدلاني", key: "formula" },
    { header: "العيار", key: "caliber" },
    { header: "التعبئة", key: "packing" },
    { header: "السعر ص", key: "price" },
    { header: "السعر ع", key: "customerPrice" },
    { header: "الكمية", key: "quantity" },
    { header: "بونص", key: "bonus" },
    { header: "السعر الإجمالي", key: "totalPrice" },
  ];

  cartItems.forEach((e) => {
    worksheet.addRow(e);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  const transport = nodemailer.createTransport({
    host: "smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "8c7107628803a8",
      pass: "035831fa58bd82",
    },
  });

  const mailOptions = {
    from: "companypharmalinkclinent@gmail.com",
    to: "companypharmalink@gmail.com",
    subject: "subject",
    html: `<p><label>name:</label> <label><b>${user.name}</b></label></p>
           <p><label>Phone:</label> <label><b>${user.phone[0]}</b></label></p>
           <p><label>Email:</label> <label><b>${user.email[0]}</b></label></p>
           <p><label>Date:</label> <label><b>${new Date()}</b></label></p>
    `,
    attachments: [
      {
        filename,
        content: buffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  };

  transport.sendMail(mailOptions);

  res.status(200).json({
    status: "success",
  });
});

exports.restoreData = catchAsync(async (req, res, next) => {
  const { data, rest } = req.body;

  const modifiedData = data
    .filter((d) => d.type !== "admin")
    .map((d) => {
      return {
        ...d,
        _id: mongoose.Types.ObjectId(d._id),
      };
    });

  try {
    if (rest) {
      await User.deleteMany({ type: { $ne: "admin" } });

      await User.insertMany(modifiedData);
    } else {
      await User.insertMany(modifiedData);
    }
  } catch (err) {
    return next(new AppError("error occured during restore some data", 401));
  }

  res.status(200).json({
    status: "success",
  });
});

exports.addCompanyToOurCompanies = catchAsync(async (req, res, next) => {
  const { companyId } = req.query;
  const { _id } = req.user;

  const findUser = await User.findById(_id);

  if (findUser) {
    findUser.ourCompanies = [...findUser.ourCompanies, companyId];
    await findUser.save({ validateBeforeSave: false });
  } else {
    return next(new AppError("enter a user id", 401));
  }

  res.status(200).json({
    status: "success",
    data: {
      companyId,
    },
  });
});

exports.removeCompanyFromOurCompanies = catchAsync(async (req, res, next) => {
  const { companyId } = req.query;
  const { _id } = req.user;

  const findUser = await User.findById(_id);

  if (findUser) {
    findUser.ourCompanies = findUser.ourCompanies.filter(
      (company) => company != companyId
    );
    await findUser.save({ validateBeforeSave: false });
  } else {
    return next(new AppError("enter a user id", 401));
  }

  res.status(200).json({
    status: "success",
    data: {
      companyId,
    },
  });
});

exports.storeExpoPushToken = catchAsync(async (req, res, next) => {
  const { _id } = req.user;
  const { expoPushToken } = req.query;

  const findUser = await User.findById(_id);

  if (findUser) {
    const expoPushTokenArr = findUser.expoPushToken || [];
    if (expoPushTokenArr.length === 0) {
      findUser.expoPushToken = [expoPushToken];
      await findUser.save({ validateBeforeSave: false });
    } else if (!expoPushTokenArr.includes(expoPushToken)) {
      findUser.expoPushToken = [...expoPushTokenArr, expoPushToken];
      await findUser.save({ validateBeforeSave: false });
    }
  } else {
    return next(new AppError("enter a user id", 401));
  }

  res.status(200).json({
    status: "success",
  });
});

exports.clearExpoPushToken = catchAsync(async (req, res, next) => {
  const { _id } = req.user;
  const { expoPushToken } = req.query;
  const findUser = await User.findById(_id);

  if (findUser && expoPushToken) {
    const filteredExpoPushToken = findUser.expoPushToken.filter(
      (ept) => ept !== expoPushToken
    );

    if (filteredExpoPushToken.length === 0) {
      findUser.expoPushToken = [];
    } else {
      findUser.expoPushToken = filteredExpoPushToken;
    }
    await findUser.save({ validateBeforeSave: false });
  } else {
    return next(new AppError("enter a user id", 401));
  }

  res.status(200).json({
    status: "success",
  });
});

exports.removeImage = catchAsync(async (req, res, next) => {
  const { source, id, type } = req.body;

  try {
    if (source) {
      if (fs.existsSync(`${__basedir}/public/${source}`)) {
        fs.unlinkSync(`${__basedir}/public/${source}`);
      }

      if (id && type) {
        if (type === "profile") {
          await User.findByIdAndUpdate(id, { logo_url: "" });
        }

        if (type === "license") {
          await User.findByIdAndUpdate(id, { paper_url: "" });
        }
      }
    }
  } catch (err) {
    return next(new AppError(err, 401));
  }

  res.status(200).json({
    status: "success",
  });
});

exports.getCompanies = catchAsync(async (req, res, next) => {
  const companies = await User.find({
    type: "company",
    isActive: true,
  })
    .select("_id type name logo_url city")
    .sort("name");

  res.status(200).json({
    data: companies,
  });
});

exports.getWarehouses = catchAsync(async (req, res, next) => {
  const { city, type } = req.user;
  let filter = {
    type: "warehouse",
    isActive: true,
  };

  if (type !== "admin") {
    filter = {
      ...filter,
      city: city,
    };
  }

  const warehouses = await User.find(filter)
    .select(
      "name logo_url _id city type allowShowingMedicines isActive  ourCompanies costOfDeliver invoiceMinTotal fastDeliver payAtDeliver includeInPointSystem pointForAmount amountToGetPoint"
    )
    .populate({
      path: "ourCompanies",
      model: "User",
      select: "_id name",
    })
    .sort("name");

  res.status(200).json({
    data: warehouses,
  });
});

exports.updatePoints = catchAsync(async (req, res, next) => {
  const { id, amount } = req.body;

  try {
    const findedUser = await User.findById(id);

    const newPoints = findedUser.points + amount;
    await User.findByIdAndUpdate(id, { points: newPoints });
  } catch (err) {
    return next(new AppError(err, 401));
  }

  res.status(200).json({
    status: "success",
    amount: amount,
  });
});

exports.getMyPoints = catchAsync(async (req, res, next) => {
  const { _id } = req.user;
  let myPoints = 0;
  try {
    const user = await User.findById(_id);
    myPoints = user.points;
  } catch (err) {
    return next(new AppError(err, 401));
  }

  res.status(200).json({
    status: "success",
    points: myPoints,
  });
});
