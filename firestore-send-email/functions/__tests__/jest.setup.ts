process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

global.config = () => require("../src/config").default;
