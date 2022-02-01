const express = require("express");
const path = require("path");
const app = express();

app.use("/", (_, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
});

app.use(express.static(path.join(__dirname, "./public")));

const PORT = 5501;
app.listen(PORT, () => console.log(`listening on port ${PORT}: ${`http://localhost:${PORT}`}`));
