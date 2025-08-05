// functions/seedAdminConfig.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.seedAdminConfig = functions.https.onRequest(async (req, res) => {
  // Richte deinen Admin-FCM-Token hier ein (oder übergebe ihn per POST im Body)
  const fcmToken = req.body.fcmToken || "<HIER_DEIN_ADMIN_FCM_TOKEN>";
  if (!fcmToken) {
    res.status(400).send("Missing fcmToken");
    return;
  }

  try {
    await admin.firestore()
      .collection("admin")
      .doc("config")
      .set({ fcmToken }, { merge: true });
    console.log("✅ Admin-Config erfolgreich gesetzt:", fcmToken);
    res.send("Admin-Config erfolgreich gesetzt");
  } catch (error) {
    console.error("❌ Fehler beim Setzen der Admin-Config:", error);
    res.status(500).send("Error seeding admin config");
  }
});