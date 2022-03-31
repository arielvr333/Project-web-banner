'use strict';
if(process.env.NODE_ENV !== 'production')
    require('dotenv').config()
const path = require('path');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 8080;
var MongoClient = require('mongodb').MongoClient;
const { connect } = require('net');
var url = "mongodb://0.0.0.0:27017";
app.use(express.static(__dirname + '/views'));
app.set('view-engine', 'ejs')
app.use(express.urlencoded({extended: false}))
var assert = require('assert');
const users = [];
const passport = require('passport');
const initializePassport = require('./passport-config');
const flash = require('express-flash');
const session = require('express-session');
app.set('view engine', 'hbs');
const methodOverride = require('method-override')
app.use(methodOverride('_method'))
initializePassport(
    passport,
    UserName => users.find(user => user.UserName === UserName),
    id => users.find(user => user.id === id)
)
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

MongoClient.connect(url, function (err, db) {
    if (err) throw err;
    var dbo = db.db("MongoDataBase");
    dbo.dropDatabase(function (err, result) {if (err) throw err;});
    dbo.createCollection("advertisements", function (err, res) { if (err) throw err; });
    dbo.createCollection("usersData", function (err, res) { if (err) throw err; });
    var screen1 = [
        { _id: "1", address: './a1.jpg', title: 'Daipers - best thing for your child !' },
        { _id: "2", address: './a2.jpg', title: 'Similac - best food for your baby' }
    ];
    var screen2 = [
        { _id: "1", address: './b1.jpg', title: 'Vacation in new york, luxury hotels starting from 100$ ' },
        { _id: "2", address: './a1.jpg', title: 'Daipers - best thing for your child !' }
    ];
    var screen3 = [
        { _id: "1", address: './e1.jpg', title: 'Vacation in Dubai- book your flight now!' },
        { _id: "2", address: './e2.jpg', title: 'join our journey to the forest only for 29.99$' },
        { _id: "3", address: './a2.jpg', title: 'Similac - best food for your baby' }
    ];
    var myobj = [
        { _id: "screen-1", screen: screen1, interval: 2000 },
        { _id: "screen-2", screen: screen2, interval: 1500 },
        { _id: "screen-3", screen: screen3, interval: 2500 }
    ];
    dbo.collection("advertisements").insertMany(myobj, function (err, res) { if (err) throw err; });
    const admin = {id: "1", UserName: "admin", password: '1234'}
    dbo.collection("usersData").insertOne(admin, function (err, res) { if (err) throw err; });
    dbo.close;
});

app.get('/', function (req, res) {
    DbActionDocumentation(req,"Home Page")
    res.sendFile(path.join(__dirname, '/homePage.html'));
});

app.get('/Admin', checkAuthenticated,(req,res) =>{
    res.render('index')
})

app.get('/login', (req, res) => {
    MongoClient.connect(url, function (err, db) {
        var dbo = db.db("MongoDataBase");
        var usersData = dbo.collection('usersData').find();
        usersData.forEach(function (doc, err) {
            users.push(doc);
        });
    });
    res.render('login.ejs')
    DbActionDocumentation(req, "log-in")
})

app.post('/login', passport.authenticate('local', {
    successRedirect: '/Admin',
    failureRedirect: '/login',
    failureFlash: true
}))

io.on('connection', function (socket) {
    socket.on('setup', function (screenName) {
        MongoClient.connect(url, function (err, db) {
            var dbo = db.db("MongoDataBase");
            var query = { _id: screenName };
            dbo.collection("advertisements").find(query).toArray(function (err, result) {
                if (err) throw err;
                socket.emit('getData', result);
            });
        });
    });
});

function DbActionDocumentation(req, Action) {
    var idAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    idAddress = idAddress.split(':').slice(-1)[0];
    var datetime = new Date().toString().slice(0, 24);
    MongoClient.connect(url, function (err, db) {
        var dbo = db.db("MongoDataBase");
        dbo.collection("usersData").find({ user: idAddress}).toArray(function (err, result) {
            if (err) throw err;
            var size = Object.keys(result).length;
            if (size == 0) {
                var obj = { user: idAddress, action: "connection", time: datetime };
                dbo.collection("usersData").insertOne(obj, function (err, res) { if (err) throw err; });
            }
        });

        var obj = { user: idAddress, action: Action, time: datetime };
        dbo.collection("usersData").insertOne(obj, function (err, res) { if (err) throw err; });
    });
}

app.get('/screen-1', function (request, response) {
    response.sendFile(path.join(__dirname, '/adsScreen.html'));
    DbActionDocumentation(request, 'screen-1')
});

app.get('/screen-2', function (request, response) {
    response.sendFile(path.join(__dirname, '/adsScreen.html'));
    DbActionDocumentation(request, 'screen-2')
});

app.get('/screen-3', function (request, response) {
    response.sendFile(path.join(__dirname, '/adsScreen.html'));
    DbActionDocumentation(request, 'screen-3')
});

server.listen(port);
console.log(` http://127.0.0.1:${port}`);

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }
    res.redirect('/login')
}

app.post('/insert', function (req, res, next) {
    var item = {
        title: req.body.title,
        address: req.body.address,
        _id: req.body.Id
    };
    var screenId = req.body.Commercials;
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        var dbo = db.db("MongoDataBase");
        var cursor = dbo.collection('advertisements').find({ _id: screenId });
        cursor.forEach(function (doc, err) {
            doc.screen.push(item)
            dbo.collection('advertisements').updateOne({ "_id": screenId, }, { $set: doc }, function (err, result) {
                assert.equal(null, err);
            });
            assert.equal(null, err);
        });
    });
    res.redirect('/Admin');
});

app.post('/update', function(req, res) {
    var item = {
        title: req.body.title,
        address: req.body.address,
        _id: req.body.id
    };
    var screenId = req.body.Commercials;
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        var dbo = db.db("MongoDataBase");
        var cursor = dbo.collection('advertisements').find({ _id: screenId });
        cursor.forEach(function (doc, err) {
            doc.screen.splice(doc.screen.findIndex(function(i){
                return i._id === item._id;
            }), 1);
            doc.screen.push(item);
            dbo.collection('advertisements').updateOne({ "_id": screenId, }, { $set: doc }, function (err, result) {
                assert.equal(null, err);
            });
            assert.equal(null, err);
        });
    });
    res.redirect('/Admin');
});

app.get('/get-intervals', checkAuthenticated, function (req, res) {
    var resultArray = [];
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        var dbo = db.db("MongoDataBase");
        var cursor = dbo.collection('advertisements').find();
        cursor.forEach(function (doc, err) {
            resultArray.push(doc);
            assert.equal(null, err);
        }, function () {
            res.render('index', { Intervals: resultArray });
        });
    });
});

app.post('/Interval', function(req, res) {
    var Interval =parseInt(req.body.Interval);
    var screenId = req.body.Commercials;
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        var dbo = db.db("MongoDataBase");
        var cursor = dbo.collection('advertisements').find({ _id: screenId });
        cursor.forEach(function (doc, err) {
        doc.interval=Interval;
            dbo.collection('advertisements').updateOne({ "_id": screenId, }, { $set: doc }, function (err, result) {
                assert.equal(null, err);              
            });
        });
        res.redirect('/Admin');
    });
});

app.post('/delete', function(req, res) {
    var id = req.body.Id;
    var screenId = req.body.Commercials;
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        var dbo = db.db("MongoDataBase");
        var cursor = dbo.collection('advertisements').find({ _id: screenId });
        cursor.forEach(function (doc, err) {
            doc.screen.splice(doc.screen.findIndex(function(i){
                return i._id === id;
            }), 1);
            dbo.collection('advertisements').updateOne({ "_id": screenId, }, { $set: doc }, function (err, result) {
                assert.equal(null, err);              
            });
            assert.equal(null, err);
        });
        res.redirect('/Admin');
      });
    });

app.get('/get-data', function (req, res) {
    var resultArray = [];
    var screenId = req.query.Commercials ;
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        var dbo = db.db("MongoDataBase");
        var cursor = dbo.collection('advertisements').find({ _id: screenId});
        cursor.forEach(function (doc, err) {
            doc.screen.forEach(function (Ad, err) {
                resultArray.push(Ad);
            });
            assert.equal(null, err);
        }, function () {
            db.close();
            res.render('index', { items: resultArray });
        });
    });
});

app.post('/changeAdmin', function(req, res) {
    var item = {
        id: "1",
        UserName: req.body.Newusername,
        password: req.body.Newpassword
    };
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        var dbo = db.db("MongoDataBase");
        dbo.collection('usersData').updateOne({ "id": item.id, }, { $set: item }, function (err, result) {assert.equal(null, err);});
    });
    req.logOut();
    res.redirect('/login');
});

app.get('/get-usersConnected', checkAuthenticated, function (req, res) {
    var resultArray = [];
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        var dbo = db.db("MongoDataBase");
        var cursor = dbo.collection('usersData').find();
        cursor.forEach(function (doc, err) {
            if(doc.id!=1)
                resultArray.push(doc);
            assert.equal(null, err);
        }, function () {
            db.close();
            res.render('index', { History: resultArray });
        });
    });
});

app.delete('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
  })

module.exports = app;