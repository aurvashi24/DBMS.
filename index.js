// 📌 Import Required Modules
const express = require('express');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const path = require('path');

// Create Express app instance
const app = express();

// 📌 Middleware Setup
app.use(methodOverride('_method')); // Enables PUT & DELETE requests from forms
app.set('view engine', 'ejs'); // Using EJS for templating
app.set('views', path.join(__dirname, 'views')); // Set views directory
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (CSS, JS)
app.use(express.urlencoded({ extended: true })); // Parse form data

// 📌 Import Models
const Chat = require('./model/chat');
const User = require("./usermodel");

// 📌 Error Handling Utility
const ExpressError = require("./ExpressError");

// 📌 Authentication Dependencies
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
app.use(cookieParser()); // Enable cookie parsing

// ----------------------------------------------------------------------------------
// ✅ 1️⃣ DATABASE CONNECTION - Connect to MongoDB
// ----------------------------------------------------------------------------------
async function connectDB() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/myapp');
        console.log("✅ Connected to MongoDB successfully");
    } catch (error) {
        console.error("❌ Error connecting to MongoDB:", error);
    }
}
connectDB();

// ----------------------------------------------------------------------------------
// ✅ 2️⃣ HELPER FUNCTIONS - Commonly used utilities
// ----------------------------------------------------------------------------------

// 🔹 Error Handling Wrapper for Async Functions
const wrapAsync = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// 🔹 Function to Create JWT Token for User Authentication..and make user login in session(browser)
const createSecretToken = (id) => {
    return jwt.sign({ id }, 'my_super_secret_key', { expiresIn: 3 * 24 * 60 * 60 }); // Token expires in 3 days
};

// ----------------------------------------------------------------------------------
// ✅ 3️⃣ AUTHENTICATION SYSTEM - User Signup, Login, Logout
// ----------------------------------------------------------------------------------

// 🔹 Middleware to Store Logged-in User in `req.Curruser`
app.use(async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) return next(); // No token → User is not logged in

        jwt.verify(token, "my_super_secret_key", async (err, data) => {
            if (err) return next(); // Invalid token → Proceed as guest user
            const loggedUser = await User.findById(data.id);
            if (loggedUser) req.Curruser = loggedUser;
            next();
        });
    } catch (error) {
        next(error);
    }
});

// 🔹 Show Signup Form
app.get("/signup", (req, res) => {
    if (req.Curruser) return res.send("You are already signed up and logged in!");
    res.render('sighnup.ejs');
});

// 🔹 Handle Signup Form Submission
app.post("/signup", wrapAsync(async (req, res) => {
    const { username, email, password } = req.body;

    // Check if user already exists
    if (await User.findOne({ email })) {
        return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const newUser = await User.create({ email, password, username });
    const token = createSecretToken(newUser._id); //make currently signup user logged in the session mean starts his session
    
    res.cookie("token", token, { httpOnly: false });
    res.redirect("/");
}));

// 🔹 Show Login Form
app.get("/login", (req, res) => {
    if (req.Curruser) return res.send("You are already logged in!");
    res.render("login.ejs");
});

// 🔹 Handle Login Form Submission
app.post("/login", wrapAsync(async (req, res) => {
    const { email, password } = req.body;

    // Validate credentials
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.json({ message: 'Incorrect email or password' });
    }

    // Generate Token & Set Cookie
    const token = createSecretToken(user._id);
    res.cookie("token", token, { httpOnly: false });
    res.redirect("/");
}));

// 🔹 Logout: Clear Token Cookie
app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect("/");
});

// ----------------------------------------------------------------------------------
// ✅ 4️⃣ CHAT SYSTEM - CRUD Operations for Messages
// ----------------------------------------------------------------------------------

// 🔹 Show All Chats on Home Page
app.get('/', wrapAsync(async (req, res) => {
    const data = await Chat.find().populate("owner").exec();
    res.render("home.ejs", { data, curruser: req.Curruser });
}));

// 🔹 Show Form to Create New Chat (Only for Logged-in Users)
app.get('/newchat', (req, res) => {
    if (!req.Curruser) return res.send("Please login first!");
    res.render("newchat.ejs");
});

// 🔹 Submit a New Chat Message
app.post('/submitchat', wrapAsync(async (req, res) => {
    if (!req.Curruser) return res.send("Please login to send messages!");

    const { to, from, msg } = req.body;
    const newChat = new Chat({ to, from, msg, created_at: new Date(), owner: req.Curruser._id });

    await newChat.save();
    res.redirect("/");
}));

// 🔹 Show Edit Form for a Chat Message (Only for Message Owner)
app.get("/edit/:id", wrapAsync(async (req, res) => {
    const chatMsg = await Chat.findById(req.params.id);

    if (!chatMsg.owner.equals(req.Curruser._id)) {//this is how well doing authrization here like in session we does
        return res.send("You do not have permission to edit this message!");
    }

    res.render("editfrom.ejs", { data: chatMsg });
}));

// 🔹 Submit Edited Chat Message
app.patch("/edited/:id", wrapAsync(async (req, res) => {
    await Chat.findByIdAndUpdate(req.params.id, { msg: req.body.msg, updated_at: new Date() });
    res.redirect("/");
}));

// 🔹 Delete a Chat Message (Only for Message Owner)
app.delete("/delete/:id", wrapAsync(async (req, res) => {
    const chatMsg = await Chat.findById(req.params.id);

    if (!chatMsg.owner.equals(req.Curruser._id)) {
        return res.send("You do not have permission to delete this message!");
    }

    await Chat.findByIdAndDelete(req.params.id);
    res.redirect("/");
}));

// ----------------------------------------------------------------------------------
// ✅ 5️⃣ ERROR HANDLING - Catching Invalid Routes & Server Errors
// ----------------------------------------------------------------------------------

// 🔹 Handle 404 Errors (Page Not Found)
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found ❌"));
});

// 🔹 Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.log(err); // Log error for debugging
    const { status = 500, message = "Something went wrong!" } = err;
    res.status(status).send(message);
});

// ----------------------------------------------------------------------------------
// ✅ 6️⃣ START THE SERVER - Listen on Port 5000
// ----------------------------------------------------------------------------------
app.listen(5000, () => {
    console.log('🚀 Server is running on port 5000');
});
