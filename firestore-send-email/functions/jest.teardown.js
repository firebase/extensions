module.exports = async function() {
  delete process.env.LOCATION;
  delete process.env.MAIL_COLLECTION;
  delete process.env.SMTP_CONNECTION_URI;
  delete process.env.SMTP_SERVER_HOST_AND_PORT;
  delete process.env.SMTP_SERVER_SSL;
  delete process.env.SMTP_EMAIL;
  delete process.env.SMTP_PASSWORD;
  delete process.env.DEFAULT_FROM;
  delete process.env.DEFAULT_REPLY_TO;
  delete process.env.USERS_COLLECTION;
  delete process.env.TEMPLATES_COLLECTION;
};
