/**
 * Minimal HTTP harness for the security regression suite.
 *
 * The suite exercises the real Express app over a real socket so middleware
 * ordering, headers, and status codes are observed exactly as a client sees
 * them. No MongoDB is required: tests that reach a controller stub the model
 * method the controller calls.
 */
const http = require('node:http');

const startApp = async (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const send = (server, { method = 'GET', path = '/', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  // Real clients never attach a body to GET/HEAD, and the CORS layer rejects
  // one with a 400 before authentication runs. Dropping it here keeps each
  // assertion about the control under test.
  const omitBody = body === undefined || ['GET', 'HEAD'].includes(method.toUpperCase());
  const payload = omitBody
    ? null
    : (typeof body === 'string' ? body : JSON.stringify(body));

  const requestHeaders = { ...headers };
  if (payload !== null && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const req = http.request({
    hostname: '127.0.0.1',
    port: server.address().port,
    method,
    path,
    headers: requestHeaders,
  }, (res) => {
    let raw = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { raw += chunk; });
    res.on('end', () => {
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch (_err) {
        parsed = null;
      }
      resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw });
    });
  });

  req.on('error', reject);
  if (payload !== null) req.write(payload);
  req.end();
});

module.exports = { startApp, send };
