const Mongoose = require('mongoose');

const { REVIEW_STATUS } = require('../constants');

// The Oracle Database API for MongoDB is reached through a load-balanced URI, and
// that is the one place `$lookup` cannot express the joins below (no `let`, no
// missing `localField`). The backend never changes while the process runs, so it
// is decided once here instead of on every request.
const ORACLE_API = /loadBalanced/i.test(process.env.MONGO_URI || '');

// Everything the storefront list needs per product: the brand (name and state),
// the Approved-review aggregates and, for a signed-in caller, the wishlist flag.
//
// On Oracle all of it is one `$sql` stage. A `$sql` stage sees only the pipeline's
// original collection as `input` (later `$sql` stages cannot name the previous
// stage reliably), so the filters that can run on raw product fields are `$match`
// stages placed before it and the reviews are pre-aggregated to one row per
// product - joining raw review rows would duplicate a product per review.
const oracleJoinStage = userId => {
  const wishlist = userId
    ? `,
    'isLiked' value nvl(
      (select json_value(w.data, '$.isLiked' returning boolean)
         from wishlists w
        where w.data.product.idOnly() = i.data."_id".idOnly()
          and w.data."user".idOnly() = hextoraw('${new Mongoose.Types.ObjectId(userId).toString()}')
        fetch first 1 row only), false)`
    : '';

  return {
    $sql: `select json_mergepatch(i.data, json_object(
    'brand' value json_object('_id' value b.data."_id", 'name' value b.data.name, 'isActive' value b.data.isActive returning json),
    'totalRatings' value nvl(rv.total, 0),
    'totalReviews' value nvl(rv.cnt, 0),
    'averageRating' value case when nvl(rv.cnt, 0) = 0 then 0 else rv.total / rv.cnt end${wishlist}
    returning json) returning json)
  from input i
  left outer join brands b on i.data.brand.idOnly() = b.data."_id".idOnly()
  left outer join (select r.data.product.idOnly() pid, count(*) cnt, sum(r.data.rating.number()) total
                     from reviews r
                    where r.data.status.string() = '${REVIEW_STATUS.Approved}'
                    group by r.data.product.idOnly()) rv
    on i.data."_id".idOnly() = rv.pid`
  };
};

const mongoJoinStages = userId => {
  const stages = [
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brands'
      }
    },
    { $unwind: { path: '$brands', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        'brand.name': '$brands.name',
        'brand._id': '$brands._id',
        'brand.isActive': '$brands.isActive'
      }
    },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'product',
        as: 'reviews'
      }
    },
    {
      $addFields: {
        reviews: {
          $filter: {
            input: '$reviews',
            as: 'review',
            cond: { $eq: ['$$review.status', REVIEW_STATUS.Approved] }
          }
        }
      }
    },
    {
      $addFields: {
        totalRatings: { $sum: '$reviews.rating' },
        totalReviews: { $size: '$reviews' }
      }
    },
    {
      $addFields: {
        averageRating: {
          $cond: [
            { $eq: ['$totalReviews', 0] },
            0,
            { $divide: ['$totalRatings', '$totalReviews'] }
          ]
        }
      }
    }
  ];

  if (userId) {
    stages.push(
      {
        $lookup: {
          from: 'wishlists',
          let: { product: '$_id' },
          pipeline: [
            {
              $match: {
                $and: [
                  { $expr: { $eq: ['$$product', '$product'] } },
                  { user: new Mongoose.Types.ObjectId(userId) }
                ]
              }
            }
          ],
          as: 'isLiked'
        }
      },
      {
        $addFields: {
          isLiked: { $ifNull: [{ $arrayElemAt: ['$isLiked.isLiked', 0] }, false] }
        }
      }
    );
  }

  stages.push({ $project: { brands: 0, reviews: 0 } });
  return stages;
};

/**
 * Pipeline behind GET /product/list, up to (not including) sort and paging.
 *
 * @param {object} filters
 * @param {number} [filters.min]       inclusive lower price bound, applied when finite
 * @param {number} [filters.max]       inclusive upper price bound, applied when finite
 * @param {number} [filters.rating]    minimum average rating (Approved reviews only)
 * @param {RegExp} [filters.name]      case-insensitive name pattern
 * @param {Array}  [filters.productIds] restrict to these products (a category)
 * @param {*}      [filters.brandId]   restrict to this brand
 * @param {string} [filters.userId]    signed-in caller; adds the `isLiked` flag
 */
exports.getStoreProductsQuery = ({
  min,
  max,
  rating = 0,
  name,
  productIds,
  brandId,
  userId
} = {}) => {
  const match = { isActive: true };

  const price = {};
  if (Number.isFinite(min)) price.$gte = min;
  if (Number.isFinite(max)) price.$lte = max;
  if (Object.keys(price).length > 0) match.price = price;

  if (name) match.name = name;
  if (productIds) match._id = { $in: productIds };
  if (brandId) match.brand = brandId;

  const pipeline = [
    { $match: match },
    ...(ORACLE_API ? [oracleJoinStage(userId)] : mongoJoinStages(userId)),
    // Products of an inactive (or missing) brand are not for sale.
    { $match: { 'brand.isActive': true } }
  ];

  if (rating > 0) pipeline.push({ $match: { averageRating: { $gte: rating } } });

  return pipeline;
};
