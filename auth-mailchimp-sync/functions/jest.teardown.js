module.exports = async function() {
  delete process.env.LOCATION;
  delete process.env.MAILCHIMP_API_KEY;
  delete process.env.MAILCHIMP_AUDIENCE_ID;
  delete process.env.MAILCHIMP_CONTACT_STATUS;
};
