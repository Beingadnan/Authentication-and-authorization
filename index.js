const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const multerconfig = require("./config/multerconfig");
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Route to render home page
app.get("/", (req, res) => {
  res.render("index");
});

// Registration route
app.post("/register", async (req, res) => {
  const { email, password, username, name, age } = req.body;

  let user = await userModel.findOne({ email });
  if (user) return res.send("Already Registered");

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await userModel.create({
        email,
        password: hash,
        username,
        name,
        age,
      });
      let token = jwt.sign({ email: email, userId: user._id }, "shhhhh");
      res.cookie("token", token); // Fixing the token cookie
      res.redirect("/login");
    });
  });
});

// Login page route
app.get("/login", (req, res) => {
  res.render("login");
});

// Login route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  let user = await userModel.findOne({ email });
  if (!user) return res.send("Something went wrong");

  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: email, userId: user._id }, "shhhhh");
      res.cookie("token", token);
      res.redirect("/profile");
    } else {
      res.redirect("/login");
    }
  });
});

// Profile route protected by middleware
app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }).populate("posts");
  res.render("profile", { user });
});

// Like
app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  if (post.likes.indexOf(req.user.userId) === -1) {
    post.likes.push(req.user.userId);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userId), 1);
  }
  await post.save();
  res.redirect("/profile");
});

// Edit
app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  res.render("edit", { post });
});

app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content }
  );
  res.redirect("/profile");
});

app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;
  let post = await postModel.create({
    user: user._id,
    content,
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

// Logout route
app.get("/logout", (req, res) => {
  res.cookie("token", ""); // Clear the token cookie
  res.redirect("/login");
});

// Upload route
app.get("/profile/upload", (req, res) => {
  res.render("upload");
});

app.post("/upload", isLoggedIn, multerconfig.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }

  let user = await userModel.findOne({ email: req.user.email });
  user.profilepic = req.file.filename; // Saving the uploaded file's name
  await user.save();
  res.redirect("/profile");
});

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

  try {
    const data = jwt.verify(token, "shhhhh");
    req.user = data;
    next();
  } catch (err) {
    res.status(401).send("Invalid or expired token");
  }
}

// Start the server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
