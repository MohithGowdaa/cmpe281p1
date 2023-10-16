const AWS = require('aws-sdk');
const multer = require('multer');
const moment = require('moment');

require('dotenv').config({ path: '.env' });

const storage = multer.memoryStorage();
const multerObject = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }).single('image');

AWS.config.update({
  region: "us-east-1",
  accessKeyId: process.env.AwsAccessKeyId,
  secretAccessKey: process.env.AwsSecretAccessKey,
});

const docClient = new AWS.DynamoDB.DocumentClient();


// Function to retrieve users from DynamoDB
const getUsersFromDynamoDB = async () => {
  const params = {
    TableName: 'users',
  };

  try {
    console.log('Fetching users from DynamoDB...');
    const data = await docClient.scan(params).promise();
    console.log('Users fetched successfully:', data);
    return data;
  } catch (err) {
    console.error('Error fetching users from DynamoDB: ', err);
    return undefined;
  }
};

// Function to fetch files from DynamoDB
const getFilesFromDynamoDB = async () => {
  const params = {
    TableName: 'files',
  };

  try {
    console.log('Fetching files from DynamoDB...');
    const data = await docClient.scan(params).promise();
    console.log('Files fetched successfully:', data);
    return data;
  } catch (err) {
    console.error('Error fetching files from DynamoDB: ', err);
    return undefined;
  }
};

// Create a new user in DynamoDB
// Create a new user in DynamoDB
exports.create = (req, res) => {
  if (!req.body || req.body.email === '') {
    res.status(400).send({ message: 'Request body cannot be empty' });
    return;
  }

  const params = {
    TableName: 'users',
    Item: {
      name: req.body.name,
      email: req.body.email, // Include the email attribute
      password: req.body.password,
    },
  };

  docClient.put(params, (err, data) => {
    if (err) {
      console.error('Unable to add user', req.body.email, '. Error JSON:', JSON.stringify(err, null, 2));
      res.status(500).json({ error: true, message: 'Unable to add user' });
    } else {
      console.log('PutItem succeeded:', req.body.email);
      res.redirect('/');
    }
  });
};


// Upload functionality using AWS S3 and DynamoDB
// ... (other code)

exports.upload = (req, res) => {
  multerObject(req, res, async (err) => {
    try {
      if (err) {
        throw new Error(err);
      }

      const startDate = new Date();
      const file = req.file;

      if (!file) {
        res.redirect('/dashboard');
        return;
      }

      const s3bucket = new AWS.S3({
        accessKeyId: process.env.AwsAccessKeyId,
        secretAccessKey: process.env.AwsSecretAccessKey,
        region: 'us-east-1',
      });

      // Fetch user details from 'users' table using the session data (user email)
      const userEmail = req.session.email; // Assuming the user's email is stored in the session

      // Fetch the user's data from DynamoDB
      const userData = await getUserDetailsFromDynamoDB(req.session);

      if (userData) {
        // Your S3 upload logic
        const uploadResult = await uploadFileToS3(s3bucket, file);

        if (uploadResult.error) {
          return res.status(500).json({ error: true, message: 'S3 upload failed', details: uploadResult.error });
        }

        console.log('File upload successful');
        const endDate = new Date();
        const str = uploadResult.data.Location;
        const cloudfrontUrl = process.env.cloudfrontUrl + str.substr(50);

        // Use the user data fetched from DynamoDB
        const user = userData.Item;

        const dynamoParams = {
          TableName: 'files',
          Item: {
            user: user.name,
            email: user.email,
            fileUrl: uploadResult.data.Location,
            fileName: file.originalname,
            fileDesc: file.originalname,
            cloudfrontUrl: cloudfrontUrl,
            uploadTime: endDate.toISOString(), 
            modifiedDate: endDate.toISOString(), // Set modifiedDate to the current date and time
          },
        };

        // Save the file details to DynamoDB
        const dynamoDBResult = await saveFileDetailsToDynamoDB(dynamoParams);

        if (dynamoDBResult.error) {
          return res.status(500).json({ error: true, message: 'Unable to add file to DynamoDB' });
        }

        // Update the session with the new file details
        updateSessionWithNewFile(req, user, uploadResult.data.Location, file);

        console.log('File Uploaded to S3 and DynamoDB');
        return res.status(200).json({ success: true, message: 'File uploaded successfully' });
      } else {
        return res.status(500).json({ error: true, message: 'User data not found in DynamoDB' });
      }
    } catch (err) {
      // Handle and log the error gracefully
      console.error('Error during file upload:', err);
      return res.status(500).json({ error: true, message: err.message });
    }
  });
};

async function getUserDetailsFromDynamoDB(session) {
  const userEmail = session.email; // Assuming the user's email is stored in the session
  if (!userEmail) {
    console.error('User email not found in session');
    return undefined;
  }

  const params = {
    TableName: 'users',
    Key: {
      email: userEmail,
    },
  };

  try {
    console.log('Fetching user details from DynamoDB...');
    const data = await docClient.get(params).promise();
    console.log('User details fetched successfully:', data);
    return data;
  } catch (err) {
    console.error('Error fetching user details from DynamoDB: ', err);
    return undefined;
  }
}

async function uploadFileToS3(s3, file) {
  const params = {
    Bucket: process.env.bucketName,
    Key: file.fieldname + '-' + Date.now(),
    Body: file.buffer,
    ContentType: 'application/octet-stream',
  };

  return new Promise((resolve) => {
    s3.upload(params, (err, data) => {
      if (err) {
        resolve({ error: err });
      } else {
        resolve({ data });
      }
    });
  });
}

async function saveFileDetailsToDynamoDB(dynamoParams) {
  return new Promise((resolve) => {
    docClient.put(dynamoParams, (err, data) => {
      if (err) {
        resolve({ error: err });
      } else {
        resolve({ data });
      }
    });
  });
}

function updateSessionWithNewFile(req, user, fileUrl, file) {
  if (!req.session.files) {
    req.session.files = [];
  }

  const startDate = new Date();
  const endDate = new Date();
  const cloudfrontUrl = process.env.cloudfrontUrl + fileUrl.substr(50);

  const newFile = {
    user: user.name,
    email: user.email,
    fileUrl,
    fileName: file.originalname,
    fileDesc: file.originalname,
    cloudfrontUrl,
    uploadTime: (endDate - startDate) / 1000,
    modifiedDate: (endDate - startDate) / 1000,
  };

  req.session.files.push(newFile);
}








// Login functionality using DynamoDB
// Login functionality using DynamoDB
exports.login = async (req, res) => {
  req.session.user = req.body.user;
  req.session.email = req.body.email;
  req.session.password = req.body.password;

  if (!req.body) {
    res.status(400).send({ message: 'Request body cannot be empty' });
    return;
  }

  const inputEmail = req.body.email;

  if (req.body.email === 'admin@gmail.com' && req.body.password === 'admin') {
    req.session.user = 'Admin';
    const userList = await getUsersFromDynamoDB();
    req.session.users = userList.Items;

    // Fetch and populate req.session.files for the admin user here
    const filesList = await getFilesFromDynamoDB();
    req.session.files = filesList.Items;

    // Pass the email to the dashboard view for the admin user
    res.render('adminView', { userName: req.session.user, email: req.session.email, usersToDisplay: req.session.users, filesToDisplay: req.session.files });
  } else {
    const userList = await getUsersFromDynamoDB();

    if (userList == undefined) {
      res.render('index', { errorMessage: 'No Users Found!' });
    } else {
      const emailArray = userList.Items.map((item) => item.email);
      if (emailArray.includes(inputEmail)) {
        const user = userList.Items.find((item) => item.email === inputEmail);
        if (user.password === req.body.password) {
          // Fetch and populate req.session.files here for regular users
          const filesList = await getFilesFromDynamoDB();
          req.session.files = filesList.Items.filter((item) => item.email === req.session.email);

          // Pass the email to the dashboard view for regular users
          res.render('dashboard', { userName: user.name, email: req.session.email, filesToDisplay: req.session.files });
        } else {
          res.render('index', { errorMessage: 'Password is incorrect' });
        }
      } else {
        res.render('index', { errorMessage: 'User not found. Please sign up.' });
      }
    }
  }
};


//File Uploading
exports.uploadFile = (req, res) => {
  const multerStorage = multer.memoryStorage();
  const upload = multer({ storage: multerStorage }).single('file'); // Assuming your file input field has the name "file"

  upload(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(500).json({ error: true, message: 'File upload failed' });
    }

    // Process the uploaded file here
    const file = req.file; // This contains the uploaded file details

    if (!file) {
      console.error('No file uploaded.');
      return res.status(400).json({ error: true, message: 'No file uploaded' });
    }

    const fileName = file.originalname;
    const email = req.session.email; // Assuming you have the user's email in the session

    // Perform the S3 upload
    const s3 = new AWS.S3({
      accessKeyId: process.env.AwsAccessKeyId,
      secretAccessKey: process.env.AwsSecretAccessKey,
      region: "us-east-1",
    });

    const params = {
      Bucket: process.env.bucketName,
      Key: `${email}/${fileName}`, // Use a unique key for the S3 object, e.g., user's email + file name
      Body: file.buffer,
      ContentType: 'application/pdf', // Adjust the content type as needed
    };

    s3.upload(params, async (s3Err, s3Data) => {
      if (s3Err) {
        console.error('S3 upload error:', s3Err);
        return res.status(500).json({ error: true, message: 'S3 upload failed' });
      }




      // File uploaded to S3 successfully, now store details in DynamoDB
      const fileUrl = s3Data.Location;
      const fileDesc = 'Optional file description'; // You can add a file description if needed

      // Use your createFile function from files.js to add the file to DynamoDB
      const newFile = createFile(email, fileUrl, fileName, fileDesc);

      // Perform DynamoDB put operation
      dynamodb.put(newFile, (dynamoErr, dynamoData) => {
        if (dynamoErr) {
          console.error('DynamoDB error:', dynamoErr);
          return res.status(500).json({ error: true, message: 'DynamoDB operation failed' });
        }

        // File details stored in DynamoDB successfully
        console.log('File uploaded and stored in S3 and DynamoDB.');
        res.status(200).json({ success: true, message: 'File uploaded successfully' });
      });
    });
  });
};


// Update user information in DynamoDB
exports.update = (req, res) => {
  const { email, newName, newPassword } = req.body;

  if (!email || (!newName && !newPassword)) {
    res.status(400).send({ message: 'Email and at least one of newName or newPassword are required in the request body' });
    return;
  }

  const params = {
    TableName: 'users',
    Key: {
      email: email,
    },
    UpdateExpression: 'set #n = :n, #p = :p',
    ExpressionAttributeNames: {
      '#n': 'name',
      '#p': 'password',
    },
    ExpressionAttributeValues: {
      ':n': newName || null,
      ':p': newPassword || null,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  docClient.update(params, (err, data) => {
    if (err) {
      console.error('Unable to update user:', JSON.stringify(err, null, 2));
      res.status(500).send({ error: true, message: 'Unable to update user' });
    } else {
      console.log('UpdateItem succeeded:', JSON.stringify(data, null, 2));
      res.status(200).send({ success: true, message: 'User updated successfully' });
    }
  });
};

// Find users in DynamoDB
exports.find = (req, res) => {
  const params = {
    TableName: 'users',
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      console.error('Unable to scan table:', JSON.stringify(err, null, 2));
      res.status(500).send({ error: true, message: 'Unable to fetch users' });
    } else {
      console.log('Scan succeeded:', JSON.stringify(data, null, 2));
      res.status(200).json({ success: true, users: data.Items });
    }
  });
};


//Delete file


// ... Other existing code

// Delete file
exports.deleteFile = (req, res) => {
  const email = req.query.email; // Get the email from the query parameters
  const fileUrl = req.query.url; // Get the file URL from the query parameters

  if (!email || !fileUrl) {
    return res.status(400).json({ error: true, message: 'Email and File URL are required for deletion' });
  }

  // AWS S3 configuration
  const s3 = new AWS.S3({
    accessKeyId: process.env.AwsAccessKeyId,
    secretAccessKey: process.env.AwsSecretAccessKey,
    region: 'us-east-1',
  });

  // Define the S3 delete parameters
  const s3Params = {
    Bucket: process.env.bucketName,
    Key: fileUrl, // Use the file's URL as the key
  };

  // Delete the file from AWS S3
  s3.deleteObject(s3Params, (s3Err, s3Data) => {
    if (s3Err) {
      console.error('S3 file deletion error:', s3Err);
      return res.status(500).json({ error: true, message: 'S3 file deletion failed' });
    }

    // AWS DynamoDB configuration
    const docClient = new AWS.DynamoDB.DocumentClient();

    // Define the DynamoDB delete parameters
    const dynamoParams = {
      TableName: 'files', // Your DynamoDB table name
      Key: {
        email: email, // Delete based on email
      },
    };

    // Delete the file record from DynamoDB
    docClient.delete(dynamoParams, (dynamoErr, dynamoData) => {
      if (dynamoErr) {
        console.error('DynamoDB file deletion error:', dynamoErr);
        return res.status(500).json({ error: true, message: 'DynamoDB file deletion failed' });
      }

      // Return a response indicating successful deletion
      res.status(200).json({ success: true, message: 'File deleted successfully' });
    });
  });
};

// ... Other existing code



// Logout and clear session
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      res.status(500).send({ error: true, message: 'Unable to logout' });
    } else {
      console.log('Session destroyed');
      res.redirect('/');
    }
  });
};

// Delete user from DynamoDB
exports.delete = (req, res) => {
  const email = req.query.email;

  if (!email) {
    res.status(400).send({ message: 'Email parameter is required' });
    return;
  }

  const params = {
    TableName: 'users',
    Key: {
      email: email,
    },
  };

  docClient.delete(params, (err, data) => {
    if (err) {
      console.error('Error deleting user:', err);
      res.status(500).send({ error: true, message: 'Unable to delete user' });
    } else {
      console.log('DeleteItem succeeded:', JSON.stringify(data, null, 2));
      res.status(200).send({ success: true, message: 'User deleted successfully' });
    }
  });
};