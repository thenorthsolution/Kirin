const { rmSync } = require("fs");

rmSync("modules/", { force: true, recursive: true });
