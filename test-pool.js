import { Connection, PublicKey } from '@solana/web3.js';

async function testPool() {
  try {
    console.log('Testing pool connection...');

    const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=58bf8ac6-817c-4236-b619-eed88a318452');

    console.log('Getting pool account info...');
    const poolAccount = await connection.getAccountInfo(new PublicKey('5aEG1Vv4dJE5MiFqLTXrvVJPVD5g2d2FgK7vPco2KHfJ'));

    if (poolAccount) {
      console.log('✅ Pool account found!');
      console.log('Account owner:', poolAccount.owner.toString());
      console.log('Account data length:', poolAccount.data.length);
    } else {
      console.log('❌ Pool account not found');
    }

    console.log('Getting current slot...');
    const slot = await connection.getSlot();
    console.log('Current slot:', slot);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error type:', typeof error);
    console.error('Full error:', error);
  }
}

testPool();
