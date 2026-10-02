// Product images are not persisted yet (the storefront renders generated art), so
// the upload only yields the reference stored on the product. The name comes from
// the client, hence it is reduced to a plain file name before it is kept.
const safeName = name =>
  String(name)
    .split(/[\\/]/)
    .pop()
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 120);

exports.s3Upload = async image => {
  if (!image) return { imageUrl: '', imageKey: '' };

  const imageKey = safeName(image.originalname);
  return { imageUrl: '/images/products/' + imageKey, imageKey };
};
