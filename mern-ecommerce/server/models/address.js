const Mongoose = require('mongoose');
const { Schema } = Mongoose;

// Address Schema
const AddressSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  address: {
    type: String,
    trim: true,
    maxlength: 200
  },
  city: {
    type: String,
    trim: true,
    maxlength: 200
  },
  state: {
    type: String,
    trim: true,
    maxlength: 200
  },
  country: {
    type: String,
    trim: true,
    maxlength: 200
  },
  zipCode: {
    type: String,
    trim: true,
    maxlength: 200
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  updated: Date,
  created: {
    type: Date,
    default: Date.now
  }
});

module.exports = Mongoose.model('Address', AddressSchema);
