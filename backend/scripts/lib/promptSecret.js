/**
 * Reads a secret from the terminal without echoing it.
 *
 * readline echoes everything it receives, so a password typed at a readline
 * prompt lands in the terminal scrollback. This reads the raw stream instead,
 * which keeps the value out of the screen, the shell history, and argv.
 */
const promptSecret = (question) => new Promise((resolve, reject) => {
  if (!process.stdin.isTTY) {
    reject(new Error('A terminal is required so the secret is never echoed or stored'));
    return;
  }

  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  let value = '';
  const finish = (fn, argument) => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeListener('data', onData);
    process.stdout.write('\n');
    fn(argument);
  };

  function onData(chunk) {
    for (const char of chunk) {
      if (char === '\n' || char === '\r') return finish(resolve, value);
      if (char === '\u0003' || char === '\u0004') return finish(reject, new Error('Cancelled'));
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
        continue;
      }
      value += char;
    }
    return undefined;
  }

  process.stdin.on('data', onData);
});

module.exports = { promptSecret };
