const AWS = require("aws-sdk");
require("dotenv").config();

const connectDB = () => {
  AWS.config.update({
    region: "us-east-1", // Update with your DynamoDB region
    accessKeyId: process.env.AwsAccessKeyId,
    secretAccessKey: process.env.AwsSecretAccessKey,
  });
};

module.exports = connectDB;
