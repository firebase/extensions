module.exports = async function() {
  process.env = Object.assign(process.env, {
    LOCATION: "europe-west2",
    MAIL_COLLECTION: "",
    SMTP_CONNECTION_URI: "",
    DEFAULT_FROM: "",
    DEFAULT_REPLY_TO: "",
    USERS_COLLECTION: "",
    TEMPLATES_COLLECTION: "",
  });
};
