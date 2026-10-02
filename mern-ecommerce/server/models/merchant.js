const Mongoose = require('mongoose');

const { MERCHANT_STATUS } = require('../constants');

const { Schema } = Mongoose;

// Merchant Schema
const MerchantSchema = new Schema({
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 254
  },
  phoneNumber: {
    type: String,
    trim: true,
    maxlength: 40
  },
  brandName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  business: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  brand: {
    type: Schema.Types.ObjectId,
    ref: 'Brand',
    default: null
  },
  status: {
    type: String,
    default: MERCHANT_STATUS.Waiting_Approval,
    enum: [
      MERCHANT_STATUS.Waiting_Approval,
      MERCHANT_STATUS.Rejected,
      MERCHANT_STATUS.Approved
    ]
  },
  updated: Date,
  created: {
    type: Date,
    default: Date.now
  }
});

module.exports = Mongoose.model('Merchant', MerchantSchema);
