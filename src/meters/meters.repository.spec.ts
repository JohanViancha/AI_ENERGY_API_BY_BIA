import type { FirebaseService } from '../firebase/firebase.service';
import { MetersRepository } from './meters.repository';

describe('MetersRepository', () => {
  it('listAll returns all meters mapped from the Firestore docs', async () => {
    const docs = [
      { data: () => ({ meter_id: 'M-001' }) },
      { data: () => ({ meter_id: 'M-002' }) },
    ];
    const get = jest.fn().mockResolvedValue({ docs });
    const collection = jest.fn().mockReturnValue({ get });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new MetersRepository(firebaseService);
    const result = await repository.listAll();

    expect(collection).toHaveBeenCalledWith('meters');
    expect(result).toEqual([{ meterId: 'M-001' }, { meterId: 'M-002' }]);
  });

  it('listAll returns an empty array when the collection is empty', async () => {
    const get = jest.fn().mockResolvedValue({ docs: [] });
    const collection = jest.fn().mockReturnValue({ get });
    const firebaseService = {
      getFirestore: jest.fn().mockReturnValue({ collection }),
    } as unknown as FirebaseService;

    const repository = new MetersRepository(firebaseService);
    const result = await repository.listAll();

    expect(result).toEqual([]);
  });

  describe('findById', () => {
    it('retorna el medidor cuando el documento existe', async () => {
      const getFn = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ meter_id: 'M-001' }),
      });
      const docFn = jest.fn().mockReturnValue({ get: getFn });
      const collection = jest.fn().mockReturnValue({ doc: docFn });
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new MetersRepository(firebaseService);
      const result = await repository.findById('M-001');

      expect(collection).toHaveBeenCalledWith('meters');
      expect(docFn).toHaveBeenCalledWith('M-001');
      expect(result).toEqual({ meterId: 'M-001' });
    });

    it('retorna null cuando el medidor no existe', async () => {
      const getFn = jest.fn().mockResolvedValue({ exists: false });
      const docFn = jest.fn().mockReturnValue({ get: getFn });
      const collection = jest.fn().mockReturnValue({ doc: docFn });
      const firebaseService = {
        getFirestore: jest.fn().mockReturnValue({ collection }),
      } as unknown as FirebaseService;

      const repository = new MetersRepository(firebaseService);
      const result = await repository.findById('M-inexistente');

      expect(result).toBeNull();
    });
  });
});
