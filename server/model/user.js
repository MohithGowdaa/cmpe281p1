const AWS = require("aws-sdk");
const { v4: uuidv4 } = require('uuid');

AWS.config.update({
  region: "us-east-1",
  accessKeyId: process.env.AwsAccessKeyId,
  secretAccessKey: process.env.AwsSecretAccessKey
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

function createUser(name, email, password) {
  const userId = uuidv4(); // Generate a unique ID for each user

  const UserSchema = {
    TableName: "users", 
    Item: {
      userId,
      name,
      email,
      password 
    }
  };

  return new Promise((resolve, reject) => {
    dynamodb.put(UserSchema, (err, data) => {
      if (err) {
        console.error('Unable to create user:', err);
        reject(err);
      } else {
        console.log('User created successfully:', userId);
        resolve(userId);
      }
    });
  });
}

module.exports = { dynamodb, createUser };
