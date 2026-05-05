import jwt from 'jsonwebtoken';

export const TEST_SECRET = 'test-secret-key-for-testing-only';

export const makeToken = (userId = 'user-id', role: 'COUNSELOR' | 'ADMIN' = 'COUNSELOR') =>
  jwt.sign({ userId, role }, TEST_SECRET, { expiresIn: '1h' });

export const counselorToken = () => makeToken('counselor-id', 'COUNSELOR');
export const adminToken = () => makeToken('admin-id', 'ADMIN');
