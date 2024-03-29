const express = require("express");
const authController = require("../controller/authController");
const basketController = require("../controller/basketController");

const basketRouter = express.Router();

basketRouter.get(
  "/",
  authController.protect,
  authController.restrictTo("warehouse", "admin", "pharmacy"),
  basketController.getBaskets
);

basketRouter.post(
  "/add",
  authController.protect,
  authController.restrictTo("warehouse", "admin"),
  basketController.addBasket
);

basketRouter.post(
  "/update",
  authController.protect,
  authController.restrictTo("warehouse", "admin"),
  basketController.updateBasket
);

basketRouter.post(
  "/remove",
  authController.protect,
  authController.restrictTo("warehouse", "admin"),
  basketController.removeBasket
);

basketRouter.get(
  "/all",
  authController.protect,
  authController.restrictTo("admin"),
  basketController.getAllBaskets
);

basketRouter.post(
  "/restore",
  authController.protect,
  authController.restrictTo("admin"),
  basketController.restoreData
);

module.exports = basketRouter;
