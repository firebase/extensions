module.exports = async function() {
  process.env = Object.assign(process.env, {
    LOCATION: "europe-west2",
    MAILCHIMP_API_KEY: "123456-789",
    MAILCHIMP_AUDIENCE_ID: "123456789",
    MAILCHIMP_CONTACT_STATUS: "pending",
  });
};
