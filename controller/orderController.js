const Order = require("../models/orderModel");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const mongoose = require("mongoose");
const { sendPushNotification } = require("../utils/expoNotification");

exports.getOrderById = catchAsync(async (req, res, next) => {
  const { id } = req.query;

  const order = await Order.findById(id)
    .populate({
      path: "pharmacy",
      model: "User",
      select: { name: 1, addressDetails: 1, mobile: 1, certificateName: 1 },
    })
    .populate({
      path: "warehouse",
      model: "User",
      select: { name: 1 },
    })
    .populate({
      path: "items.item",
      model: "Item",
      select: {
        name: 1,
        formula: 1,
        caliber: 1,
        price: 1,
        customer_price: 1,
        nameAr: 1,
      },
      populate: {
        path: "company",
        model: "User",
        select: { name: 1 },
      },
    });

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

exports.getAllOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({});

  res.status(200).json({
    status: "success",
    data: {
      data: orders,
    },
  });
});

exports.updateOrder = catchAsync(async (req, res, next) => {
  const { type } = req.user;
  const { id } = req.query;
  const body = req.body;

  const updatedOrder = await Order.findByIdAndUpdate(id, body, {
    new: true,
  })
    .populate({
      path: "pharmacy",
      model: "User",
      select: { name: 1, addressDetails: 1 },
    })
    .populate({
      path: "warehouse",
      model: "User",
      select: { name: 1 },
    });

  const { pharmacy, warehouse, createdAt } = updatedOrder;

  const warehouseUser = await User.findById(warehouse._id).select(
    "name expoPushToken"
  );
  const pharmacyUser = await User.findById(pharmacy._id).select(
    "name expoPushToken"
  );

  const adminUser = await User.findOne({
    type: "admin",
  }).select("name expoPushToken");

  const orderStatus =
    body.status === "dont-serve"
      ? "نعتذر عن تخديم الطلبية"
      : body.status === "confirm"
      ? "تم تثبيت الطلبية"
      : body.status === "delivery"
      ? "تم تسليم الطلبية"
      : body.status === "shipping"
      ? "تم شحن الطلبية"
      : "";

  if (orderStatus.length > 0) {
    const message = [
      "تم تغيير حالة الطلبية المرسلة من الصيدلية",
      `${pharmacyUser.name}`,
      "إلى المستودع",
      `${warehouseUser.name}`,
      "بتاريخ",
      `${new Date(createdAt).toLocaleDateString()}`,
      "إلى",
      `${orderStatus}`,
    ];

    let sendTo = [];

    if (type === "admin") {
      sendTo = [...pharmacyUser.expoPushToken];
    }

    if (type === "warehouse") {
      sendTo = [...pharmacyUser.expoPushToken, ...adminUser.expoPushToken];
    }

    sendPushNotification(sendTo, "تعديل حالة الطلبية", message.join(" "), {
      screen: "order",
      orderId: updatedOrder._id,
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      order: updatedOrder,
    },
  });
});

exports.updateOrders = catchAsync(async (req, res, next) => {
  const { ids, body } = req.body;

  for (let i = 0; i < ids.length; i++) {
    const updatedOrder = await Order.findByIdAndUpdate(ids[i], body, {});

    const { pharmacy, warehouse, createdAt } = updatedOrder;

    const warehouseUser = await User.findById(warehouse).select(
      "name expoPushToken"
    );
    const pharmacyUser = await User.findById(pharmacy).select(
      "name expoPushToken"
    );

    const adminUser = await User.findOne({
      type: "admin",
    }).select("name expoPushToken");

    if (body.warehouseStatus) {
      const orderStatus =
        body.warehouseStatus === "sent"
          ? "الطلبية قيد الشحن"
          : body.warehouseStatus === "received"
          ? "تم استلام الطلبية"
          : "نعتذر عن تخديم الطلبية";
      const message = [
        "تم تغيير حالة الطلبية المرسلة من الصيدلية",
        `${pharmacyUser.name}`,
        "إلى المستودع",
        `${warehouseUser.name}`,
        "بتاريخ",
        `${new Date(createdAt).toLocaleDateString()}`,
        "إلى",
        `${orderStatus}`,
      ];

      sendPushNotification(
        [...pharmacyUser.expoPushToken, ...adminUser.expoPushToken],
        "تعديل حالة الطلبية",
        message.join(" "),
        {
          screen: "order",
          orderId: updatedOrder._id,
        }
      );
    }

    if (body.pharmacyStatus) {
      const orderStatus =
        body.pharmacyStatus === "sent"
          ? "تم ارسال الطلبية"
          : "تم استلام الطلبية من المستودع";
      const message = [
        "تم تغيير حالة الطلبية المرسلة من الصيدلية",
        `${pharmacyUser.name}`,
        "إلى المستودع",
        `${warehouseUser.name}`,
        "بتاريخ",
        `${new Date(createdAt).toLocaleDateString()}`,
        "إلى",
        `${orderStatus}`,
      ];

      sendPushNotification(
        [...warehouseUser.expoPushToken, ...adminUser.expoPushToken],
        "تعديل حالة الطلبية",
        message.join(" "),
        {
          screen: "order",
          orderId: updatedOrder._id,
        }
      );
    }
  }

  res.status(200).json({
    status: "success",
  });
});

exports.getOrders = catchAsync(async (req, res, next) => {
  const user = req.user;
  const {
    page,
    limit,
    pharmacyName = null,
    warehouseName = null,
    date = null,
    date1 = null,
    orderStatus = "",
  } = req.query;

  const conditionArray = [];

  if (user.type === "pharmacy") {
    conditionArray.push({ pharmacy: user._id });
  }

  if (user.type === "warehouse") {
    conditionArray.push({ warehouse: user._id });
  }

  if (pharmacyName) {
    // get the ids for all company that there name match the companyName
    const pharmacies = await User.find(
      {
        name: { $regex: pharmacyName, $options: "i" },
        type: "pharmacy",
      },
      { _id: 1 }
    );

    // map each company object to it's id
    const arr = pharmacies.map((pharmacy) => pharmacy._id);

    // get all items that company id in the companies ids array
    conditionArray.push({
      pharmacy: { $in: arr },
    });
  }

  if (warehouseName) {
    // get the ids for all company that there name match the companyName
    const warehouses = await User.find(
      {
        name: { $regex: warehouseName, $options: "i" },
        type: "warehouse",
      },
      {
        _id: 1,
      }
    );

    // map each company object to it's id
    const arr = warehouses.map((warehouse) => warehouse._id);

    // get all items that company id in the companies ids array
    conditionArray.push({
      warehouse: { $in: arr },
    });
  }

  if (orderStatus !== "") {
    conditionArray.push({ status: orderStatus });
  }

  if (date) {
    conditionArray.push({
      createdAt: {
        $gte: new Date(date),
        $lt: new Date(date1),
      },
    });
  }

  const orders = await Order.find(
    conditionArray.length > 0 ? { $and: conditionArray } : {}
  )
    .sort("-createdAt")
    .skip((page - 1) * (limit * 1))
    .limit(limit * 1)
    .select(
      "_id pharmacy warehouse updatedAt createdAt status shippedDate deliverDate deliverTime shippedTime couldNotDeliverDate confirmDate"
    )
    .populate({
      path: "pharmacy",
      model: "User",
      select: { name: 1, addressDetails: 1 },
    })
    .populate({
      path: "warehouse",
      model: "User",
      select: { name: 1 },
    });

  const count = await Order.countDocuments(
    conditionArray.length > 0 ? { $and: conditionArray } : {}
  );

  res.status(200).json({
    status: "success",
    count,
    data: {
      orders,
    },
  });
});

exports.saveOrder = catchAsync(async (req, res, next) => {
  const body = req.body;

  try {
    await Order.create(body);
  } catch (err) {
    return next(new AppError("something went wrong", 400, ""));
  }

  // to send notification for a warehouse
  const warehouserUser = await User.findById(req.body.warehouse);
  const pharmacyUser = await User.findById(req.body.pharmacy).select(
    "_id name"
  );
  const adminUser = await User.findOne({
    type: "admin",
  });

  const messages = [":طلبية جديدة من الصيدلية", `${pharmacyUser.name}`, ""];

  if (warehouserUser && warehouserUser.expoPushToken.length > 0) {
    const somePushTokens = [];
    somePushTokens.push(...warehouserUser.expoPushToken);
    sendPushNotification(somePushTokens, "طلبية جديدة", messages.join(" "));
  }

  if (
    adminUser &&
    adminUser.expoPushToken &&
    adminUser.expoPushToken.length > 0
  ) {
    messages.push("الى المستودع", `${warehouserUser.name}`);
    sendPushNotification(
      adminUser.expoPushToken,
      "طلبية جديدة",
      messages.join(" ")
    );
  }

  res.status(200).json({
    status: "success",
  });
});

exports.getUnreadOrders = catchAsync(async (req, res, next) => {
  const user = req.user;

  let count = 0;

  if (user.type === "admin") {
    count = await Order.countDocuments({ seenByAdmin: false });
  } else {
    count = await Order.countDocuments({
      warehouseStatus: "unread",
      warehouse: user._id,
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      count,
    },
  });
});

exports.deleteOrder = catchAsync(async (req, res, next) => {
  const { orderId } = req.body;

  await Order.findByIdAndDelete(orderId);

  res.status(200).json({
    status: "success",
    data: {
      orderId,
    },
  });
});

exports.restoreData = catchAsync(async (req, res, next) => {
  const { data, rest } = req.body;

  const modifiedData = data.map((d) => {
    return {
      ...d,
      pharmacy: mongoose.Types.ObjectId(d.pharmacy),
      warehouse: mongoose.Types.ObjectId(d.warehouse),
      items: d.items.map((i) => {
        return {
          ...i,
          item: mongoose.Types.ObjectId(i.item),
          _id: mongoose.Types.ObjectId(i._id),
        };
      }),
    };
  });

  try {
    if (rest) {
      await Order.deleteMany({});
      await Order.insertMany(modifiedData);
    } else {
      await Order.insertMany(modifiedData);
    }
  } catch (err) {
    return next(new AppError("error occured during restore some data", 401));
  }

  res.status(200).json({
    status: "success",
  });
});
