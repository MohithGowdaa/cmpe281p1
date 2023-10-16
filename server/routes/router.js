const express = require('express');
const router = express.Router();

const renderServices = require('../services/render');
const controller = require('../controller/controller');

// Define routes using appropriate HTTP methods and controller functions
router.get('/', renderServices.homeRoutes);
router.get('/add-user-route', renderServices.addUser);
router.get('/dashboard', renderServices.dashboard);
router.get('/index', renderServices.homeRoutes);

// Routes for API methods dealing with the database
router.post('/upload', controller.upload);
router.post('/login', controller.login);
router.post('/api/users', controller.create);
router.put('/api/users/:id', controller.update); // Use PUT for updates
router.get('/api/users', controller.find);
router.get('/logout', controller.logout);
router.delete('/api/users/:id', controller.delete); // Use DELETE for resource deletion
router.post('/upload', controller.uploadFile);
router.get('/delete-file', controller.deleteFile);


module.exports = router;