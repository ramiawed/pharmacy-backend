const Order = require("../models/orderModel");
const Item = require("../models/itemModel");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getOrderById = catchAsync(async (req, res, next) => {
  const { id } = req.query;

  const order = await Order.findById(id)
    .populate({
      path: "pharmacy",
      model: "User",
      select: { name: 1 },
    })
    .populate({
      path: "warehouse",
      model: "User",
      select: { name: 1 },
    })
    .populate({
      path: "items.item",
      model: "Item",
      select: { name: 1, formula: 1, caliber: 1, price: 1, customer_price: 1 },
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

exports.getOrders = catchAsync(async (req, res, next) => {
  const {
    pharmacyId = null,
    warehouseId = null,
    page,
    limit,
    pharmacyName = null,
    warehouseName = null,
    date = null,
    date1 = null,
  } = req.query;

  console.log(req.query);

  const conditionArray = [];

  if (pharmacyId) {
    conditionArray.push({ pharmacy: pharmacyId });
  }

  if (warehouseId) {
    conditionArray.push({ warehouse: warehouseId });
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

  if (date) {
    conditionArray.push({
      orderDate: {
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
    .select("_id pharmacy warehouse orderDate")
    .populate({
      path: "pharmacy",
      model: "User",
      select: { name: 1 },
    })
    .populate({
      path: "warehouse",
      model: "User",
      select: { name: 1 },
    });

  // .populate({
  //   path: "items.item",
  //   model: "Item",
  //   select: { name: 1, formula: 1, caliber: 1, price: 1, customer_price: 1 },
  //   populate: {
  //     path: "company",
  //     model: "User",
  //     select: { name: 1 },
  //   },
  // })
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
    console.log(err);
  }

  res.status(200).json({
    status: "success",
  });
});