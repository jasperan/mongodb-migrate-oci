const Mongoose = require('mongoose');
const slug = require('mongoose-slug-generator');
const { Schema } = Mongoose;

const options = {
  separator: '-',
  lang: 'en',
  truncate: 120
};

// Product Schema
const ProductSchema = new Schema({
  sku: {
    type: String
  },
  name: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    slug: 'name',
    unique: true
  },
  imageUrl: {
    type: String
  },
  imageKey: {
    type: String
  },
  description: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    min: 0
  },
  price: {
    type: Number,
    min: 0
  },
  taxable: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  brand: {
    type: Schema.Types.ObjectId,
    ref: 'Brand',
    default: null
  },
  updated: Date,
  created: {
    type: Date,
    default: Date.now
  }
});

// Registered on this schema only: the global Mongoose.plugin() re-applied the
// slug hooks to every schema compiled afterwards.
ProductSchema.plugin(slug, options);

module.exports = Mongoose.model('Product', ProductSchema);
