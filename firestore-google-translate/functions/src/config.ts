export default {
  languages: process.env.LANGUAGES.split(","),
  location: process.env.LOCATION,
  messageFieldName: process.env.MESSAGE_FIELD_NAME,
  translationsFieldName: process.env.TRANSLATIONS_FIELD_NAME,
};
