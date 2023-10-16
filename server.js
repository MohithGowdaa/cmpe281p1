const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const AWS = require('aws-sdk'); // Include AWS SDK for DynamoDB
const session = require('express-session');

dotenv.config({ path: '.env' });

const app = express();

// Creating a constant port variable and keeping 8080 as the default value
const PORT = process.env.PORT || 8000;

// To log requests: will print stuff like 'GET / 200 19 - 4.930 ms' in the console. That is the request type, path, and time taken.
app.use(morgan('tiny'));

// AWS SDK configuration for DynamoDB
AWS.config.update({
  region: 'us-east-1',
  endpoint: process.env.DynamoDb_URI,
  accessKeyId: process.env.AwsAccessKeyId,
  secretAccessKey: process.env.AwsSecretAccessKey,
});


// Using body parser to parse requests
app.use(bodyParser.urlencoded({ extended: true }));

// Express session
app.use(
  session({
    secret: 'secret', // Change this to a strong, secret key
    resave: true,
    saveUninitialized: true,
  })
);

// Setting the view engine
app.set('view engine', 'ejs');

app.use('/css', express.static(path.resolve(__dirname, 'assets/css')));
app.use('/img', express.static(path.resolve(__dirname, 'assets/img')));
app.use('/js', express.static(path.resolve(__dirname, 'assets/js')));

// Function to retrieve user information from the 'users' table based on email
async function getUserByEmail(email) {
  const docClient = new AWS.DynamoDB.DocumentClient();

  const params = {
    TableName: 'users', 
    Key: {
      email: email, 
    },
  };

  try {
    const data = await docClient.get(params).promise();
    return data.Item; // This will contain user details
  } catch (error) {
    console.error('Error fetching user details from DynamoDB:', error);
    return null; // Handle this error gracefully in your application
  }
}

// Middleware to fetch user data based on session email
app.use(async (req, res, next) => {
  if (req.session.email) {
    // Fetch user information from DynamoDB using the email stored in the session
    const userData = await getUserByEmail(req.session.email);
    if (userData) {
      req.user = userData; // Store user data in the request object for future use
    }
  }
  next();
});

// Load routers
const router = require('./server/routes/router');
app.use('/', router);



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
