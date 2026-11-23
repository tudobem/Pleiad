import { memoryStorage } from './memoryStorage.ts';
import { storageContract } from './storageContract.test-util.ts';

storageContract('memory', async () => memoryStorage());
