import { Router } from 'express';
import { login, me } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { LoginSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/login', validateRequest(LoginSchema), login);
router.get('/me', authenticate, me);

export default router;
