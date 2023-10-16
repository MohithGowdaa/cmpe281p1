const AWS = require("aws-sdk");
const { v4: uuidv4 } = require('uuid');

AWS.config.update({
  region: "us-east-1",
  accessKeyId: process.env.AwsAccessKeyId,
  secretAccessKey: process.env.AwsSecretAccessKey
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

function createFile(user, email, fileUrl, fileName, fileDesc) {
  const fileId = uuidv4(); // Generate a unique ID for each file
  const uploadTime = new Date().toISOString(); // Current date in ISO 8601 format

  const FilesSchema = {
    TableName: "Files", 
    Item: {
      fileId,
      user,
      email,
      fileUrl,
      fileName,
      fileDesc,
      uploadTime,
      modifiedDate: uploadTime // Set modifiedDate to uploadTime initially
    }
  };

  return FilesSchema;
}

module.exports = { dynamodb, createFile };
