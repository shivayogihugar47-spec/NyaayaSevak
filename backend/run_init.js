const { initDB } = require("./services/db");
initDB().then(() => {
  console.log("Done");
  process.exit(0);
});
