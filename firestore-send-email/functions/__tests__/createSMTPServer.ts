const SMTPServer = require("smtp-server").SMTPServer;

export const smtpServer = () => {
  const server = new SMTPServer({
    secure: false,
    authOptional: true,
    closeTimeout: 1000,
    onData(stream, session, callback) {
      stream.pipe(process.stdout); // print message to console
      stream.on("end", () => {
        callback(null, "Message accepted");
      });
    },
  });
  const port = 465;
  const host = "localhost";

  server.listen(port, () => console.log(`Server listening on ${host}:${port}`));

  return server;
};
