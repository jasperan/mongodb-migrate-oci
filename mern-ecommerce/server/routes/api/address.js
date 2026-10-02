const express = require('express');
const router = express.Router();

// Bring in Models & Helpers
const Address = require('../../models/address');
const auth = require('../../middleware/auth');
const { asyncHandler, httpError, pick, isObjectId } = require('../../utils/http');

const ADDRESS_FIELDS = ['address', 'city', 'state', 'country', 'zipCode', 'isDefault'];

// Every lookup is scoped to the signed-in owner: an address id alone never
// grants access, and a foreign or unknown id is simply "not found".
const ownAddressId = req => {
  if (!isObjectId(req.params.id)) throw httpError(404, 'Address not found.');
  return { _id: req.params.id, user: req.user._id };
};

// add address api
router.post(
  '/add',
  auth,
  asyncHandler(async (req, res) => {
    const address = new Address({
      ...pick(req.body, ADDRESS_FIELDS),
      user: req.user._id
    });

    try {
      await address.validate();
    } catch (error) {
      throw httpError(400, 'Your address is not valid.');
    }
    const addressDoc = await address.save();

    res.status(200).json({
      success: true,
      message: `Address has been added successfully!`,
      address: addressDoc
    });
  })
);

// fetch all addresses api
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const addresses = await Address.find({ user: req.user._id });

    res.status(200).json({ addresses });
  })
);

router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const addressDoc = await Address.findOne(ownAddressId(req));

    if (!addressDoc) throw httpError(404, 'Address not found.');

    res.status(200).json({ address: addressDoc });
  })
);

router.put(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const query = ownAddressId(req);
    const update = { ...pick(req.body, ADDRESS_FIELDS), updated: Date.now() };

    let addressDoc;
    try {
      addressDoc = await Address.findOneAndUpdate(query, update, {
        new: true,
        runValidators: true
      });
    } catch (error) {
      throw httpError(400, 'Your address is not valid.');
    }

    if (!addressDoc) throw httpError(404, 'Address not found.');

    res.status(200).json({
      success: true,
      message: 'Address has been updated successfully!'
    });
  })
);

router.delete(
  '/delete/:id',
  auth,
  asyncHandler(async (req, res) => {
    const result = await Address.deleteOne(ownAddressId(req));

    if (result.deletedCount === 0) throw httpError(404, 'Address not found.');

    res.status(200).json({
      success: true,
      message: `Address has been deleted successfully!`,
      address: result
    });
  })
);

module.exports = router;
