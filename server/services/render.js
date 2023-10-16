exports.homeRoutes=(req,res) =>{
    res.render('index');
}

exports.addUser=(req,res) =>{
    res.render('add_user');
}

exports.dashboard=(req,res) =>{
    // console.log(req);
    res.render('dashboard');
}
