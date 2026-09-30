// const AWS = require('aws-sdk');

exports.s3Upload = async image => {
  try {
    let imageUrl = '';
    let imageKey = '';

    if (image) {
	imageUrl = '/images/products/' + image.originalname;
        imageKey = image.originalname;
    }

    return { imageUrl, imageKey };
  } catch (error) {
    return { imageUrl: '', imageKey: '' };
  }
};