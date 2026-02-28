const SMTPServer = require("smtp-server").SMTPServer;

export const smtpServer = () => {
  const server = new SMTPServer({
    secure: false,
    authOptional: true,
    closeTimeout: 1000,
    ignoreTLS: true,
    onData(stream, session, callback) {
      stream.pipe(process.stdout); // print message to console
      stream.on("end", () => {
        callback(null, "Accepted");
      });
    },
  });

  const port = 8132;
  const host = "127.0.0.1";

  server.listen(port, () => console.log(`Server listening on ${host}:${port}`));

  return server;
};
