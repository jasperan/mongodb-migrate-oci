const Mongoose = require('mongoose');

exports.getStoreProductsQuery = (min, max, rating) => {
  rating = Number(rating);
  max = Number(max);
  min = Number(min);

  const priceFilter = min && max ? { price: { $gte: min, $lte: max } } : {};
  const ratingFilter = rating
    ? { rating: { $gte: rating } }
    : { rating: { $gte: rating } };

  const matchQuery = {
    isActive: true,
    price: priceFilter.price,
    averageRating: ratingFilter.rating
  };

  const basicQuery = process.env.MONGO_URI.includes('loadBalanced') ? [
    {
       $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brands'
      }
      /*$sql: `select json_mergepatch(i.data, json_object('brands' : json_array(b.data returning json) returning json))
 from input i 
left outer join brands b on i.data.brand.idOnly() = b.data."_id".idOnly()`*/
    },
    {
      $unwind: {
        path: '$brands',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        'brand.name': '$brands.name',
        'brand._id': '$brands._id',
        'brand.isActive': '$brands.isActive'
      }
    },
    {
      $match: {
        'brand.isActive': true
      }
    },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'product',
        as: 'reviews'
      }
      /*$sql: `select json_mergepatch(i.data, json_object('reviews': json_array(r.data returning json) returning json)) from "Q6" i left outer join reviews r on i.data."_id".idOnly() = r.data.product.idOnly()`*/
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
    },
    {
      $match: matchQuery
    },
    {
      $project: {
        brands: 0,
        reviews: 0
      }
    }
  ]

    : // original pipeline
    [
      {
        $lookup: {
          from: 'brands',
          localField: 'brand',
          foreignField: '_id',
          as: 'brands'
        }
      },
      {
        $unwind: {
          path: '$brands',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          'brand.name': '$brands.name',
          'brand._id': '$brands._id',
          'brand.isActive': '$brands.isActive'
        }
      },
      {
        $match: {
          'brand.isActive': true
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
      },
      {
        $match: matchQuery
      },
      {
        $project: {
          brands: 0,
          reviews: 0
        }
      }
    ]
    ;

  return basicQuery;
};

exports.getStoreProductsWishListQuery = (userId, brandDoc, categoryDoc) => {

  if (brandDoc) {
    console.log("Brand doc present");
  } else {
    console.log("Brand doc NOT present");
  }

  var alias = "Q12";

  if (brandDoc && categoryDoc) {
    alias = "Q14";
  } else if (brandDoc || categoryDoc) {
    alias = "Q13";
  }

  const wishListQuery = process.env.MONGO_URI.includes('loadBalanced') ? [
    {
            $lookup: {
              from: 'wishlists',
              left: { product: '$_id' },
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
          
      /*$sql: `select json_mergepatch(i.data, json_object('isLiked':w.is_liked returning json) ) from "` + alias + `" i left outer join wishlists_root w on i.data."_id" = w.product and w.ora$user = hextoraw('` + new Mongoose.Types.ObjectId(userId) + `')`*/
    }/*,
    {
      $addFields: {
        isLiked: { $arrayElemAt: ['$isLiked.isLiked', 0] }
      }
    }*/
  ]
    : // original pipeline
    [
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
          isLiked: { $arrayElemAt: ['$isLiked.isLiked', 0] }
        }
      }
    ];

  return wishListQuery;
};