const express = require("express");
const authController = require("../controller/authController");
const savedItemsController = require("../controller/savedItemsController");

const savedItemRouter = express.Router();

savedItemRouter.get(
  "/",
  authController.protect,
  savedItemsController.getSavedItems
);

savedItemRouter.post(
  "/add",
  authController.protect,
  savedItemsController.addSavedItem
);

savedItemRouter.post(
  "/remove",
  authController.protect,
  savedItemsController.removeSaveItem
);

savedItemRouter.get(
  "/all",
  authController.protect,
  authController.restrictTo("admin"),
  savedItemsController.getAllSavedItems
);

savedItemRouter.post(
  "/restore",
  authController.protect,
  authController.restrictTo("admin"),
  savedItemsController.restoreData
);

module.exports = savedItemRouter;
