// ========================================
// SHARED UID GENERATOR — Blum
//
// generateUID(prefix) → prefix_16hexchars
//
// Used by room server, home OS, and all home modules.
// Every piece of recorded data gets a UID.
//
// Prefix registry:
//   msg    — room messages          (room server)
//   op     — room operations        (room server)
//   uid    — participant UIDs       (room server)
//   room   — room UIDs             (room server)
//   disp   — dispatch batches       (room server)
//   cycle  — processing cycles      (home.js)
//   doc    — boot documents         (boot assembler)
//   ctx    — context messages       (context manager)
//   resp   — nucleus responses      (home.js)
//   entry  — homelogfull entries    (router)
//   parse  — output parse results   (output processor)
//   blk    — output blocks          (output processor)
//   iter   — tool loop iterations   (home.js)
// ========================================

const crypto = require('crypto');

function generateUID(prefix) {
  return prefix + '_' + crypto.randomBytes(8).toString('hex');
}

module.exports = { generateUID };
