#!/usr/bin/env node
const admin = require('../src/auth/admin.service');

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'create': {
      const [name, ...scopes] = args;
      const result = await admin.createClient(name, scopes);
      console.log(`client_id=${result.publicId}`);
      console.log(`client_secret=${result.secret}`);
      break;
    }
    case 'list':
      console.table(await admin.listClients());
      break;
    case 'rotate': {
      const result = await admin.rotateSecret(args[0]);
      console.log(`client_id=${result.publicId}`);
      console.log(`client_secret=${result.secret}`);
      break;
    }
    case 'revoke-secret':
      await admin.revokeSecret(args[0], args[1]);
      break;
    case 'suspend':
      await admin.changeClientStatus(args[0], 'SUSPENDED');
      break;
    case 'activate':
      await admin.changeClientStatus(args[0], 'ACTIVE');
      break;
    case 'revoke':
      await admin.changeClientStatus(args[0], 'REVOKED');
      break;
    case 'grant-scope':
      await admin.grantScope(args[0], args[1]);
      break;
    case 'revoke-scope':
      await admin.revokeScope(args[0], args[1]);
      break;
    default:
      throw new Error('Uso: create <name> <scope...> | list | rotate <client-id> | revoke-secret <client-id> <secret-id> | suspend|activate|revoke <client-id> | grant-scope|revoke-scope <client-id> <scope>');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
